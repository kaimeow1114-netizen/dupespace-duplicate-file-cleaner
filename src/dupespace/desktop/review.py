"""Virtual group cards with isolated hit targets and bounded, local-only previews."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import (
    QObject,
    QRunnable,
    QSize,
    Qt,
    QThreadPool,
    QUrl,
    Signal,
)
from PySide6.QtGui import (
    QDesktopServices,
    QImage,
    QImageReader,
    QPixmap,
    QTextOption,
)
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from ..models import FileRecord
from ..windows_safety import DEFAULT_WINDOWS_SAFETY_POLICY, is_cloud_placeholder
from .state import format_bytes
from .widgets import TEAL, button, icon, label

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SHELL_SUFFIXES = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".heic", ".psd"}


def file_type(record: FileRecord) -> tuple[int, str, str]:
    suffix = Path(record.name).suffix.casefold()
    if record.item_kind == "folder":
        return 3, "資料夾", "folder"
    if suffix in {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}:
        return 0, "影片", "video"
    if suffix in IMAGE_SUFFIXES | {".heic", ".psd", ".gif", ".tiff", ".raw"}:
        return 1, "圖片", "image"
    if suffix in {".pdf", ".doc", ".docx", ".txt", ".xlsx", ".pptx", ".odt"}:
        return 2, "PDF" if suffix == ".pdf" else "文件", "file"
    return 4, suffix.removeprefix(".").upper() or "檔案", "file"


class PreviewSignals(QObject):
    ready = Signal(object, object, int)


class PreviewJob(QRunnable):
    def __init__(self, record, key, generation, signals):
        super().__init__()
        self.record, self.key = record, key
        self.generation, self.signals = generation, signals

    def run(self):
        image = QImage()
        try:
            if self.record.source == "drive":
                from .cloud_thumbnail import read_thumbnail

                image = read_thumbnail(self.record.thumbnail_url)
                return
            path = DEFAULT_WINDOWS_SAFETY_POLICY.validate_regular_file(self.record.location)
            if is_cloud_placeholder(path):
                return
            info = path.stat()
            if info.st_size != self.record.size:
                return
            if self.record.modified_at is not None and info.st_mtime != self.record.modified_at:
                return
            if path.suffix.casefold() in SHELL_SUFFIXES:
                from .shell_thumbnail import shell_thumbnail

                image = shell_thumbnail(path)
                after = path.stat()
                if (after.st_size, after.st_mtime_ns) != (info.st_size, info.st_mtime_ns):
                    image = QImage()
                return
            if info.st_size > 16 * 1024**2:
                return
            reader = QImageReader(str(path))
            reader.setAllocationLimit(32)
            reader.setAutoTransform(True)
            size = reader.size()
            if not size.isValid() or size.width() * size.height() > 24_000_000:
                return
            reader.setScaledSize(size.scaled(QSize(320, 200), Qt.AspectRatioMode.KeepAspectRatio))
            image = reader.read()
        except (OSError, ValueError):
            pass
        finally:
            self.signals.ready.emit(self.key, image, self.generation)


class PreviewCache(QObject):
    changed = Signal()
    LIMIT = 40
    MAX_PENDING = 8

    def __init__(self, parent=None):
        super().__init__(parent)
        self.cache: OrderedDict = OrderedDict()
        self.pending = set()
        self.generation = 0
        self.pool = QThreadPool(self)
        self.pool.setMaxThreadCount(1)
        self.signals = PreviewSignals(self)
        self.signals.ready.connect(self._ready)

    def clear(self):
        self.generation += 1
        self.pool.clear()
        self.pending.clear()
        self.cache.clear()

    def get(self, record):
        if (
            record.item_kind != "file"
            or Path(record.name).suffix.casefold() not in IMAGE_SUFFIXES | SHELL_SUFFIXES
            or record.safety_context.is_hard_protected
        ):
            return None
        key = (record.key, record.location, record.metadata_token, record.size, record.modified_at)
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        if key not in self.pending and len(self.pending) < self.MAX_PENDING:
            self.pending.add(key)
            self.pool.start(PreviewJob(record, key, self.generation, self.signals))
        return None

    def _ready(self, key, image, generation):
        if generation != self.generation:
            return
        self.pending.discard(key)
        self.cache[key] = QPixmap.fromImage(image) if not image.isNull() else None
        while len(self.cache) > self.LIMIT:
            self.cache.popitem(last=False)
        self.changed.emit()


class DetailsPane(QFrame):
    closed = Signal()
    tree_requested = Signal(object, object)

    def __init__(self, previews, parent=None):
        super().__init__(parent)
        self.previews, self.record, self.group = previews, None, None
        self.setProperty("kind", "card")
        self.setMinimumWidth(290)
        box = QVBoxLayout(self)
        box.setContentsMargins(16, 14, 16, 14)
        header = QHBoxLayout()
        header.addWidget(label("檔案詳細資料", "heading"), 1)
        close = button("", "close", "icon")
        close.setAccessibleName("關閉詳細資料")
        close.clicked.connect(self.closed)
        header.addWidget(close)
        box.addLayout(header)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        content = QWidget()
        content.setStyleSheet("background: white;")
        details = QVBoxLayout(content)
        details.setContentsMargins(0, 8, 0, 8)
        self.picture = QLabel()
        self.picture.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.picture.setFixedHeight(160)
        details.addWidget(self.picture)
        self.name = label("", "heading", wrap=True)
        self.name.setMinimumWidth(0)
        details.addWidget(self.name)
        self.status = label("", "badge", wrap=True)
        details.addWidget(self.status)
        self.fields = {}
        for name in ("完整路徑", "類型與容量", "修改時間", "建立時間", "內容校驗碼", "保護原因"):
            details.addWidget(label(name, "small"))
            value = QTextEdit()
            value.setReadOnly(True)
            value.setWordWrapMode(QTextOption.WrapMode.WrapAnywhere)
            value.setFrameStyle(QFrame.Shape.NoFrame)
            value.setStyleSheet("QTextEdit { background: white; border: none; padding: 0; }")
            value.setFixedHeight(66 if name in {"完整路徑", "內容校驗碼"} else 32)
            value.setMinimumWidth(0)
            details.addWidget(value)
            self.fields[name] = value
        self.tree_button = button("對照資料夾內容", "folder")
        self.tree_button.clicked.connect(lambda: self.tree_requested.emit(self.group, self.record))
        details.addWidget(self.tree_button)
        details.addStretch()
        scroll.setWidget(content)
        box.addWidget(scroll, 1)
        copy = button("複製完整路徑", "copy")
        copy.clicked.connect(
            lambda: QApplication.clipboard().setText(self.record.location) if self.record else None
        )
        box.addWidget(copy)
        self.open_button = button("開啟所在資料夾", "folder")
        self.open_button.clicked.connect(self._open_location)
        box.addWidget(self.open_button)
        previews.changed.connect(self._preview)
        self.hide()

    def show_record(self, group, record):
        self.group, self.record = group, record
        self.name.setText("\u200b".join(record.name))
        self.name.setToolTip(record.name)
        keeper = record.key == group.keeper_key or record.root_role == "keep"
        self.status.setText("保留原檔 · 不會刪除" if keeper else "重複副本")
        values = {
            "完整路徑": record.location,
            "類型與容量": f"{file_type(record)[1]} · {format_bytes(record.size)}",
            "修改時間": self._date(record.modified_at),
            "建立時間": self._date(record.created_at),
            "內容校驗碼": record.checksum,
            "保護原因": record.protection_reason
            or ("每組至少保留一份" if keeper else "符合條件的副本"),
        }
        for key, value in values.items():
            self.fields[key].setPlainText(value)
            self.fields[key].setToolTip(value)
        self.open_button.setText(
            "開啟所在資料夾" if record.source == "local" else "在 Google Drive 查看"
        )
        self.tree_button.setVisible(record.item_kind == "folder")
        self._preview()
        self.show()

    def _open_location(self):
        if self.record is None:
            return
        try:
            if self.record.source == "local":
                path = DEFAULT_WINDOWS_SAFETY_POLICY.validate_scan_root(
                    Path(self.record.location).parent
                )
                QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))
            else:
                url = QUrl(self.record.web_url or "")
                if url.scheme() == "https" and url.host() in {
                    "drive.google.com",
                    "docs.google.com",
                }:
                    QDesktopServices.openUrl(url)
        except (ValueError, OSError):
            self.open_button.setToolTip("此位置目前無法開啟；可複製完整路徑檢查。")

    @staticmethod
    def _date(value):
        try:
            return (
                datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M:%S") if value else "未提供"
            )
        except (ValueError, OSError, OverflowError):
            return "未提供"

    def _preview(self):
        if self.record is None:
            return
        pixmap = self.previews.get(self.record)
        self.picture.setPixmap(
            pixmap if pixmap else icon(file_type(self.record)[2], TEAL, 48).pixmap(48)
        )
