from __future__ import annotations

import queue
import threading
import tkinter as tk
from collections.abc import Callable
from importlib.resources import as_file, files
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any

from .confirmations import (
    ConfirmationSnapshot,
    TrashReminderSession,
    needs_large_operation_countdown,
    needs_second_confirmation,
    permanent_confirmation_phrase,
)
from .drive import (
    DriveAuthenticationError,
    GoogleDrivePermanentDeleteExecutor,
    GoogleDriveScanner,
    GoogleDriveTrashExecutor,
    build_drive_service,
)
from .grouping import default_selection, operation_items, selected_bytes
from .local import (
    LocalPermanentDeleteExecutor,
    LocalScanner,
    LocalTrashExecutor,
    ScanCancelled,
)
from .models import (
    ActionReport,
    DuplicateGroup,
    FileRecord,
    OperationMode,
    ProgressUpdate,
    ScanReport,
)
from .reporting import write_action_report
from .sound import SoundPlayer
from .stats import calculate_cleanup_stats
from .windows_safety import UnsafePathError

NAVY = "#082B40"
NAVY_2 = "#123E55"
MINT = "#16C7B7"
MINT_SOFT = "#DDF8F4"
GOLD = "#F7C948"
CREAM = "#F6FAF9"
WHITE = "#FFFFFF"
INK = "#183543"
MUTED = "#68828C"
LINE = "#D9E7E8"
RED = "#C83D4D"
RED_SOFT = "#FFF0F2"
PAGE_SIZE = 240

STAGES = (
    "選擇掃描位置",
    "掃描中",
    "檢查重複檔案",
    "選擇處理方式",
    "高風險確認",
    "執行中",
    "完成與節省報告",
)


def _format_bytes(value: int) -> str:
    units = ("B", "KB", "MB", "GB", "TB", "PB")
    amount = float(max(0, value))
    unit = units[0]
    for unit in units:
        if amount < 1024 or unit == units[-1]:
            break
        amount /= 1024
    decimals = 0 if unit == "B" else 1 if amount >= 10 else 2
    return f"{amount:.{decimals}f} {unit}"


class DupeSweepApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("DUPESWEEP｜重複檔案清理")
        self.geometry("1220x800")
        self.minsize(980, 680)
        self.configure(bg=CREAM)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self.folder_paths: list[Path] = []
        self.oauth_credentials: Path | None = None
        self.drive_service: Any | None = None
        self.groups_by_source: dict[str, tuple[DuplicateGroup, ...]] = {}
        self.reports_by_source: dict[str, ScanReport] = {}
        self.selected_keys: set[str] = set()
        self.rows: list[tuple[DuplicateGroup, FileRecord]] = []
        self.page_index = 0
        self.busy = False
        self.cancel_event = threading.Event()
        self.event_queue: queue.Queue[tuple[str, Any]] = queue.Queue()
        self.session_freed_bytes = 0
        self.stage = 1
        self.trash_reminders = TrashReminderSession()
        self.sound = SoundPlayer()
        self._animation_phase = 0

        self.mode_var = tk.StringVar(value="trash")
        self.status_var = tk.StringVar(
            value="從『加入資料夾』開始，DUPESWEEP 會保護每組的一份原檔。"
        )
        self.progress_var = tk.DoubleVar(value=0)
        self.page_var = tk.StringVar(value="第 1 / 1 頁")
        self.location_var = tk.StringVar(value="尚未選擇掃描位置")
        self.muted_var = tk.BooleanVar(value=self.sound.muted)
        self.volume_var = tk.DoubleVar(value=self.sound.volume * 100)
        self.metric_vars = {
            name: tk.StringVar(value="0")
            for name in (
                "scanned",
                "groups",
                "duplicates",
                "selected",
                "estimated",
                "actual",
                "duplicate_percent",
                "capacity_percent",
            )
        }

        self._configure_styles()
        self._set_window_icon()
        self._build_ui()
        self.after(70, self._poll_events)
        self.after(80, self._animate_sweep)

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure(
            "Treeview",
            background=WHITE,
            fieldbackground=WHITE,
            foreground=INK,
            rowheight=34,
            borderwidth=0,
            font=("Segoe UI", 10),
        )
        style.configure(
            "Treeview.Heading",
            background="#EAF2F2",
            foreground=NAVY,
            font=("Segoe UI Semibold", 9),
            relief="flat",
        )
        style.map("Treeview", background=[("selected", MINT_SOFT)], foreground=[("selected", NAVY)])
        style.configure(
            "Mint.Horizontal.TProgressbar",
            troughcolor="#DCE8E8",
            background=MINT,
            bordercolor="#DCE8E8",
            lightcolor=MINT,
            darkcolor=MINT,
        )

    def _set_window_icon(self) -> None:
        try:
            resource = files("dupesweep.assets").joinpath("dupesweep.ico")
            with as_file(resource) as icon_path:
                self.iconbitmap(default=str(icon_path))
        except (OSError, tk.TclError):
            return

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=NAVY, height=78)
        header.pack(fill="x")
        header.pack_propagate(False)
        brand = tk.Frame(header, bg=NAVY)
        brand.pack(side="left", padx=24)
        tk.Label(brand, text="DUPESWEEP", bg=NAVY, fg=WHITE, font=("Segoe UI Black", 21)).pack(
            anchor="w"
        )
        tk.Label(
            brand, text="把空間還給重要的事", bg=NAVY, fg="#9FD9D4", font=("Segoe UI", 9)
        ).pack(anchor="w")

        sound_box = tk.Frame(header, bg=NAVY)
        sound_box.pack(side="right", padx=22)
        tk.Checkbutton(
            sound_box,
            text="靜音",
            variable=self.muted_var,
            command=self._save_sound_settings,
            bg=NAVY,
            fg=WHITE,
            activebackground=NAVY,
            activeforeground=WHITE,
            selectcolor=NAVY_2,
        ).pack(side="left", padx=(0, 8))
        tk.Label(sound_box, text="音量", bg=NAVY, fg="#BBD1D8").pack(side="left")
        tk.Scale(
            sound_box,
            from_=0,
            to=100,
            orient="horizontal",
            variable=self.volume_var,
            command=lambda _value: self._save_sound_settings(),
            showvalue=False,
            length=100,
            bg=NAVY,
            fg=WHITE,
            troughcolor=NAVY_2,
            highlightthickness=0,
        ).pack(side="left")

        body = tk.Frame(self, bg=CREAM)
        body.pack(fill="both", expand=True)
        self.step_frame = tk.Frame(body, bg="#EAF4F3", width=205)
        self.step_frame.pack(side="left", fill="y")
        self.step_frame.pack_propagate(False)
        tk.Label(
            self.step_frame,
            text="安全清理流程",
            bg="#EAF4F3",
            fg=NAVY,
            font=("Segoe UI Semibold", 12),
        ).pack(anchor="w", padx=20, pady=(22, 12))
        self.step_labels: list[tk.Label] = []
        for index, label in enumerate(STAGES, start=1):
            row = tk.Frame(self.step_frame, bg="#EAF4F3")
            row.pack(fill="x", padx=14, pady=3)
            badge = tk.Label(
                row, text=str(index), width=2, bg=WHITE, fg=MUTED, font=("Segoe UI Semibold", 9)
            )
            badge.pack(side="left", ipady=4)
            text = tk.Label(
                row,
                text=label,
                anchor="w",
                bg="#EAF4F3",
                fg=MUTED,
                font=("Segoe UI", 9),
                wraplength=140,
            )
            text.pack(side="left", padx=8, fill="x", expand=True)
            self.step_labels.append(text)
        tk.Label(
            self.step_frame,
            text="✓ Keeper 永遠保留\n✓ 預設移至垃圾桶\n✓ 永久刪除無法略過警告",
            justify="left",
            bg="#EAF4F3",
            fg="#4C6C75",
            font=("Segoe UI", 8),
        ).pack(side="bottom", anchor="w", padx=20, pady=20)

        workspace = tk.Frame(body, bg=CREAM)
        workspace.pack(side="left", fill="both", expand=True, padx=20, pady=16)

        source_card = self._card(workspace)
        source_card.pack(fill="x")
        left = tk.Frame(source_card, bg=WHITE)
        left.pack(side="left", fill="x", expand=True)
        tk.Label(
            left, text="你想整理哪裡？", bg=WHITE, fg=NAVY, font=("Segoe UI Semibold", 15)
        ).pack(anchor="w")
        tk.Label(
            left,
            textvariable=self.location_var,
            bg=WHITE,
            fg=MUTED,
            font=("Segoe UI", 9),
            wraplength=610,
            justify="left",
        ).pack(anchor="w", pady=(3, 0))
        actions = tk.Frame(source_card, bg=WHITE)
        actions.pack(side="right")
        self._button(actions, "＋ 加入資料夾", self._add_folder, MINT, NAVY).pack(
            side="left", padx=4
        )
        self._button(actions, "掃描本機", self._start_local_scan, NAVY, WHITE).pack(
            side="left", padx=4
        )
        self._button(actions, "連接 Google Drive", self._start_drive_scan, GOLD, NAVY).pack(
            side="left", padx=4
        )

        metrics = tk.Frame(workspace, bg=CREAM)
        metrics.pack(fill="x", pady=10)
        specs = (
            ("掃描檔案", "scanned"),
            ("重複群組", "groups"),
            ("重複副本", "duplicates"),
            ("已選取", "selected"),
            ("預估節省", "estimated"),
            ("實際節省", "actual"),
            ("重複容量", "duplicate_percent"),
            ("磁碟占比", "capacity_percent"),
        )
        for column, (label, key) in enumerate(specs):
            card = tk.Frame(metrics, bg=WHITE, highlightbackground=LINE, highlightthickness=1)
            card.grid(row=0, column=column, sticky="nsew", padx=3)
            metrics.grid_columnconfigure(column, weight=1)
            tk.Label(card, text=label, bg=WHITE, fg=MUTED, font=("Segoe UI", 8)).pack(pady=(8, 0))
            tk.Label(
                card,
                textvariable=self.metric_vars[key],
                bg=WHITE,
                fg=NAVY,
                font=("Segoe UI Semibold", 12),
            ).pack(pady=(1, 8))

        operation_card = self._card(workspace, padding=12)
        operation_card.pack(fill="x")
        tk.Label(
            operation_card, text="處理方式", bg=WHITE, fg=NAVY, font=("Segoe UI Semibold", 11)
        ).pack(side="left", padx=(2, 12))
        self.trash_radio = tk.Radiobutton(
            operation_card,
            text="移至垃圾桶（建議，可復原）",
            value="trash",
            variable=self.mode_var,
            command=self._on_mode_changed,
            indicatoron=False,
            bg=MINT_SOFT,
            fg=NAVY,
            selectcolor=MINT_SOFT,
            activebackground=MINT_SOFT,
            relief="flat",
            padx=14,
            pady=8,
            font=("Segoe UI Semibold", 9),
        )
        self.trash_radio.pack(side="left", padx=4)
        self.delete_radio = tk.Radiobutton(
            operation_card,
            text="立即永久刪除（無法復原）",
            value="permanent",
            variable=self.mode_var,
            command=self._on_mode_changed,
            indicatoron=False,
            bg=RED_SOFT,
            fg=RED,
            selectcolor=RED_SOFT,
            activebackground=RED_SOFT,
            relief="flat",
            padx=14,
            pady=8,
            font=("Segoe UI Semibold", 9),
        )
        self.delete_radio.pack(side="left", padx=4)
        self.mode_help = tk.Label(
            operation_card,
            text="預設送進垃圾桶；失敗項目只會列為失敗。",
            bg=WHITE,
            fg=MUTED,
            font=("Segoe UI", 8),
        )
        self.mode_help.pack(side="right", padx=6)

        list_card = tk.Frame(workspace, bg=WHITE, highlightbackground=LINE, highlightthickness=1)
        list_card.pack(fill="both", expand=True, pady=10)
        toolbar = tk.Frame(list_card, bg=WHITE)
        toolbar.pack(fill="x", padx=12, pady=8)
        tk.Label(
            toolbar, text="檢查重複檔案", bg=WHITE, fg=NAVY, font=("Segoe UI Semibold", 12)
        ).pack(side="left")
        tk.Button(
            toolbar,
            text="選取本頁可處理項目",
            command=self._select_page,
            relief="flat",
            bg=WHITE,
            fg=NAVY,
            cursor="hand2",
        ).pack(side="right")
        tk.Button(
            toolbar,
            text="取消全選",
            command=self._clear_selection,
            relief="flat",
            bg=WHITE,
            fg=MUTED,
            cursor="hand2",
        ).pack(side="right", padx=8)

        self.tree = ttk.Treeview(
            list_card,
            columns=("pick", "state", "name", "location", "size", "group"),
            show="headings",
            selectmode="browse",
        )
        for column, text, width, anchor in (
            ("pick", "選取", 55, "center"),
            ("state", "保護狀態", 90, "center"),
            ("name", "檔案名稱", 180, "w"),
            ("location", "位置", 380, "w"),
            ("size", "大小", 90, "e"),
            ("group", "群組", 65, "center"),
        ):
            self.tree.heading(column, text=text)
            self.tree.column(
                column, width=width, anchor=anchor, stretch=column in {"name", "location"}
            )
        self.tree.pack(fill="both", expand=True, padx=10)
        self.tree.tag_configure("keeper", background="#EDF9F1", foreground="#31734A")
        self.tree.tag_configure("blocked", background="#F2F3F4", foreground="#87959A")
        self.tree.tag_configure("selected", background=MINT_SOFT, foreground=NAVY)
        self.tree.bind("<Double-1>", self._toggle_tree_row)
        self.tree.bind("<space>", self._toggle_tree_row)

        pagination = tk.Frame(list_card, bg=WHITE)
        pagination.pack(fill="x", padx=12, pady=8)
        self._button(
            pagination, "‹ 上一頁", self._previous_page, "#EAF2F2", NAVY, compact=True
        ).pack(side="left")
        tk.Label(
            pagination, textvariable=self.page_var, bg=WHITE, fg=MUTED, font=("Segoe UI", 9)
        ).pack(side="left", padx=12)
        self._button(pagination, "下一頁 ›", self._next_page, "#EAF2F2", NAVY, compact=True).pack(
            side="left"
        )
        self.empty_label = tk.Label(
            list_card,
            text="還沒有掃描結果\n加入一般資料夾，或連接 Google Drive 開始。",
            bg=WHITE,
            fg=MUTED,
            font=("Segoe UI", 12),
            justify="center",
        )
        self.empty_label.place(relx=0.5, rely=0.55, anchor="center")

        footer = tk.Frame(workspace, bg=NAVY, padx=14, pady=10)
        footer.pack(fill="x")
        self.sweep_canvas = tk.Canvas(footer, width=50, height=50, bg=NAVY, highlightthickness=0)
        self.sweep_canvas.pack(side="left", padx=(0, 10))
        status_box = tk.Frame(footer, bg=NAVY)
        status_box.pack(side="left", fill="x", expand=True)
        tk.Label(
            status_box,
            textvariable=self.status_var,
            bg=NAVY,
            fg=WHITE,
            anchor="w",
            font=("Segoe UI", 9),
        ).pack(fill="x")
        ttk.Progressbar(
            status_box,
            style="Mint.Horizontal.TProgressbar",
            variable=self.progress_var,
            maximum=100,
        ).pack(fill="x", pady=(6, 0))
        self.stop_button = self._button(footer, "安全停止", self._cancel, "#31556A", WHITE)
        self.stop_button.pack(side="right", padx=5)
        self.action_button = self._button(
            footer, "將選取項目移至垃圾桶", self._start_cleanup, MINT, NAVY
        )
        self.action_button.pack(side="right", padx=5)
        self._set_stage(1)

    def _card(self, parent: tk.Misc, padding: int = 16) -> tk.Frame:
        return tk.Frame(
            parent,
            bg=WHITE,
            padx=padding,
            pady=padding,
            highlightbackground=LINE,
            highlightthickness=1,
        )

    def _button(
        self,
        parent: tk.Misc,
        text: str,
        command: Callable[[], None],
        background: str,
        foreground: str,
        *,
        compact: bool = False,
    ) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg=background,
            fg=foreground,
            activebackground=background,
            activeforeground=foreground,
            relief="flat",
            bd=0,
            padx=10 if compact else 14,
            pady=6 if compact else 9,
            cursor="hand2",
            font=("Segoe UI Semibold", 8 if compact else 9),
        )

    def _save_sound_settings(self) -> None:
        self.sound.configure(muted=self.muted_var.get(), volume=self.volume_var.get() / 100)

    def _set_stage(self, stage: int) -> None:
        self.stage = max(1, min(7, stage))
        for index, label in enumerate(self.step_labels, start=1):
            label.configure(
                fg=NAVY if index == self.stage else MINT if index < self.stage else MUTED,
                font=("Segoe UI Semibold" if index == self.stage else "Segoe UI", 9),
            )

    def _add_folder(self) -> None:
        selected = filedialog.askdirectory(title="選擇要掃描的一般資料夾")
        if not selected:
            return
        try:
            safe = LocalScanner().safety_policy.validate_scan_root(selected)
        except (UnsafePathError, OSError) as error:
            self.sound.play("error")
            messagebox.showwarning("這個位置受到保護", str(error), parent=self)
            return
        if safe not in self.folder_paths:
            self.folder_paths.append(safe)
        self.location_var.set("本機：" + "、".join(str(path) for path in self.folder_paths))
        self.status_var.set("位置已加入。按『掃描本機』找出內容完全相同的檔案。")

    def _choose_oauth_file(self) -> bool:
        selected = filedialog.askopenfilename(
            title="選擇 Google Desktop OAuth JSON",
            filetypes=(("JSON", "*.json"), ("所有檔案", "*.*")),
        )
        if not selected:
            return False
        self.oauth_credentials = Path(selected)
        return True

    def _start_local_scan(self) -> None:
        if not self.folder_paths:
            messagebox.showinfo("先選擇位置", "請先加入至少一個自己的資料夾。", parent=self)
            return
        self._start_task(
            "scan-local",
            lambda: LocalScanner().scan(
                self.folder_paths, progress=self._post_progress, cancel_event=self.cancel_event
            ),
            2,
            "正在安全掃描本機檔案…",
        )

    def _start_drive_scan(self) -> None:
        if self.oauth_credentials is None and not self._choose_oauth_file():
            return

        def worker() -> tuple[Any, ScanReport]:
            service = build_drive_service(self.oauth_credentials)
            report = GoogleDriveScanner().scan(
                service, progress=self._post_progress, cancel_event=self.cancel_event
            )
            return service, report

        self._start_task("scan-drive", worker, 2, "正在連接並掃描 Google Drive…")

    def _start_task(self, event: str, function: Callable[[], Any], stage: int, status: str) -> None:
        if self.busy:
            messagebox.showinfo("作業進行中", "請先等待目前作業，或按『安全停止』。", parent=self)
            return
        self.busy = True
        self.cancel_event.clear()
        self.progress_var.set(2)
        self.status_var.set(status)
        self._set_stage(stage)

        def run() -> None:
            try:
                self.event_queue.put((event, function()))
            except Exception as error:  # noqa: BLE001 - normalized for UI
                self.event_queue.put(("error", error))

        threading.Thread(target=run, daemon=True).start()

    def _post_progress(self, update: ProgressUpdate) -> None:
        self.event_queue.put(("progress", update))

    def _poll_events(self) -> None:
        try:
            while True:
                event, payload = self.event_queue.get_nowait()
                if event == "progress":
                    self._handle_progress(payload)
                elif event == "scan-local":
                    self._accept_scan(payload)
                elif event == "scan-drive":
                    self.drive_service, report = payload
                    self._accept_scan(report)
                elif event == "actions":
                    self._accept_actions(payload)
                elif event == "error":
                    self._handle_error(payload)
        except queue.Empty:
            pass
        self.after(70, self._poll_events)

    def _handle_progress(self, update: ProgressUpdate) -> None:
        self.status_var.set(update.message)
        if update.total:
            self.progress_var.set(min(99, update.current / update.total * 100))
        else:
            self.progress_var.set(min(92, self.progress_var.get() + 0.35))

    def _accept_scan(self, report: ScanReport) -> None:
        self.busy = False
        self.reports_by_source[report.source] = report
        self.groups_by_source[report.source] = report.groups
        self.mode_var.set("trash")
        self.selected_keys = {
            key
            for source, groups in self.groups_by_source.items()
            for key in default_selection(groups, "trash")
        }
        self.trash_reminders.invalidate()
        self._rebuild_rows()
        self.progress_var.set(100)
        self._set_stage(3)
        self.status_var.set(
            f"掃描完成：{report.examined_files:,} 個檔案、"
            f"{len(report.groups):,} 個重複群組、"
            f"{report.duplicate_copies:,} 個額外副本。"
        )
        if report.warnings:
            preview = "\n".join(report.warnings[:6])
            messagebox.showwarning("安全略過項目", preview, parent=self)
        if not report.groups:
            self.status_var.set("沒有找到內容完全相同的副本。這個位置目前很乾淨！")
            self.sound.play("success")

    def _handle_error(self, error: Exception) -> None:
        self.busy = False
        self.progress_var.set(0)
        self._set_stage(1 if not self.rows else 3)
        if isinstance(error, (ScanCancelled,)):
            self.status_var.set("已安全停止；尚未處理的檔案沒有變更。")
            return
        self.sound.play("error")
        title = (
            "Google Drive 連線失敗"
            if isinstance(error, DriveAuthenticationError)
            else "DUPESWEEP 遇到問題"
        )
        self.status_var.set(str(error))
        messagebox.showerror(title, str(error), parent=self)

    def _rebuild_rows(self) -> None:
        self.rows = [
            (group, record)
            for groups in self.groups_by_source.values()
            for group in groups
            for record in group.records
        ]
        self.page_index = min(self.page_index, max(0, (len(self.rows) - 1) // PAGE_SIZE))
        self._render_page()
        self._update_metrics()

    def _render_page(self) -> None:
        self.tree.delete(*self.tree.get_children())
        start = self.page_index * PAGE_SIZE
        page = self.rows[start : start + PAGE_SIZE]
        mode = self._mode()
        for offset, (group, record) in enumerate(page):
            keeper = record.key == group.keeper_key
            allowed = record.can_trash if mode == "trash" else record.can_delete
            selected = record.key in self.selected_keys
            mark = "—" if keeper or not allowed else "☑" if selected else "☐"
            state = (
                "保留原檔"
                if keeper
                else "無權限"
                if not allowed
                else "待處理"
                if selected
                else "不處理"
            )
            tags = (
                ("keeper",)
                if keeper
                else ("blocked",)
                if not allowed
                else ("selected",)
                if selected
                else ()
            )
            self.tree.insert(
                "",
                "end",
                iid=str(start + offset),
                values=(
                    mark,
                    state,
                    record.name,
                    record.location,
                    _format_bytes(record.size),
                    start + offset + 1,
                ),
                tags=tags,
            )
        total_pages = max(1, (len(self.rows) + PAGE_SIZE - 1) // PAGE_SIZE)
        self.page_var.set(f"第 {self.page_index + 1} / {total_pages} 頁 · 每頁最多 {PAGE_SIZE} 項")
        if self.rows:
            self.empty_label.place_forget()
        else:
            self.empty_label.place(relx=0.5, rely=0.55, anchor="center")

    def _mode(self) -> OperationMode:
        return "permanent" if self.mode_var.get() == "permanent" else "trash"

    def _on_mode_changed(self) -> None:
        mode = self._mode()
        self.trash_reminders.invalidate()
        self.selected_keys.clear()
        self._set_stage(4)
        if mode == "permanent":
            self.mode_help.configure(text="無法復原；請重新主動選取要永久刪除的副本。", fg=RED)
            self.action_button.configure(text="立即永久刪除選取檔案", bg=RED, fg=WHITE)
            self.status_var.set("高風險模式未預先選取任何檔案。請逐項檢查並主動選取。")
            self.sound.play("permanent_warning")
        else:
            self.mode_help.configure(text="預設送進垃圾桶；失敗項目只會列為失敗。", fg=MUTED)
            self.action_button.configure(text="將選取項目移至垃圾桶", bg=MINT, fg=NAVY)
            self.status_var.set("垃圾桶模式可復原。可選取要處理的多餘副本。")
        self._render_page()
        self._update_metrics()

    def _toggle_tree_row(self, _event: tk.Event[Any]) -> str:
        selection = self.tree.selection()
        if not selection:
            return "break"
        index = int(selection[0])
        if not 0 <= index < len(self.rows):
            return "break"
        group, record = self.rows[index]
        allowed = record.can_trash if self._mode() == "trash" else record.can_delete
        if record.key == group.keeper_key or not allowed or self.busy:
            self.status_var.set("這一份受到保護或目前沒有權限，不能選取。")
            return "break"
        if record.key in self.selected_keys:
            self.selected_keys.remove(record.key)
        else:
            self.selected_keys.add(record.key)
        self.trash_reminders.invalidate()
        self._render_page()
        self._update_metrics()
        return "break"

    def _select_page(self) -> None:
        start = self.page_index * PAGE_SIZE
        mode = self._mode()
        for group, record in self.rows[start : start + PAGE_SIZE]:
            allowed = record.can_trash if mode == "trash" else record.can_delete
            if record.key != group.keeper_key and allowed:
                self.selected_keys.add(record.key)
        self.trash_reminders.invalidate()
        self._render_page()
        self._update_metrics()

    def _clear_selection(self) -> None:
        self.selected_keys.clear()
        self.trash_reminders.invalidate()
        self._render_page()
        self._update_metrics()

    def _previous_page(self) -> None:
        if self.page_index > 0:
            self.page_index -= 1
            self._render_page()

    def _next_page(self) -> None:
        if (self.page_index + 1) * PAGE_SIZE < len(self.rows):
            self.page_index += 1
            self._render_page()

    def _update_metrics(self) -> None:
        groups = tuple(
            group for source_groups in self.groups_by_source.values() for group in source_groups
        )
        reports = tuple(self.reports_by_source.values())
        stats = calculate_cleanup_stats(groups, self.selected_keys, reports)
        self.metric_vars["scanned"].set(f"{stats.examined_files:,}")
        self.metric_vars["groups"].set(f"{len(groups):,}")
        self.metric_vars["duplicates"].set(f"{sum(len(g.records) - 1 for g in groups):,}")
        self.metric_vars["selected"].set(f"{len(self.selected_keys):,}")
        self.metric_vars["estimated"].set(_format_bytes(stats.selected_bytes))
        self.metric_vars["actual"].set(_format_bytes(self.session_freed_bytes))
        self.metric_vars["duplicate_percent"].set(f"{stats.reclaimable_percent:.1f}%")
        self.metric_vars["capacity_percent"].set(
            "—" if stats.capacity_percent is None else f"{stats.capacity_percent:.3f}%"
        )

    def _confirmation_snapshot(self) -> ConfirmationSnapshot:
        selected_groups = {
            group.fingerprint for group, record in self.rows if record.key in self.selected_keys
        }
        source_token = ",".join(
            sorted(
                source
                for source, groups in self.groups_by_source.items()
                if any(
                    record.key in self.selected_keys for group in groups for record in group.records
                )
            )
        )
        groups = tuple(
            group for source_groups in self.groups_by_source.values() for group in source_groups
        )
        return ConfirmationSnapshot(
            len(self.selected_keys),
            len(selected_groups),
            selected_bytes(groups, self.selected_keys),
            self._mode(),
            source_token,
        )

    def _start_cleanup(self) -> None:
        if self.busy:
            return
        if not self.selected_keys:
            messagebox.showinfo("尚未選取", "請先選取至少一個多餘副本。", parent=self)
            return
        snapshot = self._confirmation_snapshot()
        self._set_stage(5)
        confirmed = (
            self._confirm_trash(snapshot)
            if snapshot.operation_mode == "trash"
            else self._confirm_permanent(snapshot)
        )
        if not confirmed:
            self._set_stage(4)
            self.status_var.set("已取消；沒有任何檔案被處理。")
            return
        self._execute_cleanup(snapshot.operation_mode)

    def _confirm_trash(self, snapshot: ConfirmationSnapshot) -> bool:
        if self.trash_reminders.can_skip(snapshot):
            return True
        self.sound.play("confirm")
        if not messagebox.askyesno(
            "確認移至垃圾桶",
            f"將 {snapshot.selected_count:,} 個副本移至垃圾桶？\n\n"
            f"預計可回收 {_format_bytes(snapshot.selected_bytes)}。\n"
            "本機可從資源回收筒復原；Drive 可從雲端垃圾桶復原。",
            parent=self,
        ):
            return False
        if needs_second_confirmation(snapshot):
            return self._trash_second_dialog(snapshot)
        return True

    def _trash_second_dialog(self, snapshot: ConfirmationSnapshot) -> bool:
        dialog, content = self._modal("再次確認大量垃圾桶操作", 520, 430, NAVY)
        tk.Label(
            content, text="大量操作再次確認", bg=WHITE, fg=NAVY, font=("Segoe UI Bold", 17)
        ).pack(anchor="w")
        tk.Label(content, text="請核對摘要；這仍是可復原的垃圾桶操作。", bg=WHITE, fg=MUTED).pack(
            anchor="w", pady=(4, 16)
        )
        for label, value in (
            ("選取檔案", f"{snapshot.selected_count:,} 個"),
            ("重複群組", f"{snapshot.group_count:,} 組"),
            ("預計釋放", _format_bytes(snapshot.selected_bytes)),
            ("處理方式", "移至垃圾桶"),
            ("掃描位置", snapshot.source_token or "目前結果"),
            ("復原", "Windows 資源回收筒或 Google Drive 垃圾桶"),
        ):
            row = tk.Frame(content, bg="#F3F8F7", padx=10, pady=7)
            row.pack(fill="x", pady=2)
            tk.Label(row, text=label, bg="#F3F8F7", fg=MUTED, width=11, anchor="w").pack(
                side="left"
            )
            tk.Label(
                row, text=value, bg="#F3F8F7", fg=INK, anchor="w", wraplength=320, justify="left"
            ).pack(side="left", fill="x", expand=True)
        suppress = tk.BooleanVar(value=False)
        tk.Checkbutton(
            content,
            text="本次程式使用期間，不再提醒完全相同的垃圾桶操作",
            variable=suppress,
            bg=WHITE,
            fg=INK,
            activebackground=WHITE,
            selectcolor=WHITE,
        ).pack(anchor="w", pady=12)
        result = {"ok": False}
        buttons = tk.Frame(content, bg=WHITE)
        buttons.pack(fill="x", side="bottom")
        self._button(buttons, "取消", dialog.destroy, "#E8EEEE", NAVY).pack(side="left")

        def accept() -> None:
            result["ok"] = True
            if suppress.get():
                self.trash_reminders.suppress(snapshot)
            dialog.destroy()

        self._button(buttons, "確認移至垃圾桶", accept, MINT, NAVY).pack(side="right")
        self._wait_modal(dialog)
        return result["ok"]

    def _confirm_permanent(self, snapshot: ConfirmationSnapshot) -> bool:
        self.sound.play("permanent_warning")
        dialog, content = self._modal("高風險：永久刪除", 560, 400, RED)
        tk.Label(
            content, text="永久刪除沒有復原功能", bg=WHITE, fg=RED, font=("Segoe UI Bold", 19)
        ).pack(anchor="w")
        tk.Label(
            content,
            text=(
                f"你主動選擇永久刪除 {snapshot.selected_count:,} 個一般檔案，"
                f"預計釋放 {_format_bytes(snapshot.selected_bytes)}。\n"
                "資料夾、捷徑、符號連結、junction、系統物件與 keeper 永遠不會刪除。"
            ),
            bg=WHITE,
            fg=INK,
            justify="left",
            wraplength=500,
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(12, 16))
        tk.Label(
            content,
            text="掃描後有變化的檔案會被跳過；權限不足只會列為失敗。垃圾桶失敗不會自動進入這裡。",
            bg=RED_SOFT,
            fg=RED,
            justify="left",
            wraplength=500,
            padx=12,
            pady=12,
        ).pack(fill="x")
        result = {"ok": False}
        buttons = tk.Frame(content, bg=WHITE)
        buttons.pack(fill="x", side="bottom", pady=(25, 0))
        self._button(buttons, "取消並返回", dialog.destroy, "#E8EEEE", NAVY).pack(side="left")

        def accept() -> None:
            result["ok"] = True
            dialog.destroy()

        self._button(buttons, "我了解，繼續確認", accept, RED, WHITE).pack(
            side="right", padx=(100, 0)
        )
        self._wait_modal(dialog)
        if not result["ok"]:
            return False
        if needs_second_confirmation(snapshot) or needs_large_operation_countdown(snapshot):
            return self._permanent_typed_dialog(snapshot)
        return True

    def _permanent_typed_dialog(self, snapshot: ConfirmationSnapshot) -> bool:
        dialog, content = self._modal("最後確認：永久刪除", 590, 500, RED)
        phrase = permanent_confirmation_phrase(snapshot.selected_count)
        tk.Label(
            content, text="最後一道紅色安全鎖", bg=WHITE, fg=RED, font=("Segoe UI Bold", 18)
        ).pack(anchor="w")
        tk.Label(
            content,
            text=(
                f"檔案：{snapshot.selected_count:,} 個　"
                f"群組：{snapshot.group_count:,} 組\n"
                f"容量：{_format_bytes(snapshot.selected_bytes)}　"
                f"來源：{snapshot.source_token}"
            ),
            bg=RED_SOFT,
            fg=INK,
            justify="left",
            padx=12,
            pady=12,
        ).pack(fill="x", pady=12)
        tk.Label(
            content, text=f"請完整輸入：{phrase}", bg=WHITE, fg=INK, font=("Segoe UI Semibold", 10)
        ).pack(anchor="w")
        typed = tk.StringVar()
        entry = tk.Entry(content, textvariable=typed, font=("Segoe UI", 12), relief="solid", bd=1)
        entry.pack(fill="x", pady=(6, 12), ipady=8)
        countdown = 8 if needs_large_operation_countdown(snapshot) else 0
        countdown_var = tk.StringVar(
            value=f"請等待 {countdown} 秒再次核對摘要"
            if countdown
            else "輸入完全相同後才可永久刪除"
        )
        tk.Label(content, textvariable=countdown_var, bg=WHITE, fg=RED).pack(anchor="w")
        result = {"ok": False, "remaining": countdown}
        buttons = tk.Frame(content, bg=WHITE)
        buttons.pack(fill="x", side="bottom", pady=(28, 0))
        self._button(buttons, "取消", dialog.destroy, "#E8EEEE", NAVY).pack(side="left")
        danger = self._button(buttons, "永久刪除（無法復原）", lambda: None, RED, WHITE)
        danger.pack(side="right", padx=(120, 0))
        danger.configure(state="disabled")

        def refresh(*_args: object) -> None:
            exact = typed.get() == phrase and snapshot.selected_count == len(self.selected_keys)
            danger.configure(state="normal" if exact and result["remaining"] <= 0 else "disabled")

        def tick() -> None:
            if not dialog.winfo_exists() or result["remaining"] <= 0:
                refresh()
                return
            result["remaining"] -= 1
            countdown_var.set(
                f"請等待 {result['remaining']} 秒再次核對摘要"
                if result["remaining"]
                else "倒數完成；請確認文字與選取數量。"
            )
            refresh()
            dialog.after(1000, tick)

        def accept() -> None:
            refresh()
            if str(danger["state"]) != "normal":
                return
            result["ok"] = True
            dialog.destroy()

        danger.configure(command=accept)
        typed.trace_add("write", refresh)
        dialog.bind("<Return>", lambda _event: "break")
        if countdown:
            dialog.after(1000, tick)
        entry.focus_set()
        self._wait_modal(dialog)
        return result["ok"]

    def _modal(
        self, title: str, width: int, height: int, accent: str
    ) -> tuple[tk.Toplevel, tk.Frame]:
        dialog = tk.Toplevel(self)
        dialog.title(title)
        dialog.transient(self)
        dialog.resizable(False, False)
        dialog.configure(bg=accent)
        dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        x = self.winfo_rootx() + max(20, (self.winfo_width() - width) // 2)
        y = self.winfo_rooty() + max(20, (self.winfo_height() - height) // 2)
        dialog.geometry(f"{width}x{height}+{x}+{y}")
        tk.Frame(dialog, bg=accent, height=7).pack(fill="x")
        content = tk.Frame(dialog, bg=WHITE, padx=26, pady=22)
        content.pack(fill="both", expand=True)
        return dialog, content

    def _wait_modal(self, dialog: tk.Toplevel) -> None:
        dialog.grab_set()
        self.wait_window(dialog)

    def _execute_cleanup(self, mode: OperationMode) -> None:
        plans: dict[str, tuple[Any, ...]] = {}
        for source, groups in self.groups_by_source.items():
            chosen = {key for key in self.selected_keys if key.startswith(f"{source}:")}
            if chosen:
                plans[source] = operation_items(groups, chosen, mode)
        if "drive" in plans and self.drive_service is None:
            messagebox.showerror(
                "Google Drive 未連線", "請重新連接並掃描 Google Drive。", parent=self
            )
            return

        def worker() -> tuple[ActionReport, ...]:
            reports: list[ActionReport] = []
            if plans.get("local"):
                executor = (
                    LocalTrashExecutor() if mode == "trash" else LocalPermanentDeleteExecutor()
                )
                reports.append(
                    executor.trash(
                        plans["local"], progress=self._post_progress, cancel_event=self.cancel_event
                    )
                    if mode == "trash"
                    else executor.delete(
                        plans["local"], progress=self._post_progress, cancel_event=self.cancel_event
                    )
                )
            if plans.get("drive"):
                executor = (
                    GoogleDriveTrashExecutor()
                    if mode == "trash"
                    else GoogleDrivePermanentDeleteExecutor()
                )
                reports.append(
                    executor.trash(
                        self.drive_service,
                        plans["drive"],
                        progress=self._post_progress,
                        cancel_event=self.cancel_event,
                    )
                    if mode == "trash"
                    else executor.delete(
                        self.drive_service,
                        plans["drive"],
                        progress=self._post_progress,
                        cancel_event=self.cancel_event,
                    )
                )
            return tuple(reports)

        self._start_task("actions", worker, 6, "正在分批安全處理；可隨時按『安全停止』。")

    def _accept_actions(self, reports: tuple[ActionReport, ...]) -> None:
        self.busy = False
        succeeded = {
            outcome.record.key
            for report in reports
            for outcome in report.outcomes
            if outcome.status in {"trashed", "deleted"}
        }
        actual = sum(
            outcome.record.size
            for report in reports
            for outcome in report.outcomes
            if outcome.status in {"trashed", "deleted"}
        )
        failed = [
            outcome
            for report in reports
            for outcome in report.outcomes
            if outcome.status in {"failed", "skipped"}
        ]
        cancelled = [
            outcome
            for report in reports
            for outcome in report.outcomes
            if outcome.status == "cancelled"
        ]
        self.session_freed_bytes += actual
        for source, groups in tuple(self.groups_by_source.items()):
            self.groups_by_source[source] = tuple(
                DuplicateGroup(
                    group.fingerprint,
                    tuple(record for record in group.records if record.key not in succeeded),
                    group.keeper_key,
                )
                for group in groups
                if len(tuple(record for record in group.records if record.key not in succeeded))
                >= 2
            )
        self.selected_keys -= succeeded
        report_note = ""
        try:
            report_path = write_action_report(reports)
            report_note = f"\nCSV 稽核報告：{report_path}"
        except OSError as error:
            report_note = f"\nCSV 報告寫入失敗：{error}"
        self._rebuild_rows()
        self.progress_var.set(100)
        self._set_stage(7)
        mode = reports[0].operation_mode if reports else "trash"
        verb = "已永久刪除" if mode == "permanent" else "已移至垃圾桶"
        self.status_var.set(
            f"完成：{len(succeeded):,} 個{verb}，"
            f"實際釋放 {_format_bytes(actual)}；{len(failed):,} 個未處理。"
        )
        self.sound.play("permanent_done" if mode == "permanent" else "trash")
        if succeeded:
            self.sound.play("success")
        if failed:
            preview = "\n".join(f"• {item.record.name}：{item.error}" for item in failed[:8])
            messagebox.showwarning(
                "部分項目安全跳過或失敗",
                f"{preview}{report_note}\n\n不會自動改用永久刪除。若要永久刪除，必須重新選擇該模式、重新選取並完成警告。",
                parent=self,
            )
        elif succeeded:
            recovery = (
                "永久刪除沒有復原功能。"
                if mode == "permanent"
                else "可到資源回收筒或 Google Drive 垃圾桶復原。"
            )
            messagebox.showinfo(
                "清理完成",
                f"{verb} {len(succeeded):,} 個檔案，"
                f"實際節省 {_format_bytes(actual)}。\n{recovery}{report_note}",
                parent=self,
            )
        elif cancelled:
            self.status_var.set("已安全停止；未開始的批次沒有變更。")

    def _cancel(self) -> None:
        if self.busy:
            self.cancel_event.set()
            self.status_var.set("已要求安全停止；正在完成目前檔案或批次。")

    def _animate_sweep(self) -> None:
        self.sweep_canvas.delete("all")
        self.sweep_canvas.create_oval(6, 6, 44, 44, outline="#31586B", width=5)
        extent = 80 if self.busy else 36
        self.sweep_canvas.create_arc(
            6,
            6,
            44,
            44,
            start=self._animation_phase,
            extent=extent,
            style="arc",
            outline=MINT if self.busy else GOLD,
            width=5,
        )
        self.sweep_canvas.create_text(
            25, 25, text="✓" if not self.busy else "↻", fill=WHITE, font=("Segoe UI Bold", 12)
        )
        if self.busy:
            self._animation_phase = (self._animation_phase + 12) % 360
        self.after(80, self._animate_sweep)

    def _on_close(self) -> None:
        if self.busy and not messagebox.askyesno(
            "安全停止並離開", "目前仍在作業。要安全停止並關閉嗎？", parent=self
        ):
            return
        self.cancel_event.set()
        self.destroy()


def main() -> None:
    DupeSweepApp().mainloop()


if __name__ == "__main__":
    main()
