from __future__ import annotations

import csv
import os
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from .models import ActionOutcome, ActionReport, OperationItem, OperationMode

FIELDS = (
    "timestamp",
    "source",
    "operation_mode",
    "status",
    "name",
    "location",
    "size_bytes",
    "checksum",
    "reason",
)


def csv_cell(value: object) -> object:
    """Keep untrusted filenames from becoming spreadsheet formulas."""
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    if isinstance(value, str) and value.startswith(("\t", "\r", "\n")):
        return "'" + value
    return value


def outcome_row(outcome: ActionOutcome) -> tuple:
    return tuple(
        csv_cell(value)
        for value in (
            outcome.occurred_at,
            outcome.record.source,
            outcome.operation_mode,
            outcome.status,
            outcome.record.name,
            outcome.record.location,
            outcome.record.size,
            outcome.record.checksum,
            outcome.error or "",
        )
    )


class AuditJournal:
    """Durable intent/result records. An unfinished intent is not a successful deletion."""

    def __init__(self, directory: Path | None = None) -> None:
        folder = directory or default_report_dir()
        folder.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().astimezone().strftime("%Y-%m-%d_%H-%M-%S")
        self.path = (folder / f"DUPESPACE-{stamp}-{uuid4().hex[:8]}.csv").absolute()
        self.handle = self.path.open("x", encoding="utf-8-sig", newline="")
        self.writer = csv.writer(self.handle)
        try:
            self.writer.writerow(FIELDS)
            self._flush()
        except BaseException:
            self.handle.close()
            raise

    def _flush(self) -> None:
        self.handle.flush()
        os.fsync(self.handle.fileno())

    def start(self, items: Iterable[OperationItem], mode: OperationMode) -> None:
        for item in items:
            self.writer.writerow(
                tuple(
                    csv_cell(value)
                    for value in (
                        datetime.now().astimezone().isoformat(timespec="seconds"),
                        item.record.source,
                        mode,
                        "pending",
                        item.record.name,
                        item.record.location,
                        item.record.size,
                        item.record.checksum,
                        "操作準備；尚無結果不代表已刪除",
                    )
                )
            )
        self._flush()

    def append(self, outcomes: Iterable[ActionOutcome]) -> None:
        for outcome in outcomes:
            self.writer.writerow(outcome_row(outcome))
        self._flush()

    def close(self) -> None:
        self.handle.close()

    def finalize(self, report: ActionReport) -> Path:
        """Atomically compact this batch's durable journal into its one final CSV.

        If replacement fails, the intent/result journal remains at the same path.
        A crash before finalization leaves pending rows distinguishable from results.
        """
        if not self.handle.closed:
            raise ValueError("Close the audit journal before finalizing it")
        _write_outcomes(self.path, report.outcomes)
        return self.path


def default_report_dir() -> Path:
    base = os.getenv("LOCALAPPDATA")
    if base:
        return Path(base) / "DupeSpace" / "reports"
    return Path.home() / ".dupespace" / "reports"


def write_action_report(
    reports: Iterable[ActionReport],
    *,
    directory: str | os.PathLike[str] | None = None,
) -> Path:
    """Write an audit CSV for a cleanup attempt and return its absolute path."""

    report_dir = Path(directory) if directory else default_report_dir()
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    destination = report_dir / f"cleanup-{timestamp}-{uuid4().hex[:8]}.csv"
    _write_outcomes(destination, (outcome for report in reports for outcome in report.outcomes))
    return destination.resolve()


def _write_outcomes(destination: Path, outcomes: Iterable[ActionOutcome]) -> None:
    temporary = destination.with_name(f"{destination.stem}-{uuid4().hex[:8]}.tmp")

    with temporary.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(FIELDS)
        for outcome in outcomes:
            writer.writerow(outcome_row(outcome))
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(destination)
