from dupesweep.models import DuplicateGroup, FileRecord, ScanReport
from dupesweep.stats import calculate_cleanup_stats


def record(key: str, size: int = 100) -> FileRecord:
    return FileRecord(key, "local", key, key, size, "sha256:same")


def test_cleanup_stats_quantifies_selected_space_and_percentages():
    group = DuplicateGroup("100:sha256:same", (record("a"), record("b"), record("c")), "a")
    report = ScanReport(
        "local",
        (group,),
        examined_files=10,
        hashed_files=3,
        examined_bytes=1_000,
        storage_capacity_bytes=10_000,
    )

    stats = calculate_cleanup_stats((group,), {"b"}, (report,))

    assert stats.selected_bytes == 100
    assert stats.reclaimable_bytes == 200
    assert stats.reclaimable_percent == 50
    assert stats.scanned_percent == 10
    assert stats.capacity_percent == 1


def test_cleanup_stats_handles_unknown_capacity():
    stats = calculate_cleanup_stats((), set(), ())

    assert stats.capacity_percent is None
    assert stats.reclaimable_percent == 0
    assert stats.scanned_percent == 0
