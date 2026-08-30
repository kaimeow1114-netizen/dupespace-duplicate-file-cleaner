import os
import threading
from dataclasses import replace
from pathlib import Path

import pytest

from dupespace.desktop.operations import run_cleanup
from dupespace.grouping import default_selection, operation_items
from dupespace.local import LocalScanner, LocalTrashExecutor
from dupespace.models import OperationItem, ScanRoot
from dupespace.windows_safety import WindowsSafetyPolicy

POLICY = WindowsSafetyPolicy([])


def fixture_scan(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    protected = root / "protected"
    protected.mkdir(parents=True)
    for index, path in enumerate(
        (protected / "image", root / "original", root / "copy1", root / "copy2")
    ):
        path.write_bytes(b"duplicate-image")
        os.utime(path, (1000 + index, 1000 + index))
    monkeypatch.setattr("dupespace.local._creation_time", lambda value: value.st_mtime)
    report = LocalScanner(safety_policy=POLICY).scan(
        (ScanRoot(str(root), "clean"), ScanRoot(str(protected), "keep"))
    )
    return root, protected, report


def test_protected_and_oldest_outside_survive_normal_one_item_batches(tmp_path, monkeypatch):
    root, protected, report = fixture_scan(tmp_path, monkeypatch)
    selected = default_selection(report.groups)
    assert selected == {f"local:{root / 'copy1'}", f"local:{root / 'copy2'}"}
    assert report.reclaimable_bytes == 2 * len(b"duplicate-image")
    moved = []
    result = run_cleanup(
        operation_items(report.groups, selected),
        "trash",
        cancel_event=threading.Event(),
        progress=lambda _: None,
        directory=tmp_path / "reports",
        local_executor=LocalTrashExecutor(trash_func=moved.append, safety_policy=POLICY),
    )
    assert len(result.report.trashed) == 2
    assert str(root / "original") not in moved
    assert not any(str(protected) in path for path in moved)
    with pytest.raises(ValueError):
        operation_items(report.groups, {report.groups[0].keeper_key})
    target = next(record for record in report.groups[0].records if record.key in selected)
    protected_record = next(
        record for record in report.groups[0].records if record.root_role == "keep"
    )
    with pytest.raises(ValueError, match="outside"):
        OperationItem(target, protected_record)
    for mode in ("trash", "permanent"):
        assert all(
            item.keeper.location == str(root / "original")
            for item in operation_items(report.groups, selected, mode)
        )


def test_folder_containing_protected_subfolder_never_becomes_target(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    for name in ("A", "B", "C"):
        folder = root / name / "private"
        folder.mkdir(parents=True)
        (folder / "photo.jpg").write_bytes(b"same")
    protected = root / "A" / "private"
    monkeypatch.setattr("dupespace.local._creation_time", lambda _: 1000)
    report = LocalScanner(safety_policy=POLICY).scan(
        (ScanRoot(str(root), "clean"), ScanRoot(str(protected / ".." / "private"), "keep"))
    )
    items = operation_items(report.groups, default_selection(report.groups))
    assert items
    for item in items:
        assert item.record.location not in {str(root / "A"), str(protected)}
        assert not protected.is_relative_to(Path(item.record.location))
        assert str(protected) in item.record.protected_paths


def test_folder_order_cannot_override_file_keeper(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    for name, file_time, folder_time in (("A", 1000, 4000), ("B", 2000, 3000)):
        folder = root / name
        folder.mkdir(parents=True)
        file = folder / "photo.jpg"
        file.write_bytes(b"same")
        os.utime(file, (file_time, file_time))
        os.utime(folder, (folder_time, folder_time))
    monkeypatch.setattr("dupespace.local._creation_time", lambda value: value.st_mtime)
    report = LocalScanner(safety_policy=POLICY).scan((ScanRoot(str(root), "clean"),))
    assert all(group.keeper.item_kind == "file" for group in report.groups)
    assert report.groups[0].keeper.location == str(root / "A" / "photo.jpg")
    assert default_selection(report.groups) == {f"local:{root / 'B' / 'photo.jpg'}"}


def test_direct_target_protection_checks_case_and_dot_alias(tmp_path, monkeypatch):
    root, _, report = fixture_scan(tmp_path, monkeypatch)
    item = operation_items(report.groups, default_selection(report.groups))[0]
    path = str(root / ".." / "photos")
    if os.name == "nt":
        path = path.upper()
    with pytest.raises(ValueError, match="protected path"):
        OperationItem(replace(item.record, protected_paths=(path,)), item.keeper)


def test_empty_file_keeper_is_not_hidden_by_folder_group(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    for name, empty_time, data_time, folder_time in (
        ("A", 1000, 4000, 6000),
        ("B", 3000, 2000, 5000),
    ):
        folder = root / name
        folder.mkdir(parents=True)
        for filename, payload, stamp in (
            ("empty.txt", b"", empty_time),
            ("data.txt", b"same", data_time),
        ):
            path = folder / filename
            path.write_bytes(payload)
            os.utime(path, (stamp, stamp))
        os.utime(folder, (folder_time, folder_time))
    monkeypatch.setattr("dupespace.local._creation_time", lambda value: value.st_mtime)
    report = LocalScanner(safety_policy=POLICY).scan((ScanRoot(str(root), "clean"),))
    assert report.groups
    assert all(group.keeper.item_kind == "file" for group in report.groups)
    assert all(
        item.record.size > 0
        for item in operation_items(report.groups, default_selection(report.groups))
    )


def test_hardlink_alias_does_not_allow_deleting_oldest_outside_folder(tmp_path, monkeypatch):
    root, other = tmp_path / "photos", tmp_path / "other"
    protected, older = root / "protected", other / "A"
    newer = root / "B"
    for folder in (protected, older, newer):
        folder.mkdir(parents=True)
    original = protected / "data"
    original.write_bytes(b"same")
    try:
        os.link(original, older / "data")
    except OSError as error:
        pytest.skip(str(error))
    (newer / "data").write_bytes(b"same")
    os.utime(original, (1000, 1000))
    os.utime(newer / "data", (2000, 2000))
    os.utime(newer, (3000, 3000))
    os.utime(older, (4000, 4000))
    monkeypatch.setattr("dupespace.local._creation_time", lambda value: value.st_mtime)
    report = LocalScanner(safety_policy=POLICY).scan(
        (
            ScanRoot(str(root), "clean"),
            ScanRoot(str(protected), "keep"),
            ScanRoot(str(other), "clean"),
        )
    )
    assert not any(group.keeper.item_kind == "folder" for group in report.groups)
    assert f"local:{older}" not in default_selection(report.groups)
