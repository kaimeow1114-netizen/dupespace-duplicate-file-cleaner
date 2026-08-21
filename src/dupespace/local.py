from __future__ import annotations

import hashlib
import os
import shutil
import threading
from collections import defaultdict
from collections.abc import Callable, Iterable
from pathlib import Path

from .grouping import build_local_duplicate_groups
from .models import (
    ActionOutcome,
    ActionReport,
    FileRecord,
    OperationItem,
    OperationMode,
    ProgressUpdate,
    SafetyContext,
    ScanReport,
    ScanRoot,
)
from .project_safety import is_package_directory_name, is_project_marker_name
from .windows_safety import (
    DEFAULT_WINDOWS_SAFETY_POLICY,
    UnsafePathError,
    WindowsSafetyPolicy,
    is_cloud_placeholder,
)

ProgressCallback = Callable[[ProgressUpdate], None]


class ScanCancelled(RuntimeError):
    pass


class SnapshotChangedError(OSError):
    pass


def _is_cancelled(cancel_event: threading.Event | None) -> bool:
    return cancel_event is not None and cancel_event.is_set()


def _emit(
    callback: ProgressCallback | None,
    stage: str,
    current: int,
    total: int | None,
    message: str,
) -> None:
    if callback:
        callback(ProgressUpdate(stage, current, total, message))


def _identity(stat_result: os.stat_result) -> tuple[int, int]:
    return (stat_result.st_dev, stat_result.st_ino)


def _metadata_token(stat_result: os.stat_result) -> str:
    return ":".join(
        str(value)
        for value in (
            stat_result.st_dev,
            stat_result.st_ino,
            stat_result.st_size,
            stat_result.st_mtime_ns,
        )
    )


def _hash_file(path: Path, expected: os.stat_result, chunk_size: int) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)

    current = path.stat()
    if _metadata_token(current) != _metadata_token(expected):
        raise SnapshotChangedError("file changed while it was being hashed")
    return f"sha256:{digest.hexdigest()}"


MINIMUM_AUTO_SELECT_BYTES = 1024 * 1024

_APPLICATION_SUFFIXES = frozenset(
    {".exe", ".dll", ".sys", ".msi", ".msp", ".appx", ".msix", ".cab"}
)
_BACKUP_NAMES = frozenset(
    {"backup", "backups", "snapshot", "snapshots", "restore", "archives", "system image"}
)
_SYNC_NAMES = frozenset(
    {"onedrive", "dropbox", "google drive", "icloud drive", "syncthing", "nextcloud"}
)


def _path_key(path: Path) -> str:
    return os.path.normcase(os.path.abspath(str(path))).rstrip("\\/")


def _contains_path(parent: Path, child: Path) -> bool:
    parent_key = _path_key(parent)
    child_key = _path_key(child)
    return child_key == parent_key or child_key.startswith(parent_key + os.sep)


def normalize_scan_roots(
    roots: Iterable[ScanRoot], safety_policy: WindowsSafetyPolicy
) -> tuple[ScanRoot, ...]:
    """Canonicalize roots and reject every equal, nested, or overlapping pair."""

    normalized: list[ScanRoot] = []
    for root in roots:
        if not isinstance(root, ScanRoot):
            raise TypeError("Local scans require explicit ScanRoot keep/clean roles")
        physical = safety_policy.validate_scan_root(root.physical_path)
        candidate = ScanRoot(str(physical), root.role)
        candidate_path = Path(candidate.physical_path)
        for existing in normalized:
            existing_path = Path(existing.physical_path)
            if _contains_path(existing_path, candidate_path) or _contains_path(
                candidate_path, existing_path
            ):
                raise UnsafePathError("保留區與清理區不可相同、巢狀或重疊")
        normalized.append(candidate)

    roles = {root.role for root in normalized}
    if "keep" not in roles or "clean" not in roles:
        raise ValueError("請至少選擇一個保留區和一個清理區")
    return tuple(normalized)


def _ancestors_within(path: Path, root: Path) -> tuple[Path, ...]:
    ancestors: list[Path] = []
    current = path.parent
    while _contains_path(root, current):
        ancestors.append(current)
        if _path_key(current) == _path_key(root):
            break
        current = current.parent
    return tuple(ancestors)


def _is_project_folder(folder: Path) -> bool:
    """Recognize common source-control and build roots without following links."""

    try:
        with os.scandir(folder) as entries:
            for entry in entries:
                if is_project_marker_name(entry.name):
                    return True
    except (OSError, PermissionError):
        return False
    return False


def detect_safety_context(path: Path, root: Path) -> SafetyContext:
    """Classify semantic contexts where an exact copy may still be required."""

    project_folder: Path | None = None
    application_folder: Path | None = None
    backup_folder: Path | None = None
    sync_folder: Path | None = None
    for ancestor in _ancestors_within(path, root):
        folded = ancestor.name.casefold()
        if project_folder is None and (
            is_package_directory_name(folded) or _is_project_folder(ancestor)
        ):
            project_folder = ancestor
        if backup_folder is None and folded in _BACKUP_NAMES:
            backup_folder = ancestor
        if sync_folder is None and folded in _SYNC_NAMES:
            sync_folder = ancestor
    if path.suffix.casefold() in _APPLICATION_SUFFIXES:
        application_folder = path.parent

    locked_folder = next(
        (
            folder
            for folder in (project_folder, application_folder, backup_folder, sync_folder)
            if folder is not None
        ),
        None,
    )
    return SafetyContext(
        project=project_folder is not None,
        application=application_folder is not None,
        backup=backup_folder is not None,
        sync=sync_folder is not None,
        locked_folder=str(locked_folder) if locked_folder else None,
    )


class LocalScanner:
    """Two-stage scanner: size bucketing first, then full SHA-256 hashing."""

    def __init__(
        self,
        chunk_size: int = 1024 * 1024,
        safety_policy: WindowsSafetyPolicy = DEFAULT_WINDOWS_SAFETY_POLICY,
    ) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        self.chunk_size = chunk_size
        self.safety_policy = safety_policy

    def scan(
        self,
        roots: Iterable[ScanRoot],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ScanReport:
        normalized_roots = normalize_scan_roots(roots, self.safety_policy)

        by_size: dict[int, list[tuple[Path, os.stat_result, ScanRoot]]] = defaultdict(list)
        seen_physical_files: set[tuple[int, int]] = set()
        warnings: list[str] = []
        examined = 0
        examined_bytes = 0
        skipped = 0

        for scan_root in normalized_roots:
            root = Path(scan_root.physical_path)
            if not root.is_dir():
                warnings.append(f"不是可讀取的資料夾：{root}")
                skipped += 1
                continue
            stack = [root]
            while stack:
                if _is_cancelled(cancel_event):
                    raise ScanCancelled("Local scan cancelled")
                directory = stack.pop()
                try:
                    if self.safety_policy.is_protected(directory):
                        skipped += 1
                        warnings.append(f"已略過受保護位置：{directory}")
                        continue
                    if self.safety_policy.has_protected_attributes(
                        directory
                    ) or is_cloud_placeholder(directory):
                        skipped += 1
                        continue
                    with os.scandir(directory) as entries:
                        for entry in entries:
                            if _is_cancelled(cancel_event):
                                raise ScanCancelled("Local scan cancelled")
                            try:
                                if entry.is_symlink():
                                    skipped += 1
                                    continue
                                if entry.is_dir(follow_symlinks=False):
                                    child = Path(entry.path)
                                    if self.safety_policy.is_protected(child):
                                        skipped += 1
                                    elif not self.safety_policy.has_protected_attributes(
                                        child
                                    ) and not is_cloud_placeholder(child):
                                        stack.append(child)
                                    else:
                                        skipped += 1
                                    continue
                                if not entry.is_file(follow_symlinks=False):
                                    skipped += 1
                                    continue
                                # On some Windows Python builds, DirEntry.stat() returns zeroed
                                # device/inode fields. os.stat() provides the real file identity,
                                # which is required to distinguish files from hard links.
                                stat_result = os.stat(entry.path, follow_symlinks=False)
                                candidate = Path(entry.path)
                                if (
                                    self.safety_policy.is_protected(candidate)
                                    or self.safety_policy.has_protected_attributes(candidate)
                                    or is_cloud_placeholder(candidate)
                                ):
                                    skipped += 1
                                    continue
                                examined += 1
                                examined_bytes += stat_result.st_size
                                if stat_result.st_size == 0:
                                    skipped += 1
                                    continue
                                identity = _identity(stat_result)
                                if identity in seen_physical_files:
                                    skipped += 1
                                    continue
                                seen_physical_files.add(identity)
                                by_size[stat_result.st_size].append(
                                    (Path(entry.path), stat_result, scan_root)
                                )
                                if examined % 250 == 0:
                                    _emit(
                                        progress,
                                        "enumerating",
                                        examined,
                                        None,
                                        f"已找到 {examined:,} 個檔案",
                                    )
                            except OSError as error:
                                skipped += 1
                                warnings.append(f"略過 {entry.path}：{error}")
                except (OSError, PermissionError) as error:
                    skipped += 1
                    warnings.append(f"無法讀取 {directory}：{error}")

        hash_candidates = [
            item
            for bucket in by_size.values()
            if {candidate[2].role for candidate in bucket} == {"keep", "clean"}
            for item in bucket
        ]
        records: list[FileRecord] = []
        for index, (path, expected_stat, scan_root) in enumerate(hash_candidates, start=1):
            if _is_cancelled(cancel_event):
                raise ScanCancelled("Local scan cancelled")
            try:
                context = detect_safety_context(path, Path(scan_root.physical_path))
                # Identical project files can be independently required by separate programs.
                # Do not hash or surface them as duplicate candidates, even for manual unlock.
                if context.project:
                    skipped += 1
                    continue
                checksum = _hash_file(path, expected_stat, self.chunk_size)
                is_keep = scan_root.role == "keep"
                is_locked = scan_root.role == "clean" and context.requires_unlock
                selectable = scan_root.role == "clean" and not is_locked
                if is_keep:
                    protection_reason = "保留區檔案永遠保留"
                elif is_locked:
                    protection_reason = "此檔案位於程式、備份或同步情境，需逐資料夾解鎖"
                else:
                    protection_reason = None
                records.append(
                    FileRecord(
                        key=f"local:{path}",
                        source="local",
                        name=path.name,
                        location=str(path),
                        size=expected_stat.st_size,
                        checksum=checksum,
                        created_at=expected_stat.st_ctime,
                        modified_at=expected_stat.st_mtime,
                        metadata_token=_metadata_token(expected_stat),
                        can_delete=True,
                        mime_type="application/octet-stream",
                        source_root=scan_root.physical_path,
                        root_role=scan_root.role,
                        selectable=selectable,
                        auto_selectable=(
                            selectable and expected_stat.st_size >= MINIMUM_AUTO_SELECT_BYTES
                        ),
                        protection_reason=protection_reason,
                        safety_context=context,
                    )
                )
            except OSError as error:
                skipped += 1
                warnings.append(f"無法雜湊 {path}：{error}")
            _emit(
                progress,
                "hashing",
                index,
                len(hash_candidates),
                f"正在比對內容：{path.name}",
            )

        groups = build_local_duplicate_groups(records)
        capacity = 0
        measured_devices: set[int] = set()
        for scan_root in normalized_roots:
            root = Path(scan_root.physical_path)
            try:
                stat_result = root.stat()
                if stat_result.st_dev in measured_devices:
                    continue
                measured_devices.add(stat_result.st_dev)
                capacity += shutil.disk_usage(root).total
            except OSError:
                continue
        _emit(progress, "complete", examined, examined, "本機掃描完成")
        return ScanReport(
            source="local",
            groups=groups,
            examined_files=examined,
            hashed_files=len(records),
            skipped_files=skipped,
            examined_bytes=examined_bytes,
            storage_capacity_bytes=capacity or None,
            warnings=tuple(warnings),
        )


def _local_key_path(record: FileRecord) -> Path:
    prefix, separator, raw_path = record.key.partition(":")
    if prefix != "local" or not separator or not raw_path:
        raise UnsafePathError("本機檔案識別碼無效。")
    return Path(raw_path)


def _validate_local_snapshot(
    record: FileRecord,
    safety_policy: WindowsSafetyPolicy,
    chunk_size: int,
) -> Path:
    path = safety_policy.validate_regular_file(record.location)
    if record.source_root is None or record.root_role not in {"keep", "clean"}:
        raise UnsafePathError("檔案缺少經驗證的保留區或清理區資訊")
    source_root = safety_policy.validate_scan_root(record.source_root)
    if not _contains_path(source_root, path):
        raise UnsafePathError("檔案已離開原本掃描根目錄")
    current_context = detect_safety_context(path, source_root)
    if current_context.project:
        raise UnsafePathError("程式碼專案中的檔案屬於硬性保護範圍，不能清理。")
    key_path = safety_policy.validate_regular_file(_local_key_path(record))
    if os.path.normcase(str(path)) != os.path.normcase(str(key_path)):
        raise UnsafePathError("檔案路徑與掃描識別碼不一致。")
    current = path.stat()
    if record.metadata_token is None:
        raise SnapshotChangedError("缺少掃描快照，請重新掃描。")
    if _metadata_token(current) != record.metadata_token:
        raise SnapshotChangedError("檔案在掃描後已變更，已安全跳過。")
    if current.st_size != record.size or current.st_mtime != record.modified_at:
        raise SnapshotChangedError("檔案大小或修改時間已變更，已安全跳過。")
    checksum = _hash_file(path, current, chunk_size)
    if checksum != record.checksum:
        raise SnapshotChangedError("檔案內容校驗碼已變更，已安全跳過。")
    return path


def _preflight_items(
    items: tuple[OperationItem, ...],
    safety_policy: WindowsSafetyPolicy,
    chunk_size: int,
    operation_mode: OperationMode,
) -> tuple[list[tuple[OperationItem, Path]], list[ActionOutcome]]:
    valid: list[tuple[OperationItem, Path]] = []
    outcomes: list[ActionOutcome] = []
    keeper_cache: dict[str, str | Exception] = {}
    for item in items:
        try:
            if item.keeper.key not in keeper_cache:
                _validate_local_snapshot(item.keeper, safety_policy, chunk_size)
                keeper_cache[item.keeper.key] = item.keeper.checksum
            keeper_result = keeper_cache[item.keeper.key]
            if isinstance(keeper_result, Exception):
                raise keeper_result
            path = _validate_local_snapshot(item.record, safety_policy, chunk_size)
            valid.append((item, path))
        except (SnapshotChangedError, UnsafePathError, OSError) as error:
            keeper_cache.setdefault(item.keeper.key, error)
            outcomes.append(
                ActionOutcome(item.record, "skipped", str(error), operation_mode=operation_mode)
            )
    return valid, outcomes


class LocalTrashExecutor:
    def __init__(
        self,
        trash_func: Callable[[str], None] | None = None,
        *,
        safety_policy: WindowsSafetyPolicy = DEFAULT_WINDOWS_SAFETY_POLICY,
        chunk_size: int = 1024 * 1024,
    ) -> None:
        self._trash_func = trash_func
        self.safety_policy = safety_policy
        self.chunk_size = chunk_size

    def _get_trash_func(self) -> Callable[[str], None]:
        if self._trash_func is not None:
            return self._trash_func
        try:
            from send2trash import send2trash
        except ImportError as error:  # pragma: no cover - installation guard
            raise RuntimeError("send2trash is required for Recycle Bin support") from error
        return send2trash

    def trash(
        self,
        items: Iterable[OperationItem],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        queue = tuple(items)
        trash_func = self._get_trash_func()
        ready, outcomes = _preflight_items(queue, self.safety_policy, self.chunk_size, "trash")

        for index, (item, path) in enumerate(ready, start=1):
            record = item.record
            if _is_cancelled(cancel_event):
                outcomes.extend(
                    ActionOutcome(pending.record, "cancelled", "operation cancelled")
                    for pending, _path in ready[index - 1 :]
                )
                break
            try:
                # Re-stat immediately before the reversible operation. Permanent deletion has
                # its own executor and is never used as a fallback here.
                _validate_local_snapshot(record, self.safety_policy, self.chunk_size)
                trash_func(str(path))
                outcomes.append(ActionOutcome(record, "trashed"))
            except (SnapshotChangedError, UnsafePathError) as error:
                outcomes.append(ActionOutcome(record, "skipped", str(error)))
            except (OSError, RuntimeError) as error:
                outcomes.append(ActionOutcome(record, "failed", str(error)))
            _emit(
                progress,
                "trashing-local",
                index,
                len(ready),
                f"正在移到資源回收筒：{record.name}",
            )

        return ActionReport(source="local", outcomes=tuple(outcomes), operation_mode="trash")


class LocalPermanentDeleteExecutor:
    """Permanently delete only unchanged regular files after keeper revalidation."""

    def __init__(
        self,
        *,
        safety_policy: WindowsSafetyPolicy = DEFAULT_WINDOWS_SAFETY_POLICY,
        unlink_func: Callable[[str], None] = os.unlink,
        chunk_size: int = 1024 * 1024,
    ) -> None:
        self.safety_policy = safety_policy
        self.unlink_func = unlink_func
        self.chunk_size = chunk_size

    def delete(
        self,
        items: Iterable[OperationItem],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        queue = tuple(items)
        ready, outcomes = _preflight_items(queue, self.safety_policy, self.chunk_size, "permanent")
        for index, (item, path) in enumerate(ready, start=1):
            if _is_cancelled(cancel_event):
                outcomes.extend(
                    ActionOutcome(
                        pending.record,
                        "cancelled",
                        "operation cancelled",
                        operation_mode="permanent",
                    )
                    for pending, _pending_path in ready[index - 1 :]
                )
                break
            record = item.record
            try:
                # Perform the full snapshot check again at the destructive boundary.
                _validate_local_snapshot(item.keeper, self.safety_policy, self.chunk_size)
                current_path = _validate_local_snapshot(record, self.safety_policy, self.chunk_size)
                if current_path != path:
                    raise UnsafePathError("檔案實體路徑已變更，已安全跳過。")
                self.unlink_func(str(current_path))
                outcomes.append(ActionOutcome(record, "deleted", operation_mode="permanent"))
            except (SnapshotChangedError, UnsafePathError) as error:
                outcomes.append(
                    ActionOutcome(record, "skipped", str(error), operation_mode="permanent")
                )
            except (OSError, RuntimeError) as error:
                outcomes.append(
                    ActionOutcome(record, "failed", str(error), operation_mode="permanent")
                )
            _emit(
                progress,
                "deleting-local",
                index,
                len(ready),
                f"正在永久刪除：{record.name}",
            )
        return ActionReport(source="local", outcomes=tuple(outcomes), operation_mode="permanent")
