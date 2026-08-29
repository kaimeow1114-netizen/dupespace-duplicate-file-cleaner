from __future__ import annotations

import csv
import threading

import pytest

from dupespace.desktop.operations import run_cleanup
from dupespace.local import LocalScanner, LocalTrashExecutor
from dupespace.models import ActionOutcome, ActionReport, FileRecord, OperationItem, ScanRoot
from dupespace.reporting import csv_cell
from dupespace.windows_safety import WindowsSafetyPolicy


def fake_items(count=3):
    keeper = FileRecord(
        "k", "local", "original.bin", "D:/keep/original.bin", 20, "hash", root_role="keep"
    )
    return tuple(
        OperationItem(
            FileRecord(
                str(i),
                "local",
                f"copy-{i}.bin",
                f"D:/clean/copy-{i}.bin",
                20,
                "hash",
                root_role="clean",
            ),
            keeper,
        )
        for i in range(count)
    )


class RecordingExecutor:
    def __init__(self, callback):
        self.callback = callback

    def trash(self, items, **_kwargs):
        self.callback(items)
        return ActionReport("local", tuple(ActionOutcome(item.record, "trashed") for item in items))


def test_durable_intent_exists_before_mutation_and_each_result_is_in_csv(tmp_path):
    def check_intent(items):
        journal = next(tmp_path.glob("operation-*.csv"))
        with journal.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        assert rows[-1]["status"] == "pending"
        assert rows[-1]["location"] == items[0].record.location

    result = run_cleanup(
        fake_items(),
        "trash",
        cancel_event=threading.Event(),
        progress=lambda _: None,
        directory=tmp_path,
        local_executor=RecordingExecutor(check_intent),
    )
    with result.csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 3
    assert all(row["status"] == "trashed" for row in rows)
    assert all(row["operation_mode"] == "trash" for row in rows)


def test_batch_stop_leaves_unstarted_items_and_reports_them(tmp_path):
    cancel = threading.Event()
    calls = []

    def stop_after_first(items):
        calls.extend(items)
        cancel.set()

    result = run_cleanup(
        fake_items(5001),
        "trash",
        cancel_event=cancel,
        progress=lambda _: None,
        directory=tmp_path,
        local_executor=RecordingExecutor(stop_after_first),
    )
    assert len(calls) == 1
    assert len(result.report.trashed) == 1
    assert len(result.report.cancelled) == 5000


def test_missing_audit_access_prevents_any_file_operation(tmp_path, monkeypatch):
    def denied(*_args, **_kwargs):
        raise PermissionError("audit denied")

    calls = []
    monkeypatch.setattr("dupespace.desktop.operations.AuditJournal", denied)
    with pytest.raises(PermissionError):
        run_cleanup(
            fake_items(),
            "trash",
            cancel_event=threading.Event(),
            progress=lambda _: None,
            directory=tmp_path,
            local_executor=RecordingExecutor(calls.extend),
        )
    assert calls == []


def test_unknown_trash_failure_stops_without_permanent_fallback(tmp_path):
    class FailedExecutor:
        def trash(self, *_args, **_kwargs):
            raise RuntimeError("uncertain result")

        def delete(self, *_args, **_kwargs):
            pytest.fail("No permanent fallback is permitted")

    result = run_cleanup(
        fake_items(),
        "trash",
        cancel_event=threading.Event(),
        progress=lambda _: None,
        directory=tmp_path,
        local_executor=FailedExecutor(),
    )
    assert len(result.report.failed) == 1
    assert len(result.report.cancelled) == 2
    assert not result.report.deleted


@pytest.mark.parametrize("value", ["=HYPERLINK(x)", "+1+1", "-1+1", "@evil", "  =evil", "\tname"])
def test_audit_neutralizes_spreadsheet_formula_payloads(value):
    assert csv_cell(value) == "'" + value
    assert csv_cell("D:/photos/photo.jpg") == "D:/photos/photo.jpg"


def test_keeper_changed_after_first_item_blocks_second_trash(tmp_path):
    clean = tmp_path / "clean"
    keep = clean / "protected"
    keep.mkdir(parents=True)
    original = keep / "original.bin"
    original.write_bytes(b"same-content")
    for index in range(2):
        (clean / f"copy-{index}.bin").write_bytes(b"same-content")
    policy = WindowsSafetyPolicy([])
    report = LocalScanner(safety_policy=policy).scan(
        (ScanRoot(str(keep), "keep"), ScanRoot(str(clean), "clean"))
    )
    keeper = report.groups[0].keeper
    items = tuple(
        OperationItem(item, keeper)
        for item in report.groups[0].records
        if item.root_role == "clean"
    )
    moved = []

    def simulate_trash(path):
        moved.append(path)
        original.write_bytes(b"CHANGED-KEEP")

    result = LocalTrashExecutor(trash_func=simulate_trash, safety_policy=policy).trash(items)
    assert len(moved) == 1
    assert len(result.trashed) == 1
    assert len(result.skipped) == 1
