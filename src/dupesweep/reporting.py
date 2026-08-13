from __future__ import annotations

import csv
import os
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from .models import ActionReport


def default_report_dir() -> Path:
    base = os.getenv("LOCALAPPDATA")
    if base:
        return Path(base) / "DupeSweep" / "reports"
    return Path.home() / ".dupesweep" / "reports"


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
    temporary = destination.with_suffix(".tmp")

    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(("source", "status", "name", "location", "size_bytes", "error"))
        for report in reports:
            for outcome in report.outcomes:
                writer.writerow(
                    (
                        outcome.record.source,
                        outcome.status,
                        outcome.record.name,
                        outcome.record.location,
                        outcome.record.size,
                        outcome.error or "",
                    )
                )
    temporary.replace(destination)
    return destination.resolve()
