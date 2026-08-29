from __future__ import annotations

import os
import time
from dataclasses import replace

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtCore import Qt  # noqa: E402
from PySide6.QtGui import QFontDatabase  # noqa: E402
from PySide6.QtTest import QTest  # noqa: E402
from PySide6.QtWidgets import QApplication, QCheckBox, QDialog  # noqa: E402

from dupespace.confirmations import ConfirmationSnapshot  # noqa: E402
from dupespace.desktop.dialogs import ConfirmationDialog, DetailsDialog  # noqa: E402
from dupespace.desktop.operations import CleanupResult  # noqa: E402
from dupespace.desktop.state import ScanSession, read_preferences, save_preferences  # noqa: E402
from dupespace.desktop.widgets import DuplicateModel  # noqa: E402
from dupespace.desktop.window import MainWindow  # noqa: E402
from dupespace.models import (  # noqa: E402
    ActionOutcome,
    ActionReport,
    DuplicateGroup,
    FileRecord,
    SafetyContext,
    ScanReport,
    ScanRoot,
)


@pytest.fixture(scope="module")
def application():
    app = QApplication.instance() or QApplication([])
    app.setStyle("Fusion")
    if os.name == "nt":
        for font in ("msjh.ttc", "msjhbd.ttc", "segoeui.ttf", "segoeuib.ttf"):
            QFontDatabase.addApplicationFont(f"C:/Windows/Fonts/{font}")
    yield app


@pytest.fixture
def window(application, tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    instance = MainWindow(restore_session=False)
    instance.reduced_motion = True
    instance.sound.muted = True
    instance.show()
    application.processEvents()
    yield instance
    assert not instance.busy
    instance.close()
    instance.deleteLater()
    application.processEvents()


def report_with_copies(count=2, *, size=1024**2) -> ScanReport:
    keeper = FileRecord(
        "keep",
        "local",
        "photo.jpg",
        "D:/原檔/photo.jpg",
        size,
        "sha256:abc",
        root_role="keep",
        source_root="D:/原檔",
        can_delete=True,
    )
    copies = tuple(
        replace(
            keeper,
            key=f"copy-{index}",
            root_role="clean",
            source_root="D:/待整理",
            location=f"D:/待整理/不同相簿-{index}.jpg",
            name=f"不同相簿-{index}.jpg",
            auto_selectable=size >= 1024**2,
        )
        for index in range(count)
    )
    group = DuplicateGroup(keeper.fingerprint, (keeper, *copies), keeper.key)
    return ScanReport("local", (group,), count + 1, count + 1, examined_bytes=(count + 1) * size)


def test_virtual_model_handles_10000_copies_without_checkbox_widgets(window):
    window._accept_scan(report_with_copies(10_000))
    assert window.model.rowCount() == 10_001
    assert len(window.session.selected) == 10_000
    assert window.table.findChildren(QCheckBox) == []
    assert window.table.model() is window.model
    window.table.scrollToBottom()


def test_keeper_checkbox_is_not_available_even_when_called_directly(application):
    state = ScanSession()
    state.accept_scan(report_with_copies())
    model = DuplicateModel(state)
    keeper = model.index(0, 0)
    assert model.data(keeper, Qt.ItemDataRole.CheckStateRole) is None
    assert not model.flags(keeper) & Qt.ItemFlag.ItemIsUserCheckable
    assert not model.setData(keeper, Qt.CheckState.Checked, Qt.ItemDataRole.CheckStateRole)
    assert "keep" not in state.selected


def test_permanent_mode_clears_selection_and_cannot_include_folders(window):
    report = report_with_copies()
    folder_records = tuple(replace(item, item_kind="folder") for item in report.groups[0].records)
    group = replace(report.groups[0], records=folder_records)
    window._accept_scan(replace(report, groups=(group,)))
    assert window.session.selected
    window._change_mode("permanent")
    assert window.session.selected == set()
    window._select_all()
    assert window.session.selected == set()
    assert not window.clean_button.isEnabled()
    window._change_mode("trash")
    assert window.session.selected == set()


def test_small_files_stay_unselected_until_explicit_select_all(window):
    window._accept_scan(report_with_copies(3, size=20))
    assert window.session.selected == set()
    window._select_all()
    assert len(window.session.selected) == 3


def test_search_keeps_original_visible_with_matching_copy(window):
    window._accept_scan(report_with_copies())
    window.search.setText("不同相簿-1")
    assert window.model.rowCount() == 3
    assert window.model.rows[0][1].root_role == "keep"


def test_rescan_invalidates_previous_confirmation_and_unlocks():
    session = ScanSession()
    report = report_with_copies()
    session.accept_scan(report)
    original = session.snapshot()
    session.reminders.suppress(original)
    session.accept_scan(report)
    with pytest.raises(ValueError, match="重新確認"):
        session.plan(original)
    assert not session.reminders.can_skip(session.snapshot())


@pytest.mark.parametrize("count,second", [(1, False), (5, False), (6, True), (5000, True)])
def test_trash_confirmations_and_session_checkbox(application, count, second):
    from dupespace.confirmations import needs_second_confirmation

    snapshot = ConfirmationSnapshot(count, 1, 100, "trash", "local")
    assert needs_second_confirmation(snapshot) is second
    dialog = ConfirmationDialog(None, snapshot, "D:/test", second=second)
    dialog.show()
    assert dialog.remember.isVisible() is second
    dialog.reject()


@pytest.mark.parametrize("count", [1, 6, 5000])
def test_permanent_warning_cannot_be_suppressed_or_accepted_with_enter(application, count):
    dialog = ConfirmationDialog(
        None, ConfirmationSnapshot(count, 1, 100, "permanent", "test"), "D:/test", second=count > 5
    )
    dialog.show()
    assert not dialog.remember.isVisible()
    assert dialog.confirm_button.isEnabled() is (count == 1)
    dialog.confirm_button.setFocus()
    QTest.keyClick(dialog.confirm_button, Qt.Key.Key_Return)
    assert dialog.result() == QDialog.DialogCode.Rejected
    assert dialog.isVisible()
    QTest.keyClick(dialog, Qt.Key.Key_Escape)
    assert not dialog.isVisible()


def test_large_permanent_confirmation_requires_exact_count_and_wait(application):
    dialog = ConfirmationDialog(
        None,
        ConfirmationSnapshot(5000, 3, 2 * 1024**3, "permanent", "test"),
        "D:/test",
        second=True,
    )
    dialog.phrase.setText("永久刪除 5000 個檔案")
    assert not dialog.confirm_button.isEnabled()
    dialog.deadline = time.monotonic() - 1
    dialog.phrase.setText("永久刪除 4999 個檔案")
    assert not dialog.confirm_button.isEnabled()
    dialog.phrase.setText("永久刪除 5000 個檔案")
    assert dialog.confirm_button.isEnabled()
    dialog.reject()


def test_pending_drive_status_and_every_navigation_page(window):
    for key in ("drive", "history", "safety", "github", "local"):
        window.nav_buttons[key].click()
        assert window.current_page == key
    assert window.connect_button.text() == "連接 Google Drive"
    assert window.account_chip.text() == "未登入"


def test_sidebar_exposes_safe_in_app_updates_without_network_on_test_start(window):
    assert window.update_button.text() == "檢查更新"
    assert window.update_button.icon().isNull() is False
    assert "WINDOWS" in window.version_label.text()
    assert window.update_thread is None


def test_sidebar_collapses_to_icons_and_preserves_account_access(window):
    window._toggle_sidebar()
    assert window.sidebar.width() == 72
    assert window.nav_buttons["local"].text() == ""
    assert window.account_chip.text() == ""
    assert "未登入" in window.account_chip.toolTip()
    window._toggle_sidebar()
    assert window.sidebar.width() == 220
    assert window.nav_buttons["local"].text() == "本機清理"
    assert window.account_chip.text() == "未登入"


def test_folder_picker_shows_cleanup_and_optional_nested_protection(window):
    window.session.roots = (
        ScanRoot("D:/照片", "clean"),
        ScanRoot("D:/照片/原始檔", "keep"),
    )
    window._refresh_roots()
    assert window.root_picker.count() == 2
    assert "1 個整理位置" in window.root_summary.text()
    assert "1 個保護資料夾" in window.root_summary.text()
    window.root_picker.setCurrentRow(0)
    assert "D:/照片" in window.current_root_feedback.text()
    assert window.protect_root_button.isEnabled()
    window.root_picker.setCurrentRow(1)
    assert "永遠不可選取" in window.current_root_feedback.text()
    assert not window.protect_root_button.isEnabled()


def test_progress_displays_current_full_folder_path(window):
    from dupespace.models import ProgressUpdate

    current = "D:/照片/2026/旅行"
    window._progress(ProgressUpdate("enumerating", 42, None, f"正在掃描：{current}"))
    assert current in window.progress_path.toolTip()
    assert "正在讀取資料夾" in window.progress_stage.text()
    assert "42" in window.progress_count.text()


def test_account_chip_uses_real_identity_and_avatar_slot(window):
    window._auth_silent = False
    window._accept_account((object(), "測試使用者", "preview@example.test", b""))
    assert "preview@example.test" in window.account_chip.text()
    assert window.drive_scan.isVisible()
    window._disconnected(None)
    assert not window.drive_scan.isVisible()
    assert window.service is None


def test_cleanup_result_plays_one_batch_sound_and_never_claims_trash_frees_disk(
    window, monkeypatch, tmp_path
):
    report = report_with_copies(5000)
    window._accept_scan(report)
    played = []
    monkeypatch.setattr(window.sound, "play", played.append)
    result = ActionReport(
        "local", tuple(ActionOutcome(item, "trashed") for item in report.groups[0].records[1:])
    )
    window._accept_cleanup(CleanupResult(result, tmp_path / "report.csv", tmp_path / "journal.csv"))
    assert played == ["trash"]
    assert "不等於已釋放" in window.restore_notice.message.text()
    assert window.session.selected == set()
    assert window.session.groups == ()


@pytest.mark.parametrize("_repeat", range(5))
def test_close_while_busy_waits_for_safe_stop_and_worker_completion(window, application, _repeat):
    callbacks = []

    def task(_emit):
        window.cancel_event.wait(3)
        return "stopped"

    window._launch(task, callbacks.append, "test", "test")
    window.close()
    assert window.busy and window.close_requested
    assert window.cancel_event.is_set()
    deadline = time.monotonic() + 5
    while window.busy and time.monotonic() < deadline:
        QTest.qWait(20)
    assert not window.busy
    assert callbacks == ["stopped"]
    assert not window.isVisible()


def test_report_detail_is_plain_text_and_nonimage_does_not_execute(window):
    group = report_with_copies().groups[0]
    record = replace(group.records[1], name="<script>payload.exe</script>")
    dialog = DetailsDialog(window, group, record)
    dialog.show()
    assert dialog.isVisible()
    dialog.reject()


def test_settings_do_not_persist_session_confirmation(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    session = ScanSession()
    session.accept_scan(report_with_copies())
    session.reminders.suppress(session.snapshot())
    save_preferences({"sound_muted": True, "reduced_motion": True})
    assert read_preferences() == {"sound_muted": True, "reduced_motion": True}
    assert not ScanSession().reminders.can_skip(session.snapshot())


@pytest.mark.parametrize("dimensions", [(1320, 860), (1060, 660), (980, 580)])
def test_compact_work_area_keeps_action_button_inside_window(window, application, dimensions):
    window.resize(*dimensions)
    window._accept_scan(report_with_copies(5000))
    application.processEvents()
    bottom = window.clean_button.mapTo(window, window.clean_button.rect().bottomRight())
    assert bottom.x() < window.width()
    assert bottom.y() < window.height()
    assert window.table.height() >= 55
    assert window.table.horizontalScrollBar().maximum() == 0


def test_project_records_remain_hard_protected_even_if_selectable_is_tampered():
    session = ScanSession()
    report = report_with_copies()
    group = report.groups[0]
    records = tuple(
        replace(item, safety_context=SafetyContext(project=True)) for item in group.records
    )
    session.accept_scan(replace(report, groups=(replace(group, records=records),)))
    session.select_all()
    assert session.selected == set()
