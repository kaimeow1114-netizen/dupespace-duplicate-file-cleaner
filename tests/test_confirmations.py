import pytest

from dupespace.confirmations import (
    ConfirmationSnapshot,
    TrashReminderSession,
    needs_large_operation_countdown,
    needs_second_confirmation,
    permanent_confirmation_phrase,
)


def snapshot(count: int = 6, mode: str = "trash") -> ConfirmationSnapshot:
    return ConfirmationSnapshot(count, 2, 1024, mode, "local")  # type: ignore[arg-type]


def test_over_five_files_requires_second_confirmation() -> None:
    assert needs_second_confirmation(snapshot(6))
    assert not needs_second_confirmation(snapshot(5))


def test_permanent_warning_cannot_be_suppressed() -> None:
    session = TrashReminderSession()
    with pytest.raises(ValueError):
        session.suppress(snapshot(1, "permanent"))


def test_trash_reminder_is_session_only_and_invalidates_on_selection_change() -> None:
    session = TrashReminderSession()
    original = snapshot(8)
    session.suppress(original)
    assert session.can_skip(original)
    assert not session.can_skip(snapshot(9))
    assert not TrashReminderSession().can_skip(original)


def test_large_permanent_delete_uses_exact_phrase_and_countdown() -> None:
    high_risk = ConfirmationSnapshot(500, 5, 1024, "permanent", "drive")
    assert needs_large_operation_countdown(high_risk)
    assert permanent_confirmation_phrase(500) == "永久刪除 500 個檔案"
