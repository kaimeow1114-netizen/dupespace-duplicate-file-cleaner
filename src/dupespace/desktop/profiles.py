"""Edit saved locations without scanning or touching their contents."""

from pathlib import Path

from PySide6.QtCore import QSize, Qt
from PySide6.QtWidgets import QDialog, QFileDialog, QHBoxLayout, QListWidgetItem, QVBoxLayout

from ..models import ScanRoot
from .state import validate_roots
from .widgets import FolderDropList, Notice, button, label


class ProfileEditor(QDialog):
    def __init__(self, parent, name, entries):
        super().__init__(parent)
        self.setWindowTitle(f"DUPESPACE｜編輯 {name}")
        self.resize(660, 490)
        self.entries = [dict(entry) for entry in entries]
        box = QVBoxLayout(self)
        box.setContentsMargins(22, 22, 22, 22)
        box.addWidget(label(f"編輯位置 · {name}", "heading", wrap=True))
        self.picker = FolderDropList()
        self.picker.folder_requested.connect(self._pick)
        self.picker.folders_dropped.connect(self._drop)
        self.picker.remove_requested.connect(self._remove)
        box.addWidget(self.picker, 1)
        self.notice = Notice()
        box.addWidget(self.notice)
        actions = QHBoxLayout()
        add = button("加入資料夾", "plus")
        add.clicked.connect(self._pick)
        actions.addWidget(add)
        protect = button("保護子資料夾", "shield")
        protect.clicked.connect(self._protect)
        actions.addWidget(protect)
        actions.addStretch()
        cancel = button("取消", kind="subtle")
        cancel.clicked.connect(self.reject)
        actions.addWidget(cancel)
        save = button("儲存變更", "check", "primary")
        save.clicked.connect(self._save)
        actions.addWidget(save)
        box.addLayout(actions)
        self._refresh()

    def _refresh(self):
        self.picker.clear()
        for entry in self.entries:
            item = QListWidgetItem(entry["path"])
            item.setData(Qt.ItemDataRole.UserRole, (entry["path"], entry["role"]))
            item.setSizeHint(QSize(0, 68))
            self.picker.addItem(item)

    def _pick(self):
        path = QFileDialog.getExistingDirectory(
            self,
            "加入整理位置",
            "",
            QFileDialog.Option.ShowDirsOnly | QFileDialog.Option.DontResolveSymlinks,
        )
        if path:
            self._drop([path])

    def _drop(self, paths):
        self.entries.extend({"path": path, "role": "clean"} for path in paths)
        self._refresh()

    def _protect(self):
        item = self.picker.currentItem()
        data = item.data(Qt.ItemDataRole.UserRole) if item else None
        if not data or data[1] != "clean":
            self.notice.setText("先選取整理位置，再選擇其中要保護的子資料夾。")
            return
        path = QFileDialog.getExistingDirectory(
            self,
            "選擇保護子資料夾",
            data[0],
            QFileDialog.Option.ShowDirsOnly | QFileDialog.Option.DontResolveSymlinks,
        )
        if path:
            self.entries.append({"path": path, "role": "keep"})
            self._refresh()

    def _remove(self, data):
        path, role = data
        self.entries = [
            e
            for e in self.entries
            if e["path"] != path
            and not (
                role == "clean"
                and e["role"] == "keep"
                and Path(e["path"]).is_relative_to(Path(path))
            )
        ]
        self._refresh()

    def _save(self):
        try:
            roots = validate_roots(tuple(ScanRoot(e["path"], e["role"]) for e in self.entries))
            if not roots:
                raise ValueError("至少保留一個整理位置。")
            self.entries = [{"path": r.physical_path, "role": r.role} for r in roots]
            self.accept()
        except (ValueError, OSError) as error:
            self.notice.setText(f"請調整位置：{error}")
