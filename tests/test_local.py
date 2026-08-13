from __future__ import annotations

import os
from pathlib import Path

import pytest

from dupesweep.grouping import default_selection
from dupesweep.local import LocalScanner, LocalTrashExecutor


def test_local_scan_hashes_content_not_just_name_or_size(tmp_path: Path) -> None:
    (tmp_path / "first.txt").write_bytes(b"same-content")
    (tmp_path / "renamed.bin").write_bytes(b"same-content")
    (tmp_path / "different.txt").write_bytes(b"other-value!")

    report = LocalScanner(chunk_size=4).scan([tmp_path])

    assert report.examined_files == 3
    assert len(report.groups) == 1
    assert {record.name for record in report.groups[0].records} == {
        "first.txt",
        "renamed.bin",
    }


def test_over_5000_duplicates_can_be_selected_without_losing_keeper(tmp_path: Path) -> None:
    for index in range(5001):
        (tmp_path / f"copy-{index:04d}.dat").write_bytes(b"x")

    report = LocalScanner().scan([tmp_path])
    selected = default_selection(report.groups)

    assert report.examined_files == 5001
    assert len(report.groups) == 1
    assert len(report.groups[0].records) == 5001
    assert len(selected) == 5000
    assert report.groups[0].keeper_key not in selected


def test_hard_link_identity_is_not_counted_twice(tmp_path: Path) -> None:
    original = tmp_path / "original.bin"
    hard_link = tmp_path / "hard-link.bin"
    duplicate = tmp_path / "real-copy.bin"
    original.write_bytes(b"payload")
    duplicate.write_bytes(b"payload")
    try:
        os.link(original, hard_link)
    except OSError as error:
        pytest.skip(f"hard links unavailable: {error}")

    report = LocalScanner().scan([tmp_path])

    assert len(report.groups) == 1
    assert len(report.groups[0].records) == 2
    assert report.skipped_files == 1


def test_local_trash_rechecks_metadata(tmp_path: Path) -> None:
    first = tmp_path / "first.bin"
    second = tmp_path / "second.bin"
    first.write_bytes(b"duplicate")
    second.write_bytes(b"duplicate")
    report = LocalScanner().scan([tmp_path])
    target = next(
        record
        for record in report.groups[0].records
        if record.key != report.groups[0].keeper_key
    )
    Path(target.location).write_bytes(b"something")

    moved: list[str] = []
    action = LocalTrashExecutor(trash_func=moved.append).trash([target])

    assert not action.trashed
    assert len(action.failed) == 1
    assert moved == []
    assert "changed" in (action.failed[0].error or "")


def test_local_trash_uses_injected_recycle_bin_function(tmp_path: Path) -> None:
    (tmp_path / "a.bin").write_bytes(b"duplicate")
    (tmp_path / "b.bin").write_bytes(b"duplicate")
    report = LocalScanner().scan([tmp_path])
    target = next(
        record
        for record in report.groups[0].records
        if record.key != report.groups[0].keeper_key
    )
    moved: list[str] = []

    action = LocalTrashExecutor(trash_func=moved.append).trash([target])

    assert len(action.trashed) == 1
    assert moved == [target.location]
