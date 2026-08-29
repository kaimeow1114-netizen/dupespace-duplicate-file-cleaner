from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Set
from dataclasses import replace
from pathlib import Path

from .models import DuplicateGroup, FileRecord, OperationItem, OperationMode


def _keeper_rank(record: FileRecord) -> tuple[float, int, str, str]:
    timestamp = record.created_at
    if timestamp is None:
        timestamp = record.modified_at
    if timestamp is None:
        timestamp = float("inf")
    return (timestamp, len(record.location), record.location.casefold(), record.key)


def build_duplicate_groups(records: Iterable[FileRecord]) -> tuple[DuplicateGroup, ...]:
    buckets: dict[str, list[FileRecord]] = defaultdict(list)
    for record in records:
        buckets[record.fingerprint].append(record)

    groups: list[DuplicateGroup] = []
    for fingerprint, bucket in buckets.items():
        if len(bucket) < 2:
            continue
        ordered = tuple(sorted(bucket, key=_keeper_rank))
        groups.append(
            DuplicateGroup(
                fingerprint=fingerprint,
                records=ordered,
                keeper_key=ordered[0].key,
            )
        )

    return tuple(
        sorted(
            groups,
            key=lambda group: (
                -group.reclaimable_bytes,
                group.records[0].name.casefold(),
                group.fingerprint,
            ),
        )
    )


def build_local_duplicate_groups(records: Iterable[FileRecord]) -> tuple[DuplicateGroup, ...]:
    """Build exact local groups, preferring optional protected-root keepers."""

    buckets: dict[str, list[FileRecord]] = defaultdict(list)
    for record in records:
        if record.safety_context.is_hard_protected:
            continue
        buckets[record.fingerprint].append(record)

    groups: list[DuplicateGroup] = []
    for fingerprint, bucket in buckets.items():
        protected = sorted(
            (record for record in bucket if record.root_role == "keep"), key=_keeper_rank
        )
        clean = sorted(
            (record for record in bucket if record.root_role == "clean"), key=_keeper_rank
        )
        if not clean or len(protected) + len(clean) < 2:
            continue
        keeper = protected[0] if protected else clean[0]
        ordered = tuple(protected + clean)
        groups.append(DuplicateGroup(fingerprint, ordered, keeper.key))

    return tuple(
        sorted(
            groups,
            key=lambda group: (
                -group.reclaimable_bytes,
                group.records[0].name.casefold(),
                group.fingerprint,
            ),
        )
    )


def default_selection(
    groups: Iterable[DuplicateGroup], operation_mode: OperationMode = "trash"
) -> set[str]:
    """Select only explicitly safe trash targets; permanent delete starts empty."""

    if operation_mode == "permanent":
        return set()

    return {
        record.key
        for group in groups
        for record in group.records
        if record.key != group.keeper_key
        and record.root_role != "keep"
        and record.selectable
        and record.auto_selectable
        and record.can_trash
    }


def validate_selection(
    groups: Iterable[DuplicateGroup],
    selected: Set[str],
    operation_mode: OperationMode = "trash",
) -> None:
    records: dict[str, FileRecord] = {}
    protected: set[str] = set()
    for group in groups:
        protected.add(group.keeper_key)
        protected.update(record.key for record in group.records if record.root_role == "keep")
        records.update((record.key, record) for record in group.records)

    unknown = set(selected) - records.keys()
    if unknown:
        raise ValueError(f"Selection contains {len(unknown)} unknown file(s)")

    selected_keepers = set(selected) & protected
    if selected_keepers:
        raise ValueError("A protected keeper or protected-folder file cannot be removed")

    locked = [key for key in selected if not records[key].selectable]
    if locked:
        raise ValueError("Selection contains a protected or locked file")

    forbidden = [
        key
        for key in selected
        if not (
            records[key].can_trash
            if operation_mode == "trash"
            else records[key].can_delete and records[key].item_kind == "file"
        )
    ]
    if forbidden:
        action = "moved to trash" if operation_mode == "trash" else "permanently deleted"
        raise ValueError(f"Selection contains a file that cannot be {action}")


def selected_records(
    groups: Iterable[DuplicateGroup],
    selected: Set[str],
    operation_mode: OperationMode = "trash",
) -> tuple[FileRecord, ...]:
    validate_selection(groups, selected, operation_mode)
    return tuple(record for group in groups for record in group.records if record.key in selected)


def operation_items(
    groups: Iterable[DuplicateGroup],
    selected: Set[str],
    operation_mode: OperationMode = "trash",
) -> tuple[OperationItem, ...]:
    """Build an immutable target/keeper plan after validating the current selection."""

    materialized = tuple(groups)
    validate_selection(materialized, selected, operation_mode)
    return tuple(
        OperationItem(record=record, keeper=group.keeper)
        for group in materialized
        for record in group.records
        if record.key in selected
    )


def selected_bytes(groups: Iterable[DuplicateGroup], selected: Set[str]) -> int:
    return sum(
        record.size for group in groups for record in group.records if record.key in selected
    )


def unlock_locked_folder(
    groups: Iterable[DuplicateGroup], folder: str, confirmation: str
) -> tuple[DuplicateGroup, ...]:
    """Unlock one risk-context folder for this in-memory scan result only."""

    folder_path = Path(folder)
    required = f"允許清理 {folder_path.name}"
    if not folder_path.name or confirmation != required:
        raise ValueError(f"Type exactly: {required}")

    changed = False
    rebuilt: list[DuplicateGroup] = []
    for group in groups:
        records: list[FileRecord] = []
        for record in group.records:
            context = record.safety_context
            if (
                record.root_role == "clean"
                and not context.is_hard_protected
                and context.locked_folder is not None
                and Path(context.locked_folder) == folder_path
            ):
                records.append(
                    replace(
                        record,
                        selectable=True,
                        auto_selectable=False,
                        protection_reason=None,
                    )
                )
                changed = True
            else:
                records.append(record)
        rebuilt.append(replace(group, records=tuple(records)))
    if not changed:
        raise ValueError("The requested folder is not locked in this scan")
    return tuple(rebuilt)
