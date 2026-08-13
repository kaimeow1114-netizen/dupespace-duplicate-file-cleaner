from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

SourceKind = Literal["local", "drive"]
OutcomeStatus = Literal["trashed", "failed", "cancelled"]


@dataclass(frozen=True, slots=True)
class FileRecord:
    """A file snapshot captured during a duplicate scan."""

    key: str
    source: SourceKind
    name: str
    location: str
    size: int
    checksum: str
    created_at: float | None = None
    modified_at: float | None = None
    metadata_token: str | None = None
    can_trash: bool = True
    web_url: str | None = None

    @property
    def fingerprint(self) -> str:
        return f"{self.size}:{self.checksum}"


@dataclass(frozen=True, slots=True)
class DuplicateGroup:
    fingerprint: str
    records: tuple[FileRecord, ...]
    keeper_key: str

    def __post_init__(self) -> None:
        if len(self.records) < 2:
            raise ValueError("A duplicate group must contain at least two records")
        keys = {record.key for record in self.records}
        if len(keys) != len(self.records):
            raise ValueError("Duplicate record keys are not allowed")
        if self.keeper_key not in keys:
            raise ValueError("The keeper must belong to the group")

    @property
    def keeper(self) -> FileRecord:
        return next(record for record in self.records if record.key == self.keeper_key)

    @property
    def reclaimable_bytes(self) -> int:
        return self.records[0].size * (len(self.records) - 1)


@dataclass(frozen=True, slots=True)
class ScanReport:
    source: SourceKind
    groups: tuple[DuplicateGroup, ...]
    examined_files: int
    hashed_files: int
    skipped_files: int = 0
    examined_bytes: int = 0
    storage_capacity_bytes: int | None = None
    warnings: tuple[str, ...] = ()

    @property
    def duplicate_copies(self) -> int:
        return sum(len(group.records) - 1 for group in self.groups)

    @property
    def reclaimable_bytes(self) -> int:
        return sum(group.reclaimable_bytes for group in self.groups)


@dataclass(frozen=True, slots=True)
class ActionOutcome:
    record: FileRecord
    status: OutcomeStatus
    error: str | None = None


@dataclass(frozen=True, slots=True)
class ActionReport:
    source: SourceKind
    outcomes: tuple[ActionOutcome, ...] = field(default_factory=tuple)

    @property
    def trashed(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "trashed")

    @property
    def failed(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "failed")

    @property
    def cancelled(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "cancelled")


@dataclass(frozen=True, slots=True)
class ProgressUpdate:
    stage: str
    current: int
    total: int | None
    message: str
