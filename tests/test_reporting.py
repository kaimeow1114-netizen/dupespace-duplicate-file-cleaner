import csv
from pathlib import Path

from dupesweep.models import ActionOutcome, ActionReport, FileRecord
from dupesweep.reporting import write_action_report


def test_action_report_is_written_as_utf8_csv(tmp_path: Path) -> None:
    record = FileRecord(
        key="local:C:/資料/副本.txt",
        source="local",
        name="副本.txt",
        location="C:/資料/副本.txt",
        size=123,
        checksum="sha256:x",
    )
    report = ActionReport("local", (ActionOutcome(record, "trashed"),))

    destination = write_action_report([report], directory=tmp_path)

    with destination.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    assert rows[0]["timestamp"]
    assert rows[0] == {
        "timestamp": rows[0]["timestamp"],
        "source": "local",
        "operation_mode": "trash",
        "status": "trashed",
        "name": "副本.txt",
        "location": "C:/資料/副本.txt",
        "size_bytes": "123",
        "checksum": "sha256:x",
        "reason": "",
    }
