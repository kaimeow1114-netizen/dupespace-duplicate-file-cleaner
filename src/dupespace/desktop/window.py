from __future__ import annotations

import csv
import sys
import threading
import time
from collections.abc import Callable
from contextlib import suppress
from importlib.resources import files
from pathlib import Path

from PySide6.QtCore import (
    QEasingCurve,
    QObject,
    QProcess,
    QPropertyAnimation,
    QSize,
    Qt,
    QThread,
    QTimer,
    QUrl,
    QVariantAnimation,
    Signal,
    Slot,
)
from PySide6.QtGui import QCloseEvent, QDesktopServices, QIcon, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QApplication,
    QButtonGroup,
    QCheckBox,
    QComboBox,
    QDialog,
    QFileDialog,
    QFrame,
    QGraphicsOpacityEffect,
    QHBoxLayout,
    QHeaderView,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QProgressBar,
    QScrollArea,
    QSlider,
    QStackedWidget,
    QTableView,
    QVBoxLayout,
    QWidget,
)

from .. import __version__
from ..confirmations import needs_second_confirmation
from ..drive import (
    DriveAuthenticationError,
    DriveScanCancelled,
    GoogleDriveScanner,
    build_drive_service,
    desktop_account_identity,
    disconnect_desktop_account,
)
from ..grouping import selected_bytes, unlock_locked_folder
from ..local import LocalScanner, ScanCancelled
from ..models import ProgressUpdate, ScanReport, ScanRoot
from ..paths import app_data_dir
from ..reporting import default_report_dir
from ..sound import SoundPlayer
from ..updater import (
    ReleaseInfo,
    UpdateError,
    VerifiedInstaller,
    check_for_update,
    download_update,
    verify_installer,
)
from .dialogs import ConfirmationDialog, DetailsDialog
from .operations import CleanupResult, run_cleanup
from .state import ScanSession, format_bytes, read_preferences, save_preferences
from .widgets import (
    EMERALD,
    STYLES,
    TEAL,
    Card,
    DuplicateModel,
    FileDelegate,
    Notice,
    ScanOrbit,
    button,
    icon,
    label,
)

WEBSITE = "https://dupespace.app"
GITHUB = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner"
UPDATE_INTERVAL_SECONDS = 24 * 60 * 60


class Worker(QObject):
    progress = Signal(object)
    result = Signal(object)
    error = Signal(object)
    finished = Signal()

    def __init__(self, task: Callable) -> None:
        super().__init__()
        self.task = task
        self.last_progress = 0.0

    def emit_progress(self, update: ProgressUpdate) -> None:
        now = time.monotonic()
        if now - self.last_progress >= 0.08 or update.current == update.total:
            self.progress.emit(update)
            self.last_progress = now

    @Slot()
    def run(self) -> None:
        try:
            self.result.emit(self.task(self.emit_progress))
        except Exception as error:
            self.error.emit(error)
        finally:
            self.finished.emit()


def scroll_page() -> tuple[QScrollArea, QVBoxLayout]:
    scroll = QScrollArea()
    scroll.setWidgetResizable(True)
    scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
    content = QWidget()
    content.setObjectName("page")
    layout = QVBoxLayout(content)
    layout.setContentsMargins(32, 28, 32, 28)
    layout.setSpacing(20)
    scroll.setWidget(content)
    return scroll, layout


class MainWindow(QMainWindow):
    def __init__(self, *, restore_session: bool = True) -> None:
        super().__init__()
        self.session = ScanSession()
        self.sound = SoundPlayer()
        self.preferences = read_preferences()
        self.reduced_motion = bool(self.preferences.get("reduced_motion", False))
        self.restore_session = restore_session
        self.service = None
        self.account_name = ""
        self.account_email = ""
        self.busy = False
        self.close_requested = False
        self.cancel_event = threading.Event()
        self.thread: QThread | None = None
        self.worker: Worker | None = None
        self.last_result: CleanupResult | None = None
        self.current_page = "local"
        self.root_lists: dict[str, QListWidget] = {}
        self.root_views: dict[str, QStackedWidget] = {}
        self.nav_buttons = {}
        self.update_thread: QThread | None = None
        self.update_worker: Worker | None = None
        self.update_release: ReleaseInfo | None = None
        self.verified_installer: VerifiedInstaller | None = None
        self.update_dialog: QDialog | None = None
        self._update_result = None
        self._update_error: Exception | None = None
        self._update_callback: Callable | None = None
        self._update_manual = False
        self._update_job = ""
        self.setWindowTitle("DUPESPACE · 安心留好每一份重要檔案")
        self.setWindowIcon(QIcon(str(files("dupespace.assets").joinpath("dupespace.ico"))))
        self.setMinimumSize(980, 580)
        screen = QApplication.primaryScreen().availableGeometry()
        self.resize(min(1320, screen.width() - 50), min(860, screen.height() - 50))
        self.setStyleSheet(STYLES)
        self._build_shell()
        self._refresh_roots()
        self.navigate("local")
        if restore_session:
            QTimer.singleShot(2200, self._auto_update_check)

    def _build_shell(self) -> None:
        central = QWidget()
        shell = QHBoxLayout(central)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.setSpacing(0)
        self.setCentralWidget(central)
        sidebar = QFrame()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(220)
        side = QVBoxLayout(sidebar)
        side.setContentsMargins(17, 27, 17, 22)
        side.setSpacing(6)
        logo = QLabel()
        pixmap = QPixmap(str(files("dupespace.assets").joinpath("dupespace-icon.png")))
        logo.setPixmap(
            pixmap.scaled(
                48,
                48,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
        )
        side.addWidget(logo)
        side.addWidget(label("DUPESPACE", "brand"))
        side.addWidget(label("留好重要的，整理多餘的。", "small"))
        side.addSpacing(32)
        side.addWidget(label("WORKSPACE", "eyebrow"))
        side.addSpacing(8)
        for key, title, glyph in (
            ("local", "本機清理", "drive"),
            ("drive", "Google Drive", "cloud"),
            ("history", "清理紀錄", "history"),
            ("safety", "安全中心", "shield"),
        ):
            nav = button(title, kind="nav")
            nav.setIcon(icon(glyph, "#78BDB7"))
            nav.setIconSize(QSize(20, 20))
            nav.setCheckable(True)
            nav.clicked.connect(lambda _checked=False, page=key: self.navigate(page))
            self.nav_buttons[key] = nav
            side.addWidget(nav)
        side.addStretch()
        side.addWidget(label("LOCAL FIRST", "eyebrow"))
        side.addWidget(label("本機檔案不離開電腦。\n每次清理都有 CSV 紀錄。", "small", wrap=True))
        side.addSpacing(18)
        preferences = button("偏好設定", kind="nav")
        preferences.setIcon(icon("settings", "#78BDB7"))
        preferences.clicked.connect(self._settings)
        side.addWidget(preferences)
        self.update_button = button("檢查更新", kind="nav")
        self.update_button.setIcon(icon("download", "#78BDB7"))
        self.update_button.clicked.connect(self.check_updates)
        side.addWidget(self.update_button)
        self.version_label = label(f"WINDOWS  /  {__version__}", "small")
        side.addWidget(self.version_label)
        shell.addWidget(sidebar)
        workspace = QWidget()
        space = QVBoxLayout(workspace)
        space.setContentsMargins(0, 0, 0, 0)
        space.setSpacing(0)
        topbar = QFrame()
        topbar.setObjectName("topbar")
        topbar.setMinimumHeight(68)
        top = QHBoxLayout(topbar)
        top.setContentsMargins(32, 12, 28, 12)
        self.breadcrumb = label("工作空間 / 本機清理", "muted")
        top.addWidget(self.breadcrumb)
        top.addStretch()
        self.account_chip = button("本機模式 · 無需登入", "user", "subtle")
        self.account_chip.setMaximumWidth(300)
        self.account_chip.clicked.connect(lambda: self.navigate("drive"))
        top.addWidget(self.account_chip)
        space.addWidget(topbar)
        self.global_notice = Notice()
        space.addWidget(self.global_notice)
        self.stack = QStackedWidget()
        self.pages = {}
        for key, page in (
            ("local", self._build_local()),
            ("drive", self._build_drive()),
            ("progress", self._build_progress()),
            ("review", self._build_review()),
            ("complete", self._build_complete()),
            ("history", self._build_history()),
            ("safety", self._build_safety()),
        ):
            self.pages[key] = page
            self.stack.addWidget(page)
        space.addWidget(self.stack, 1)
        shell.addWidget(workspace, 1)

    def _build_local(self) -> QWidget:
        page, box = scroll_page()
        box.addWidget(label("A LITTLE LESS CLUTTER. A LITTLE MORE SPACE.", "eyebrow"))
        box.addWidget(label("空間清爽，重要檔案好好留下。", "title", wrap=True))
        box.addWidget(
            label(
                "先指定要保護的原檔，再選擇想整理的位置。只有兩邊內容完全相同的副本才會列出。",
                "muted",
                wrap=True,
            )
        )
        profile_row = QHBoxLayout()
        self.profiles = QComboBox()
        self.profiles.setAccessibleName("載入常用位置設定檔")
        self._refresh_profiles()
        self.profiles.activated.connect(self._load_profile)
        profile_row.addWidget(self.profiles, 1)
        save = button("儲存這組位置", "folder", "subtle")
        save.clicked.connect(self._save_profile)
        profile_row.addWidget(save)
        box.addLayout(profile_row)
        zones = QHBoxLayout()
        zones.setSpacing(20)
        for role, number, title, description, placeholder in (
            (
                "keep",
                "01",
                "保留區",
                "這裡的所有檔案永遠不會被選取或刪除。",
                "例如：照片原檔、文件收藏",
            ),
            (
                "clean",
                "02",
                "清理區",
                "只找出保留區已有的副本，清理前由你決定。",
                "例如：匯入副本、重複下載",
            ),
        ):
            card = Card(kind=role)
            heading = QHBoxLayout()
            heading.addWidget(label(number, "eyebrow"))
            heading.addWidget(label(title, "heading"))
            heading.addStretch()
            glyph = QLabel()
            glyph.setPixmap(
                icon(
                    "shield" if role == "keep" else "folder",
                    EMERALD if role == "keep" else TEAL,
                    28,
                ).pixmap(28)
            )
            heading.addWidget(glyph)
            card.box.addLayout(heading)
            card.box.addWidget(label(description, "muted", wrap=True))
            paths = QListWidget()
            paths.setMinimumHeight(116)
            paths.setMaximumHeight(160)
            paths.setAccessibleName(f"{title}資料夾列表")
            paths.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
            self.root_lists[role] = paths
            empty = QWidget()
            empty_box = QVBoxLayout(empty)
            empty_box.setContentsMargins(12, 14, 12, 14)
            empty_box.addStretch()
            empty_heading = label(
                "想保護的原檔，從這裡開始" if role == "keep" else "想整理的位置，從這裡開始",
                "muted",
            )
            empty_heading.setAlignment(Qt.AlignmentFlag.AlignCenter)
            empty_box.addWidget(empty_heading)
            hint = label("選擇資料夾，不會移動任何檔案", "small")
            hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
            empty_box.addWidget(hint)
            empty_box.addStretch()
            view = QStackedWidget()
            view.addWidget(empty)
            view.addWidget(paths)
            view.setFixedHeight(128)
            self.root_views[role] = view
            card.box.addWidget(view)
            card.box.addWidget(label(placeholder, "small", wrap=True))
            actions = QHBoxLayout()
            add = button("加入資料夾", "plus", "add")
            add.clicked.connect(
                lambda _checked=False, selected_role=role: self._add_root(selected_role)
            )
            actions.addWidget(add, 1)
            remove = button("移除", "close", "subtle")
            remove.setToolTip("只移除掃描位置，不會刪除檔案")
            remove.clicked.connect(
                lambda _checked=False, selected_role=role: self._remove_root(selected_role)
            )
            actions.addWidget(remove)
            card.box.addLayout(actions)
            zones.addWidget(card, 1)
        box.addLayout(zones)
        box.addWidget(
            Notice(
                "系統位置、程式碼專案、套件與未下載的雲端檔案會受到保護。"
                "相同設定檔可能各有用途，不會因為內容相同就清除你的專案。"
            )
        )
        actions = QHBoxLayout()
        self.ready_text = label("加入至少一個保留區與一個清理區，就可以開始。", "muted", wrap=True)
        actions.addWidget(self.ready_text, 1)
        self.scan_button = button("開始安全掃描", "arrow", "primary")
        self.scan_button.setMinimumHeight(48)
        self.scan_button.clicked.connect(self.start_local_scan)
        actions.addWidget(self.scan_button)
        box.addLayout(actions)
        box.addStretch()
        return page

    def _build_drive(self) -> QWidget:
        page, box = scroll_page()
        box.addWidget(label("YOUR FILES STAY IN YOUR GOOGLE DRIVE", "eyebrow"))
        box.addWidget(label("雲端整理，也要先守護原檔。", "title", wrap=True))
        box.addWidget(
            Notice(
                "Google 資料存取權驗證尚未完成，正在準備示範影片與送審。"
                "此功能目前不是已完成驗證的正式公開服務，登入可能受到 Google 限制。",
                "warning",
            )
        )
        account = Card()
        heading = QHBoxLayout()
        orbit = ScanOrbit(compact=True)
        heading.addWidget(orbit)
        identity = QVBoxLayout()
        self.drive_identity = label("尚未連接 Google Drive", "heading", wrap=True)
        self.drive_email = label("本機清理不需要 Google 帳號。", "muted", wrap=True)
        identity.addWidget(self.drive_identity)
        identity.addWidget(self.drive_email)
        heading.addLayout(identity, 1)
        account.box.addLayout(heading)
        account.box.addWidget(
            label(
                "使用 Google 提供的檔案資訊與校驗碼比對，不會把檔案內容上傳到 DUPESPACE。"
                "每組保留最舊的一份，程式碼專案與不符合權限的項目不會自動選取。",
                "muted",
                wrap=True,
            )
        )
        actions = QHBoxLayout()
        self.connect_button = button("連接 Google Drive", "cloud", "primary")
        self.connect_button.clicked.connect(lambda: self.connect_drive(interactive=True))
        self.disconnect_button = button("中斷連線", "close", "subtle")
        self.disconnect_button.clicked.connect(self.disconnect_drive)
        self.disconnect_button.hide()
        self.drive_scan = button("掃描 Google Drive", "search", "primary")
        self.drive_scan.clicked.connect(self.start_drive_scan)
        self.drive_scan.hide()
        actions.addWidget(self.connect_button)
        actions.addWidget(self.drive_scan)
        actions.addWidget(self.disconnect_button)
        actions.addStretch()
        account.box.addLayout(actions)
        box.addWidget(account)
        box.addWidget(
            Notice(
                "登入權杖以目前 Windows 使用者的 DPAPI 保護，重新啟動後可嘗試恢復連線。"
                "這不是抵抗已入侵電腦的保證；請不要在不信任的共用電腦登入。"
            )
        )
        policy = button("了解 Google 資料使用與隱私政策", "external", "subtle")
        policy.clicked.connect(lambda: self._open_url(WEBSITE + "/privacy"))
        box.addWidget(policy, 0, Qt.AlignmentFlag.AlignLeft)
        box.addStretch()
        return page

    def _build_progress(self) -> QWidget:
        page, box = scroll_page()
        box.addStretch()
        self.orbit = ScanOrbit()
        box.addWidget(self.orbit, 0, Qt.AlignmentFlag.AlignCenter)
        self.progress_title = label("正在仔細比對內容", "title", wrap=True)
        self.progress_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        box.addWidget(self.progress_title)
        self.progress_subtitle = label("掃描不會刪除任何檔案。", "muted", wrap=True)
        self.progress_subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        box.addWidget(self.progress_subtitle)
        card = Card()
        self.progress_stage = label("準備掃描", "heading")
        card.box.addWidget(self.progress_stage)
        self.progress_bar = QProgressBar()
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setRange(0, 0)
        card.box.addWidget(self.progress_bar)
        self.progress_count = label("正在讀取檔案資訊", "muted")
        card.box.addWidget(self.progress_count)
        self.progress_path = label("", "small")
        self.progress_path.setMaximumWidth(850)
        card.box.addWidget(self.progress_path)
        box.addWidget(card)
        self.stop_button = button("安全停止", "stop", "secondary")
        self.stop_button.clicked.connect(self.request_stop)
        box.addWidget(self.stop_button, 0, Qt.AlignmentFlag.AlignCenter)
        box.addWidget(
            label("會在目前檔案或批次完成後停止，不會強制中斷檔案操作。", "small"),
            0,
            Qt.AlignmentFlag.AlignCenter,
        )
        box.addStretch()
        return page

    def _build_review(self) -> QWidget:
        page = QWidget()
        box = QVBoxLayout(page)
        box.setContentsMargins(28, 18, 28, 18)
        box.setSpacing(10)
        header = QHBoxLayout()
        headings = QVBoxLayout()
        headings.addWidget(label("REVIEW YOUR DUPLICATES", "eyebrow"))
        self.review_title = label("原檔已保護，副本由你決定。", "title", wrap=True)
        headings.addWidget(self.review_title)
        header.addLayout(headings, 1)
        locations = button("調整位置", "folder", "subtle")
        locations.clicked.connect(self._change_locations)
        header.addWidget(locations)
        rescan = button("重新掃描", "search", "subtle")
        rescan.clicked.connect(self.rescan)
        header.addWidget(rescan)
        box.addLayout(header)
        self.review_stats = label("", "muted", wrap=True)
        box.addWidget(self.review_stats)
        modes = QHBoxLayout()
        self.mode_group = QButtonGroup(self)
        self.mode_trash = button("移至垃圾桶 · 建議", "trash", "mode")
        self.mode_permanent = button("永久刪除 · 無法復原", "warning", "risk-mode")
        for mode_button, mode in ((self.mode_trash, "trash"), (self.mode_permanent, "permanent")):
            mode_button.setCheckable(True)
            self.mode_group.addButton(mode_button)
            mode_button.clicked.connect(
                lambda _checked=False, choice=mode: self._change_mode(choice)
            )
            modes.addWidget(mode_button)
        modes.addStretch()
        box.addLayout(modes)
        self.review_notice = Notice()
        box.addWidget(self.review_notice)
        toolbar = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setPlaceholderText("搜尋檔名或完整路徑")
        self.search.setAccessibleName("搜尋重複檔案")
        self.search.setClearButtonEnabled(True)
        toolbar.addWidget(self.search, 1)
        select = button("選取全部重複副本", "check", "subtle")
        select.clicked.connect(self._select_all)
        toolbar.addWidget(select)
        clear = button("取消選取", kind="subtle")
        clear.clicked.connect(self._clear_selection)
        toolbar.addWidget(clear)
        details = button("檢查", "eye")
        details.clicked.connect(self._details)
        toolbar.addWidget(details)
        box.addLayout(toolbar)
        self.model = DuplicateModel(self.session)
        self.model.selection_changed.connect(self._refresh_selection)
        self.search.textChanged.connect(self.model.refresh)
        self.table = QTableView()
        self.table.setAccessibleName("重複副本列表，保留檔案無法勾選")
        self.table.setModel(self.model)
        self.table.setItemDelegateForColumn(1, FileDelegate(self.table))
        self.table.verticalHeader().hide()
        self.table.verticalHeader().setDefaultSectionSize(65)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        for column, width in ((0, 42), (2, 104), (3, 112), (4, 58)):
            self.table.setColumnWidth(column, width)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.table.setShowGrid(False)
        self.table.setWordWrap(False)
        self.table.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.table.doubleClicked.connect(lambda _index: self._details())
        box.addWidget(self.table, 1)
        self.unlock_button = button("檢查受保護的資料夾", "lock", "subtle")
        self.unlock_button.clicked.connect(self._unlock)
        box.addWidget(self.unlock_button, 0, Qt.AlignmentFlag.AlignLeft)
        actionbar = Card()
        actionbar.box.setContentsMargins(18, 12, 18, 12)
        row = QHBoxLayout()
        summary = QVBoxLayout()
        self.selection_count = label("尚未選取副本", "heading")
        self.selection_capacity = label("", "small")
        summary.addWidget(self.selection_count)
        summary.addWidget(self.selection_capacity)
        row.addLayout(summary, 1)
        self.clean_button = button("移至垃圾桶", "trash", "primary")
        self.clean_button.setMinimumHeight(44)
        self.clean_button.clicked.connect(self.start_cleanup)
        row.addWidget(self.clean_button)
        actionbar.box.addLayout(row)
        box.addWidget(actionbar)
        return page

    def _build_complete(self) -> QWidget:
        page, box = scroll_page()
        box.addWidget(label("EVERY RESULT, ACCOUNTED FOR", "eyebrow"))
        self.complete_title = label("整理完成，空間更有秩序。", "title", wrap=True)
        box.addWidget(self.complete_title)
        self.complete_message = label("", "muted", wrap=True)
        box.addWidget(self.complete_message)
        card = Card()
        self.complete_metric = label("0 B", "metric")
        card.box.addWidget(self.complete_metric)
        self.complete_metric_label = label("已移至垃圾桶的副本容量", "muted")
        card.box.addWidget(self.complete_metric_label)
        self.complete_counts = label("", "body", wrap=True)
        card.box.addWidget(self.complete_counts)
        box.addWidget(card)
        self.restore_notice = Notice()
        box.addWidget(self.restore_notice)
        self.result_warning = Notice(kind="warning")
        box.addWidget(self.result_warning)
        actions = QHBoxLayout()
        self.report_button = button("開啟 CSV 報告", "download", "primary")
        self.report_button.clicked.connect(self._open_last_report)
        actions.addWidget(self.report_button)
        retry = button("檢查未處理項目", "eye")
        retry.clicked.connect(self._show_review)
        actions.addWidget(retry)
        again = button("重新掃描", "search", "subtle")
        again.clicked.connect(self.rescan)
        actions.addWidget(again)
        actions.addStretch()
        box.addLayout(actions)
        self.restore_button = button("開啟垃圾桶復原", "history", "subtle")
        self.restore_button.clicked.connect(self._open_trash)
        box.addWidget(self.restore_button, 0, Qt.AlignmentFlag.AlignLeft)
        box.addStretch()
        return page

    def _build_history(self) -> QWidget:
        page, box = scroll_page()
        box.addWidget(label("YOUR LOCAL AUDIT TRAIL", "eyebrow"))
        box.addWidget(label("每次整理，都有跡可循。", "title", wrap=True))
        box.addWidget(
            label("紀錄只保存在這台電腦，包含每個項目的結果、位置與校驗碼。", "muted", wrap=True)
        )
        self.history_empty = Notice("還沒有清理紀錄。第一次整理完成後，CSV 報告就會出現在這裡。")
        box.addWidget(self.history_empty)
        self.history_list = QListWidget()
        self.history_list.setMinimumHeight(300)
        self.history_list.setAccessibleName("最近 100 次清理紀錄")
        self.history_list.itemDoubleClicked.connect(self._open_history_item)
        box.addWidget(self.history_list, 1)
        row = QHBoxLayout()
        open_report = button("開啟選取報告", "download", "primary")
        open_report.clicked.connect(
            lambda: self._open_history_item(self.history_list.currentItem())
        )
        row.addWidget(open_report)
        folder = button("所有報告與操作日誌", "folder")
        folder.clicked.connect(self._open_reports_folder)
        row.addWidget(folder)
        row.addStretch()
        box.addLayout(row)
        box.addWidget(
            label(
                "操作日誌中的 pending 代表尚無確定結果，不能當作成功刪除。"
                "CSV 中的危險公式字首會加上單引號。",
                "small",
                wrap=True,
            )
        )
        return page

    def _build_safety(self) -> QWidget:
        page, box = scroll_page()
        box.addWidget(label("SAFETY IS A WORKFLOW, NOT A PROMISE", "eyebrow"))
        box.addWidget(label("方便，不以犧牲檔案為代價。", "title", wrap=True))
        for title, text, glyph in (
            (
                "保留區是不可越過的界線",
                "所有保留區檔案永遠不能選取。清理區內自行重複、但保留區沒有的檔案不會列入。",
                "shield",
            ),
            (
                "同樣的設定檔，可能各有用途",
                "Windows 系統、程式碼專案、套件、虛擬環境與雲端占位檔受到保護；"
                "不穿越連結或接合點。備份與同步資料夾需要額外檢查。",
                "code",
            ),
            (
                "變更就跳過，不強行繼續",
                "操作前重新驗證副本與保留檔的身分、內容及狀態。這不是檔案系統快照；整理時請暫停會寫入目標位置的其他程式。",
                "history",
            ),
            (
                "垃圾桶與永久刪除是兩條路",
                "預設移至垃圾桶。永久刪除需主動選擇、重新選取與高風險確認，只能處理一般檔案。垃圾桶失敗永不改用永久刪除。",
                "trash",
            ),
        ):
            card = Card()
            row = QHBoxLayout()
            glyph_label = QLabel()
            glyph_label.setPixmap(icon(glyph, TEAL, 25).pixmap(25))
            row.addWidget(glyph_label)
            row.addWidget(label(title, "heading"), 1)
            card.box.addLayout(row)
            card.box.addWidget(label(text, "muted", wrap=True))
            box.addWidget(card)
        links = QHBoxLayout()
        for title, url in (
            ("安全整理指南", WEBSITE + "/support"),
            ("隱私權政策", WEBSITE + "/privacy"),
            ("檢查開源程式碼", GITHUB),
        ):
            link = button(title, "external", "subtle")
            link.clicked.connect(lambda _checked=False, address=url: self._open_url(address))
            links.addWidget(link)
        box.addLayout(links)
        box.addStretch()
        return page

    def navigate(self, key: str) -> None:
        if self.busy:
            return
        if key == "history":
            self._refresh_history()
        if key == "local" and self.session.source == "local" and self.session.report:
            key = "review"
        if key == "drive" and self.session.source == "drive" and self.session.report:
            key = "review"
        self._show_page(key)
        if key == "drive" and self.restore_session and self.service is None:
            self.restore_session = False
            if (app_data_dir() / "oauth-token.dpapi").is_file():
                self.connect_drive(interactive=False)

    def _show_page(self, key: str) -> None:
        self.current_page = key
        self.stack.setCurrentWidget(self.pages[key])
        nav_key = self.session.source if key in {"review", "complete", "progress"} else key
        for name, nav in self.nav_buttons.items():
            nav.setChecked(name == nav_key)
        titles = {
            "local": "本機清理",
            "drive": "Google Drive",
            "history": "清理紀錄",
            "safety": "安全中心",
            "review": "檢查副本",
            "progress": "安全處理中",
            "complete": "整理結果",
        }
        self.breadcrumb.setText(f"工作空間 / {titles[key]}")
        if not self.reduced_motion:
            effect = QGraphicsOpacityEffect(self.stack)
            self.stack.setGraphicsEffect(effect)
            self.fade = QPropertyAnimation(effect, b"opacity", self)
            self.fade.setDuration(180)
            self.fade.setStartValue(0.72)
            self.fade.setEndValue(1.0)
            self.fade.setEasingCurve(QEasingCurve.Type.OutCubic)
            self.fade.start()

    def _refresh_roots(self) -> None:
        for role, listing in self.root_lists.items():
            listing.clear()
            for root in self.session.roots:
                if root.role == role:
                    item = QListWidgetItem(icon("folder"), root.physical_path)
                    item.setData(Qt.ItemDataRole.UserRole, root.physical_path)
                    item.setToolTip(root.physical_path)
                    listing.addItem(item)
            self.root_views[role].setCurrentIndex(1 if listing.count() else 0)
        self.scan_button.setEnabled(self.session.ready and not self.busy)
        if self.session.ready:
            count_keep = sum(root.role == "keep" for root in self.session.roots)
            self.ready_text.setText(
                f"{count_keep} 個保留區 · {len(self.session.roots) - count_keep} 個清理區。"
                "掃描只讀取，不會刪除。"
            )
        else:
            self.ready_text.setText("加入至少一個保留區與一個清理區，就可以開始。")

    def _add_root(self, role: str) -> None:
        folder = QFileDialog.getExistingDirectory(
            self,
            "選擇保留區" if role == "keep" else "選擇清理區",
            "",
            QFileDialog.Option.ShowDirsOnly | QFileDialog.Option.DontResolveSymlinks,
        )
        if not folder:
            return
        try:
            self.session.set_roots((*self.session.roots, ScanRoot(folder, role)))
            self.global_notice.setText("")
        except (ValueError, OSError) as error:
            self.global_notice.setText(f"這個位置不能加入：{error}")
        self._refresh_roots()

    def _remove_root(self, role: str) -> None:
        item = self.root_lists[role].currentItem()
        if item:
            path = item.data(Qt.ItemDataRole.UserRole)
            try:
                self.session.set_roots(
                    tuple(root for root in self.session.roots if root.physical_path != path)
                )
            except (ValueError, OSError) as error:
                self.global_notice.setText(f"位置已變更，請重新設定：{error}")
            self._refresh_roots()

    def _refresh_profiles(self) -> None:
        self.profiles.clear()
        self.profiles.addItem("常用位置 · 選擇已儲存的設定檔", None)
        saved = self.preferences.get("profiles", {})
        if isinstance(saved, dict):
            for name in sorted(saved)[:30]:
                self.profiles.addItem(str(name), name)

    def _save_profile(self) -> None:
        if not self.session.ready:
            self.global_notice.setText("先選好保留區與清理區，再儲存這組位置。")
            return
        name, accepted = QInputDialog.getText(
            self, "儲存常用位置", "設定檔名稱（僅保存路徑，不保存選取或解鎖狀態）"
        )
        if accepted and name.strip():
            profiles = self.preferences.get("profiles", {})
            if not isinstance(profiles, dict):
                profiles = {}
            profiles[name.strip()[:60]] = [
                {"path": root.physical_path, "role": root.role} for root in self.session.roots
            ]
            try:
                save_preferences({"profiles": profiles})
                self.preferences["profiles"] = profiles
                self._refresh_profiles()
                self.global_notice.setText("這組位置已儲存在本機。下次使用仍會重新驗證所有路徑。")
            except OSError:
                self.global_notice.setText("設定檔無法儲存；目前掃描位置不受影響。")

    def _load_profile(self, index: int) -> None:
        name = self.profiles.itemData(index)
        if name is None:
            return
        try:
            entries = self.preferences["profiles"][name]
            self.session.set_roots(
                tuple(ScanRoot(entry["path"], entry["role"]) for entry in entries)
            )
            self._refresh_roots()
            self.global_notice.setText("已載入位置；先前選取、解鎖與確認都已重設。")
        except (KeyError, TypeError, ValueError, OSError) as error:
            self.global_notice.setText(f"這組位置目前不能使用，請重新選擇：{error}")

    def start_local_scan(self) -> None:
        if self.busy or not self.session.ready:
            return
        try:
            self.session.set_roots(self.session.roots)
        except (ValueError, OSError) as error:
            self.global_notice.setText(f"掃描位置無法使用：{error}")
            return
        self.session.source = "local"
        roots = self.session.roots
        self._launch(
            lambda emit: LocalScanner().scan(roots, progress=emit, cancel_event=self.cancel_event),
            self._accept_scan,
            "正在仔細比對內容",
            "掃描不會刪除任何檔案。完整比對需要一些時間。",
        )

    def start_drive_scan(self) -> None:
        if self.busy or self.service is None:
            return
        self.session.clear_scan()
        self.session.source = "drive"
        self._launch(
            lambda emit: GoogleDriveScanner().scan(
                self.service, progress=emit, cancel_event=self.cancel_event
            ),
            self._accept_scan,
            "正在比對 Google Drive",
            "只讀取檔案資訊與校驗碼，不下載檔案內容。",
        )

    def rescan(self) -> None:
        if self.busy:
            return
        if self.session.source == "drive":
            self.start_drive_scan()
        else:
            self.start_local_scan()

    def _change_locations(self) -> None:
        if self.busy:
            return
        self.session.clear_scan()
        self.model.refresh()
        self._show_page("local" if self.session.source == "local" else "drive")

    def _accept_scan(self, report: ScanReport) -> None:
        self.session.accept_scan(report)
        self.search.clear()
        self._show_review()
        if report.warnings:
            self.global_notice.setText("掃描提醒：" + "；".join(report.warnings[:3]))

    def _show_review(self) -> None:
        if self.busy:
            return
        self.model.refresh()
        report = self.session.report
        if report:
            copies = sum(
                record.key != group.keeper_key and record.root_role != "keep"
                for group in self.session.groups
                for record in group.records
            )
            duplicate_bytes = sum(group.reclaimable_bytes for group in self.session.groups)
            percentage = (
                duplicate_bytes / report.examined_bytes * 100 if report.examined_bytes else 0
            )
            self.review_stats.setText(
                f"已檢查 {report.examined_files:,} 個檔案 · {len(self.session.groups):,} 組重複 · "
                f"{copies:,} 個副本 · 重複容量占已掃描 {percentage:.1f}%"
            )
        self.review_title.setText(
            "原檔已保護，副本由你決定。" if self.session.groups else "這次沒有需要整理的副本。"
        )
        self.mode_trash.setChecked(self.session.mode == "trash")
        self.mode_permanent.setChecked(self.session.mode == "permanent")
        self.unlock_button.setVisible(
            any(
                record.safety_context.requires_unlock
                and not record.selectable
                and not record.safety_context.is_hard_protected
                for group in self.session.groups
                for record in group.records
            )
        )
        self._refresh_selection()
        self._show_page("review")

    def _change_mode(self, mode: str) -> None:
        if self.busy or mode == self.session.mode:
            return
        self.session.set_mode(mode)
        self.model.refresh()
        self._refresh_selection()

    def _refresh_selection(self) -> None:
        permanent = self.session.mode == "permanent"
        count = len(self.session.selected)
        size = selected_bytes(self.session.groups, self.session.selected)
        self.selection_count.setText(f"已選取 {count:,} 個副本 · {format_bytes(size)}")
        capacity = self.session.report.storage_capacity_bytes if self.session.report else None
        self.selection_capacity.setText(
            (f"占掃描磁碟總容量 {size / capacity * 100:.2f}% · " if capacity else "")
            + ("永久刪除無法復原。" if permanent else "移至垃圾桶仍會占用磁碟空間。")
        )
        self.clean_button.setEnabled(count > 0 and not self.busy)
        self.clean_button.setText("檢查並永久刪除" if permanent else "移至垃圾桶")
        self.clean_button.setProperty("kind", "danger" if permanent else "primary")
        self.clean_button.style().unpolish(self.clean_button)
        self.clean_button.style().polish(self.clean_button)
        if not self.session.groups:
            self.review_notice.setText(
                "沒有找到符合安全條件的重複副本。程式碼專案、保留區與受保護位置仍受到保護；"
                "也可以重新選擇掃描位置。"
            )
        else:
            self.review_notice.setText(
                "高風險：選取已清空，請手動選擇。資料夾及保留檔案不能永久刪除。"
                if permanent
                else "原檔已鎖定。小於 1 MiB 的副本不會預選；"
                "請先核對用途與完整路徑，再決定是否整理。"
            )

    def _select_all(self) -> None:
        self.session.select_all()
        self.model.refresh()
        self._refresh_selection()

    def _clear_selection(self) -> None:
        self.session.selected.clear()
        self.session.reminders.invalidate()
        self.model.refresh()
        self._refresh_selection()

    def _details(self) -> None:
        index = self.table.currentIndex()
        if index.isValid():
            group, record, _ = self.model.rows[index.row()]
            DetailsDialog(self, group, record).exec()

    def _unlock(self) -> None:
        index = self.table.currentIndex()
        if not index.isValid():
            self.global_notice.setText("請先選取想檢查的受保護副本列。")
            return
        _group, record, _ = self.model.rows[index.row()]
        context = record.safety_context
        if not context.locked_folder or context.is_hard_protected or record.root_role != "clean":
            self.global_notice.setText(
                "這個項目不能解除保護。系統位置、程式碼專案與保留區永遠不會解鎖。"
            )
            return
        folder = context.locked_folder
        records = [
            item
            for group in self.session.groups
            for item in group.records
            if item.safety_context.locked_folder == folder and item.root_role == "clean"
        ]
        text, accepted = QInputDialog.getText(
            self,
            "僅為這次掃描解鎖",
            f"{folder}\n{len(records):,} 個副本 · "
            f"{format_bytes(sum(item.size for item in records))}\n"
            "可能仍被程式、備份或同步工作使用。\n"
            f"確認已停止相關程式後，輸入：允許清理 {Path(folder).name}",
        )
        if accepted:
            try:
                self.session.groups = unlock_locked_folder(self.session.groups, folder, text)
                self.session.reminders.invalidate()
                self.model.refresh()
                self._refresh_selection()
                self.global_notice.setText("資料夾僅在這次掃描解鎖，沒有自動選取任何檔案。")
            except ValueError:
                self.global_notice.setText("確認文字不相符，資料夾仍受到保護。")

    def start_cleanup(self) -> None:
        if self.busy or not self.session.selected:
            return
        snapshot = self.session.snapshot()
        locations = (
            "Google Drive / 我的雲端硬碟"
            if self.session.source == "drive"
            else "\n".join(
                f"{'保留' if root.role == 'keep' else '清理'}：{root.physical_path}"
                for root in self.session.roots
            )
        )
        if not self.session.reminders.can_skip(snapshot):
            self.sound.play("permanent_warning" if self.session.mode == "permanent" else "confirm")
            first = ConfirmationDialog(self, snapshot, locations)
            if first.exec() != QDialog.DialogCode.Accepted:
                return
            if needs_second_confirmation(snapshot):
                second = ConfirmationDialog(self, snapshot, locations, second=True)
                if second.exec() != QDialog.DialogCode.Accepted:
                    return
                if snapshot.operation_mode == "trash" and second.remember.isChecked():
                    self.session.reminders.suppress(snapshot)
        try:
            items = self.session.plan(snapshot)
        except ValueError as error:
            self.global_notice.setText(str(error))
            return
        mode = self.session.mode
        self._launch(
            lambda emit: run_cleanup(
                items, mode, cancel_event=self.cancel_event, progress=emit, service=self.service
            ),
            self._accept_cleanup,
            "正在永久刪除已確認的副本" if mode == "permanent" else "正在把副本移至垃圾桶",
            "每個項目先複驗，再執行並記錄結果；保留檔案不會成為操作目標。",
        )

    def _accept_cleanup(self, result: CleanupResult) -> None:
        self.last_result = result
        self.session.apply_actions(result.report)
        successes = (*result.report.trashed, *result.report.deleted)
        size = sum(outcome.record.size for outcome in successes)
        permanent = result.report.operation_mode == "permanent"
        stopped = bool(result.report.cancelled)
        issues = len(result.report.failed) + len(result.report.skipped)
        self.complete_title.setText(
            "已安全停止，已完成的結果保留。" if stopped else "整理完成，請查看處理結果。"
        )
        self.complete_message.setText(
            "沒有自動重試失敗項目，也沒有改用其他刪除方式。保留檔案仍受到保護。"
        )
        self.complete_metric.setText(format_bytes(size))
        if not self.reduced_motion and size:
            self.counter_animation = QVariantAnimation(self)
            self.counter_animation.setStartValue(0.0)
            self.counter_animation.setEndValue(float(size))
            self.counter_animation.setDuration(650)
            self.counter_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
            self.counter_animation.valueChanged.connect(
                lambda value: self.complete_metric.setText(format_bytes(int(value)))
            )
            self.counter_animation.start()
        self.complete_metric_label.setText(
            "成功永久刪除的檔案邏輯容量" if permanent else "成功移至垃圾桶的副本容量"
        )
        self.complete_counts.setText(
            f"成功 {len(successes):,} 項 · 失敗／已變更略過 {issues:,} 項 · "
            f"未開始 {len(result.report.cancelled):,} 項"
        )
        self.restore_notice.setText(
            "永久刪除沒有復原功能。上述容量是檔案大小加總；"
            "壓縮、其他硬連結或系統寫入可能使實際可用空間變化不同。"
            if permanent
            else "這些副本仍在垃圾桶，可以復原。移至垃圾桶不等於已釋放磁碟空間；"
            "DUPESPACE 不會替你清空垃圾桶。"
        )
        self.result_warning.setText(result.warning)
        self.report_button.setText("開啟 CSV 報告" if result.csv_path else "開啟操作日誌")
        self.restore_button.setVisible(not permanent)
        self.sound.play(
            "error" if issues or result.warning else "permanent_done" if permanent else "trash"
        )
        self._show_page("complete")

    def _launch(self, task: Callable, callback: Callable, title: str, subtitle: str) -> None:
        if self.busy:
            return
        self.busy = True
        self.cancel_event = threading.Event()
        self._callback = callback
        self._job_result = None
        self._job_error = None
        self._return_page = self.current_page
        self.global_notice.setText("")
        for nav in self.nav_buttons.values():
            nav.setEnabled(False)
        self.account_chip.setEnabled(False)
        self.update_button.setEnabled(False)
        self.model.busy = True
        self.progress_title.setText(title)
        self.progress_subtitle.setText(subtitle)
        self.progress_stage.setText("準備中")
        self.progress_count.setText("正在開始這次工作")
        self.progress_path.setText("")
        self.progress_bar.setRange(0, 0)
        self.stop_button.setText("安全停止")
        self.stop_button.setEnabled(True)
        self.orbit.animate(True, self.reduced_motion)
        self._show_page("progress")
        self.thread = QThread(self)
        self.worker = Worker(task)
        self.worker.moveToThread(self.thread)
        self.thread.started.connect(self.worker.run)
        self.worker.progress.connect(self._progress)
        self.worker.result.connect(self._receive_result)
        self.worker.error.connect(self._receive_error)
        # Stop the worker event loop in the emitting thread.  A queued call to
        # QThread.quit() can be starved while the GUI is processing a close
        # request, which left an otherwise completed worker alive on Linux.
        # quit() is thread-safe and the direct connection makes shutdown
        # deterministic without force-terminating the thread.
        self.worker.finished.connect(self.thread.quit, Qt.ConnectionType.DirectConnection)
        self.worker.finished.connect(self.worker.deleteLater)
        self.thread.finished.connect(self._finished)
        self.thread.finished.connect(self.thread.deleteLater)
        self.thread.start()

    @Slot(object)
    def _receive_result(self, result) -> None:
        self._job_result = result

    @Slot(object)
    def _receive_error(self, error) -> None:
        self._job_error = error

    @Slot(object)
    def _progress(self, update: ProgressUpdate) -> None:
        stages = {"validation": "重新驗證副本與保留檔", "cleanup": "逐項記錄處理結果"}
        self.progress_stage.setText(stages.get(update.stage, "正在精確比對，保護原檔"))
        if update.total and update.total > 0:
            self.progress_bar.setRange(0, 1000)
            self.progress_bar.setValue(min(1000, int(update.current / update.total * 1000)))
            self.progress_count.setText(
                f"{update.current:,} / {update.total:,} · {update.current / update.total:.0%}"
            )
        else:
            self.progress_bar.setRange(0, 0)
            self.progress_count.setText(f"已檢查 {update.current:,} 個項目")
        self.progress_path.setToolTip(update.message)
        self.progress_path.setText(
            self.progress_path.fontMetrics().elidedText(
                update.message, Qt.TextElideMode.ElideMiddle, max(300, self.progress_path.width())
            )
        )

    @Slot()
    def _finished(self) -> None:
        # QThread.finished can precede OS thread-local cleanup. Join before the parent
        # window is allowed to close and destroy its child QThread.
        if self.thread is not None and not self.thread.wait(100):
            QTimer.singleShot(25, self._finished)
            return
        self.busy = False
        self.model.busy = False
        self.orbit.animate(False)
        self.thread = None
        self.worker = None
        for nav in self.nav_buttons.values():
            nav.setEnabled(True)
        self.account_chip.setEnabled(True)
        self.update_button.setEnabled(self.update_thread is None)
        self._refresh_roots()
        if self._job_error is not None:
            error = self._job_error
            self.model.refresh()
            self._show_page(
                self.session.source
                if self._return_page == "review" and self.session.report is None
                else self._return_page
            )
            if isinstance(error, (ScanCancelled, DriveScanCancelled)):
                message = "掃描已停止。未產生可供清理的部分結果，沒有刪除任何檔案。"
            elif isinstance(error, DriveAuthenticationError):
                message = (
                    "無法完成 Google 連線。請檢查網路與 Google 授權狀態，"
                    "再按連接重試；本機功能不受影響。"
                )
            else:
                message = "這次工作未能完成，沒有啟動後續操作。請確認位置、權限與網路狀態後重試。"
                if isinstance(error, (ValueError, OSError)) and self.session.source == "local":
                    message += f"\n{str(error)[:400]}"
            self.global_notice.setText(message)
            if not isinstance(error, (ScanCancelled, DriveScanCancelled)):
                self.sound.play("error")
        else:
            self._callback(self._job_result)
        if self.close_requested:
            self.close()

    def request_stop(self) -> None:
        if self.busy:
            self.cancel_event.set()
            self.stop_button.setEnabled(False)
            self.stop_button.setText("正在安全停止…")
            self.progress_subtitle.setText("正在等目前檔案或網路請求完成；之後不再開始新的批次。")

    def connect_drive(self, *, interactive: bool) -> None:
        if self.busy:
            return

        def connect(_emit):
            service = build_drive_service(interactive=interactive)
            name, email = desktop_account_identity(service)
            return service, name, email

        self._launch(
            connect,
            self._accept_account,
            "正在連接 Google Drive",
            "請在系統瀏覽器完成 Google 授權。"
            if interactive
            else "正在安全地恢復先前連線；失效時會請你重新登入。",
        )

    def _accept_account(self, account) -> None:
        self.service, self.account_name, self.account_email = account
        self.drive_identity.setText(self.account_name)
        self.drive_email.setText(self.account_email or "Google Drive 已連線")
        self.account_chip.setText(
            self.account_chip.fontMetrics().elidedText(
                self.account_email or self.account_name, Qt.TextElideMode.ElideMiddle, 230
            )
        )
        self.account_chip.setToolTip(f"Google Drive 已連線\n{self.account_email}")
        self.connect_button.hide()
        self.disconnect_button.show()
        self.drive_scan.show()
        self._show_page("drive")

    def disconnect_drive(self) -> None:
        if not self.busy:
            self._launch(
                lambda _emit: disconnect_desktop_account(),
                self._disconnected,
                "正在中斷 Google 連線",
                "清除這台電腦的登入權杖，並嘗試通知 Google 撤銷授權。",
            )

    def _disconnected(self, _result) -> None:
        self.service = None
        self.account_name = self.account_email = ""
        self.account_chip.setText("本機模式 · 無需登入")
        self.account_chip.setToolTip("")
        self.drive_identity.setText("尚未連接 Google Drive")
        self.drive_email.setText("本機清理不需要 Google 帳號。")
        self.connect_button.show()
        self.disconnect_button.hide()
        self.drive_scan.hide()
        if self.session.source == "drive":
            self.session.clear_scan()
            self.model.refresh()
        self._show_page("drive")
        self.global_notice.setText(
            "本機登入資料已移除。如需確認 Google 端授權已撤銷，"
            "請到 Google 帳戶的第三方連線頁面檢查。"
        )

    def _auto_update_check(self) -> None:
        if self.busy:
            QTimer.singleShot(30_000, self._auto_update_check)
            return
        try:
            last_check = float(self.preferences.get("last_update_check", 0))
        except (TypeError, ValueError):
            last_check = 0
        if time.time() - last_check >= UPDATE_INTERVAL_SECONDS:
            self.check_updates(manual=False)

    def check_updates(self, _checked: bool = False, *, manual: bool = True) -> None:
        if self.busy:
            if manual:
                self.global_notice.setText("目前工作結束後再檢查更新，避免干擾掃描或清理。")
            return
        if self.update_thread is not None:
            return
        if self.update_release is not None:
            if manual:
                self._show_update_offer(self.update_release)
            return
        self.update_button.setText("正在檢查更新")
        self._start_update_job(
            lambda _emit: check_for_update(__version__),
            self._update_checked,
            manual=manual,
            job="check",
        )

    def _start_update_job(
        self,
        task: Callable,
        callback: Callable,
        *,
        manual: bool,
        job: str,
    ) -> None:
        if self.update_thread is not None:
            return
        self._update_result = None
        self._update_error = None
        self._update_callback = callback
        self._update_manual = manual
        self._update_job = job
        self.update_button.setEnabled(False)
        self.update_thread = QThread(self)
        self.update_worker = Worker(task)
        self.update_worker.moveToThread(self.update_thread)
        self.update_thread.started.connect(self.update_worker.run)
        self.update_worker.progress.connect(self._update_progress)
        self.update_worker.result.connect(self._receive_update_result)
        self.update_worker.error.connect(self._receive_update_error)
        self.update_worker.finished.connect(
            self.update_thread.quit, Qt.ConnectionType.DirectConnection
        )
        self.update_worker.finished.connect(self.update_worker.deleteLater)
        self.update_thread.finished.connect(self._update_finished)
        self.update_thread.finished.connect(self.update_thread.deleteLater)
        self.update_thread.start()

    @Slot(object)
    def _receive_update_result(self, result) -> None:
        self._update_result = result

    @Slot(object)
    def _receive_update_error(self, error) -> None:
        self._update_error = error

    @Slot(object)
    def _update_progress(self, update: ProgressUpdate) -> None:
        if self.update_dialog is None or self._update_job != "download":
            return
        progress = self.update_dialog.findChild(QProgressBar, "updateProgress")
        status = self.update_dialog.findChild(QLabel, "updateStatus")
        if progress is not None and update.total:
            progress.setRange(0, 1000)
            progress.setValue(min(1000, int(update.current / update.total * 1000)))
        if status is not None:
            status.setText(
                f"已下載 {format_bytes(update.current)} / {format_bytes(update.total)}，"
                "完成後會核對 SHA-256。"
            )

    @Slot()
    def _update_finished(self) -> None:
        if self.update_thread is not None and not self.update_thread.wait(100):
            QTimer.singleShot(25, self._update_finished)
            return
        error = self._update_error
        result = self._update_result
        callback = self._update_callback
        manual = self._update_manual
        job = self._update_job
        self.update_thread = None
        self.update_worker = None
        self._update_callback = None
        self.update_button.setEnabled(not self.busy)
        if error is not None:
            if self.update_dialog is not None:
                self.update_dialog.close()
                self.update_dialog = None
            self.update_button.setText("檢查更新")
            if manual or job == "download":
                message = (
                    "更新檔無法通過安全檢查，沒有執行任何安裝程式。"
                    if isinstance(error, UpdateError)
                    else "目前無法完成更新檢查，請稍後再試。"
                )
                self.global_notice.setText(message)
                self.sound.play("error")
        elif callback is not None:
            callback(result)
        if self.close_requested and not self.busy:
            self.close()

    def _update_checked(self, release: ReleaseInfo | None) -> None:
        now = time.time()
        self.preferences["last_update_check"] = now
        with suppress(OSError):
            save_preferences({"last_update_check": now})
        if release is None:
            self.update_button.setText("已是最新版本")
            if self._update_manual:
                self.global_notice.setText(f"目前使用的 DUPESPACE {__version__} 已是最新版本。")
            QTimer.singleShot(3500, self._reset_update_button)
            return
        self.update_release = release
        self.update_button.setText(f"更新至 {release.version}")
        self.global_notice.setText(
            f"DUPESPACE {release.version} 已發布。可直接在應用程式內下載、驗證並安裝。"
        )
        if self._update_manual:
            self._show_update_offer(release)

    def _reset_update_button(self) -> None:
        if self.update_release is None and self.update_thread is None:
            self.update_button.setText("檢查更新")

    def _show_update_offer(self, release: ReleaseInfo) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("DUPESPACE｜有可用更新")
        dialog.setMinimumWidth(510)
        box = QVBoxLayout(dialog)
        box.setContentsMargins(28, 26, 28, 26)
        box.setSpacing(17)
        box.addWidget(label(f"DUPESPACE {release.version} 已準備好", "heading"))
        box.addWidget(
            label(
                f"目前版本 {__version__}。安裝檔會直接從 DUPESPACE 的公開 GitHub Release "
                "下載，完成後先核對檔案大小與 SHA-256，再讓你決定是否啟動安裝。",
                "muted",
                wrap=True,
            )
        )
        box.addWidget(Notice("不會靜默安裝，也不會以系統管理員權限在背景執行。"))
        notes = button("查看版本說明", "external", "subtle")
        notes.clicked.connect(lambda: self._open_url(release.release_url))
        box.addWidget(notes)
        actions = QHBoxLayout()
        actions.addStretch()
        later = button("稍後", kind="subtle")
        later.clicked.connect(dialog.reject)
        actions.addWidget(later)
        download = button("下載並驗證更新", "download", "primary")
        download.clicked.connect(dialog.accept)
        actions.addWidget(download)
        box.addLayout(actions)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._download_release(release)

    def _download_release(self, release: ReleaseInfo) -> None:
        if self.busy or self.update_thread is not None:
            return
        dialog = QDialog(self)
        dialog.setWindowTitle("DUPESPACE｜正在準備更新")
        dialog.setMinimumWidth(500)
        dialog.setModal(True)
        box = QVBoxLayout(dialog)
        box.setContentsMargins(28, 26, 28, 26)
        box.setSpacing(16)
        box.addWidget(label(f"正在下載 DUPESPACE {release.version}", "heading"))
        status = label("正在連接公開 GitHub Release。", "muted", wrap=True)
        status.setObjectName("updateStatus")
        box.addWidget(status)
        progress = QProgressBar()
        progress.setObjectName("updateProgress")
        progress.setRange(0, 0)
        box.addWidget(progress)
        box.addWidget(
            label("下載過程不會掃描、上傳或變更你的檔案。", "small", wrap=True)
        )
        self.update_dialog = dialog
        dialog.show()

        def task(emit):
            return download_update(
                release,
                progress=lambda current, total: emit(
                    ProgressUpdate("download", current, total, "正在下載並驗證更新")
                ),
            )

        self._start_update_job(
            task,
            self._update_downloaded,
            manual=True,
            job="download",
        )

    def _update_downloaded(self, installer: VerifiedInstaller) -> None:
        if self.update_dialog is not None:
            self.update_dialog.close()
            self.update_dialog = None
        self.verified_installer = installer
        self._confirm_install(installer)

    def _confirm_install(self, installer: VerifiedInstaller) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("DUPESPACE｜更新已通過驗證")
        dialog.setMinimumWidth(510)
        box = QVBoxLayout(dialog)
        box.setContentsMargins(28, 26, 28, 26)
        box.setSpacing(17)
        box.addWidget(label("更新檔已通過 SHA-256 驗證", "heading"))
        box.addWidget(
            label(
                f"版本 {installer.version} · {format_bytes(installer.size)}。按下開始安裝前，"
                "DUPESPACE 會再讀取一次檔案並核對雜湊；若內容有任何變化就會停止。",
                "muted",
                wrap=True,
            )
        )
        box.addWidget(Notice("安裝程式會顯示自己的步驟。應用程式將在成功啟動安裝後關閉。"))
        actions = QHBoxLayout()
        actions.addStretch()
        later = button("稍後安裝", kind="subtle")
        later.clicked.connect(dialog.reject)
        actions.addWidget(later)
        install = button("現在開始安裝", "check", "primary")
        install.clicked.connect(dialog.accept)
        actions.addWidget(install)
        box.addLayout(actions)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._launch_installer(installer)

    def _launch_installer(self, installer: VerifiedInstaller) -> None:
        try:
            path = verify_installer(installer)
        except UpdateError:
            self.global_notice.setText(
                "更新檔在下載後發生變化，操作已取消；沒有執行任何安裝程式。"
            )
            self.sound.play("error")
            return
        started = QProcess.startDetached(str(path), [], str(path.parent))
        success = bool(started[0] if isinstance(started, tuple) else started)
        if not success:
            self.global_notice.setText("無法啟動已驗證的安裝程式，應用程式會保持開啟。")
            self.sound.play("error")
            return
        self.close()

    def _settings(self) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("DUPESPACE｜偏好設定")
        dialog.setMinimumWidth(470)
        box = QVBoxLayout(dialog)
        box.setContentsMargins(26, 24, 26, 24)
        box.setSpacing(18)
        box.addWidget(label("保持舒服，也保持專注。", "heading"))
        muted = QCheckBox("靜音")
        muted.setChecked(self.sound.muted)
        box.addWidget(muted)
        box.addWidget(label("音效音量 · 預設低音量，每批次播放一次", "muted"))
        volume = QSlider(Qt.Orientation.Horizontal)
        volume.setRange(0, 100)
        volume.setValue(round(self.sound.volume * 100))
        volume.setAccessibleName("音效音量")
        box.addWidget(volume)
        motion = QCheckBox("減少動態效果")
        motion.setChecked(self.reduced_motion)
        box.addWidget(motion)
        box.addWidget(Notice("偏好設定不影響任何安全警告。永久刪除確認不能關閉。"))
        save = button("儲存設定", "check", "primary")
        save.clicked.connect(dialog.accept)
        box.addWidget(save)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            try:
                self.sound.configure(muted=muted.isChecked(), volume=volume.value() / 100)
                self.reduced_motion = motion.isChecked()
                save_preferences({"reduced_motion": self.reduced_motion})
            except OSError:
                self.global_notice.setText("偏好設定無法儲存，這次使用仍會套用。")

    def _refresh_history(self) -> None:
        self.history_list.clear()
        folder = default_report_dir()
        try:
            reports = sorted(folder.glob("cleanup-*.csv"), reverse=True)[:100]
            for path in reports:
                if path.is_symlink():
                    continue
                with path.open(encoding="utf-8-sig", newline="") as handle:
                    rows = list(csv.DictReader(handle))
                successes = sum(row.get("status") in {"trashed", "deleted"} for row in rows)
                item = QListWidgetItem(
                    f"{path.name[8:23]}  ·  成功 {successes:,} / {len(rows):,} 項\n{path.name}"
                )
                item.setData(Qt.ItemDataRole.UserRole, str(path))
                self.history_list.addItem(item)
        except (OSError, ValueError, csv.Error):
            self.global_notice.setText("部分報告無法讀取，可以在報告資料夾中檢查。")
        self.history_empty.setVisible(self.history_list.count() == 0)

    def _open_history_item(self, item) -> None:
        if item:
            path = Path(item.data(Qt.ItemDataRole.UserRole))
            if (
                path.parent == default_report_dir()
                and path.suffix == ".csv"
                and path.is_file()
                and not path.is_symlink()
            ):
                QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))

    def _open_reports_folder(self) -> None:
        folder = default_report_dir()
        if folder.is_dir():
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))
        else:
            self.global_notice.setText("完成第一次清理後，會自動建立報告資料夾。")

    def _open_last_report(self) -> None:
        if self.last_result:
            path = self.last_result.csv_path or self.last_result.journal_path
            if path.is_file():
                QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))

    def _open_trash(self) -> None:
        if self.session.source == "drive":
            self._open_url("https://drive.google.com/drive/trash")
        elif sys.platform == "win32":
            import subprocess

            subprocess.Popen(["explorer.exe", "shell:RecycleBinFolder"])

    @staticmethod
    def _open_url(url: str) -> None:
        QDesktopServices.openUrl(QUrl(url))

    def closeEvent(self, event: QCloseEvent) -> None:
        update_running = self.update_thread is not None and self.update_thread.isRunning()
        if self.busy or update_running:
            self.close_requested = True
            if self.busy:
                self.request_stop()
            self.global_notice.setText(
                "會在目前操作或更新檢查安全結束後關閉；不會強制終止執行緒。"
            )
            event.ignore()
        else:
            event.accept()
