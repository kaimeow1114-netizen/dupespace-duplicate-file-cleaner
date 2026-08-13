from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Set

from .models import DuplicateGroup, FileRecord


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


def default_selection(groups: Iterable[DuplicateGroup]) -> set[str]:
    """Select every trashable extra copy while always protecting the keeper."""

    return {
        record.key
        for group in groups
        for record in group.records
        if record.key != group.keeper_key and record.can_trash
    }


def validate_selection(groups: Iterable[DuplicateGroup], selected: Set[str]) -> None:
    records: dict[str, FileRecord] = {}
    protected: set[str] = set()
    for group in groups:
        protected.add(group.keeper_key)
        records.update((record.key, record) for record in group.records)

    unknown = set(selected) - records.keys()
    if unknown:
        raise ValueError(f"Selection contains {len(unknown)} unknown file(s)")

    selected_keepers = set(selected) & protected
    if selected_keepers:
        raise ValueError("A protected keeper cannot be moved to trash")

    forbidden = [key for key in selected if not records[key].can_trash]
    if forbidden:
        raise ValueError("Selection contains a file that cannot be moved to trash")


def selected_records(
    groups: Iterable[DuplicateGroup], selected: Set[str]
) -> tuple[FileRecord, ...]:
    validate_selection(groups, selected)
    return tuple(
        record for group in groups for record in group.records if record.key in selected
    )


def selected_bytes(groups: Iterable[DuplicateGroup], selected: Set[str]) -> int:
    return sum(
        record.size for group in groups for record in group.records if record.key in selected
    )
