from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
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
from .token_store import (
    TokenProtectionError,
    clear_tokens,
    load_protected_token,
    protected_token_path,
    save_protected_token,
)

MINIMUM_AUTO_SELECT_BYTES = 1024 * 1024

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder"
GOOGLE_SHORTCUT_MIME = "application/vnd.google-apps.shortcut"
BATCH_LIMIT = 100
SYSTEM_METADATA_NAMES = frozenset({".ds_store", "thumbs.db", "desktop.ini"})
APPLICATION_SUFFIXES = frozenset(
    {".exe", ".dll", ".sys", ".msi", ".msp", ".appx", ".msix", ".cab", ".lnk"}
)
BACKUP_SYNC_NAMES = frozenset(
    {
        "backup",
        "backups",
        "snapshot",
        "snapshots",
        "restore",
        "archives",
        "onedrive",
        "dropbox",
        "google drive",
        "icloud drive",
        "syncthing",
        "nextcloud",
    }
)

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


def _drive_checksum_value(item: dict[str, Any]) -> str | None:
    if item.get("sha256Checksum"):
        return f"sha256:{item['sha256Checksum']}"
    if item.get("md5Checksum"):
        return f"md5:{item['md5Checksum']}"
    return None


def _drive_paths(items: Iterable[dict[str, Any]]) -> dict[str, str]:
    materialized = tuple(items)
    by_id = {str(item.get("id")): item for item in materialized if item.get("id")}
    memo: dict[str, str] = {}

    def build(item_id: str, visiting: set[str]) -> str:
        if item_id in memo:
            return memo[item_id]
        item = by_id.get(item_id)
        if item is None or item_id in visiting:
            return "Google Drive"
        visiting.add(item_id)
        name = str(item.get("name") or "(未命名)")
        parent = next(
            (str(value) for value in item.get("parents", []) if str(value) in by_id),
            None,
        )
        value = f"{build(parent, visiting)} / {name}" if parent else f"Google Drive / {name}"
        visiting.remove(item_id)
        memo[item_id] = value
        return value

    for item_id in by_id:
        build(item_id, set())
    return memo


def _folder_manifest(
    folder_id: str,
    items: Iterable[dict[str, Any]],
    *,
    ignore_system_metadata: bool,
) -> tuple[str, int, tuple[str, ...], int, int, str] | None:
    """Return digest, count, tree entries, ignored count, bytes and latest time."""

    materialized = tuple(items)
    by_id = {str(item.get("id")): item for item in materialized if item.get("id")}
    children: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in materialized:
        for parent in item.get("parents", []):
            children[str(parent)].append(item)
    protected = drive_project_protected_ids(materialized)
    visiting: set[str] = set()

    def walk(current_id: str, prefix: str) -> tuple[list[str], int, int, int, str] | None:
        current = by_id.get(current_id)
        if (
            current is None
            or current_id in visiting
            or current_id in protected
            or current.get("mimeType") != GOOGLE_FOLDER_MIME
            or current.get("ownedByMe") is not True
            or current.get("driveId")
            or not current.get("capabilities", {}).get("canTrash")
            or str(current.get("name") or "").casefold() in BACKUP_SYNC_NAMES
            or is_package_directory_name(str(current.get("name") or ""))
        ):
            return None
        visiting.add(current_id)
        rows: list[str] = []
        comparable_count = 0
        ignored_count = 0
        actual_bytes = 0
        latest = str(current.get("modifiedTime") or "")
        for child in sorted(
            children.get(current_id, []),
            key=lambda item: str(item.get("name") or "").casefold(),
        ):
            child_id = str(child.get("id") or "")
            name = str(child.get("name") or "(未命名)")
            folded = name.casefold()
            relative = f"{prefix}{name}"
            if child.get("mimeType") == GOOGLE_FOLDER_MIME:
                nested = walk(child_id, f"{relative}/")
                if nested is None:
                    visiting.remove(current_id)
                    return None
                nested_rows, nested_count, nested_ignored, nested_bytes, nested_latest = nested
                rows.extend(nested_rows)
                comparable_count += nested_count
                ignored_count += nested_ignored
                actual_bytes += nested_bytes
                latest = max(latest, nested_latest)
                continue
            size_value = child.get("size")
            checksum_value = _drive_checksum_value(child)
            if (
                child_id in protected
                or child.get("mimeType") == GOOGLE_SHORTCUT_MIME
                or str(child.get("mimeType") or "").startswith("application/vnd.google-apps.")
                or child.get("ownedByMe") is not True
                or child.get("driveId")
                or size_value is None
                or int(size_value) == 0
                or checksum_value is None
                or Path(name).suffix.casefold() in APPLICATION_SUFFIXES
                or is_project_marker_name(name)
            ):
                visiting.remove(current_id)
                return None
            size = int(size_value)
            actual_bytes += size
            latest = max(latest, str(child.get("modifiedTime") or ""))
            if ignore_system_metadata and folded in SYSTEM_METADATA_NAMES:
                ignored_count += 1
                continue
            rows.append(f"{relative}\0{size}\0{checksum_value}")
            comparable_count += 1
        visiting.remove(current_id)
        return rows, comparable_count, ignored_count, actual_bytes, latest

    result = walk(folder_id, "")
    if result is None:
        return None
    rows, count, ignored, total_bytes, latest = result
    if count == 0:
        return None
    rows.sort(key=str.casefold)
    digest = hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()
    return f"folder-sha256:{digest}", count, tuple(rows), ignored, total_bytes, latest


def app_data_dir() -> Path:
    return dupespace_data_dir()


def default_token_path() -> Path:
    return protected_token_path()


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
    explicit_token_file = Path(token_path) if token_path else None
    creds = None

    if explicit_token_file and explicit_token_file.exists():
        try:
            creds = Credentials.from_authorized_user_file(
                str(explicit_token_file), [DRIVE_SCOPE]
            )
        except (OSError, ValueError):
            creds = None
    elif explicit_token_file is None:
        try:
            saved_token = load_protected_token()
            if saved_token:
                creds = Credentials.from_authorized_user_info(
                    json.loads(saved_token), [DRIVE_SCOPE]
                )
        except (TokenProtectionError, ValueError, json.JSONDecodeError) as error:
            raise DriveAuthenticationError(str(error)) from error

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

        if explicit_token_file is not None:
            explicit_token_file.parent.mkdir(parents=True, exist_ok=True)
            explicit_token_file.write_text(creds.to_json(), encoding="utf-8")
        else:
            try:
                save_protected_token(creds.to_json())
            except TokenProtectionError as error:
                raise DriveAuthenticationError(str(error)) from error

    return build("drive", "v3", credentials=creds, cache_discovery=False)


def desktop_account_identity(service: Any) -> tuple[str, str]:
    """Return the connected Google Drive user's display name and email."""

    try:
        response = service.about().get(fields="user(displayName,emailAddress)").execute()
        user = response.get("user", {})
        return str(user.get("displayName") or "Google Drive"), str(
            user.get("emailAddress") or ""
        )
    except Exception as error:  # noqa: BLE001 - normalize Google transport errors
        raise DriveAuthenticationError(f"無法讀取 Google 帳號資訊：{error}") from error


def disconnect_desktop_account() -> None:
    """Best-effort OAuth revocation followed by unconditional local token removal."""

    try:
        saved = load_protected_token()
        if saved:
            token = str(json.loads(saved).get("refresh_token") or "")
            if token:
                body = urllib.parse.urlencode({"token": token}).encode("ascii")
                request = urllib.request.Request(
                    "https://oauth2.googleapis.com/revoke",
                    data=body,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(request, timeout=8):  # noqa: S310
                        pass
                except (OSError, urllib.error.URLError):
                    pass
    finally:
        clear_tokens()


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
        ignore_system_metadata: bool = False,
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
        paths = _drive_paths(listed_items)
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
                    location=paths.get(str(item.get("id")), "Google Drive"),
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

        file_groups = build_duplicate_groups(records)
        folder_records: list[FileRecord] = []
        for item in listed_items:
            if item.get("mimeType") != GOOGLE_FOLDER_MIME:
                continue
            folder_id = str(item.get("id") or "")
            manifest = _folder_manifest(
                folder_id,
                listed_items,
                ignore_system_metadata=ignore_system_metadata,
            )
            if manifest is None:
                continue
            checksum_value, count, tree_entries, ignored, total_bytes, latest = manifest
            can_trash = bool(item.get("capabilities", {}).get("canTrash"))
            folder_records.append(
                FileRecord(
                    key=f"drive:{folder_id}",
                    source="drive",
                    name=item.get("name") or "(未命名資料夾)",
                    location=paths.get(folder_id, "Google Drive"),
                    size=total_bytes,
                    checksum=checksum_value,
                    item_kind="folder",
                    entry_count=count,
                    tree_entries=tree_entries,
                    ignored_metadata_count=ignored,
                    system_metadata_ignored=ignore_system_metadata,
                    created_at=_timestamp(item.get("createdTime")),
                    modified_at=_timestamp(latest),
                    metadata_token=json.dumps(
                        {
                            "count": count + ignored,
                            "bytes": total_bytes,
                            "latest": latest,
                        },
                        sort_keys=True,
                        separators=(",", ":"),
                    ),
                    can_trash=can_trash,
                    can_delete=False,
                    mime_type=GOOGLE_FOLDER_MIME,
                    web_url=item.get("webViewLink"),
                    parent_ids=tuple(
                        sorted(str(parent) for parent in item.get("parents", []))
                    ),
                    selectable=can_trash,
                    auto_selectable=(
                        can_trash and total_bytes >= MINIMUM_AUTO_SELECT_BYTES
                    ),
                    protection_reason=None if can_trash else "目前帳號沒有資料夾垃圾桶權限",
                )
            )

        by_id = {
            str(item.get("id")): item for item in listed_items if item.get("id")
        }

        def has_covered_ancestor(item_id: str, covered: set[str]) -> bool:
            pending = list(by_id.get(item_id, {}).get("parents", []))
            visited: set[str] = set()
            while pending:
                parent = str(pending.pop())
                if parent in covered:
                    return True
                if parent in visited:
                    continue
                visited.add(parent)
                pending.extend(by_id.get(parent, {}).get("parents", []))
            return False

        folder_groups_raw = sorted(
            build_duplicate_groups(folder_records),
            key=lambda group: min(record.location.count(" / ") for record in group.records),
        )
        folder_groups = []
        covered_folder_ids: set[str] = set()
        for group in folder_groups_raw:
            ids = {_drive_file_id(record) for record in group.records}
            if any(has_covered_ancestor(item_id, covered_folder_ids) for item_id in ids):
                continue
            folder_groups.append(group)
            covered_folder_ids.update(ids)
        file_groups = tuple(
            group
            for group in file_groups
            if not any(
                has_covered_ancestor(_drive_file_id(record), covered_folder_ids)
                for record in group.records
                if record.key != group.keeper_key
            )
        )
        groups = tuple(
            sorted(
                (*folder_groups, *file_groups),
                key=lambda group: (
                    -group.reclaimable_bytes,
                    group.records[0].name.casefold(),
                    group.fingerprint,
                ),
            )
        )
        if ignore_system_metadata:
            ignored_metadata = sum(
                record.ignored_metadata_count
                for group in folder_groups
                for record in group.records
            )
            if ignored_metadata:
                warnings.append(
                    f"已依使用者選擇忽略 {ignored_metadata:,} 個系統暫存中繼資料檔；"
                    "移除資料夾時會連同它們移至 Google Drive 垃圾桶。"
                )
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
    return _drive_checksum_value(item)


def _list_current_drive_items(service: Any) -> tuple[dict[str, Any], ...]:
    page_token: str | None = None
    listed: list[dict[str, Any]] = []
    while True:
        response = service.files().list(
            q="trashed = false",
            spaces="drive",
            corpora="user",
            pageSize=1000,
            pageToken=page_token,
            fields=GoogleDriveScanner.FIELDS,
            supportsAllDrives=True,
            includeItemsFromAllDrives=False,
        ).execute(num_retries=3)
        listed.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return tuple(listed)


def _validate_drive_folder_snapshot(
    items: tuple[dict[str, Any], ...],
    record: FileRecord,
    capability: str | None = None,
) -> str | None:
    if record.item_kind != "folder":
        return "Folder validation received a non-folder record"
    if capability == "canDelete":
        return "資料夾只能移至 Google Drive 垃圾桶，不能永久刪除"
    folder_id = _drive_file_id(record)
    current = next((item for item in items if str(item.get("id")) == folder_id), None)
    if current is None or current.get("trashed") is True:
        return "資料夾已移動或刪除"
    if (
        current.get("mimeType") != GOOGLE_FOLDER_MIME
        or current.get("ownedByMe") is not True
        or current.get("driveId")
    ):
        return "資料夾不是本人擁有的 My Drive 一般資料夾"
    if capability and not bool(current.get("capabilities", {}).get(capability)):
        return f"Google Drive permission {capability} is not available"
    parents = tuple(sorted(str(parent) for parent in current.get("parents", [])))
    if parents != record.parent_ids:
        return "資料夾已移至不同的 Google Drive 位置"
    manifest = _folder_manifest(
        folder_id,
        items,
        ignore_system_metadata=record.system_metadata_ignored,
    )
    if manifest is None:
        return "資料夾目前含無法驗證、非本人擁有、捷徑或受保護項目"
    checksum_value, count, _tree_entries, ignored, total_bytes, latest = manifest
    token = json.dumps(
        {"count": count + ignored, "bytes": total_bytes, "latest": latest},
        sort_keys=True,
        separators=(",", ":"),
    )
    if token != record.metadata_token or checksum_value != record.checksum:
        return "資料夾內容已變更，操作已取消"
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
            original_chunk_length = len(chunk)
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

            if operation_mode == "permanent" and any(
                item.record.item_kind == "folder" for item in chunk
            ):
                outcomes.extend(
                    ActionOutcome(
                        item.record,
                        "skipped",
                        "資料夾只能移至 Google Drive 垃圾桶，不能永久刪除",
                        operation_mode=operation_mode,
                    )
                    for item in chunk
                    if item.record.item_kind == "folder"
                )
                chunk = tuple(item for item in chunk if item.record.item_kind == "file")
                if not chunk:
                    processed += original_chunk_length
                    continue

            ids = [
                file_id
                for item in chunk
                for file_id in (_drive_file_id(item.record), _drive_file_id(item.keeper))
            ]
            snapshots, fetch_errors = _fetch_drive_files(service, ids)
            folder_snapshot_items: tuple[dict[str, Any], ...] | None = None
            folder_snapshot_error: str | None = None
            if any(item.record.item_kind == "folder" for item in chunk):
                try:
                    folder_snapshot_items = _list_current_drive_items(service)
                except Exception as error:  # noqa: BLE001 - Google transport errors vary
                    folder_snapshot_error = str(error)
            valid: list[OperationItem] = []
            capability = "canTrash" if operation_mode == "trash" else "canDelete"
            for item in chunk:
                target_id = _drive_file_id(item.record)
                keeper_id = _drive_file_id(item.keeper)
                error = fetch_errors.get(target_id) or fetch_errors.get(keeper_id)
                if item.record.item_kind == "folder":
                    error = error or folder_snapshot_error
                    if folder_snapshot_items is not None:
                        error = error or _validate_drive_folder_snapshot(
                            folder_snapshot_items, item.record, capability
                        )
                        error = error or _validate_drive_folder_snapshot(
                            folder_snapshot_items, item.keeper
                        )
                else:
                    error = error or _validate_drive_snapshot(
                        snapshots.get(target_id), item.record, capability
                    )
                    error = error or _validate_drive_snapshot(
                        snapshots.get(keeper_id), item.keeper
                    )
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
                response: Any,
                exception: Exception | None,
                *,
                records: dict[str, FileRecord] = chunk_by_key,
                results: dict[str, ActionOutcome] = chunk_results,
            ) -> None:
                record = records[request_id]
                if exception is None and (
                    operation_mode != "trash"
                    or (
                        isinstance(response, dict)
                        and response.get("id") == _drive_file_id(record)
                        and response.get("trashed") is True
                    )
                ):
                    status = "trashed" if operation_mode == "trash" else "deleted"
                    results[request_id] = ActionOutcome(
                        record, status, operation_mode=operation_mode
                    )
                else:
                    results[request_id] = ActionOutcome(
                        record,
                        "failed",
                        str(exception)
                        if exception is not None
                        else "Google Drive 未確認項目已進入垃圾桶",
                        operation_mode=operation_mode,
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

            processed += original_chunk_length
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
