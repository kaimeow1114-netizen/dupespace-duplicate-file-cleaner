from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field, replace
from pathlib import Path
from uuid import uuid4

from ..confirmations import ConfirmationSnapshot, TrashReminderSession
from ..grouping import default_selection, operation_items, selected_bytes
from ..models import ActionReport, DuplicateGroup, FileRecord, OperationMode, ScanReport, ScanRoot
from ..paths import app_data_dir
from ..windows_safety import DEFAULT_WINDOWS_SAFETY_POLICY, WindowsSafetyPolicy


def format_bytes(value: int) -> str:
    amount = float(max(0, value))
    for unit in ("B", "KiB", "MiB", "GiB", "TiB", "PiB"):
        if amount < 1024 or unit == "PiB":
            return f"{amount:,.0f} {unit}" if unit == "B" else f"{amount:,.2f} {unit}"
        amount /= 1024
    return "0 B"


def validate_roots(
    roots: tuple[ScanRoot, ...], policy: WindowsSafetyPolicy = DEFAULT_WINDOWS_SAFETY_POLICY
) -> tuple[ScanRoot, ...]:
    """Validate additions even before both roles have been chosen."""
    checked: list[ScanRoot] = []
    for root in roots:
        if root.role not in {"keep", "clean"}:
            raise ValueError("掃描位置必須指定保留區或清理區。")
        path = policy.validate_scan_root(root.physical_path)
        for previous in checked:
            prior = Path(previous.physical_path)
            if path == prior or path.is_relative_to(prior) or prior.is_relative_to(path):
                raise ValueError("位置不能相同或互相包含。請分別選擇獨立的保留區與清理區。")
        checked.append(ScanRoot(str(path), root.role))
    return tuple(checked)


@dataclass
class ScanSession:
    roots: tuple[ScanRoot, ...] = ()
    source: str = "local"
    report: ScanReport | None = None
    groups: tuple[DuplicateGroup, ...] = ()
    selected: set[str] = field(default_factory=set)
    mode: OperationMode = "trash"
    scan_id: str = field(default_factory=lambda: uuid4().hex)
    reminders: TrashReminderSession = field(default_factory=TrashReminderSession)

    @property
    def ready(self) -> bool:
        return {root.role for root in self.roots} == {"keep", "clean"}

    def clear_scan(self) -> None:
        self.report = None
        self.groups = ()
        self.selected.clear()
        self.mode = "trash"
        self.scan_id = uuid4().hex
        self.reminders.invalidate()

    def set_roots(self, roots: tuple[ScanRoot, ...]) -> None:
        self.roots = validate_roots(roots)
        self.clear_scan()

    def accept_scan(self, report: ScanReport) -> None:
        self.clear_scan()
        self.source = report.source
        self.report = report
        self.groups = report.groups
        self.selected = default_selection(self.groups)

    def set_mode(self, mode: OperationMode) -> None:
        if mode not in {"trash", "permanent"}:
            raise ValueError("Unknown operation mode")
        self.mode = mode
        self.selected.clear()
        self.reminders.invalidate()

    def allowed(self, group: DuplicateGroup, record: FileRecord) -> bool:
        return (
            record.key != group.keeper_key
            and record.root_role != "keep"
            and record.selectable
            and not record.safety_context.is_hard_protected
            and (
                record.can_trash
                if self.mode == "trash"
                else record.can_delete and record.item_kind == "file"
            )
        )

    def select_all(self) -> None:
        self.selected = {
            record.key
            for group in self.groups
            for record in group.records
            if self.allowed(group, record)
        }
        self.reminders.invalidate()

    def snapshot(self) -> ConfirmationSnapshot:
        selected_groups = [
            group
            for group in self.groups
            if any(record.key in self.selected for record in group.records)
        ]
        selection_digest = hashlib.sha256(
            "\0".join(sorted(self.selected)).encode("utf-8")
        ).hexdigest()
        return ConfirmationSnapshot(
            len(self.selected),
            len(selected_groups),
            selected_bytes(self.groups, self.selected),
            self.mode,
            f"{self.source}:{self.scan_id}:{selection_digest}",
        )

    def plan(self, confirmed: ConfirmationSnapshot):
        if confirmed != self.snapshot():
            raise ValueError("選取項目或掃描來源已變更，請重新確認。")
        return operation_items(self.groups, self.selected, self.mode)

    def apply_actions(self, report: ActionReport) -> None:
        removed = {
            item.record.key for item in report.outcomes if item.status in {"trashed", "deleted"}
        }
        remaining: list[DuplicateGroup] = []
        for group in self.groups:
            records = tuple(record for record in group.records if record.key not in removed)
            if len(records) < 2 or not any(
                record.key != group.keeper_key and record.root_role != "keep" for record in records
            ):
                continue
            remaining.append(replace(group, records=records))
        self.groups = tuple(remaining)
        self.selected.clear()
        self.reminders.invalidate()


def read_preferences() -> dict:
    try:
        value = json.loads((app_data_dir() / "settings.json").read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def save_preferences(values: dict) -> None:
    settings = read_preferences()
    settings.update(values)
    destination = app_data_dir() / "settings.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"settings-{uuid4().hex}.tmp")
    temporary.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, destination)
