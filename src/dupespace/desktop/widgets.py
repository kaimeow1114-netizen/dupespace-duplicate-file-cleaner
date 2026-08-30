from __future__ import annotations

# Preserve the readable one-line SVG paths and stylesheet declarations.
# ruff: noqa: E501
import math
from importlib.resources import files
from pathlib import Path

from PySide6.QtCore import QRectF, QSize, Qt, QTimer, Signal
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPen, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import (
    QAbstractItemView,
    QFrame,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QPushButton,
    QStyle,
    QStyledItemDelegate,
    QStyleOptionViewItem,
    QVBoxLayout,
    QWidget,
)

TEAL = "#0D9488"
EMERALD = "#10B981"
INK = "#102A2C"
MUTED = "#627776"
ROSE = "#BE123C"

# Lucide/Feather vector geometry; see the bundled Lucide license notice.
ICON_PATHS = {
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    "video": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m10 8 6 4-6 4Z"/>',
    "edit": '<path d="m16 3 5 5L8 21H3v-5Zm-2 2 5 5"/>',
    "drive": '<rect x="2" y="12" width="20" height="8" rx="2"/><path d="m2 12 3-8h14l3 8M6 16h.01M10 16h.01"/>',
    "cloud": '<path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6-1A4.5 4.5 0 0 0 6.5 16H8m4-4v9m-3-3 3 3 3-3"/>',
    "shield": '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11"/><path d="m9 12 2 2 4-4"/>',
    "folder": '<path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    "history": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2"/>',
    "settings": '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>',
    "arrow": '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    "back": '<path d="M19 12H5m6 6-6-6 6-6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "close": '<path d="m6 6 12 12M6 18 18 6"/>',
    "trash": '<path d="M3 6h18m-2 0-1 14H6L5 6m4 0V3h6v3m-5 4v7m4-7v7"/>',
    "search": '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    "check": '<path d="m5 12 4 4L19 6"/>',
    "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "warning": '<path d="m12 3 10 18H2Z"/><path d="M12 9v4m0 4h.01"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>',
    "external": '<path d="M15 3h6v6m0-6L10 14M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "stop": '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m9-12v12m-5-5 5 5 5-5"/>',
    "code": '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-14-4 18"/>',
    "eye": '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
    "panel": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m5-13 4 4-4 4"/>',
    "github": '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4 5 5 0 0 0 19.3.5S18.2.1 15 1.8a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.3 3.5 6.5 6.8 7A4.8 4.8 0 0 0 8 18v4m-5-7c0 0 1 1 4 1"/>',
    "bug": '<path d="m8 2 1.9 1.9M16 2l-1.9 1.9M3 13h4m10 0h4M5 7l2.3 2.3M19 7l-2.3 2.3M5 19l2.3-2.3M19 19l-2.3-2.3"/><rect x="7" y="4" width="10" height="16" rx="5"/><path d="M12 8v8"/>',
    "message": '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
}


def icon(name: str, color: str = TEAL, size: int = 20) -> QIcon:
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
        f'viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="1.7" '
        f'stroke-linecap="round" stroke-linejoin="round">{ICON_PATHS[name]}</svg>'
    )
    renderer = QSvgRenderer(svg.encode())
    pixmap = QPixmap(size * 2, size * 2)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    renderer.render(painter)
    painter.end()
    pixmap.setDevicePixelRatio(2)
    return QIcon(pixmap)


def label(text: str, kind: str = "body", *, wrap: bool = False) -> QLabel:
    result = QLabel(text)
    result.setTextFormat(Qt.TextFormat.PlainText)
    result.setProperty("kind", kind)
    result.setWordWrap(wrap)
    return result


def button(text: str, glyph: str | None = None, kind: str = "secondary") -> QPushButton:
    result = QPushButton(text)
    result.setProperty("kind", kind)
    result.setCursor(Qt.CursorShape.PointingHandCursor)
    result.setAutoDefault(False)
    result.setDefault(False)
    if glyph:
        color = "#FFFFFF" if kind in {"primary", "danger"} else TEAL
        result.setIcon(icon(glyph, color))
        result.setIconSize(QSize(18, 18))
    return result


class Card(QFrame):
    def __init__(self, parent: QWidget | None = None, kind: str = "card") -> None:
        super().__init__(parent)
        self.setProperty("kind", kind)
        self.box = QVBoxLayout(self)
        self.box.setContentsMargins(22, 20, 22, 20)
        self.box.setSpacing(14)


class Notice(QFrame):
    def __init__(self, text: str = "", kind: str = "info") -> None:
        super().__init__()
        self.setProperty("kind", f"notice-{kind}")
        row = QHBoxLayout(self)
        row.setContentsMargins(14, 12, 14, 12)
        glyph = QLabel()
        glyph.setPixmap(icon("warning" if kind == "warning" else "shield", TEAL).pixmap(20))
        row.addWidget(glyph, 0, Qt.AlignmentFlag.AlignTop)
        self.message = label(text, "notice", wrap=True)
        row.addWidget(self.message, 1)
        self.setVisible(bool(text))

    def setText(self, text: str) -> None:
        self.message.setText(text)
        self.setVisible(bool(text))


class FolderDropList(QListWidget):
    """Large, direct folder target with click-to-pick and safe directory drops."""

    folder_requested = Signal()
    folders_dropped = Signal(object)
    remove_requested = Signal(object)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("rootPicker")
        self.setAcceptDrops(True)
        self.setDragDropMode(QAbstractItemView.DragDropMode.DropOnly)
        self.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setMinimumHeight(220)
        self.setAccessibleName("要整理的資料夾與受保護子資料夾")
        self.setItemDelegate(FolderDelegate(self))
        self.setMouseTracking(True)

    @staticmethod
    def _directories(event) -> list[str]:
        mime = event.mimeData()
        if not mime.hasUrls():
            return []
        paths: list[str] = []
        for url in mime.urls():
            local = url.toLocalFile()
            if local and Path(local).is_dir():
                paths.append(str(Path(local)))
        return paths

    def dragEnterEvent(self, event) -> None:
        if self._directories(event):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event) -> None:
        if self._directories(event):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event) -> None:
        paths = self._directories(event)
        if paths:
            self.folders_dropped.emit(paths)
            event.acceptProposedAction()
        else:
            event.ignore()

    def mousePressEvent(self, event) -> None:
        item = self.itemAt(event.position().toPoint())
        if item is not None and folder_remove_rect(self.visualItemRect(item)).contains(
            event.position().toPoint()
        ):
            if event.button() == Qt.MouseButton.LeftButton:
                self.remove_requested.emit(item.data(Qt.ItemDataRole.UserRole))
            event.accept()
            return
        if item is None and event.button() == Qt.MouseButton.LeftButton:
            self.folder_requested.emit()
        super().mousePressEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:
        event.accept()

    def mouseMoveEvent(self, event) -> None:
        item = self.itemAt(event.position().toPoint())
        remove = item is not None and folder_remove_rect(self.visualItemRect(item)).contains(
            event.position().toPoint()
        )
        self.viewport().setCursor(
            Qt.CursorShape.PointingHandCursor
            if remove or item is None
            else Qt.CursorShape.ArrowCursor
        )
        self.setToolTip("移出掃描清單，不會刪除檔案" if remove else "")
        super().mouseMoveEvent(event)

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key.Key_Delete and self.currentItem():
            self.remove_requested.emit(self.currentItem().data(Qt.ItemDataRole.UserRole))
        else:
            super().keyPressEvent(event)

    def paintEvent(self, event) -> None:
        super().paintEvent(event)
        if self.count():
            return
        painter = QPainter(self.viewport())
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        rectangle = self.viewport().rect().adjusted(24, 24, -24, -24)
        painter.setPen(QColor("#0F766E"))
        heading = QFont(self.font())
        heading.setPointSize(14)
        heading.setBold(True)
        painter.setFont(heading)
        painter.drawText(
            rectangle.adjusted(0, 42, 0, 0),
            Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop,
            "點一下選擇資料夾",
        )
        painter.setPen(QColor(MUTED))
        painter.setFont(self.font())
        painter.drawText(
            rectangle.adjusted(0, 78, 0, 0),
            Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop,
            "也可以直接把一個或多個資料夾拖到這裡",
        )
        icon("folder", TEAL, 34).paint(
            painter,
            rectangle.center().x() - 17,
            rectangle.top(),
            34,
            34,
        )
        painter.end()


def folder_remove_rect(rect):
    return rect.adjusted(max(0, rect.width() - 44), 10, -6, -10)


class FolderDelegate(QStyledItemDelegate):
    def paint(self, painter, option, index):
        styled = QStyleOptionViewItem(option)
        self.initStyleOption(styled, index)
        styled.text, styled.icon = "", QIcon()
        option.widget.style().drawControl(
            QStyle.ControlElement.CE_ItemViewItem, styled, painter, option.widget
        )
        data = index.data(Qt.ItemDataRole.UserRole)
        if not data:
            return
        path, role = data
        painter.save()
        rectangle = option.rect.adjusted(14, 10, -50, -8)
        icon("shield" if role == "keep" else "folder").paint(
            painter, rectangle.left(), rectangle.top() + 8, 22, 22
        )
        rectangle.adjust(34, 0, 0, 0)
        heading = QFont(option.font)
        heading.setBold(True)
        painter.setFont(heading)
        painter.setPen(QColor(INK))
        name = Path(path).name or path
        if role == "keep":
            name += " · 已保護"
        painter.drawText(
            rectangle,
            Qt.AlignmentFlag.AlignTop,
            painter.fontMetrics().elidedText(name, Qt.TextElideMode.ElideRight, rectangle.width()),
        )
        painter.setFont(option.font)
        painter.setPen(QColor(MUTED))
        painter.drawText(
            rectangle.adjusted(0, 24, 0, 0),
            Qt.AlignmentFlag.AlignTop,
            painter.fontMetrics().elidedText(path, Qt.TextElideMode.ElideMiddle, rectangle.width()),
        )
        remove = folder_remove_rect(option.rect)
        icon("close", MUTED, 18).paint(
            painter, remove.center().x() - 9, remove.center().y() - 9, 18, 18
        )
        painter.restore()


class ProfileButton(QPushButton):
    def __init__(self, name, preview):
        super().__init__()
        self.name, self.preview = name, preview
        self.setMinimumWidth(0)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setAccessibleName(f"載入 {name}：{preview}")
        self.setToolTip(f"{name}\n{preview}")
        self.setMinimumHeight(44)

    def sizeHint(self):
        return QSize(260, 44)

    def paintEvent(self, event):
        super().paintEvent(event)
        painter = QPainter(self)
        area = self.rect().adjusted(12, 0, -12, 0)
        preview_width = min(self.width() // 2, max(0, area.width() // 2))
        font = QFont(self.font())
        font.setBold(True)
        painter.setFont(font)
        painter.setPen(QColor(INK))
        title = area.adjusted(0, 0, -preview_width - 18, 0)
        painter.drawText(
            title,
            Qt.AlignmentFlag.AlignVCenter,
            painter.fontMetrics().elidedText(self.name, Qt.TextElideMode.ElideRight, title.width()),
        )
        font.setBold(False)
        font.setPixelSize(12)
        painter.setFont(font)
        painter.setPen(QColor(MUTED))
        area.setLeft(area.right() - preview_width)
        painter.drawText(
            area,
            Qt.AlignmentFlag.AlignVCenter,
            painter.fontMetrics().elidedText(
                self.preview, Qt.TextElideMode.ElideRight, preview_width
            ),
        )


class ProfileRow(QWidget):
    load = Signal(str)
    rename = Signal(str)
    edit = Signal(str)
    remove = Signal(str)

    def __init__(self, name, entries):
        super().__init__()
        self.setObjectName("profileRow")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        row = QHBoxLayout(self)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(4)
        names = [Path(e.get("path", "")).name for e in entries if isinstance(e, dict)]
        self.main = ProfileButton(name, f"{len(names)} 個資料夾 · " + "、".join(names))
        self.main.clicked.connect(lambda: self.load.emit(name))
        row.addWidget(self.main, 1)
        for glyph, title, signal in (
            ("edit", "重新命名", self.rename),
            ("settings", "編輯位置", self.edit),
            ("close", "刪除設定檔", self.remove),
        ):
            action = button("", glyph, "icon")
            action.setFixedSize(34, 36)
            action.setToolTip(title)
            action.setAccessibleName(f"{title}：{name}")
            action.clicked.connect(lambda _checked=False, s=signal: s.emit(name))
            row.addWidget(action)


class ScanOrbit(QWidget):
    def __init__(self, *, compact: bool = False) -> None:
        super().__init__()
        self.setFixedSize(90 if compact else 184, 90 if compact else 184)
        self.phase = 0.0
        self.active = False
        self.reduced_motion = False
        self.logo = QPixmap(str(files("dupespace.assets").joinpath("dupespace-icon.png")))
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)

    def animate(self, active: bool, reduced_motion: bool = False) -> None:
        self.active, self.reduced_motion = active, reduced_motion
        if active and not reduced_motion:
            self.timer.start(40)
        else:
            self.timer.stop()
        self.update()

    def _tick(self) -> None:
        self.phase = (self.phase + 0.025) % (2 * math.pi)
        self.update()

    def paintEvent(self, _event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        center = self.width() / 2
        radius = center - 8
        painter.setPen(QPen(QColor("#D8EFEB"), 1.5))
        painter.drawEllipse(QRectF(8, 8, radius * 2, radius * 2))
        painter.drawEllipse(QRectF(21, 21, self.width() - 42, self.height() - 42))
        painter.setPen(Qt.PenStyle.NoPen)
        for index in range(7):
            angle = self.phase + index * (math.pi * 2 / 7)
            painter.setBrush(QColor("#14B8A6" if index % 2 else "#99F6E4"))
            x, y = center + math.cos(angle) * radius, center + math.sin(angle) * radius
            painter.drawEllipse(QRectF(x - 3, y - 3, 6, 6))
        inset = int(self.width() * 0.24)
        painter.drawPixmap(
            inset, inset, self.width() - inset * 2, self.height() - inset * 2, self.logo
        )


STYLES = """
QMainWindow, QDialog { background: #F5F8F8; }
QWidget#page { background: #F5F8F8; }
QWidget#profileCanvas { background: #F5F8F8; }
QWidget#profileRow { background: #ECF6F2; border: 1px solid #D4E7DF; border-radius: 10px; }
QSplitter::handle { background: #D4E5DF; }
QSplitter::handle:hover { background: #83CDBD; }
QWidget { font-family: 'Segoe UI', 'Microsoft JhengHei UI', sans-serif; font-size: 14px; color: #102A2C; }
QLabel { background: transparent; }
QLabel[kind='eyebrow'] { color: #0F766E; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
QLabel[kind='title'] { font-size: 30px; font-weight: 700; color: #102A2C; }
QLabel[kind='heading'] { font-size: 19px; font-weight: 700; }
QLabel[kind='muted'] { color: #627776; font-size: 13px; }
QLabel[kind='small'] { color: #627776; font-size: 11px; }
QLabel[kind='metric'] { font-size: 28px; font-weight: 700; color: #0F766E; }
QLabel[kind='danger'] { color: #BE123C; font-weight: 700; }
QLabel[kind='badge'] { color: #047857; background: #D1FAE5; border-radius: 9px; padding: 4px 9px; font-size: 11px; font-weight: 600; }
QFrame[kind='card'] { background: white; border: 1px solid #DEEBE8; border-radius: 16px; }
QFrame[kind='keep'] { background: white; border: 1px solid #A7DBC9; border-radius: 16px; }
QFrame[kind='clean'] { background: white; border: 1px solid #95D9D2; border-radius: 16px; }
QFrame[kind='notice-info'] { background: #E8F5F1; border: 1px solid #CCE8DF; border-radius: 10px; }
QFrame[kind='notice-warning'] { background: #FFFBEB; border: 1px solid #F5D99A; border-radius: 10px; }
QLabel[kind='notice'] { font-size: 12px; color: #365C54; }
QFrame#sidebar { background: #08272B; border: none; }
QFrame#sidebar QLabel { color: #99B9BA; }
QFrame#sidebar QLabel[kind='brand'] { color: #F0FDFA; font-size: 18px; font-weight: 800; letter-spacing: 1px; }
QFrame#sidebar QLabel[kind='eyebrow'] { color: #55C6BA; font-size: 10px; }
QPushButton { border: 1px solid #CFDFDB; border-radius: 9px; padding: 10px 16px; background: #FFFFFF; font-weight: 600; }
QPushButton:hover { background: #ECF8F4; border-color: #70BCAF; }
QPushButton:pressed { background: #DCF2EC; }
QPushButton:focus { border: 2px solid #0D9488; padding: 9px 15px; }
QPushButton:disabled { color: #95AAA6; background: #EAF0EE; border-color: #E0E9E6; }
QPushButton[kind='primary'] { color: white; background: #0F766E; border-color: #0F766E; }
QPushButton[kind='primary']:hover { background: #0D9488; }
QPushButton[kind='primary']:disabled { background: #BDD5CF; border-color: #BDD5CF; color: #F7FCFA; }
QPushButton[kind='danger'] { background: #BE123C; color: white; border-color: #BE123C; }
QPushButton[kind='danger']:disabled { background: #E4BBC6; border-color: #E4BBC6; color: white; }
QPushButton[kind='subtle'] { border-color: transparent; background: transparent; color: #526D67; padding: 8px 10px; }
QPushButton[kind='icon'] { padding: 6px; min-width: 18px; min-height: 18px; background: transparent; border: 1px solid transparent; }
QPushButton[kind='icon']:hover { background: #E1F3ED; border-color: #81CBBB; }
QPushButton#sidebarToggle { padding: 0; text-align: center; border: none; background: transparent; }
QPushButton#sidebarToggle:hover { background: #15464A; }
QPushButton[compact='true'] { padding: 10px 0; text-align: center; }
QPushButton[kind='nav'] { color: #A9C7C6; background: transparent; border: none; padding: 14px 17px; text-align: left; }
QPushButton[kind='nav']:hover { background: #103A3D; color: white; }
QPushButton[kind='nav']:checked { background: #15464A; color: #99F6E4; border: 1px solid #26716B; }
QPushButton[kind='nav']:focus { border: 1px solid #5EEAD4; }
QPushButton[kind='account'] { color: #E7FFFB; background: #103A3D; border: 1px solid #275A5A; padding: 11px 12px; text-align: left; }
QPushButton[kind='account']:hover { background: #15464A; border-color: #4FA89E; }
QPushButton[kind='add'] { border: 1px dashed #90C6BD; background: #F6FCFA; color: #0F766E; }
QPushButton[kind='mode']:checked { background: #DDF5EA; border: 2px solid #059669; padding: 9px 15px; }
QPushButton[kind='risk-mode'] { color: #9F1239; }
QPushButton[kind='risk-mode']:checked { background: #FFF1F2; border: 2px solid #E11D48; padding: 9px 15px; }
QLineEdit, QComboBox { background: white; border: 1px solid #D4E4DF; border-radius: 8px; padding: 9px 12px; min-height: 20px; }
QLineEdit:focus, QComboBox:focus { border: 2px solid #0D9488; padding: 8px 11px; }
QListWidget, QTreeWidget, QTableView { background: white; border: none; selection-background-color: #DBF1EB; selection-color: #102A2C; outline: 0; }
QListWidget::item { padding: 9px 4px; border-bottom: 1px solid #ECF2EF; }
QListWidget#rootPicker { background: #F8FCFB; border: 2px dashed #9CCFC6; border-radius: 14px; padding: 8px; }
QListWidget#rootPicker:hover { border-color: #14B8A6; background: #F1FBF8; }
QListWidget#rootPicker::item { min-height: 52px; margin: 3px; padding: 10px 12px; border: 1px solid #D9EAE5; border-radius: 10px; background: white; }
QListWidget#rootPicker::item:selected { background: #DDF5EA; border: 2px solid #0D9488; color: #102A2C; }
QTableView::item { border-bottom: 1px solid #EDF3F0; padding: 5px; }
QTableView::indicator { width: 17px; height: 17px; }
QHeaderView::section { background: #F5F9F7; border: none; border-bottom: 1px solid #E1EDE7; padding: 12px 8px; color: #6A817B; font-size: 12px; }
QScrollArea { border: none; background: transparent; }
QScrollBar:vertical { background: transparent; width: 8px; margin: 2px; }
QScrollBar::handle:vertical { background: #BCD2CA; border-radius: 3px; min-height: 32px; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }
QProgressBar { border: none; background: #E2F0EA; border-radius: 5px; min-height: 9px; max-height: 9px; }
QProgressBar::chunk { border-radius: 5px; background: #14B8A6; }
QCheckBox, QRadioButton { spacing: 9px; }
QCheckBox::indicator { width: 18px; height: 18px; }
QToolTip { background: #08272B; color: #F0FDFA; border: 1px solid #29605B; padding: 6px; }
"""
