from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import shutil
import threading
from collections.abc import Callable
from contextlib import suppress
from pathlib import Path, PurePosixPath

from .grouping import build_local_duplicate_groups
from .local import (
    ScanCancelled,
    SnapshotChangedError,
    _creation_time,
    _is_cancelled,
    _metadata_token,
    detect_safety_context,
)
from .models import FileRecord, ProgressUpdate, ScanReport, path_contains
from .windows_safety import (
    DEFAULT_WINDOWS_SAFETY_POLICY,
    UnsafePathError,
    WindowsSafetyPolicy,
)

DUPEJOB_SCHEMA = "https://dupespace.app/schemas/dupejob-v1"
DUPEJOB_ALGORITHM = "DUPESPACE-CHUNK-SHA256-v1"
DUPEJOB_DOMAIN = b"DUPESPACE-CHUNK-SHA256-v1"
# A 100,000-file report with ordinary Windows paths can exceed 8 MiB. Keep a
# bounded ceiling without making a valid large browser analysis impossible.
MAX_JOB_BYTES = 32 * 1024 * 1024
MAX_JOB_FILES = 100_000
JOB_CHUNK_BYTES = 4 * 1024 * 1024
JOB_CATEGORIES = {"video", "image", "pdf", "document", "archive", "audio", "other"}

ProgressCallback = Callable[[ProgressUpdate], None]


def _fail(message: str) -> ValueError:
    return ValueError(f"DupeJob 無法載入：{message}")


def _read_job(path: Path) -> dict:
    try:
        size = path.stat().st_size
        if size <= 0 or size > MAX_JOB_BYTES:
            raise _fail("檔案大小不符合安全限制")
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise _fail("檔案不是有效的 UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise _fail("最外層資料格式錯誤")
    if (
        value.get("schema") != DUPEJOB_SCHEMA
        or value.get("version") != 1
        or value.get("source") != "dupespace-browser-local"
        or value.get("fingerprintAlgorithm") != DUPEJOB_ALGORITHM
    ):
        raise _fail("版本或指紋演算法不受支援")
    if not isinstance(value.get("groups"), list):
        raise _fail("缺少重複群組")
    source_root_name = value.get("sourceRootName")
    if (
        not isinstance(source_root_name, str)
        or not source_root_name.strip()
        or len(source_root_name) > 255
        or source_root_name in {".", ".."}
        or any(separator in source_root_name for separator in ("/", "\\", "\x00"))
    ):
        raise _fail("來源資料夾名稱錯誤")
    return value


def _safe_relative_path(raw: object) -> PurePosixPath:
    if not isinstance(raw, str) or not raw or len(raw) > 4096 or "\\" in raw:
        raise _fail("包含無效的相對路徑")
    path = PurePosixPath(raw)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise _fail("相對路徑嘗試離開選取的資料夾")
    if any(":" in part or "\x00" in part for part in path.parts):
        raise _fail("相對路徑含有 Windows 不允許的字元")
    return path


def _fingerprints(
    path: Path,
    expected: os.stat_result,
    *,
    cancel_event: threading.Event | None,
) -> tuple[str, str]:
    browser = hashlib.sha256()
    browser.update(DUPEJOB_DOMAIN)
    browser.update(expected.st_size.to_bytes(8, "big"))
    standard = hashlib.sha256()
    with path.open("rb") as handle:
        if _metadata_token(os.fstat(handle.fileno())) != _metadata_token(expected):
            raise SnapshotChangedError("檔案在驗證前已變更")
        while chunk := handle.read(JOB_CHUNK_BYTES):
            if _is_cancelled(cancel_event):
                raise ScanCancelled("DupeJob verification cancelled")
            browser.update(hashlib.sha256(chunk).digest())
            standard.update(chunk)
        if _metadata_token(os.fstat(handle.fileno())) != _metadata_token(expected):
            raise SnapshotChangedError("檔案在驗證期間已變更")
    if _metadata_token(path.stat()) != _metadata_token(expected):
        raise SnapshotChangedError("檔案在驗證期間已變更")
    return browser.hexdigest(), f"sha256:{standard.hexdigest()}"


def load_dupejob(
    job_path: str | os.PathLike[str],
    selected_root: str | os.PathLike[str],
    *,
    safety_policy: WindowsSafetyPolicy = DEFAULT_WINDOWS_SAFETY_POLICY,
    progress: ProgressCallback | None = None,
    cancel_event: threading.Event | None = None,
) -> ScanReport:
    """Verify a browser report against one selected folder without enumerating unrelated files.

    The manifest is an untrusted hint. Every path is constrained to the selected root and every
    byte is read again before ordinary desktop grouping and cleanup protections are applied.
    """

    job = _read_job(Path(job_path))
    root = safety_policy.validate_scan_root(selected_root)
    entries: list[tuple[str, int, int, str]] = []
    seen_paths: set[str] = set()
    seen_fingerprints: set[str] = set()
    for group in job["groups"]:
        if not isinstance(group, dict):
            raise _fail("群組格式錯誤")
        fingerprint = group.get("fingerprint")
        files = group.get("files")
        category = group.get("category")
        context_review = group.get("contextReview")
        if (
            not isinstance(fingerprint, str)
            or len(fingerprint) != 64
            or any(character not in "0123456789abcdef" for character in fingerprint)
            or not isinstance(files, list)
            or len(files) < 2
            or category not in JOB_CATEGORIES
            or type(context_review) is not bool
        ):
            raise _fail("群組指紋、分類或檔案數量錯誤")
        if fingerprint in seen_fingerprints:
            raise _fail("同一個內容指紋被拆成多個群組")
        seen_fingerprints.add(fingerprint)
        references = 0
        for entry in files:
            if not isinstance(entry, dict):
                raise _fail("檔案記錄格式錯誤")
            role = entry.get("role")
            if role not in {"reference_only", "duplicate_candidate"}:
                raise _fail("檔案角色錯誤")
            references += role == "reference_only"
            relative = _safe_relative_path(entry.get("relativePath"))
            size = entry.get("size")
            modified = entry.get("lastModified")
            if type(size) is not int or size <= 0 or type(modified) is not int or modified < 0:
                raise _fail("檔案大小或修改時間錯誤")
            normalized = str(relative).casefold()
            if normalized in seen_paths:
                raise _fail("同一路徑重複出現在報告中")
            seen_paths.add(normalized)
            entries.append((str(relative), size, modified, fingerprint))
        if references != 1:
            raise _fail("每個群組必須只有一個瀏覽器參考項目")
    if not entries or len(entries) > MAX_JOB_FILES:
        raise _fail("檔案數量不符合安全限制")

    records: list[FileRecord] = []
    warnings: list[str] = []
    if Path(job["sourceRootName"]).name.casefold() != root.name.casefold():
        warnings.append(
            "選取的資料夾名稱與網頁分析時不同；已改以完整內容重新驗證每個候選檔案"
        )
    examined_bytes = 0
    project_cache: dict[Path, tuple[str, bool]] = {}
    for index, (relative, expected_size, expected_modified, manifest_fingerprint) in enumerate(
        entries, start=1
    ):
        if _is_cancelled(cancel_event):
            raise ScanCancelled("DupeJob verification cancelled")
        raw_path = root.joinpath(*PurePosixPath(relative).parts)
        try:
            path = safety_policy.validate_regular_file(raw_path)
            if not path_contains(str(root), str(path)):
                raise UnsafePathError("檔案不在選取的資料夾內")
            stat_result = path.stat()
            if stat_result.st_size != expected_size:
                raise SnapshotChangedError("檔案大小與瀏覽器分析結果不同")
            if stat_result.st_mtime_ns // 1_000_000 != expected_modified:
                raise SnapshotChangedError("檔案修改時間與瀏覽器分析結果不同")
            context = detect_safety_context(path, root, project_cache=project_cache)
            if context.project:
                raise UnsafePathError("程式碼專案中的相同檔案仍可能各自必要")
            browser_fingerprint, checksum = _fingerprints(
                path, stat_result, cancel_event=cancel_event
            )
            if browser_fingerprint != manifest_fingerprint:
                raise SnapshotChangedError("完整內容與瀏覽器分析結果不同")
            locked = context.requires_unlock
            records.append(
                FileRecord(
                    key=f"local:{path}",
                    source="local",
                    name=path.name,
                    location=str(path),
                    size=stat_result.st_size,
                    checksum=checksum,
                    created_at=_creation_time(stat_result),
                    modified_at=stat_result.st_mtime,
                    metadata_token=_metadata_token(stat_result),
                    can_delete=True,
                    mime_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                    source_root=str(root),
                    root_role="clean",
                    selectable=not locked,
                    auto_selectable=not locked,
                    protection_reason=(
                        "此檔案位於程式、備份或同步情境，需逐資料夾解鎖"
                        if locked
                        else None
                    ),
                    safety_context=context,
                )
            )
            examined_bytes += stat_result.st_size
        except (OSError, SnapshotChangedError, UnsafePathError) as error:
            warnings.append(f"略過 {relative}：{error}")
        if progress:
            progress(
                ProgressUpdate(
                    "hashing",
                    index,
                    len(entries),
                    f"重新驗證：{relative}",
                )
            )

    groups = build_local_duplicate_groups(records)
    capacity = None
    with suppress(OSError):
        capacity = shutil.disk_usage(root).total
    return ScanReport(
        source="local",
        groups=groups,
        examined_files=len(entries),
        hashed_files=len(records),
        skipped_files=len(entries) - len(records),
        examined_bytes=examined_bytes,
        storage_capacity_bytes=capacity,
        warnings=tuple(warnings),
    )
