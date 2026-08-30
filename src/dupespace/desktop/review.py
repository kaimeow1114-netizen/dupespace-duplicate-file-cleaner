"""Virtual group cards with isolated hit targets and bounded, local-only previews."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import (
    QAbstractListModel,
    QObject,
    QRect,
    QRunnable,
    QSize,
    Qt,
    QThreadPool,
    QUrl,
    Signal,
)
from PySide6.QtGui import (
    QColor,
    QDesktopServices,
    QFont,
    QImage,
    QImageReader,
    QPainter,
    QPen,
    QPixmap,
    QTextOption,
)
from PySide6.QtWidgets import (
    QAbstractItemView,
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QListView,
    QScrollArea,
    QStyledItemDelegate,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from ..models import FileRecord
from ..windows_safety import DEFAULT_WINDOWS_SAFETY_POLICY, is_cloud_placeholder
from .state import ScanSession, format_bytes
from .widgets import INK, MUTED, TEAL, button, icon, label

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def file_type(record: FileRecord) -> tuple[int, str, str]:
    suffix = Path(record.name).suffix.casefold()
    if record.item_kind == "folder":
        return 3, "資料夾", "folder"
    if suffix in {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}:
        return 0, "影片", "video"
    if suffix in IMAGE_SUFFIXES | {".heic", ".gif", ".tiff", ".raw"}:
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
            path = DEFAULT_WINDOWS_SAFETY_POLICY.validate_regular_file(self.record.location)
            if is_cloud_placeholder(path):
                return
            info = path.stat()
            if info.st_size != self.record.size or info.st_size > 16 * 1024**2:
                return
            if self.record.modified_at is not None and info.st_mtime != self.record.modified_at:
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
            record.source != "local"
            or record.item_kind != "file"
            or Path(record.name).suffix.casefold() not in IMAGE_SUFFIXES
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


class ReviewModel(QAbstractListModel):
    selection_changed = Signal()

    def __init__(self, session: ScanSession):
        super().__init__()
        self.session, self.rows, self.ends = session, [], set()
        self.query, self.busy = "", False

    def refresh(self, query=None):
        if query is not None:
            self.query = query.casefold().strip()
        self.beginResetModel()
        self.rows, self.ends = [], set()
        groups = sorted(
            self.session.groups, key=lambda g: (file_type(g.keeper)[0], -g.reclaimable_bytes)
        )
        for number, group in enumerate(groups, 1):
            if self.query and not any(self.query in r.location.casefold() for r in group.records):
                continue
            self.rows.append((group, group.keeper, number))
            self.rows.extend((group, r, number) for r in group.records if r.key != group.keeper_key)
            self.ends.add(len(self.rows) - 1)
        self.endResetModel()

    def rowCount(self, parent=None):
        return 0 if parent is not None and parent.isValid() else len(self.rows)

    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or index.row() >= len(self.rows):
            return None
        group, record, number = self.rows[index.row()]
        if role == Qt.ItemDataRole.DisplayRole:
            return record.name
        if role == Qt.ItemDataRole.ToolTipRole:
            return f"{record.location}\n{record.protection_reason or record.checksum}"
        if role == Qt.ItemDataRole.AccessibleTextRole:
            status = "保留原檔" if record.key == group.keeper_key else "副本"
            return f"群組 {number}，{status}，{record.name}，{record.location}"
        if role == Qt.ItemDataRole.CheckStateRole and self.session.allowed(group, record):
            return (
                Qt.CheckState.Checked
                if record.key in self.session.selected
                else Qt.CheckState.Unchecked
            )
        return None

    def flags(self, index):
        result = Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsSelectable
        if index.isValid() and not self.busy:
            group, record, _ = self.rows[index.row()]
            if self.session.allowed(group, record):
                result |= Qt.ItemFlag.ItemIsUserCheckable
        return result

    def setData(self, index, value, role=Qt.ItemDataRole.EditRole):
        if self.busy or not index.isValid() or role != Qt.ItemDataRole.CheckStateRole:
            return False
        group, record, _ = self.rows[index.row()]
        if not self.session.allowed(group, record):
            return False
        if value in (Qt.CheckState.Checked, Qt.CheckState.Checked.value):
            self.session.selected.add(record.key)
        else:
            self.session.selected.discard(record.key)
        self.session.reminders.invalidate()
        self.dataChanged.emit(index, index)
        self.selection_changed.emit()
        return True


def hit_rects(rect: QRect, keeper: bool):
    if keeper:
        preview_width = 150 if rect.width() >= 570 else 92
        return QRect(), rect.adjusted(preview_width + 34, 58, -16, -28)
    return QRect(rect.left() + 10, rect.top() + 9, 44, 48), rect.adjusted(64, 8, -18, -14)


class GroupDelegate(QStyledItemDelegate):
    def __init__(self, view, previews):
        super().__init__(view)
        self.view, self.previews = view, previews

    def sizeHint(self, option, index):
        group, record, _ = index.model().rows[index.row()]
        return QSize(
            0,
            (182 if record.key == group.keeper_key else 76)
            + (14 if index.row() in index.model().ends else 0),
        )

    def paint(self, painter: QPainter, option, index):
        group, record, number = index.model().rows[index.row()]
        keeper = record.key == group.keeper_key
        allowed = index.model().session.allowed(group, record)
        checked = record.key in index.model().session.selected
        hovered = self.view.hover_row == index.row()
        active = self.view.detail_key == record.key
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = option.rect.adjusted(2, 0, -3, -14 if index.row() in index.model().ends else 0)
        if hovered:
            r.adjust(-1, 0, 1, 0)
        painter.setPen(
            QPen(QColor("#5ABCAF" if hovered or active else "#D6E9E3"), 1.5 if hovered else 1)
        )
        painter.setBrush(QColor("#EDF9F5" if hovered else "#F3FAF7" if keeper else "#FFFFFF"))
        painter.drawRoundedRect(r, 10 if keeper else 5, 10 if keeper else 5)
        font = QFont(option.font)
        font.setPixelSize(14)
        painter.setFont(font)
        check_rect, text_rect = hit_rects(r, keeper)
        if not keeper and r.width() >= 460:
            text_rect.adjust(0, 0, -115, 0)
            painter.setPen(QColor(MUTED))
            painter.drawText(
                r.adjusted(r.width() - 126, 18, -16, 0),
                Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignRight,
                format_bytes(record.size),
            )
            painter.drawText(
                r.adjusted(r.width() - 126, 42, -16, 0),
                Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignRight,
                "受到保護" if not allowed else "副本",
            )
        if keeper:
            rank, kind, glyph = file_type(record)
            painter.setPen(QColor(TEAL))
            font.setBold(True)
            painter.setFont(font)
            painter.drawText(
                r.adjusted(18, 14, -18, 0),
                Qt.AlignmentFlag.AlignTop,
                f"{kind}  /  群組 {number:02}    ·    {len(group.records) - 1} 份副本",
            )
            preview = QRect(r.left() + 16, r.top() + 47, text_rect.left() - r.left() - 30, 116)
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor("#E1F1EC"))
            painter.drawRoundedRect(preview, 8, 8)
            pixmap = self.previews.get(record)
            if pixmap:
                scaled = pixmap.scaled(
                    preview.size() - QSize(8, 8),
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation,
                )
                painter.drawPixmap(preview.center() - scaled.rect().center(), scaled)
            else:
                icon(glyph, TEAL, 34).paint(
                    painter, preview.center().x() - 17, preview.center().y() - 17, 34, 34
                )
            icon("lock", "#059669", 15).paint(painter, text_rect.left(), r.top() + 146, 15, 15)
            painter.setPen(QColor("#047857"))
            font.setPixelSize(12)
            font.setBold(False)
            painter.setFont(font)
            painter.drawText(text_rect.left() + 22, r.top() + 159, "保留原檔 · 不會刪除")
        else:
            square = QRect(check_rect.center().x() - 10, check_rect.center().y() - 10, 20, 20)
            painter.setPen(QPen(QColor(TEAL if checked else "#7DA79B"), 1.6))
            painter.setBrush(QColor(TEAL if checked and allowed else "#FFFFFF"))
            painter.drawRoundedRect(square, 4, 4)
            if allowed and checked:
                icon("check", "#FFFFFF", 16).paint(painter, square.adjusted(2, 2, -2, -2))
            elif not allowed:
                icon("lock", "#059669", 14).paint(painter, square.adjusted(3, 3, -3, -3))
        font.setPixelSize(15)
        font.setBold(True)
        painter.setFont(font)
        painter.setPen(QColor(TEAL if hovered else INK))
        painter.drawText(
            text_rect,
            Qt.AlignmentFlag.AlignTop,
            painter.fontMetrics().elidedText(
                record.name, Qt.TextElideMode.ElideRight, text_rect.width()
            ),
        )
        font.setPixelSize(12)
        font.setBold(False)
        painter.setFont(font)
        painter.setPen(QColor(MUTED))
        painter.drawText(
            text_rect.adjusted(0, 24, 0, 0),
            Qt.AlignmentFlag.AlignTop,
            painter.fontMetrics().elidedText(
                record.location, Qt.TextElideMode.ElideMiddle, text_rect.width()
            ),
        )
        if keeper:
            painter.drawText(
                text_rect.adjusted(0, 50, 0, 0),
                Qt.AlignmentFlag.AlignTop,
                format_bytes(record.size),
            )
        painter.restore()


class GroupView(QListView):
    details_requested = Signal(object, object)

    def __init__(self, model, previews, parent=None):
        super().__init__(parent)
        self.hover_row, self.detail_key = -1, None
        self.setModel(model)
        self.setItemDelegate(GroupDelegate(self, previews))
        self.setMouseTracking(True)
        self.setResizeMode(QListView.ResizeMode.Adjust)
        self.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.setSpacing(0)
        self.setAccessibleName("重複群組；空白鍵勾選副本，Enter 查看詳細資料")
        self.setStyleSheet("QListView { background: transparent; border: none; outline: 0; }")
        previews.changed.connect(self.viewport().update)

    def _zone(self, index, point):
        group, record, _ = self.model().rows[index.row()]
        check, text = hit_rects(self.visualRect(index), record.key == group.keeper_key)
        return "check" if check.contains(point) else "details" if text.contains(point) else "row"

    def mouseMoveEvent(self, event):
        index = self.indexAt(event.position().toPoint())
        self.hover_row = index.row() if index.isValid() else -1
        hand = index.isValid() and self._zone(index, event.position().toPoint()) == "details"
        self.viewport().setCursor(
            Qt.CursorShape.PointingHandCursor if hand else Qt.CursorShape.ArrowCursor
        )
        self.viewport().update()
        super().mouseMoveEvent(event)

    def leaveEvent(self, event):
        self.hover_row = -1
        self.viewport().update()
        super().leaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() != Qt.MouseButton.LeftButton:
            return
        index = self.indexAt(event.position().toPoint())
        if not index.isValid():
            return
        self.setCurrentIndex(index)
        zone = self._zone(index, event.position().toPoint())
        if zone == "check":
            self._toggle(index)
        elif zone == "details":
            self._details(index)
        event.accept()

    def mouseReleaseEvent(self, event):
        event.accept()

    def mouseDoubleClickEvent(self, event):
        # A second checkbox click remains a checkbox click, never a details gesture.
        self.mousePressEvent(event)

    def _toggle(self, index):
        state = index.data(Qt.ItemDataRole.CheckStateRole)
        if state is not None:
            self.model().setData(
                index,
                Qt.CheckState.Unchecked
                if state == Qt.CheckState.Checked
                else Qt.CheckState.Checked,
                Qt.ItemDataRole.CheckStateRole,
            )

    def _details(self, index):
        if not self.model().busy:
            group, record, _ = self.model().rows[index.row()]
            self.detail_key = record.key
            self.details_requested.emit(group, record)
            self.viewport().update()

    def keyPressEvent(self, event):
        index = self.currentIndex()
        if index.isValid() and event.key() == Qt.Key.Key_Space:
            self._toggle(index)
        elif index.isValid() and event.key() in {Qt.Key.Key_Enter, Qt.Key.Key_Return}:
            self._details(index)
        else:
            super().keyPressEvent(event)


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
