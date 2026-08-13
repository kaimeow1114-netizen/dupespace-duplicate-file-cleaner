from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from .models import DuplicateGroup, ScanReport


@dataclass(frozen=True, slots=True)
class CleanupStats:
    selected_bytes: int
    reclaimable_bytes: int
    examined_bytes: int
    storage_capacity_bytes: int | None

    @property
    def reclaimable_percent(self) -> float:
        if self.reclaimable_bytes <= 0:
            return 0.0
        return min(100.0, self.selected_bytes / self.reclaimable_bytes * 100)

    @property
    def scanned_percent(self) -> float:
        if self.examined_bytes <= 0:
            return 0.0
        return min(100.0, self.selected_bytes / self.examined_bytes * 100)

    @property
    def capacity_percent(self) -> float | None:
        if not self.storage_capacity_bytes:
            return None
        return min(100.0, self.selected_bytes / self.storage_capacity_bytes * 100)


def calculate_cleanup_stats(
    groups: Iterable[DuplicateGroup],
    selected: set[str],
    reports: Iterable[ScanReport],
) -> CleanupStats:
    group_list = tuple(groups)
    report_list = tuple(reports)
    selected_size = sum(
        record.size for group in group_list for record in group.records if record.key in selected
    )
    reclaimable = sum(group.reclaimable_bytes for group in group_list)
    examined = sum(report.examined_bytes for report in report_list)
    capacities = [
        report.storage_capacity_bytes
        for report in report_list
        if report.storage_capacity_bytes is not None
    ]
    capacity = sum(capacities) if capacities else None
    return CleanupStats(selected_size, reclaimable, examined, capacity)
