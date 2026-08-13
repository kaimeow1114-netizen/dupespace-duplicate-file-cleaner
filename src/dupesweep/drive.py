from __future__ import annotations

import json
import os
import threading
import time
from collections.abc import Callable, Iterable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

from .grouping import build_duplicate_groups
from .models import ActionOutcome, ActionReport, FileRecord, ProgressUpdate, ScanReport

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder"
GOOGLE_SHORTCUT_MIME = "application/vnd.google-apps.shortcut"
BATCH_LIMIT = 100

ProgressCallback = Callable[[ProgressUpdate], None]


class DriveDependencyError(RuntimeError):
    pass


class DriveAuthenticationError(RuntimeError):
    pass


class DriveScanCancelled(RuntimeError):
    pass


def app_data_dir() -> Path:
    base = os.getenv("LOCALAPPDATA")
    if base:
        return Path(base) / "DupeSweep"
    return Path.home() / ".dupesweep"


def default_token_path() -> Path:
    return app_data_dir() / "token.json"


def _emit(
    callback: ProgressCallback | None,
    stage: str,
    current: int,
    total: int | None,
    message: str,
) -> None:
    if callback:
        callback(ProgressUpdate(stage, current, total, message))


def _timestamp(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _load_google_modules() -> tuple[Any, Any, Any, Any]:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError as error:  # pragma: no cover - installation guard
        raise DriveDependencyError(
            "Google Drive dependencies are missing. Run: python -m pip install -e ."
        ) from error
    return Request, Credentials, InstalledAppFlow, build


def build_drive_service(
    credentials_path: str | os.PathLike[str],
    *,
    token_path: str | os.PathLike[str] | None = None,
) -> Any:
    """Authorize an installed app and build a Drive v3 service.

    The OAuth client secret is supplied by the user. The refresh token is stored in the
    per-user application data directory, never in the repository.
    """

    credentials_file = Path(credentials_path).expanduser().resolve(strict=False)
    if not credentials_file.is_file():
        raise DriveAuthenticationError(f"找不到 OAuth 憑證檔：{credentials_file}")

    try:
        data = json.loads(credentials_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DriveAuthenticationError(f"OAuth 憑證檔無法讀取：{error}") from error
    if not isinstance(data, dict) or "installed" not in data:
        raise DriveAuthenticationError("請使用 Google OAuth Desktop app（installed）JSON 檔")

    Request, Credentials, InstalledAppFlow, build = _load_google_modules()
    token_file = Path(token_path) if token_path else default_token_path()
    creds = None

    if token_file.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(token_file), [DRIVE_SCOPE])
        except (OSError, ValueError):
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as error:  # noqa: BLE001 - normalize auth library errors
                raise DriveAuthenticationError(f"Google 登入權杖更新失敗：{error}") from error
        else:
            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(credentials_file), [DRIVE_SCOPE]
                )
                creds = flow.run_local_server(port=0, open_browser=True)
            except Exception as error:  # noqa: BLE001 - normalize auth library errors
                raise DriveAuthenticationError(f"Google OAuth 登入失敗：{error}") from error

        token_file.parent.mkdir(parents=True, exist_ok=True)
        token_file.write_text(creds.to_json(), encoding="utf-8")

    return build("drive", "v3", credentials=creds, cache_discovery=False)


class GoogleDriveScanner:
    """Scan owned My Drive blobs using checksums returned by Google Drive."""

    FIELDS = (
        "nextPageToken,incompleteSearch,"
        "files(id,name,mimeType,size,md5Checksum,sha256Checksum,createdTime,"
        "modifiedTime,parents,ownedByMe,driveId,version,webViewLink,capabilities(canTrash))"
    )

    def scan(
        self,
        service: Any,
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
        include_shared_drives: bool = False,
    ) -> ScanReport:
        page_token: str | None = None
        records: list[FileRecord] = []
        warnings: list[str] = []
        examined = 0
        skipped = 0
        page_number = 0
        capacity: int | None = None

        try:
            quota = service.about().get(fields="storageQuota").execute(num_retries=3)
            limit = quota.get("storageQuota", {}).get("limit")
            capacity = int(limit) if limit is not None else None
        except Exception as error:  # noqa: BLE001 - quota is optional scan context
            warnings.append(f"無法讀取 Google Drive 容量：{error}")

        while True:
            if cancel_event and cancel_event.is_set():
                raise DriveScanCancelled("Google Drive scan cancelled")
            page_number += 1
            request = service.files().list(
                q="trashed = false",
                spaces="drive",
                corpora="user",
                pageSize=1000,
                pageToken=page_token,
                fields=self.FIELDS,
                supportsAllDrives=True,
                includeItemsFromAllDrives=include_shared_drives,
            )
            response = request.execute(num_retries=3)
            if response.get("incompleteSearch"):
                warnings.append("Google Drive 回報搜尋不完整；請縮小掃描範圍後重試。")

            for item in response.get("files", []):
                examined += 1
                mime_type = item.get("mimeType", "")
                drive_id = item.get("driveId")
                owned_by_me = item.get("ownedByMe") is True
                can_trash = bool(item.get("capabilities", {}).get("canTrash"))
                checksum_value = item.get("sha256Checksum") or item.get("md5Checksum")
                checksum_kind = "sha256" if item.get("sha256Checksum") else "md5"

                if mime_type in {GOOGLE_FOLDER_MIME, GOOGLE_SHORTCUT_MIME}:
                    skipped += 1
                    continue
                if (drive_id and not include_shared_drives) or not owned_by_me:
                    skipped += 1
                    continue
                if not checksum_value or item.get("size") is None:
                    skipped += 1
                    continue

                records.append(
                    FileRecord(
                        key=f"drive:{item['id']}",
                        source="drive",
                        name=item.get("name") or "(未命名)",
                        location=f"Google Drive / {item.get('name') or '(未命名)'}",
                        size=int(item["size"]),
                        checksum=f"{checksum_kind}:{checksum_value}",
                        created_at=_timestamp(item.get("createdTime")),
                        modified_at=_timestamp(item.get("modifiedTime")),
                        metadata_token=str(item.get("version")) if item.get("version") else None,
                        can_trash=can_trash,
                        web_url=item.get("webViewLink"),
                    )
                )

            _emit(
                progress,
                "listing-drive",
                examined,
                None,
                f"已讀取 {examined:,} 個 Google Drive 項目（第 {page_number} 頁）",
            )
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        groups = build_duplicate_groups(records)
        _emit(progress, "complete", examined, examined, "Google Drive 掃描完成")
        return ScanReport(
            source="drive",
            groups=groups,
            examined_files=examined,
            hashed_files=len(records),
            skipped_files=skipped,
            examined_bytes=sum(record.size for record in records),
            storage_capacity_bytes=capacity,
            warnings=tuple(warnings),
        )


def _chunks(records: Sequence[FileRecord], size: int) -> Iterable[Sequence[FileRecord]]:
    for start in range(0, len(records), size):
        yield records[start : start + size]


def _drive_file_id(record: FileRecord) -> str:
    prefix, separator, file_id = record.key.partition(":")
    if prefix != "drive" or not separator or not file_id:
        raise ValueError(f"Invalid Google Drive record key: {record.key}")
    return file_id


class GoogleDriveTrashExecutor:
    """Move files to Drive trash in batches no larger than the API's 100-call limit."""

    def __init__(self, batch_size: int = BATCH_LIMIT, retry_count: int = 3) -> None:
        if not 1 <= batch_size <= BATCH_LIMIT:
            raise ValueError(f"batch_size must be between 1 and {BATCH_LIMIT}")
        self.batch_size = batch_size
        self.retry_count = retry_count

    def trash(
        self,
        service: Any,
        records: Iterable[FileRecord],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        queue = tuple(records)
        outcomes: list[ActionOutcome] = []
        processed = 0

        for chunk in _chunks(queue, self.batch_size):
            if cancel_event and cancel_event.is_set():
                outcomes.extend(
                    ActionOutcome(record, "cancelled", "operation cancelled")
                    for record in queue[processed:]
                )
                break

            chunk_results: dict[str, ActionOutcome] = {}
            chunk_by_key = {record.key: record for record in chunk}

            def callback(
                request_id: str,
                _response: Any,
                exception: Exception | None,
                *,
                records: dict[str, FileRecord] = chunk_by_key,
                results: dict[str, ActionOutcome] = chunk_results,
            ) -> None:
                record = records[request_id]
                if exception is None:
                    results[request_id] = ActionOutcome(record, "trashed")
                else:
                    results[request_id] = ActionOutcome(record, "failed", str(exception))

            batch_error: Exception | None = None
            for attempt in range(self.retry_count + 1):
                chunk_results.clear()
                batch = service.new_batch_http_request(callback=callback)
                for record in chunk:
                    request = service.files().update(
                        fileId=_drive_file_id(record),
                        body={"trashed": True},
                        supportsAllDrives=True,
                        fields="id,trashed",
                    )
                    batch.add(request, request_id=record.key)
                try:
                    batch.execute()
                    batch_error = None
                    break
                except Exception as error:  # noqa: BLE001 - Drive transport errors vary
                    batch_error = error
                    if attempt < self.retry_count:
                        time.sleep(min(2**attempt, 4))

            if batch_error is not None:
                outcomes.extend(
                    ActionOutcome(record, "failed", str(batch_error)) for record in chunk
                )
            else:
                for record in chunk:
                    outcomes.append(
                        chunk_results.get(
                            record.key,
                            ActionOutcome(record, "failed", "Drive returned no result"),
                        )
                    )

            processed += len(chunk)
            _emit(
                progress,
                "trashing-drive",
                processed,
                len(queue),
                f"Google Drive 批次完成：{processed:,} / {len(queue):,}",
            )

        return ActionReport(source="drive", outcomes=tuple(outcomes))
