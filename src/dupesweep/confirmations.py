from __future__ import annotations

from dataclasses import dataclass

from .models import OperationMode

GIB = 1024**3


@dataclass(frozen=True, slots=True)
class ConfirmationSnapshot:
    selected_count: int
    group_count: int
    selected_bytes: int
    operation_mode: OperationMode
    source_token: str


def permanent_confirmation_phrase(selected_count: int) -> str:
    return f"永久刪除 {selected_count} 個檔案"


def needs_large_operation_countdown(snapshot: ConfirmationSnapshot) -> bool:
    return (
        snapshot.selected_count >= 500
        or snapshot.selected_bytes >= GIB
        or snapshot.selected_count >= 5_000
    )


def needs_second_confirmation(snapshot: ConfirmationSnapshot) -> bool:
    return snapshot.selected_count > 5


class TrashReminderSession:
    """In-memory only; deliberately has no persistence API."""

    def __init__(self) -> None:
        self._suppressed_for: ConfirmationSnapshot | None = None

    def suppress(self, snapshot: ConfirmationSnapshot) -> None:
        if snapshot.operation_mode != "trash":
            raise ValueError("Permanent-delete warnings can never be suppressed")
        self._suppressed_for = snapshot

    def can_skip(self, snapshot: ConfirmationSnapshot) -> bool:
        return snapshot.operation_mode == "trash" and snapshot == self._suppressed_for

    def invalidate(self) -> None:
        self._suppressed_for = None
