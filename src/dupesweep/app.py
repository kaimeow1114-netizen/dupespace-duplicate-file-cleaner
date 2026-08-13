from __future__ import annotations

import queue
import threading
import tkinter as tk
from collections.abc import Callable
from tkinter import filedialog, messagebox, simpledialog, ttk
from typing import Any

from .drive import (
    GoogleDriveScanner,
    GoogleDriveTrashExecutor,
    build_drive_service,
)
from .grouping import (
    build_duplicate_groups,
    default_selection,
    selected_bytes,
    selected_records,
    validate_selection,
)
from .local import LocalScanner, LocalTrashExecutor
from .models import ActionReport, DuplicateGroup, FileRecord, ProgressUpdate, ScanReport
from .reporting import write_action_report


def _format_bytes(value: int) -> str:
    units = ("B", "KB", "MB", "GB", "TB", "PB")
    amount = float(value)
    for unit in units:
        if abs(amount) < 1024 or unit == units[-1]:
            precision = 0 if unit == "B" else 2
            return f"{amount:.{precision}f} {unit}"
        amount /= 1024
    return f"{value} B"


class DupeSweepApp:
    POLL_MS = 100

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("DupeSweep — 重複檔案清理工具")
        self.root.geometry("1120x760")
        self.root.minsize(900, 620)

        self.groups_by_source: dict[str, tuple[DuplicateGroup, ...]] = {
            "local": (),
            "drive": (),
        }
        self.selected_keys: set[str] = set()
        self.records_by_key: dict[str, FileRecord] = {}
        self.keeper_keys: set[str] = set()
        self.row_to_key: dict[str, str] = {}
        self.drive_service: Any | None = None
        self.cancel_event = threading.Event()
        self.event_queue: queue.Queue[tuple[str, Any]] = queue.Queue()
        self.busy = False

        self.status_var = tk.StringVar(value="請加入本機資料夾，或選擇 Google OAuth 憑證。")
        self.summary_var = tk.StringVar(value="尚未掃描")
        self.credentials_var = tk.StringVar(value="")
        self.progress_var = tk.DoubleVar(value=0)

        self._configure_style()
        self._build_ui()
        self.root.after(self.POLL_MS, self._poll_events)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    @property
    def groups(self) -> tuple[DuplicateGroup, ...]:
        return self.groups_by_source["local"] + self.groups_by_source["drive"]

    def _configure_style(self) -> None:
        style = ttk.Style(self.root)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Title.TLabel", font=("Segoe UI", 22, "bold"))
        style.configure("Subtitle.TLabel", font=("Segoe UI", 10))
        style.configure("Summary.TLabel", font=("Segoe UI", 11, "bold"))
        style.configure("Danger.TButton", font=("Segoe UI", 10, "bold"))

    def _build_ui(self) -> None:
        outer = ttk.Frame(self.root, padding=16)
        outer.pack(fill="both", expand=True)

        header = ttk.Frame(outer)
        header.pack(fill="x")
        ttk.Label(header, text="DupeSweep", style="Title.TLabel").pack(side="left")
        ttk.Label(
            header,
            text="精準找出重複內容；保留一份，其餘移到垃圾桶",
            style="Subtitle.TLabel",
        ).pack(side="left", padx=(16, 0), pady=(8, 0))

        sources = ttk.LabelFrame(outer, text="1. 選擇掃描來源", padding=12)
        sources.pack(fill="x", pady=(14, 10))
        sources.columnconfigure(0, weight=1)
        sources.columnconfigure(1, weight=1)

        local_frame = ttk.Frame(sources)
        local_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        ttk.Label(local_frame, text="本機資料夾", style="Summary.TLabel").pack(anchor="w")
        local_body = ttk.Frame(local_frame)
        local_body.pack(fill="x", pady=(6, 0))
        self.folder_list = tk.Listbox(local_body, height=4, selectmode="extended")
        self.folder_list.pack(side="left", fill="x", expand=True)
        local_buttons = ttk.Frame(local_body)
        local_buttons.pack(side="left", padx=(8, 0), fill="y")
        ttk.Button(local_buttons, text="加入…", command=self._add_folder).pack(fill="x")
        ttk.Button(local_buttons, text="移除", command=self._remove_folder).pack(
            fill="x", pady=(5, 0)
        )
        ttk.Button(local_frame, text="掃描本機", command=self._scan_local).pack(
            anchor="e", pady=(8, 0)
        )

        drive_frame = ttk.Frame(sources)
        drive_frame.grid(row=0, column=1, sticky="nsew")
        ttk.Label(drive_frame, text="Google Drive", style="Summary.TLabel").pack(anchor="w")
        ttk.Label(
            drive_frame,
            text="選擇 Google Cloud 建立的 Desktop app OAuth JSON 檔",
        ).pack(anchor="w", pady=(6, 3))
        credential_row = ttk.Frame(drive_frame)
        credential_row.pack(fill="x")
        ttk.Entry(credential_row, textvariable=self.credentials_var).pack(
            side="left", fill="x", expand=True
        )
        ttk.Button(credential_row, text="選擇…", command=self._choose_credentials).pack(
            side="left", padx=(8, 0)
        )
        ttk.Button(
            drive_frame,
            text="連接並掃描 Google Drive",
            command=self._scan_drive,
        ).pack(anchor="e", pady=(8, 0))

        results = ttk.LabelFrame(outer, text="2. 檢查重複檔案", padding=8)
        results.pack(fill="both", expand=True)
        results.columnconfigure(0, weight=1)
        results.rowconfigure(1, weight=1)

        toolbar = ttk.Frame(results)
        toolbar.grid(row=0, column=0, sticky="ew", pady=(0, 7))
        ttk.Label(toolbar, textvariable=self.summary_var, style="Summary.TLabel").pack(
            side="left"
        )
        ttk.Button(toolbar, text="選取所有額外副本", command=self._select_all).pack(
            side="right"
        )
        ttk.Button(toolbar, text="清除選取", command=self._clear_selection).pack(
            side="right", padx=(0, 6)
        )

        columns = ("action", "source", "size", "location")
        self.tree = ttk.Treeview(
            results,
            columns=columns,
            show="tree headings",
            selectmode="browse",
        )
        self.tree.heading("#0", text="檔案 / 群組")
        self.tree.heading("action", text="處理")
        self.tree.heading("source", text="來源")
        self.tree.heading("size", text="大小")
        self.tree.heading("location", text="位置")
        self.tree.column("#0", width=230, minwidth=150)
        self.tree.column("action", width=90, anchor="center", stretch=False)
        self.tree.column("source", width=100, anchor="center", stretch=False)
        self.tree.column("size", width=90, anchor="e", stretch=False)
        self.tree.column("location", width=520, minwidth=250)
        self.tree.tag_configure("keeper", foreground="#18794e")
        self.tree.tag_configure("delete", foreground="#b42318")
        self.tree.tag_configure("blocked", foreground="#667085")
        self.tree.grid(row=1, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(results, orient="vertical", command=self.tree.yview)
        scrollbar.grid(row=1, column=1, sticky="ns")
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.bind("<Double-1>", self._toggle_selected)
        self.tree.bind("<space>", self._toggle_selected)

        footer = ttk.Frame(outer)
        footer.pack(fill="x", pady=(10, 0))
        progress_frame = ttk.Frame(footer)
        progress_frame.pack(side="left", fill="x", expand=True)
        ttk.Label(progress_frame, textvariable=self.status_var).pack(anchor="w")
        self.progress = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress.pack(fill="x", pady=(4, 0))
        self.cancel_button = ttk.Button(footer, text="取消目前作業", command=self._cancel)
        self.cancel_button.pack(side="left", padx=(12, 8))
        self.trash_button = ttk.Button(
            footer,
            text="將選取項目移到垃圾桶",
            style="Danger.TButton",
            command=self._trash_selected,
        )
        self.trash_button.pack(side="right")

    def _add_folder(self) -> None:
        folder = filedialog.askdirectory(title="選擇要掃描的資料夾")
        if folder:
            current = set(self.folder_list.get(0, "end"))
            if folder not in current:
                self.folder_list.insert("end", folder)

    def _remove_folder(self) -> None:
        for index in reversed(self.folder_list.curselection()):
            self.folder_list.delete(index)

    def _choose_credentials(self) -> None:
        filename = filedialog.askopenfilename(
            title="選擇 Google OAuth Desktop app JSON",
            filetypes=[("JSON", "*.json"), ("所有檔案", "*.*")],
        )
        if filename:
            self.credentials_var.set(filename)

    def _scan_local(self) -> None:
        roots = tuple(self.folder_list.get(0, "end"))
        if not roots:
            messagebox.showinfo("尚未選擇", "請先加入至少一個本機資料夾。")
            return

        def job() -> ScanReport:
            return LocalScanner().scan(
                roots,
                progress=self._post_progress,
                cancel_event=self.cancel_event,
            )

        self._start_job("正在掃描本機檔案…", job)

    def _scan_drive(self) -> None:
        credentials = self.credentials_var.get().strip()
        if not credentials:
            messagebox.showinfo("缺少 OAuth 憑證", "請先選擇 Google OAuth JSON 檔。")
            return

        def job() -> tuple[Any, ScanReport]:
            service = build_drive_service(credentials)
            report = GoogleDriveScanner().scan(
                service,
                progress=self._post_progress,
                cancel_event=self.cancel_event,
            )
            return service, report

        self._start_job("正在連接 Google Drive…", job)

    def _start_job(self, status: str, function: Callable[[], Any]) -> None:
        if self.busy:
            messagebox.showinfo("作業進行中", "請先等待目前作業完成，或按下取消。")
            return
        self.busy = True
        self.cancel_event.clear()
        self.status_var.set(status)
        self.progress.configure(mode="indeterminate")
        self.progress.start(12)

        def worker() -> None:
            try:
                self.event_queue.put(("done", function()))
            except Exception as error:  # noqa: BLE001 - shown safely on the UI thread
                self.event_queue.put(("error", error))

        threading.Thread(target=worker, name="dupesweep-worker", daemon=True).start()

    def _post_progress(self, update: ProgressUpdate) -> None:
        self.event_queue.put(("progress", update))

    def _poll_events(self) -> None:
        try:
            while True:
                event, payload = self.event_queue.get_nowait()
                if event == "progress":
                    self._handle_progress(payload)
                elif event == "done":
                    self._finish_job(payload)
                elif event == "error":
                    self._fail_job(payload)
        except queue.Empty:
            pass
        self.root.after(self.POLL_MS, self._poll_events)

    def _handle_progress(self, update: ProgressUpdate) -> None:
        self.status_var.set(update.message)
        if update.total:
            self.progress.stop()
            self.progress.configure(mode="determinate")
            self.progress_var.set(min(100, update.current / update.total * 100))

    def _finish_job(self, result: Any) -> None:
        self.busy = False
        self.progress.stop()
        self.progress.configure(mode="determinate")
        self.progress_var.set(100)

        if isinstance(result, ScanReport):
            self._accept_scan(result)
        elif isinstance(result, tuple) and len(result) == 2 and isinstance(result[1], ScanReport):
            self.drive_service = result[0]
            self._accept_scan(result[1])
        elif isinstance(result, tuple) and all(isinstance(item, ActionReport) for item in result):
            self._accept_actions(result)
        else:
            self.status_var.set("作業完成")

    def _fail_job(self, error: Exception) -> None:
        self.busy = False
        self.progress.stop()
        self.progress.configure(mode="determinate")
        self.progress_var.set(0)
        self.status_var.set(f"作業未完成：{error}")
        messagebox.showerror("DupeSweep", str(error))

    def _accept_scan(self, report: ScanReport) -> None:
        self.groups_by_source[report.source] = report.groups
        self.selected_keys -= {
            key for key in self.selected_keys if key.startswith(f"{report.source}:")
        }
        self.selected_keys |= default_selection(report.groups)
        self._refresh_tree()
        warning_text = f"，略過 {report.skipped_files:,} 項" if report.skipped_files else ""
        self.status_var.set(
            f"掃描完成：檢查 {report.examined_files:,} 個檔案，"
            f"找到 {report.duplicate_copies:,} 個額外副本{warning_text}。"
        )
        if report.warnings:
            preview = "\n".join(report.warnings[:8])
            remainder = len(report.warnings) - 8
            if remainder > 0:
                preview += f"\n…另有 {remainder:,} 筆警告"
            messagebox.showwarning("掃描警告", preview)

    def _refresh_tree(self) -> None:
        self.tree.delete(*self.tree.get_children())
        self.row_to_key.clear()
        self.records_by_key = {
            record.key: record for group in self.groups for record in group.records
        }
        self.keeper_keys = {group.keeper_key for group in self.groups}

        for index, group in enumerate(self.groups, start=1):
            source_name = "本機" if group.records[0].source == "local" else "Google Drive"
            parent = self.tree.insert(
                "",
                "end",
                text=f"重複群組 {index}（{len(group.records)} 份）",
                values=("", source_name, _format_bytes(group.records[0].size), ""),
                open=index <= 20,
            )
            for record in group.records:
                if record.key == group.keeper_key:
                    action, tag = "保留", "keeper"
                elif not record.can_trash:
                    action, tag = "無權限", "blocked"
                elif record.key in self.selected_keys:
                    action, tag = "移除", "delete"
                else:
                    action, tag = "略過", ""
                row = self.tree.insert(
                    parent,
                    "end",
                    text=record.name,
                    values=(
                        action,
                        source_name,
                        _format_bytes(record.size),
                        record.location,
                    ),
                    tags=(tag,) if tag else (),
                )
                self.row_to_key[row] = record.key
        self._update_summary()

    def _toggle_selected(self, _event: tk.Event[Any] | None = None) -> str:
        row = self.tree.focus()
        key = self.row_to_key.get(row)
        if not key:
            return "break"
        record = self.records_by_key[key]
        if key in self.keeper_keys:
            self.status_var.set("每個群組至少保留一份；受保護的檔案不能選取。")
            return "break"
        if not record.can_trash:
            self.status_var.set("目前帳號沒有權限將這個檔案移到垃圾桶。")
            return "break"
        if key in self.selected_keys:
            self.selected_keys.remove(key)
        else:
            self.selected_keys.add(key)
        self._refresh_tree()
        return "break"

    def _select_all(self) -> None:
        self.selected_keys = default_selection(self.groups)
        self._refresh_tree()

    def _clear_selection(self) -> None:
        self.selected_keys.clear()
        self._refresh_tree()

    def _update_summary(self) -> None:
        total_records = sum(len(group.records) for group in self.groups)
        size = selected_bytes(self.groups, self.selected_keys)
        self.summary_var.set(
            f"{len(self.groups):,} 組 / {total_records:,} 個相符檔案｜"
            f"已選 {len(self.selected_keys):,} 個，可釋放 {_format_bytes(size)}"
        )

    def _trash_selected(self) -> None:
        if self.busy:
            messagebox.showinfo("作業進行中", "請先等待目前作業完成。")
            return
        if not self.selected_keys:
            messagebox.showinfo("尚未選取", "目前沒有要移到垃圾桶的檔案。")
            return
        try:
            validate_selection(self.groups, self.selected_keys)
        except ValueError as error:
            messagebox.showerror("選取無效", str(error))
            return

        count = len(self.selected_keys)
        bytes_to_free = selected_bytes(self.groups, self.selected_keys)
        if not messagebox.askyesno(
            "確認移到垃圾桶",
            f"即將移動 {count:,} 個重複副本（{_format_bytes(bytes_to_free)}）。\n\n"
            "本機檔案會進入資源回收筒；Google Drive 檔案會進入雲端垃圾桶。\n"
            "是否繼續？",
            icon="warning",
        ):
            return
        if count >= 500:
            phrase = f"移除 {count}"
            answer = simpledialog.askstring(
                "大量操作確認",
                f"這是大量檔案操作。請輸入「{phrase}」才能繼續：",
                parent=self.root,
            )
            if answer != phrase:
                self.status_var.set("確認文字不符，已取消。")
                return

        records = selected_records(self.groups, self.selected_keys)
        local_records = tuple(record for record in records if record.source == "local")
        drive_records = tuple(record for record in records if record.source == "drive")
        if drive_records and self.drive_service is None:
            messagebox.showerror("Google Drive 未連線", "請重新連接並掃描 Google Drive。")
            return

        def job() -> tuple[ActionReport, ...]:
            reports: list[ActionReport] = []
            if local_records:
                reports.append(
                    LocalTrashExecutor().trash(
                        local_records,
                        progress=self._post_progress,
                        cancel_event=self.cancel_event,
                    )
                )
            if drive_records and not self.cancel_event.is_set():
                reports.append(
                    GoogleDriveTrashExecutor().trash(
                        self.drive_service,
                        drive_records,
                        progress=self._post_progress,
                        cancel_event=self.cancel_event,
                    )
                )
            return tuple(reports)

        self._start_job(f"準備移動 {count:,} 個檔案…", job)

    def _accept_actions(self, reports: tuple[ActionReport, ...]) -> None:
        trashed_keys = {
            outcome.record.key
            for report in reports
            for outcome in report.trashed
        }
        failed = [outcome for report in reports for outcome in report.failed]
        cancelled = [outcome for report in reports for outcome in report.cancelled]

        for source in ("local", "drive"):
            remaining_records = [
                record
                for group in self.groups_by_source[source]
                for record in group.records
                if record.key not in trashed_keys
            ]
            self.groups_by_source[source] = build_duplicate_groups(remaining_records)

        self.selected_keys -= trashed_keys
        self.selected_keys &= {
            record.key for group in self.groups for record in group.records
        }
        self._refresh_tree()
        try:
            report_path = write_action_report(reports)
            report_note = f" 報告：{report_path}"
        except OSError as error:
            report_note = f" 報告寫入失敗：{error}"
        self.status_var.set(
            f"完成：{len(trashed_keys):,} 個已移到垃圾桶，"
            f"{len(failed):,} 個失敗，{len(cancelled):,} 個取消。{report_note}"
        )
        if failed:
            preview = "\n".join(
                f"• {outcome.record.name}: {outcome.error}" for outcome in failed[:10]
            )
            if len(failed) > 10:
                preview += f"\n…另有 {len(failed) - 10:,} 個失敗"
            messagebox.showwarning("部分檔案未處理", preview)
        elif trashed_keys:
            messagebox.showinfo(
                "DupeSweep",
                f"已將 {len(trashed_keys):,} 個重複副本移到垃圾桶。\n"
                "確認無誤後，再由你自行清空垃圾桶。",
            )

    def _cancel(self) -> None:
        if not self.busy:
            self.status_var.set("目前沒有進行中的作業。")
            return
        self.cancel_event.set()
        self.status_var.set("正在安全停止；目前已送出的批次可能仍會完成…")

    def _on_close(self) -> None:
        if self.busy and not messagebox.askyesno(
            "結束 DupeSweep",
            "作業仍在進行。要發出取消訊號並關閉視窗嗎？",
            icon="warning",
        ):
            return
        self.cancel_event.set()
        self.root.destroy()


def main() -> None:
    root = tk.Tk()
    DupeSweepApp(root)
    root.mainloop()
