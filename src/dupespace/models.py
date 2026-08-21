from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

SourceKind = Literal["local", "drive"]
OperationMode = Literal["trash", "permanent"]
OutcomeStatus = Literal["trashed", "deleted", "failed", "skipped", "cancelled"]
RootRole = Literal["keep", "clean"]


@dataclass(frozen=True, slots=True)
class ScanRoot:
    """A canonical scan root with an explicit safety role."""

    physical_path: str
    role: RootRole


@dataclass(frozen=True, slots=True)
class SafetyContext:
    """Context that can make an otherwise exact duplicate unsafe to auto-select."""

    project: bool = False
    application: bool = False
    backup: bool = False
    sync: bool = False
    cloud_placeholder: bool = False
    locked_folder: str | None = None

    @property
    def requires_unlock(self) -> bool:
        """Whether a non-project risk folder may be unlocked for this scan only."""

        return any((self.application, self.backup, self.sync))

    @property
    def is_hard_protected(self) -> bool:
        """Contexts that can never become an operation target."""

        return self.project or self.cloud_placeholder


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
    can_delete: bool = False
    mime_type: str | None = None
    web_url: str | None = None
    parent_ids: tuple[str, ...] = ()
    source_root: str | None = None
    root_role: RootRole | None = None
    selectable: bool = True
    auto_selectable: bool = True
    protection_reason: str | None = None
    safety_context: SafetyContext = field(default_factory=SafetyContext)

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
        return sum(
            record.size
            for record in self.records
            if record.key != self.keeper_key and record.root_role != "keep"
        )


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
    operation_mode: OperationMode = "trash"
    occurred_at: str = field(
        default_factory=lambda: (
            datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        )
    )


@dataclass(frozen=True, slots=True)
class ActionReport:
    source: SourceKind
    outcomes: tuple[ActionOutcome, ...] = field(default_factory=tuple)
    operation_mode: OperationMode = "trash"

    @property
    def trashed(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "trashed")

    @property
    def failed(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "failed")

    @property
    def deleted(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "deleted")

    @property
    def skipped(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "skipped")

    @property
    def cancelled(self) -> tuple[ActionOutcome, ...]:
        return tuple(outcome for outcome in self.outcomes if outcome.status == "cancelled")


@dataclass(frozen=True, slots=True)
class ProgressUpdate:
    stage: str
    current: int
    total: int | None
    message: str


@dataclass(frozen=True, slots=True)
class OperationItem:
    """One selected duplicate and the protected keeper that makes it safe to remove."""

    record: FileRecord
    keeper: FileRecord

    def __post_init__(self) -> None:
        if self.record.key == self.keeper.key:
            raise ValueError("A keeper cannot be an operation target")
        if self.record.source != self.keeper.source:
            raise ValueError("Target and keeper must use the same source")
        if self.record.fingerprint != self.keeper.fingerprint:
            raise ValueError("Target and keeper must have the same fingerprint")
        if self.record.source == "local":
            if self.keeper.root_role != "keep" or self.record.root_role != "clean":
                raise ValueError(
                    "Local operations require a keep-root keeper and clean-root target"
                )
            if not self.record.selectable:
                raise ValueError("A locked local file cannot be an operation target")
            if self.record.safety_context.is_hard_protected:
                raise ValueError(
                    "A project or cloud-placeholder file cannot be an operation target"
                )
