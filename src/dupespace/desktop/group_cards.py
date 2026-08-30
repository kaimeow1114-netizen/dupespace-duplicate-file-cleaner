"""Virtual side-by-side comparison cards with bounded painting and precise hit targets."""

from __future__ import annotations

from PySide6.QtCore import (
    QAbstractAnimation,
    QAbstractListModel,
    QEasingCurve,
    QPropertyAnimation,
    QRect,
    QSize,
    Qt,
    Signal,
)
from PySide6.QtGui import QColor, QFont, QPainter, QPen
from PySide6.QtWidgets import QAbstractItemView, QListView, QStyledItemDelegate, QToolTip

from .state import format_bytes
from .widgets import INK, MUTED, TEAL, icon

COPY_HEIGHT = 76
INITIAL_COPIES = 3


def category(record):
    from .review import file_type

    return file_type(record)


class ReviewModel(QAbstractListModel):
    selection_changed = Signal()

    def __init__(self, session):
        super().__init__()
        self.session, self.rows, self.copies, self.limits = session, [], [], {}
        self.query, self.busy = "", False

    def refresh(self, query=None):
        if query is not None:
            self.query = query.casefold().strip()
        self.beginResetModel()
        self.rows, self.copies = [], []
        groups = sorted(
            self.session.groups, key=lambda g: (category(g.keeper)[0], -g.reclaimable_bytes)
        )
        for number, group in enumerate(groups, 1):
            if self.query and not any(self.query in r.location.casefold() for r in group.records):
                continue
            self.rows.append((group, group.keeper, number))
            copies = tuple(r for r in group.records if r.key != group.keeper_key)
            # A matching copy remains next to its keeper even when it was beyond the initial page.
            if self.query and self.query not in group.keeper.location.casefold():
                copies = tuple(r for r in copies if self.query in r.location.casefold())
            self.copies.append(copies)
        current = {g.keeper_key for g, _, _ in self.rows}
        self.limits = {key: limit for key, limit in self.limits.items() if key in current}
        self.endResetModel()

    def rowCount(self, parent=None):
        return 0 if parent is not None and parent.isValid() else len(self.rows)

    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or index.row() >= len(self.rows):
            return None
        group, record, number = self.rows[index.row()]
        if role == Qt.ItemDataRole.DisplayRole:
            return record.name
        if role == Qt.ItemDataRole.AccessibleTextRole:
            return f"群組 {number}，保留原檔 {record.name}，{len(group.records) - 1} 份副本"
        return None

    def flags(self, index):
        return Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsSelectable

    def setData(self, index, value, role=Qt.ItemDataRole.EditRole):
        # The model row represents the protected keeper, not a selectable copy.
        return False

    def set_record_checked(self, index, record, checked):
        if self.busy or not index.isValid() or index.row() >= len(self.rows):
            return False
        group = self.rows[index.row()][0]
        if record not in group.records or not self.session.allowed(group, record):
            return False
        if checked:
            self.session.selected.add(record.key)
        else:
            self.session.selected.discard(record.key)
        self.session.reminders.invalidate()
        self.dataChanged.emit(index, index)
        self.selection_changed.emit()
        return True

    def visible_count(self, row):
        return min(len(self.copies[row]), self.limits.get(self.rows[row][1].key, INITIAL_COPIES))

    def reveal(self, row, count=None):
        self.limits[self.rows[row][1].key] = count or (self.visible_count(row) + 20)
        self.layoutChanged.emit()


def card_geometry(rect, copies, more=False):
    """Shared geometry for painting, pointer hit testing and regression tests."""
    outer = rect.adjusted(2, 0, -4, -14)
    body = outer.adjusted(12, 42, -12, -12 - (36 if more else 0))
    side_by_side = body.width() >= 610
    if side_by_side:
        left_width = min(300, max(226, int(body.width() * 0.35)))
        keeper = QRect(body.left(), body.top(), left_width, 202)
        right = QRect(
            keeper.right() + 16, body.top(), body.width() - left_width - 16, body.height()
        )
    else:
        keeper = QRect(body.left(), body.top(), body.width(), 170)
        right = QRect(body.left(), keeper.bottom() + 12, body.width(), copies * COPY_HEIGHT)
    return outer, keeper, right


def copy_hit_rects(rect):
    return QRect(rect.left(), rect.top(), 44, rect.height()), rect.adjusted(52, 7, -12, -8)


class GroupDelegate(QStyledItemDelegate):
    def __init__(self, view, previews):
        super().__init__(view)
        self.view, self.previews = view, previews

    def sizeHint(self, option, index):
        count = index.model().visible_count(index.row())
        more = count < len(index.model().copies[index.row()])
        wide = self.view.viewport().width() - 29 >= 610
        height = max(202, count * COPY_HEIGHT) if wide else 182 + count * COPY_HEIGHT
        return QSize(0, 68 + height + (36 if more else 0))

    @staticmethod
    def text(painter, rect, text, size=13, color=INK, bold=False, middle=False):
        font = QFont(painter.font())
        font.setPixelSize(size)
        font.setBold(bold)
        painter.setFont(font)
        painter.setPen(QColor(color))
        painter.drawText(
            rect,
            Qt.AlignmentFlag.AlignTop,
            painter.fontMetrics().elidedText(
                text,
                Qt.TextElideMode.ElideMiddle if middle else Qt.TextElideMode.ElideRight,
                max(0, rect.width()),
            ),
        )

    def paint(self, painter, option, index):
        model, row = index.model(), index.row()
        group, keeper, number = model.rows[row]
        count = model.visible_count(row)
        more = count < len(model.copies[row])
        outer, left, right = card_geometry(option.rect, count, more)
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(QPen(QColor("#D2E5DF")))
        painter.setBrush(QColor("#FFFFFF"))
        painter.drawRoundedRect(outer, 12, 12)
        self.text(
            painter,
            outer.adjusted(16, 12, -100, 0),
            f"{category(keeper)[1]}  /  群組 {number:02}    ·    {len(group.records) - 1} 份副本",
            13,
            TEAL,
            True,
        )
        if count > INITIAL_COPIES:
            self.text(
                painter, QRect(outer.right() - 80, outer.top() + 12, 70, 22), "收合副本", 12, TEAL
            )
        hovered = self.view.hover_key == keeper.key or self.view.detail_key == keeper.key
        painter.setBrush(QColor("#EAF7F2" if hovered else "#F2FAF7"))
        painter.setPen(QPen(QColor("#59B8A8" if hovered else "#D6EAE3")))
        painter.drawRoundedRect(left, 9, 9)
        wide = right.top() == left.top()
        visual = QRect(left.left() + 12, left.top() + 12, 112, 82)
        if not wide:
            visual.setHeight(116)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor("#DDEFE8"))
        painter.drawRoundedRect(visual, 8, 8)
        pixmap = self.previews.get(keeper)
        if pixmap:
            scaled = pixmap.scaled(
                visual.size() - QSize(6, 6),
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
            painter.drawPixmap(visual.center() - scaled.rect().center(), scaled)
        else:
            icon(category(keeper)[2], TEAL, 30).paint(
                painter, visual.center().x() - 15, visual.center().y() - 15, 30, 30
            )
        if wide:
            text = QRect(left.left() + 12, visual.bottom() + 10, left.width() - 24, 56)
            badge = QRect(
                visual.right() + 10, visual.top() + 10, left.right() - visual.right() - 20, 64
            )
            self.text(painter, badge, "保留原檔", 13, "#047857", True)
            self.text(painter, badge.adjusted(0, 24, 0, 0), format_bytes(keeper.size), 12, MUTED)
        else:
            text = QRect(
                visual.right() + 12, left.top() + 20, left.right() - visual.right() - 24, 70
            )
            self.text(painter, text.adjusted(0, 66, 0, 30), format_bytes(keeper.size), 12, MUTED)
        self.text(painter, text, keeper.name, 15, INK, True)
        self.text(painter, text.adjusted(0, 27, 0, 20), keeper.location, 12, MUTED, middle=True)
        icon("lock", "#059669", 14).paint(painter, left.left() + 12, left.bottom() - 25, 14, 14)
        self.text(
            painter,
            QRect(left.left() + 33, left.bottom() - 25, left.width() - 40, 22),
            "原檔受保護，不會刪除",
            12,
            "#047857",
        )
        # Paint only visible copies, even after a very large group is expanded.
        viewport = self.view.viewport().rect()
        first = max(0, (viewport.top() - right.top()) // COPY_HEIGHT)
        last = min(count, (viewport.bottom() - right.top()) // COPY_HEIGHT + 1)
        for offset in range(first, last):
            record = model.copies[row][offset]
            r = QRect(
                right.left(), right.top() + offset * COPY_HEIGHT, right.width(), COPY_HEIGHT - 6
            )
            allowed = model.session.allowed(group, record)
            selected = record.key in model.session.selected
            hovered = self.view.hover_key == record.key or self.view.detail_key == record.key
            painter.setBrush(QColor("#EFFAF6" if hovered else "#FFFFFF"))
            painter.setPen(QPen(QColor("#56B6A4" if hovered else "#DFEBE7"), 1.5 if hovered else 1))
            painter.drawRoundedRect(r, 7, 7)
            check, text = copy_hit_rects(r)
            square = QRect(check.center().x() - 10, check.center().y() - 10, 20, 20)
            painter.setPen(QPen(QColor(TEAL if selected else "#7DA79B"), 1.5))
            painter.setBrush(QColor(TEAL if selected and allowed else "#FFFFFF"))
            painter.drawRoundedRect(square, 4, 4)
            if selected and allowed:
                icon("check", "#FFFFFF", 16).paint(painter, square.adjusted(2, 2, -2, -2))
            elif not allowed:
                icon("lock", "#059669", 14).paint(painter, square.adjusted(3, 3, -3, -3))
            self.text(
                painter,
                text.adjusted(0, 0, -74, 0),
                record.name,
                15,
                TEAL if hovered else INK,
                True,
            )
            self.text(
                painter,
                QRect(r.right() - 90, r.top() + 10, 80, 20),
                format_bytes(record.size),
                12,
                MUTED,
            )
            self.text(painter, text.adjusted(0, 27, 0, 0), record.location, 12, MUTED, middle=True)
        if more:
            self.text(
                painter,
                self.view.more_rect(index),
                f"再顯示 {min(20, len(model.copies[row]) - count)} 份副本"
                f" · 尚有 {len(model.copies[row]) - count:,} 份",
                13,
                TEAL,
                True,
            )
        painter.restore()


class GroupView(QListView):
    details_requested = Signal(object, object)

    def __init__(self, model, previews, parent=None):
        super().__init__(parent)
        self.hover_key, self.detail_key, self.focus_key = None, None, None
        self.reduced_motion = False
        self.setModel(model)
        self.setItemDelegate(GroupDelegate(self, previews))
        self.setMouseTracking(True)
        self.setResizeMode(QListView.ResizeMode.Adjust)
        self.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.verticalScrollBar().setSingleStep(22)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.setAccessibleName("左右重複群組；方向鍵選擇檔案，空白鍵勾選，Enter 查看詳細資料")
        self.setStyleSheet("QListView { background: #F5F8F8; border: none; outline: 0; }")
        self.animation = QPropertyAnimation(self.verticalScrollBar(), b"value", self)
        self.animation.setDuration(170)
        self.animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        previews.changed.connect(self.viewport().update)
        model.modelReset.connect(self.animation.stop)

    def wheelEvent(self, event):
        if event.pixelDelta().y():
            self.animation.stop()
            self.verticalScrollBar().setValue(
                self.verticalScrollBar().value() - event.pixelDelta().y()
            )
        else:
            bar = self.verticalScrollBar()
            start = (
                self.animation.endValue()
                if self.animation.state() == QAbstractAnimation.State.Running
                else bar.value()
            )
            target = max(
                bar.minimum(), min(bar.maximum(), int(start - event.angleDelta().y() / 120 * 66))
            )
            self.animation.stop()
            if self.reduced_motion:
                bar.setValue(target)
            else:
                self.animation.setStartValue(bar.value())
                self.animation.setEndValue(target)
                self.animation.start()
        event.accept()

    def geometry_for(self, index):
        row = index.row()
        count = self.model().visible_count(row)
        return card_geometry(self.visualRect(index), count, count < len(self.model().copies[row]))

    def copy_rect(self, index, offset):
        right = self.geometry_for(index)[2]
        return QRect(
            right.left(), right.top() + offset * COPY_HEIGHT, right.width(), COPY_HEIGHT - 6
        )

    def more_rect(self, index):
        outer = self.geometry_for(index)[0]
        return QRect(outer.left() + 16, outer.bottom() - 35, outer.width() - 32, 24)

    def _target(self, index, point):
        row = index.row()
        group, keeper, _ = self.model().rows[row]
        outer, left, right = self.geometry_for(index)
        if (
            self.model().visible_count(row) > INITIAL_COPIES
            and point.y() < outer.top() + 38
            and point.x() > outer.right() - 90
        ):
            return "collapse", None
        if self.model().visible_count(row) < len(self.model().copies[row]) and self.more_rect(
            index
        ).contains(point):
            return "more", None
        if left.contains(point):
            return "details", keeper
        offset = (point.y() - right.top()) // COPY_HEIGHT
        if 0 <= offset < self.model().visible_count(row):
            rect = self.copy_rect(index, offset)
            record = self.model().copies[row][offset]
            check, text = copy_hit_rects(rect)
            if check.contains(point):
                return "check", record
            if text.contains(point):
                return "details", record
        return "row", None

    def mouseMoveEvent(self, event):
        index = self.indexAt(event.position().toPoint())
        zone, record = (
            self._target(index, event.position().toPoint()) if index.isValid() else ("row", None)
        )
        self.hover_key = record.key if record else None
        self.viewport().setCursor(
            Qt.CursorShape.PointingHandCursor
            if zone in {"details", "more", "collapse"}
            else Qt.CursorShape.ArrowCursor
        )
        self.viewport().update()
        if record:
            self.setToolTip(record.location)
        else:
            QToolTip.hideText()
            self.setToolTip("")
        super().mouseMoveEvent(event)

    def leaveEvent(self, event):
        self.hover_key = None
        self.viewport().update()
        super().leaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() != Qt.MouseButton.LeftButton:
            return
        self.animation.stop()
        index = self.indexAt(event.position().toPoint())
        if not index.isValid():
            return
        self.setCurrentIndex(index)
        zone, record = self._target(index, event.position().toPoint())
        if record:
            self.focus_key = record.key
        if zone == "check":
            self.model().set_record_checked(
                index, record, record.key not in self.model().session.selected
            )
        elif zone == "details":
            self._details(index, record)
        elif zone in {"more", "collapse"} and not self.model().busy:
            self.model().reveal(index.row(), INITIAL_COPIES if zone == "collapse" else None)
            self.doItemsLayout()
        event.accept()

    def mouseReleaseEvent(self, event):
        event.accept()

    def mouseDoubleClickEvent(self, event):
        self.mousePressEvent(event)

    def current_record(self):
        index = self.currentIndex()
        if not index.isValid():
            return None
        group, keeper, _ = self.model().rows[index.row()]
        return next((r for r in group.records if r.key == self.focus_key), keeper)

    def _details(self, index, record):
        if not self.model().busy:
            self.detail_key = record.key
            self.details_requested.emit(self.model().rows[index.row()][0], record)
            self.viewport().update()

    def keyPressEvent(self, event):
        index = self.currentIndex()
        record = self.current_record()
        if record is not None and event.key() == Qt.Key.Key_Space:
            self.model().set_record_checked(
                index, record, record.key not in self.model().session.selected
            )
        elif record is not None and event.key() in {Qt.Key.Key_Return, Qt.Key.Key_Enter}:
            self._details(index, record)
        elif record is not None and event.key() in {Qt.Key.Key_Left, Qt.Key.Key_Right}:
            records = (self.model().rows[index.row()][1], *self.model().copies[index.row()])
            offset = next((i for i, r in enumerate(records) if r.key == record.key), 0)
            offset = max(
                0, min(len(records) - 1, offset + (1 if event.key() == Qt.Key.Key_Right else -1))
            )
            self.focus_key = records[offset].key
            self.detail_key = self.focus_key
            if offset > self.model().visible_count(index.row()):
                self.model().reveal(index.row(), offset)
                self.doItemsLayout()
            self.viewport().update()
        else:
            super().keyPressEvent(event)
