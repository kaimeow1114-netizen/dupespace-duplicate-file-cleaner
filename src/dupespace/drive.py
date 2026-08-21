from __future__ import annotations

import json
import os
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable, Iterable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

from .grouping import build_duplicate_groups
from .models import (
    ActionOutcome,
    ActionReport,
    FileRecord,
    OperationItem,
    OperationMode,
    ProgressUpdate,
    ScanReport,
)
from .paths import app_data_dir as dupespace_data_dir
from .project_safety import is_package_directory_name, is_project_marker_name

MINIMUM_AUTO_SELECT_BYTES = 1024 * 1024

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


def drive_project_protected_ids(items: Iterable[dict[str, Any]]) -> set[str]:
    """Return every Drive item inside a recognized source-code project tree."""

    materialized = tuple(items)
    known_ids = {str(item["id"]) for item in materialized if item.get("id")}
    children: dict[str, set[str]] = defaultdict(set)
    project_roots: set[str] = set()
    protected: set[str] = set()

    for item in materialized:
        item_id = str(item.get("id") or "")
        if not item_id:
            continue
        parents = tuple(str(parent) for parent in item.get("parents", []) if parent)
        for parent in parents:
            children[parent].add(item_id)
        name = str(item.get("name") or "")
        is_folder = item.get("mimeType") == GOOGLE_FOLDER_MIME
        if is_project_marker_name(name):
            protected.add(item_id)
            project_roots.update(parent for parent in parents if parent in known_ids)
        if is_folder and is_package_directory_name(name):
            protected.add(item_id)
            project_roots.add(item_id)
            project_roots.update(parent for parent in parents if parent in known_ids)

    queue = deque(project_roots)
    visited: set[str] = set()
    while queue:
        item_id = queue.popleft()
        if item_id in visited:
            continue
        visited.add(item_id)
        protected.add(item_id)
        queue.extend(children.get(item_id, ()))
    return protected


def app_data_dir() -> Path:
    return dupespace_data_dir()


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


def _desktop_oauth_config() -> dict[str, Any]:
    client_id = os.getenv("DUPESPACE_GOOGLE_DESKTOP_CLIENT_ID", "")
    try:
        from ._desktop_oauth import CLIENT_ID

        client_id = CLIENT_ID or client_id
    except ImportError:
        pass
    if not client_id:
        raise DriveAuthenticationError(
            "這個開發版本尚未注入 DUPESPACE Google Desktop OAuth Client ID。"
        )
    return {
        "installed": {
            "client_id": client_id,
            # A native app cannot keep a client secret. Google authenticates this public
            # client with the loopback redirect and PKCE instead of a bundled secret.
            "client_secret": "",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }


def build_drive_service(
    credentials_path: str | os.PathLike[str] | None = None,
    *,
    token_path: str | os.PathLike[str] | None = None,
) -> Any:
    """Authorize DupeSpace Desktop; the new app-data path forces a fresh sign-in."""

    if credentials_path is None:
        data = _desktop_oauth_config()
    else:
        credentials_file = Path(credentials_path).expanduser().resolve(strict=False)
        if not credentials_file.is_file():
            raise DriveAuthenticationError(f"找不到 OAuth 憑證檔：{credentials_file}")
        try:
            data = json.loads(credentials_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise DriveAuthenticationError(f"OAuth 憑證檔無法讀取：{error}") from error
        if not isinstance(data, dict) or "installed" not in data:
            raise DriveAuthenticationError("請使用 Google OAuth Desktop app（installed）JSON 檔")
        installed = data["installed"]
        if not isinstance(installed, dict) or not installed.get("client_id"):
            raise DriveAuthenticationError("OAuth Desktop app JSON 缺少 Client ID")
        # Ignore the generated Desktop client secret even when an older Google JSON file
        # contains one. Native client secrets are public material and must not be relied on.
        data = {"installed": {**installed, "client_secret": ""}}

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
                flow = InstalledAppFlow.from_client_config(
                    data,
                    [DRIVE_SCOPE],
                    autogenerate_code_verifier=True,
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
        "modifiedTime,parents,ownedByMe,driveId,version,webViewLink,"
        "capabilities(canTrash,canDelete))"
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
        listed_items: list[dict[str, Any]] = []
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
                listed_items.append(item)

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

        project_protected = drive_project_protected_ids(listed_items)
        if project_protected:
            warnings.append(f"已硬性略過 {len(project_protected):,} 個程式碼專案或套件環境項目。")

        records: list[FileRecord] = []
        for item in listed_items:
            if str(item.get("id") or "") in project_protected:
                skipped += 1
                continue
            mime_type = item.get("mimeType", "")
            drive_id = item.get("driveId")
            owned_by_me = item.get("ownedByMe") is True
            can_trash = bool(item.get("capabilities", {}).get("canTrash"))
            can_delete = bool(item.get("capabilities", {}).get("canDelete"))
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
            file_size = int(item["size"])
            if file_size == 0:
                skipped += 1
                continue

            records.append(
                FileRecord(
                    key=f"drive:{item['id']}",
                    source="drive",
                    name=item.get("name") or "(未命名)",
                    location=f"Google Drive / {item.get('name') or '(未命名)'}",
                    size=file_size,
                    checksum=f"{checksum_kind}:{checksum_value}",
                    created_at=_timestamp(item.get("createdTime")),
                    modified_at=_timestamp(item.get("modifiedTime")),
                    metadata_token=str(item.get("version")) if item.get("version") else None,
                    can_trash=can_trash,
                    can_delete=can_delete,
                    mime_type=mime_type,
                    web_url=item.get("webViewLink"),
                    parent_ids=tuple(sorted(str(parent) for parent in item.get("parents", []))),
                    selectable=can_trash or can_delete,
                    auto_selectable=(can_trash and file_size >= MINIMUM_AUTO_SELECT_BYTES),
                    protection_reason=(
                        None if can_trash or can_delete else "目前帳號沒有垃圾桶或刪除權限"
                    ),
                )
            )

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


_PREFLIGHT_FIELDS = (
    "id,name,mimeType,size,md5Checksum,sha256Checksum,modifiedTime,ownedByMe,"
    "version,parents,trashed,capabilities(canTrash,canDelete)"
)


def _drive_checksum(item: dict[str, Any]) -> str | None:
    if item.get("sha256Checksum"):
        return f"sha256:{item['sha256Checksum']}"
    if item.get("md5Checksum"):
        return f"md5:{item['md5Checksum']}"
    return None


def _fetch_drive_files(
    service: Any, file_ids: Iterable[str]
) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    results: dict[str, dict[str, Any]] = {}
    errors: dict[str, str] = {}
    unique_ids = tuple(dict.fromkeys(file_ids))
    for id_chunk in _chunks(unique_ids, BATCH_LIMIT):

        def callback(request_id: str, response: Any, exception: Exception | None) -> None:
            if exception is not None:
                errors[request_id] = str(exception)
            elif isinstance(response, dict):
                results[request_id] = response
            else:
                errors[request_id] = "Google Drive returned an invalid metadata response"

        batch = service.new_batch_http_request(callback=callback)
        for file_id in id_chunk:
            batch.add(
                service.files().get(
                    fileId=file_id,
                    fields=_PREFLIGHT_FIELDS,
                    supportsAllDrives=False,
                ),
                request_id=file_id,
            )
        try:
            batch.execute()
        except Exception as error:  # noqa: BLE001 - Google transport errors vary
            for file_id in id_chunk:
                errors.setdefault(file_id, str(error))
    return results, errors


def _validate_drive_snapshot(
    current: dict[str, Any] | None,
    record: FileRecord,
    capability: str | None = None,
) -> str | None:
    if current is None:
        return "Google Drive metadata could not be revalidated"
    try:
        file_id = _drive_file_id(record)
    except ValueError as error:
        return str(error)
    if current.get("id") != file_id:
        return "Google Drive file ID changed after the scan"
    if current.get("trashed") is True or current.get("ownedByMe") is not True:
        return "File is trashed or is no longer owned by this account"
    if current.get("mimeType") in {GOOGLE_FOLDER_MIME, GOOGLE_SHORTCUT_MIME}:
        return "Folders and shortcuts are never cleanup targets"
    if current.get("size") is None or int(current["size"]) != record.size:
        return "File size changed after the scan"
    if str(current.get("version") or "") != str(record.metadata_token or ""):
        return "File version changed after the scan"
    current_parents = tuple(sorted(str(parent) for parent in current.get("parents", [])))
    if current_parents != record.parent_ids:
        return "File moved to a different Google Drive folder after the scan"
    if _timestamp(current.get("modifiedTime")) != record.modified_at:
        return "File modification time changed after the scan"
    if _drive_checksum(current) != record.checksum:
        return "File checksum changed after the scan"
    if capability and not bool(current.get("capabilities", {}).get(capability)):
        return f"Google Drive permission {capability} is not available"
    return None


class _GoogleDriveOperationExecutor:
    """Shared, fail-closed Drive executor. Trash and delete never call each other."""

    def __init__(self, batch_size: int = BATCH_LIMIT, retry_count: int = 3) -> None:
        if not 1 <= batch_size <= BATCH_LIMIT:
            raise ValueError(f"batch_size must be between 1 and {BATCH_LIMIT}")
        self.batch_size = batch_size
        self.retry_count = retry_count

    def execute(
        self,
        service: Any,
        items: Iterable[OperationItem],
        operation_mode: OperationMode,
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        queue = tuple(items)
        outcomes: list[ActionOutcome] = []
        processed = 0

        for chunk in _chunks(queue, self.batch_size):
            if cancel_event and cancel_event.is_set():
                outcomes.extend(
                    ActionOutcome(
                        item.record,
                        "cancelled",
                        "operation cancelled",
                        operation_mode=operation_mode,
                    )
                    for item in queue[processed:]
                )
                break

            ids = [
                file_id
                for item in chunk
                for file_id in (_drive_file_id(item.record), _drive_file_id(item.keeper))
            ]
            snapshots, fetch_errors = _fetch_drive_files(service, ids)
            valid: list[OperationItem] = []
            capability = "canTrash" if operation_mode == "trash" else "canDelete"
            for item in chunk:
                target_id = _drive_file_id(item.record)
                keeper_id = _drive_file_id(item.keeper)
                error = fetch_errors.get(target_id) or fetch_errors.get(keeper_id)
                error = error or _validate_drive_snapshot(
                    snapshots.get(target_id), item.record, capability
                )
                error = error or _validate_drive_snapshot(snapshots.get(keeper_id), item.keeper)
                if error:
                    outcomes.append(
                        ActionOutcome(
                            item.record,
                            "skipped",
                            error,
                            operation_mode=operation_mode,
                        )
                    )
                else:
                    valid.append(item)

            if not valid:
                processed += len(chunk)
                continue

            chunk_results: dict[str, ActionOutcome] = {}
            chunk_by_key = {item.record.key: item.record for item in valid}

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
                    status = "trashed" if operation_mode == "trash" else "deleted"
                    results[request_id] = ActionOutcome(
                        record, status, operation_mode=operation_mode
                    )
                else:
                    results[request_id] = ActionOutcome(
                        record, "failed", str(exception), operation_mode=operation_mode
                    )

            batch_error: Exception | None = None
            for attempt in range(self.retry_count + 1):
                chunk_results.clear()
                batch = service.new_batch_http_request(callback=callback)
                for item in valid:
                    record = item.record
                    if operation_mode == "trash":
                        request = service.files().update(
                            fileId=_drive_file_id(record),
                            body={"trashed": True},
                            supportsAllDrives=False,
                            fields="id,trashed",
                        )
                    else:
                        request = service.files().delete(
                            fileId=_drive_file_id(record),
                            supportsAllDrives=False,
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
                    ActionOutcome(
                        item.record,
                        "failed",
                        str(batch_error),
                        operation_mode=operation_mode,
                    )
                    for item in valid
                )
            else:
                for item in valid:
                    record = item.record
                    outcomes.append(
                        chunk_results.get(
                            record.key,
                            ActionOutcome(
                                record,
                                "failed",
                                "Drive returned no result",
                                operation_mode=operation_mode,
                            ),
                        )
                    )

            processed += len(chunk)
            _emit(
                progress,
                "trashing-drive" if operation_mode == "trash" else "deleting-drive",
                processed,
                len(queue),
                f"Google Drive 批次完成：{processed:,} / {len(queue):,}",
            )

        return ActionReport(source="drive", outcomes=tuple(outcomes), operation_mode=operation_mode)


class GoogleDriveTrashExecutor(_GoogleDriveOperationExecutor):
    """Move files to Drive trash. Failures are reported and never permanently deleted."""

    def trash(
        self,
        service: Any,
        items: Iterable[OperationItem],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        return self.execute(
            service,
            items,
            "trash",
            progress=progress,
            cancel_event=cancel_event,
        )


class GoogleDrivePermanentDeleteExecutor(_GoogleDriveOperationExecutor):
    """Permanently delete unchanged, user-owned regular Drive files."""

    def delete(
        self,
        service: Any,
        items: Iterable[OperationItem],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        return self.execute(
            service,
            items,
            "permanent",
            progress=progress,
            cancel_event=cancel_event,
        )
