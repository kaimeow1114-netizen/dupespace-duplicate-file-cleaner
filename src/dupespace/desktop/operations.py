from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..drive import GoogleDrivePermanentDeleteExecutor, GoogleDriveTrashExecutor
from ..local import LocalPermanentDeleteExecutor, LocalTrashExecutor
from ..models import ActionOutcome, ActionReport, OperationItem, OperationMode, ProgressUpdate
from ..reporting import AuditJournal, write_action_report


@dataclass(frozen=True)
class CleanupResult:
    report: ActionReport
    csv_path: Path | None
    journal_path: Path
    warning: str = ""


def run_cleanup(
    items: tuple[OperationItem, ...],
    mode: OperationMode,
    *,
    cancel_event: threading.Event,
    progress,
    service: Any = None,
    directory: Path | None = None,
    local_executor=None,
) -> CleanupResult:
    if not items or mode not in {"trash", "permanent"}:
        raise ValueError("沒有可執行的清理計畫。")
    source = items[0].record.source
    if any(item.record.source != source for item in items):
        raise ValueError("一次操作只能使用一種掃描來源。")
    if source == "drive" and service is None:
        raise ValueError("Google Drive 尚未連線，沒有執行任何操作。")
    # Creating the durable log is a prerequisite, not a best-effort cleanup step.
    journal = AuditJournal(directory)
    outcomes: list[ActionOutcome] = []
    warning = ""
    batch_size = 1 if source == "local" else 20
    if source == "local":
        executor = local_executor or (
            LocalTrashExecutor() if mode == "trash" else LocalPermanentDeleteExecutor()
        )
    else:
        executor = (
            GoogleDriveTrashExecutor(batch_size=batch_size)
            if mode == "trash"
            else GoogleDrivePermanentDeleteExecutor(batch_size=batch_size)
        )
    try:
        for offset in range(0, len(items), batch_size):
            if cancel_event.is_set():
                break
            batch = items[offset : offset + batch_size]
            journal.start(batch, mode)
            progress(ProgressUpdate("validation", offset, len(items), batch[0].record.location))
            execute = executor.trash if mode == "trash" else executor.delete
            try:
                report = (
                    execute(batch, cancel_event=cancel_event)
                    if source == "local"
                    else execute(service, batch, cancel_event=cancel_event)
                )
            except Exception:
                # Do not retry an unknown mutation or turn a trash failure into deletion.
                report = ActionReport(
                    source,
                    tuple(
                        ActionOutcome(
                            item.record,
                            "failed",
                            "操作結果未確定；請先檢查原位置與垃圾桶，再重新掃描。",
                            mode,
                        )
                        for item in batch
                    ),
                    mode,
                )
                cancel_event.set()
            outcomes.extend(report.outcomes)
            journal.append(report.outcomes)
            progress(ProgressUpdate("cleanup", len(outcomes), len(items), batch[-1].record.name))
    except OSError:
        warning = "稽核紀錄無法繼續寫入，已停止後續操作。請保存目前結果與操作日誌。"
        cancel_event.set()
    finally:
        remaining = items[len(outcomes) :]
        cancelled = tuple(
            ActionOutcome(item.record, "cancelled", "已安全停止，未開始處理。", mode)
            for item in remaining
        )
        outcomes.extend(cancelled)
        try:
            journal.append(cancelled)
        except OSError:
            warning = "稽核紀錄寫入失敗，已停止後續操作；請保留操作日誌並檢查結果。"
        finally:
            journal.close()
    final_report = ActionReport(source, tuple(outcomes), mode)
    try:
        csv_path = write_action_report((final_report,), directory=directory)
    except OSError:
        csv_path = None
        warning = "最終報告無法儲存。請先保存操作日誌；不要重複執行未確認的項目。"
    return CleanupResult(final_report, csv_path, journal.path, warning)
