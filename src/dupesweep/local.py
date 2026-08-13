from __future__ import annotations

import hashlib
import os
import shutil
import threading
from collections import defaultdict
from collections.abc import Callable, Iterable
from pathlib import Path

from .grouping import build_duplicate_groups
from .models import ActionOutcome, ActionReport, FileRecord, ProgressUpdate, ScanReport

ProgressCallback = Callable[[ProgressUpdate], None]


class ScanCancelled(RuntimeError):
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
        raise OSError("file changed while it was being hashed")
    return f"sha256:{digest.hexdigest()}"


def _normalize_roots(roots: Iterable[str | os.PathLike[str]]) -> tuple[Path, ...]:
    candidates = sorted(
        {Path(root).expanduser().resolve(strict=False) for root in roots},
        key=lambda path: (len(path.parts), str(path).casefold()),
    )
    normalized: list[Path] = []
    for candidate in candidates:
        if any(candidate == parent or parent in candidate.parents for parent in normalized):
            continue
        normalized.append(candidate)
    return tuple(normalized)


class LocalScanner:
    """Two-stage scanner: size bucketing first, then full SHA-256 hashing."""

    def __init__(self, chunk_size: int = 1024 * 1024) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        self.chunk_size = chunk_size

    def scan(
        self,
        roots: Iterable[str | os.PathLike[str]],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ScanReport:
        normalized_roots = _normalize_roots(roots)
        if not normalized_roots:
            raise ValueError("Choose at least one folder")

        by_size: dict[int, list[tuple[Path, os.stat_result]]] = defaultdict(list)
        seen_physical_files: set[tuple[int, int]] = set()
        warnings: list[str] = []
        examined = 0
        examined_bytes = 0
        skipped = 0

        for root in normalized_roots:
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
                    with os.scandir(directory) as entries:
                        for entry in entries:
                            if _is_cancelled(cancel_event):
                                raise ScanCancelled("Local scan cancelled")
                            try:
                                if entry.is_symlink():
                                    skipped += 1
                                    continue
                                if entry.is_dir(follow_symlinks=False):
                                    stack.append(Path(entry.path))
                                    continue
                                if not entry.is_file(follow_symlinks=False):
                                    skipped += 1
                                    continue
                                # On some Windows Python builds, DirEntry.stat() returns zeroed
                                # device/inode fields. os.stat() provides the real file identity,
                                # which is required to distinguish files from hard links.
                                stat_result = os.stat(entry.path, follow_symlinks=False)
                                examined += 1
                                examined_bytes += stat_result.st_size
                                identity = _identity(stat_result)
                                if identity in seen_physical_files:
                                    skipped += 1
                                    continue
                                seen_physical_files.add(identity)
                                by_size[stat_result.st_size].append(
                                    (Path(entry.path), stat_result)
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
            if len(bucket) > 1
            for item in bucket
        ]
        records: list[FileRecord] = []
        for index, (path, expected_stat) in enumerate(hash_candidates, start=1):
            if _is_cancelled(cancel_event):
                raise ScanCancelled("Local scan cancelled")
            try:
                checksum = _hash_file(path, expected_stat, self.chunk_size)
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

        groups = build_duplicate_groups(records)
        capacity = 0
        measured_devices: set[int] = set()
        for root in normalized_roots:
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


class LocalTrashExecutor:
    def __init__(self, trash_func: Callable[[str], None] | None = None) -> None:
        self._trash_func = trash_func

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
        records: Iterable[FileRecord],
        *,
        progress: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> ActionReport:
        queue = tuple(records)
        trash_func = self._get_trash_func()
        outcomes: list[ActionOutcome] = []

        for index, record in enumerate(queue, start=1):
            if _is_cancelled(cancel_event):
                outcomes.extend(
                    ActionOutcome(pending, "cancelled", "operation cancelled")
                    for pending in queue[index - 1 :]
                )
                break
            try:
                path = Path(record.location)
                current = path.stat()
                if record.metadata_token is None:
                    raise OSError("scan metadata is missing; rescan before cleanup")
                if _metadata_token(current) != record.metadata_token:
                    raise OSError("file changed after the scan; rescan before cleanup")
                trash_func(str(path))
                outcomes.append(ActionOutcome(record, "trashed"))
            except (OSError, RuntimeError) as error:
                outcomes.append(ActionOutcome(record, "failed", str(error)))
            _emit(
                progress,
                "trashing-local",
                index,
                len(queue),
                f"正在移到資源回收筒：{record.name}",
            )

        return ActionReport(source="local", outcomes=tuple(outcomes))
