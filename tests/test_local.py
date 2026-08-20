from __future__ import annotations

import os
from pathlib import Path

import pytest

from dupespace.grouping import (
    default_selection,
    operation_items,
    validate_selection,
)
from dupespace.local import LocalPermanentDeleteExecutor, LocalScanner, LocalTrashExecutor
from dupespace.models import ScanRoot
from dupespace.windows_safety import UnsafePathError, WindowsSafetyPolicy

TEST_POLICY = WindowsSafetyPolicy([])


def scan_roots(tmp_path: Path) -> tuple[Path, Path, list[ScanRoot]]:
    keep = tmp_path / "keep"
    clean = tmp_path / "clean"
    keep.mkdir()
    clean.mkdir()
    return keep, clean, [ScanRoot(str(keep), "keep"), ScanRoot(str(clean), "clean")]


def test_local_scan_hashes_content_not_just_name_or_size(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    (keep / "first.txt").write_bytes(b"same-content")
    (clean / "renamed.bin").write_bytes(b"same-content")
    (clean / "different.txt").write_bytes(b"other-value!")

    report = LocalScanner(chunk_size=4, safety_policy=TEST_POLICY).scan(roots)

    assert report.examined_files == 3
    assert len(report.groups) == 1
    assert {record.name for record in report.groups[0].records} == {
        "first.txt",
        "renamed.bin",
    }


def test_over_5000_duplicates_can_be_selected_without_losing_keeper(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    monkeypatch.setattr("dupespace.local.MINIMUM_AUTO_SELECT_BYTES", 1)
    (keep / "keeper.dat").write_bytes(b"x")
    for index in range(5000):
        (clean / f"copy-{index:04d}.dat").write_bytes(b"x")

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    selected = default_selection(report.groups)

    assert report.examined_files == 5001
    assert len(report.groups) == 1
    assert len(report.groups[0].records) == 5001
    assert len(selected) == 5000
    assert report.groups[0].keeper_key not in selected


def test_hard_link_identity_is_not_counted_twice(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    original = keep / "original.bin"
    hard_link = clean / "hard-link.bin"
    duplicate = clean / "real-copy.bin"
    original.write_bytes(b"payload")
    duplicate.write_bytes(b"payload")
    try:
        os.link(original, hard_link)
    except OSError as error:
        pytest.skip(f"hard links unavailable: {error}")

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)

    assert len(report.groups) == 1
    assert len(report.groups[0].records) == 2
    assert report.skipped_files == 1


def test_local_trash_rechecks_metadata(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    first = keep / "first.bin"
    second = clean / "second.bin"
    first.write_bytes(b"duplicate")
    second.write_bytes(b"duplicate")
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    target = next(
        record for record in report.groups[0].records if record.key != report.groups[0].keeper_key
    )
    Path(target.location).write_bytes(b"something")

    moved: list[str] = []
    items = operation_items(report.groups, {target.key})
    action = LocalTrashExecutor(trash_func=moved.append, safety_policy=TEST_POLICY).trash(items)

    assert not action.trashed
    assert len(action.skipped) == 1
    assert moved == []


def test_local_trash_uses_injected_recycle_bin_function(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    (keep / "a.bin").write_bytes(b"duplicate")
    (clean / "b.bin").write_bytes(b"duplicate")
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    target = next(
        record for record in report.groups[0].records if record.key != report.groups[0].keeper_key
    )
    moved: list[str] = []

    items = operation_items(report.groups, {target.key})
    action = LocalTrashExecutor(trash_func=moved.append, safety_policy=TEST_POLICY).trash(items)

    assert len(action.trashed) == 1
    assert moved == [target.location]


def test_local_permanent_delete_never_targets_keeper(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    (keep / "keeper.bin").write_bytes(b"duplicate")
    (clean / "extra.bin").write_bytes(b"duplicate")
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    selected = {
        record.key
        for record in report.groups[0].records
        if record.root_role == "clean"
    }
    items = operation_items(report.groups, selected, "permanent")
    removed: list[str] = []

    action = LocalPermanentDeleteExecutor(
        unlink_func=removed.append, safety_policy=TEST_POLICY
    ).delete(items)

    assert len(action.deleted) == 1
    assert report.groups[0].keeper.location not in removed


def test_local_permanent_delete_skips_changed_checksum(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    first = keep / "first.bin"
    second = clean / "second.bin"
    first.write_bytes(b"duplicate")
    second.write_bytes(b"duplicate")
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    selected = {
        record.key
        for record in report.groups[0].records
        if record.root_role == "clean"
    }
    target = next(record for record in report.groups[0].records if record.key in selected)
    target_path = Path(target.location)
    original_mtime = target_path.stat().st_mtime_ns
    target_path.write_bytes(b"DIFFERENT")
    os.utime(target_path, ns=(original_mtime, original_mtime))

    action = LocalPermanentDeleteExecutor(
        unlink_func=lambda _path: None, safety_policy=TEST_POLICY
    ).delete(
        operation_items(report.groups, selected, "permanent")
    )

    assert not action.deleted
    assert action.skipped


def test_local_scan_requires_non_overlapping_keep_and_clean_roots(tmp_path: Path) -> None:
    keep = tmp_path / "root"
    nested = keep / "nested"
    nested.mkdir(parents=True)

    with pytest.raises(UnsafePathError):
        LocalScanner(safety_policy=TEST_POLICY).scan(
            [ScanRoot(str(keep), "keep"), ScanRoot(str(nested / ".."), "clean")]
        )


def test_zero_byte_small_and_clean_only_groups_follow_safe_policy(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    (keep / "empty.bin").write_bytes(b"")
    (clean / "empty-copy.bin").write_bytes(b"")
    (keep / "small.bin").write_bytes(b"same")
    (clean / "small-copy.bin").write_bytes(b"same")
    (clean / "only-one.bin").write_bytes(b"clean-only")
    (clean / "only-two.bin").write_bytes(b"clean-only")

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)

    assert len(report.groups) == 1
    assert {record.name for record in report.groups[0].records} == {
        "small.bin",
        "small-copy.bin",
    }
    assert default_selection(report.groups) == set()
    assert all(record.size > 0 for group in report.groups for record in group.records)


def test_one_mib_safe_clean_copy_is_preselected(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    content = b"d" * (1024 * 1024)
    (keep / "keeper.bin").write_bytes(content)
    (clean / "copy.bin").write_bytes(content)

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    selected = default_selection(report.groups)

    assert len(selected) == 1
    assert next(iter(selected)).endswith("copy.bin")
    assert default_selection(report.groups, "permanent") == set()


def test_identical_files_in_independent_projects_are_never_candidates(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    first_project = keep / "service-one"
    second_project = clean / "service-two"
    (first_project / ".git").mkdir(parents=True)
    (second_project / ".git").mkdir(parents=True)
    content = b'{"sharedPlugin":"required-by-this-project"}' * 30_000
    (first_project / "settings.json").write_bytes(content)
    (second_project / "settings.json").write_bytes(content)

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)

    assert report.groups == ()
    assert report.hashed_files == 0
    assert report.skipped_files >= 2
    assert default_selection(report.groups) == set()


def test_project_marker_added_after_scan_blocks_operation(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    target_folder = clean / "ordinary-folder"
    target_folder.mkdir()
    (keep / "keeper.bin").write_bytes(b"duplicate")
    (target_folder / "copy.bin").write_bytes(b"duplicate")
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    target = next(record for record in report.groups[0].records if record.root_role == "clean")
    (target_folder / ".git").mkdir()

    moved: list[str] = []
    action = LocalTrashExecutor(trash_func=moved.append, safety_policy=TEST_POLICY).trash(
        operation_items(report.groups, {target.key})
    )

    assert moved == []
    assert len(action.skipped) == 1
    assert "程式碼專案" in (action.skipped[0].error or "")


@pytest.mark.parametrize(
    ("relative_path", "risk_flag"),
    [
        (Path("installed-app") / "runtime.dll", "application"),
        (Path("Backup") / "archive.bin", "backup"),
        (Path("OneDrive") / "synced-copy.bin", "sync"),
    ],
)
def test_application_backup_and_sync_contexts_are_locked_by_default(
    tmp_path: Path, relative_path: Path, risk_flag: str
) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    target_path = clean / relative_path
    target_path.parent.mkdir(parents=True)
    content = b"r" * (1024 * 1024)
    (keep / "trusted-original.bin").write_bytes(content)
    target_path.write_bytes(content)

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    target = next(
        record for record in report.groups[0].records if record.root_role == "clean"
    )

    assert getattr(target.safety_context, risk_flag)
    assert target.safety_context.locked_folder == str(target_path.parent)
    assert not target.selectable
    assert not target.auto_selectable
    assert default_selection(report.groups) == set()


def test_cloud_placeholder_is_skipped_without_hashing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    keeper = keep / "keeper.bin"
    placeholder = clean / "online-only.bin"
    keeper.write_bytes(b"remote")
    placeholder.write_bytes(b"remote")
    monkeypatch.setattr(
        "dupespace.local.is_cloud_placeholder", lambda path: Path(path) == placeholder
    )

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)

    assert report.groups == ()
    assert report.hashed_files == 0
    assert report.skipped_files >= 1


def test_all_keep_root_copies_are_unselectable(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    content = b"k" * (1024 * 1024)
    (keep / "first.bin").write_bytes(content)
    (keep / "second.bin").write_bytes(content)
    (clean / "copy.bin").write_bytes(content)
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    keep_record = next(
        record
        for record in report.groups[0].records
        if record.root_role == "keep" and record.key != report.groups[0].keeper_key
    )

    with pytest.raises(ValueError):
        validate_selection(report.groups, {keep_record.key})
