from __future__ import annotations

import math
import time
from pathlib import Path

from PySide6.QtCore import QEvent, QSize, Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices, QImageReader, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QScrollArea,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..confirmations import (
    ConfirmationSnapshot,
    needs_large_operation_countdown,
    permanent_confirmation_phrase,
)
from ..models import DuplicateGroup, FileRecord
from ..windows_safety import DEFAULT_WINDOWS_SAFETY_POLICY
from .state import format_bytes
from .widgets import Card, Notice, button, label


class ConfirmationDialog(QDialog):
    """Explicit confirmation; Enter never activates a destructive action."""

    def __init__(
        self, parent, snapshot: ConfirmationSnapshot, locations: str, *, second: bool = False
    ) -> None:
        super().__init__(parent)
        self.snapshot = snapshot
        self.permanent = snapshot.operation_mode == "permanent"
        self.setWindowTitle("DUPESPACE｜高風險確認" if self.permanent else "DUPESPACE｜確認清理")
        self.setMinimumWidth(540)
        self.resize(610, 650 if second else 560)
        self.setModal(True)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(26, 22, 26, 22)
        layout.setSpacing(14)
        layout.addWidget(
            label("PERMANENT DELETE" if self.permanent else "REVIEW BEFORE CLEANUP", "eyebrow")
        )
        layout.addWidget(
            label(
                "永久刪除，沒有復原功能"
                if self.permanent
                else "再次核對這次大量清理"
                if second
                else "讓原檔留下，副本進垃圾桶",
                "heading",
            )
        )
        layout.addWidget(
            Notice(
                "這不是資源回收筒。即使只有一個檔案，刪除後也無法復原。"
                if self.permanent
                else "可從 Windows 資源回收筒或 Google Drive 垃圾桶復原；失敗時不會改用永久刪除。",
                "warning" if self.permanent else "info",
            )
        )
        summary = Card()
        for name, value in (
            ("已選取", f"{snapshot.selected_count:,} 個副本"),
            ("重複群組", f"{snapshot.group_count:,} 組"),
            ("可整理容量", format_bytes(snapshot.selected_bytes)),
            ("處理方式", "立即永久刪除" if self.permanent else "移至垃圾桶"),
        ):
            row = QHBoxLayout()
            row.addWidget(label(name, "muted"))
            row.addStretch()
            row.addWidget(label(value, "danger" if self.permanent else "body"))
            summary.box.addLayout(row)
        summary.box.addWidget(label("掃描位置", "muted"))
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setMinimumHeight(64)
        location_label = label(locations, "small", wrap=True)
        location_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        scroll.setWidget(location_label)
        summary.box.addWidget(scroll)
        layout.addWidget(summary, 1)
        self.remember = QCheckBox("本次使用期間，相同來源與選取不再提醒移至垃圾桶")
        self.remember.setVisible(second and not self.permanent)
        layout.addWidget(self.remember)
        self.phrase = QLineEdit()
        self.phrase.setAccessibleName("輸入永久刪除確認文字")
        self.required = permanent_confirmation_phrase(snapshot.selected_count)
        self.typed_required = second and self.permanent
        if self.typed_required:
            layout.addWidget(label(f"請完整輸入：{self.required}", "danger"))
            self.phrase.setPlaceholderText(self.required)
            layout.addWidget(self.phrase)
        else:
            self.phrase.hide()
        wait_seconds = 0
        if (
            self.permanent
            and needs_large_operation_countdown(snapshot)
            and (second or snapshot.selected_count <= 5)
        ):
            wait_seconds = 15 if snapshot.selected_count >= 5000 else 10
        self.deadline = time.monotonic() + wait_seconds
        self.wait_label = label("", "danger")
        layout.addWidget(self.wait_label)
        buttons = QHBoxLayout()
        cancel = button("取消，保留所有檔案", "back", "subtle")
        cancel.clicked.connect(self.reject)
        buttons.addWidget(cancel)
        buttons.addStretch(1)
        buttons.addSpacing(32)
        self.confirm_button = button(
            "確認永久刪除" if self.permanent else "確認移至垃圾桶",
            "trash",
            "danger" if self.permanent else "primary",
        )
        self.confirm_button.clicked.connect(self._confirm)
        buttons.addWidget(self.confirm_button)
        layout.addLayout(buttons)
        self.phrase.textChanged.connect(self._refresh_gate)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._refresh_gate)
        self.timer.start(200)
        self._refresh_gate()
        for widget in self.findChildren(QWidget):
            widget.installEventFilter(self)
        cancel.setFocus()

    def _refresh_gate(self) -> None:
        remaining = max(0, math.ceil(self.deadline - time.monotonic()))
        self.wait_label.setText(f"大量操作安全等待：{remaining} 秒" if remaining else "")
        self.confirm_button.setEnabled(
            remaining == 0 and (not self.typed_required or self.phrase.text() == self.required)
        )

    def _confirm(self) -> None:
        self._refresh_gate()
        if self.confirm_button.isEnabled():
            self.accept()

    def eventFilter(self, watched, event) -> bool:
        if event.type() in {QEvent.Type.KeyPress, QEvent.Type.KeyRelease}:
            if event.key() in {Qt.Key.Key_Return, Qt.Key.Key_Enter}:
                return True
            if event.key() == Qt.Key.Key_Escape:
                self.reject()
                return True
        return super().eventFilter(watched, event)

    def keyPressEvent(self, event) -> None:
        if event.key() in {Qt.Key.Key_Return, Qt.Key.Key_Enter}:
            event.ignore()
        else:
            super().keyPressEvent(event)


class DetailsDialog(QDialog):
    def __init__(self, parent, group: DuplicateGroup, record: FileRecord) -> None:
        super().__init__(parent)
        self.setWindowTitle("DUPESPACE｜檢查副本")
        self.resize(940 if record.item_kind == "folder" else 650, 660)
        box = QVBoxLayout(self)
        box.setContentsMargins(24, 24, 24, 24)
        box.setSpacing(14)
        box.addWidget(
            label("檢查資料夾鏡像" if record.item_kind == "folder" else record.name, "heading")
        )
        description = label(record.location, "muted", wrap=True)
        description.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        box.addWidget(description)
        if record.item_kind == "folder":
            box.addWidget(
                Notice(
                    f"掃描時完全一致 · {record.entry_count:,} 個檔案。執行前仍會重新檢查，"
                    "資料夾只可移至垃圾桶，不能永久刪除。"
                )
            )
            trees = QHBoxLayout()
            for title, candidate in (
                ("保留目錄 · 永不刪除", group.keeper),
                ("目前檢查的目錄", record),
            ):
                column = Card()
                column.box.addWidget(label(title, "heading"))
                column.box.addWidget(label(candidate.location, "small", wrap=True))
                tree = QTreeWidget()
                tree.setHeaderHidden(True)
                tree.setUniformRowHeights(True)
                nodes: dict[str, QTreeWidgetItem] = {}
                for entry in candidate.tree_entries:
                    relative = entry.split("\0", 1)[0]
                    parent_node = None
                    segments = relative.replace("\\", "/").split("/")
                    for index, segment in enumerate(segments):
                        key = "/".join(segments[: index + 1])
                        if key not in nodes:
                            node = QTreeWidgetItem([segment])
                            if parent_node is None:
                                tree.addTopLevelItem(node)
                            else:
                                parent_node.addChild(node)
                            nodes[key] = node
                        parent_node = nodes[key]
                tree.expandToDepth(0)
                column.box.addWidget(tree, 1)
                trees.addWidget(column, 1)
            box.addLayout(trees, 1)
        else:
            preview = QLabel()
            preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
            preview.setMinimumHeight(180)
            if record.source == "local" and Path(record.name).suffix.casefold() in {
                ".jpg",
                ".jpeg",
                ".png",
                ".webp",
                ".bmp",
            }:
                try:
                    safe_path = DEFAULT_WINDOWS_SAFETY_POLICY.validate_regular_file(record.location)
                    reader = QImageReader(str(safe_path))
                    reader.setAllocationLimit(32)
                    reader.setAutoTransform(True)
                    size = reader.size()
                    if size.isValid():
                        reader.setScaledSize(
                            size.scaled(QSize(540, 250), Qt.AspectRatioMode.KeepAspectRatio)
                        )
                        picture = reader.read()
                        if not picture.isNull():
                            preview.setPixmap(QPixmap.fromImage(picture))
                except (ValueError, OSError):
                    pass
            if preview.pixmap().isNull():
                preview.setText("此格式不在應用程式內預覽\n可先檢查完整路徑與內容校驗碼。")
            box.addWidget(preview, 1)
            box.addWidget(label(f"容量：{format_bytes(record.size)}", "body"))
            checksum = label(f"內容校驗碼\n{record.checksum}", "small", wrap=True)
            checksum.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
            box.addWidget(checksum)
            box.addWidget(
                Notice(
                    f"本組保留檔案：{group.keeper.location}\n"
                    "相同內容不代表可以移除。請確認這一份不再被其他程式使用。"
                )
            )
        buttons = QHBoxLayout()
        copy = button("複製完整路徑", "copy")
        copy.clicked.connect(lambda: QApplication.clipboard().setText(record.location))
        buttons.addWidget(copy)
        if record.source == "local":
            open_folder = button("開啟所在資料夾", "folder")
            open_folder.clicked.connect(lambda: self._open_parent(record))
            buttons.addWidget(open_folder)
        elif (
            record.web_url
            and QUrl(record.web_url).scheme() == "https"
            and QUrl(record.web_url).host()
            in {
                "drive.google.com",
                "docs.google.com",
            }
        ):
            open_drive = button("在 Google Drive 查看", "external")
            open_drive.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(record.web_url)))
            buttons.addWidget(open_drive)
        buttons.addStretch()
        close = button("完成檢查", "check", "primary")
        close.clicked.connect(self.accept)
        buttons.addWidget(close)
        box.addLayout(buttons)

    def _open_parent(self, record: FileRecord) -> None:
        try:
            parent = DEFAULT_WINDOWS_SAFETY_POLICY.validate_scan_root(Path(record.location).parent)
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(parent)))
        except (ValueError, OSError):
            return
