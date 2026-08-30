from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from dupespace.desktop.state import validate_roots
from dupespace.grouping import (
    default_selection,
    operation_items,
    validate_selection,
)
from dupespace.local import (
    LocalPermanentDeleteExecutor,
    LocalScanner,
    LocalTrashExecutor,
    _creation_time,
)
from dupespace.models import ScanRoot
from dupespace.windows_safety import UnsafePathError, WindowsSafetyPolicy

TEST_POLICY = WindowsSafetyPolicy([])


@pytest.mark.parametrize(
    ("platform", "birth_time", "expected"),
    [("nt", None, 200), ("posix", None, None), ("nt", 100, 100),
     ("posix", 100, 100), ("posix", 0, 0)],
)
def test_creation_time_never_uses_posix_metadata_change_time(
    platform, birth_time, expected, monkeypatch
) -> None:
    metadata = SimpleNamespace(st_ctime=200)
    if birth_time is not None:
        metadata.st_birthtime = birth_time
    with monkeypatch.context() as patch:
        patch.setattr("dupespace.local.os.name", platform)
        actual = _creation_time(metadata)
    assert actual == expected


def scan_roots(tmp_path: Path) -> tuple[Path, Path, list[ScanRoot]]:
    clean = tmp_path / "clean"
    keep = clean / "protected"
    keep.mkdir(parents=True)
    return keep, clean, [ScanRoot(str(keep), "keep"), ScanRoot(str(clean), "clean")]


def test_cleanup_root_is_sufficient_and_protection_must_be_nested(tmp_path: Path) -> None:
    clean = tmp_path / "photos"
    protected = clean / "originals"
    outside = tmp_path / "outside"
    protected.mkdir(parents=True)
    outside.mkdir()

    roots = validate_roots((ScanRoot(str(clean), "clean"),), TEST_POLICY)
    assert roots == (ScanRoot(str(clean.resolve()), "clean"),)
    nested = validate_roots(
        (ScanRoot(str(clean), "clean"), ScanRoot(str(protected), "keep")), TEST_POLICY
    )
    assert {root.role for root in nested} == {"clean", "keep"}
    with pytest.raises(ValueError, match="保護資料夾必須"):
        validate_roots(
            (ScanRoot(str(clean), "clean"), ScanRoot(str(outside), "keep")), TEST_POLICY
        )


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


@pytest.mark.parametrize("has_birth_time", [True, False])
def test_single_cleanup_root_keeps_oldest_copy_without_required_keep_zone(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, has_birth_time: bool
) -> None:
    root = tmp_path / "photos"
    root.mkdir()
    older = root / "original.jpg"
    newer = root / "copy.jpg"
    payload = b"same-image" * 200_000
    older.write_bytes(payload)
    newer.write_bytes(payload)
    os.utime(older, (1_700_000_000, 1_700_000_000))
    os.utime(newer, (1_710_000_000, 1_710_000_000))
    # os.utime does not set Windows creation time; both writes can share one clock tick.
    # Exercise explicit creation times and the modification-time fallback deterministically.
    monkeypatch.setattr(
        "dupespace.local._creation_time",
        lambda metadata: metadata.st_mtime if has_birth_time else None,
    )
    monkeypatch.setattr("dupespace.local.MINIMUM_AUTO_SELECT_BYTES", 1)

    report = LocalScanner(safety_policy=TEST_POLICY).scan([ScanRoot(str(root), "clean")])

    assert report.examined_files == 2
    assert len(report.groups) == 1
    assert report.groups[0].keeper.location == str(older)
    assert default_selection(report.groups) == {f"local:{newer}"}


def test_nested_protected_folder_participates_as_keeper_and_is_not_scanned_twice(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "photos"
    protected = root / "originals"
    copies = root / "imports"
    protected.mkdir(parents=True)
    copies.mkdir()
    payload = b"same-image" * 200_000
    original = protected / "photo.jpg"
    duplicate = copies / "photo-copy.jpg"
    original.write_bytes(payload)
    duplicate.write_bytes(payload)
    monkeypatch.setattr("dupespace.local.MINIMUM_AUTO_SELECT_BYTES", 1)

    report = LocalScanner(safety_policy=TEST_POLICY).scan(
        [ScanRoot(str(root), "clean"), ScanRoot(str(protected), "keep")]
    )

    assert report.examined_files == 2
    group = next(group for group in report.groups if group.records[0].item_kind == "file")
    assert group.keeper.location == str(original)
    assert default_selection(report.groups) == {f"local:{duplicate}"}


def test_protected_folder_can_anchor_an_exact_duplicate_folder_group(tmp_path: Path) -> None:
    root = tmp_path / "photos"
    protected = root / "original-album"
    duplicate = root / "album-copy"
    protected.mkdir(parents=True)
    duplicate.mkdir()
    payload = b"p" * (1024 * 1024)
    (protected / "photo.jpg").write_bytes(payload)
    (duplicate / "photo.jpg").write_bytes(payload)

    report = LocalScanner(safety_policy=TEST_POLICY).scan(
        [ScanRoot(str(root), "clean"), ScanRoot(str(protected), "keep")]
    )

    group = next(group for group in report.groups if group.records[0].item_kind == "folder")
    assert group.keeper.location == str(protected)
    assert default_selection((group,)) == {f"local:{duplicate}"}


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
    assert report.examined_bytes == len(b"payload") * 2


def test_scan_cancels_during_folder_stage(tmp_path, monkeypatch):
    import threading

    from dupespace.local import ScanCancelled

    keep, clean, roots = scan_roots(tmp_path)
    for root in (keep, clean):
        (root / "album").mkdir()
        (root / "album" / "photo.bin").write_bytes(b"image")
    cancel = threading.Event()

    def progress(update):
        if update.stage == "folders":
            cancel.set()

    with pytest.raises(ScanCancelled):
        LocalScanner(safety_policy=TEST_POLICY).scan(roots, progress=progress, cancel_event=cancel)


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
    selected = {record.key for record in report.groups[0].records if record.root_role == "clean"}
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
    selected = {record.key for record in report.groups[0].records if record.root_role == "clean"}
    target = next(record for record in report.groups[0].records if record.key in selected)
    target_path = Path(target.location)
    original_mtime = target_path.stat().st_mtime_ns
    target_path.write_bytes(b"DIFFERENT")
    os.utime(target_path, ns=(original_mtime, original_mtime))

    action = LocalPermanentDeleteExecutor(
        unlink_func=lambda _path: None, safety_policy=TEST_POLICY
    ).delete(operation_items(report.groups, selected, "permanent"))

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

    assert len(report.groups) == 2
    assert any(
        {record.name for record in group.records} == {"small.bin", "small-copy.bin"}
        for group in report.groups
    )
    assert any(
        {record.name for record in group.records} == {"only-one.bin", "only-two.bin"}
        for group in report.groups
    )
    assert len(default_selection(report.groups)) == 2
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
    target = next(record for record in report.groups[0].records if record.root_role == "clean")

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


def test_identical_folder_trees_are_recycle_bin_candidates(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    original = keep / "photos-original"
    duplicate = clean / "photos-copy"
    for folder in (original, duplicate):
        (folder / "album").mkdir(parents=True)
        (folder / "album" / "image.bin").write_bytes(b"p" * (1024 * 1024))
        (folder / "notes.txt").write_text("same", encoding="utf-8")

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    folder_group = next(group for group in report.groups if group.records[0].item_kind == "folder")
    target = next(record for record in folder_group.records if record.root_role == "clean")

    assert target.entry_count == 2
    assert target.can_trash
    assert not target.can_delete
    assert target.key in default_selection(report.groups)
    moved: list[str] = []
    action = LocalTrashExecutor(trash_func=moved.append, safety_policy=TEST_POLICY).trash(
        operation_items(report.groups, {target.key})
    )
    assert len(action.trashed) == 1
    assert moved == [str(duplicate)]


def test_one_different_folder_file_prevents_folder_match(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    original = keep / "album"
    duplicate = clean / "album-copy"
    original.mkdir()
    duplicate.mkdir()
    (original / "photo.jpg").write_bytes(b"original")
    (duplicate / "photo.jpg").write_bytes(b"different")

    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)

    assert all(group.records[0].item_kind == "file" for group in report.groups)


def test_system_metadata_is_strict_by_default_and_optional_with_warning(
    tmp_path: Path,
) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    original = keep / "album"
    duplicate = clean / "album-copy"
    original.mkdir()
    duplicate.mkdir()
    payload = b"p" * (1024 * 1024)
    (original / "photo.jpg").write_bytes(payload)
    (duplicate / "photo.jpg").write_bytes(payload)
    (original / ".DS_Store").write_bytes(b"one")
    (duplicate / ".DS_Store").write_bytes(b"two")

    strict = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    relaxed = LocalScanner(safety_policy=TEST_POLICY).scan(roots, ignore_system_metadata=True)

    assert not any(group.records[0].item_kind == "folder" for group in strict.groups)
    folder_group = next(group for group in relaxed.groups if group.records[0].item_kind == "folder")
    assert all(record.ignored_metadata_count == 1 for record in folder_group.records)
    assert any("系統暫存中繼資料" in warning for warning in relaxed.warnings)


def test_folder_toctou_change_cancels_recycle_bin_move(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    original = keep / "album"
    duplicate = clean / "album-copy"
    original.mkdir()
    duplicate.mkdir()
    payload = b"p" * (1024 * 1024)
    (original / "photo.jpg").write_bytes(payload)
    (duplicate / "photo.jpg").write_bytes(payload)
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    group = next(group for group in report.groups if group.records[0].item_kind == "folder")
    target = next(record for record in group.records if record.root_role == "clean")
    (duplicate / "new.txt").write_text("changed after scan", encoding="utf-8")
    moved: list[str] = []

    action = LocalTrashExecutor(trash_func=moved.append, safety_policy=TEST_POLICY).trash(
        operation_items(report.groups, {target.key})
    )

    assert moved == []
    assert len(action.skipped) == 1
    assert "資料夾內容已變更" in (action.skipped[0].error or "")


def test_folder_toctou_same_size_edit_with_preserved_time_cancels(tmp_path: Path) -> None:
    clean = tmp_path / "clean"
    keep = clean / "protected"
    keep.mkdir(parents=True)
    original, duplicate = keep / "Original", clean / "Copy"
    original.mkdir()
    duplicate.mkdir()
    (original / "data.bin").write_bytes(b"A" * (1024 * 1024))
    target_file = duplicate / "data.bin"
    target_file.write_bytes(b"A" * (1024 * 1024))
    report = LocalScanner(safety_policy=WindowsSafetyPolicy(protected_roots=())).scan(
        (ScanRoot(str(keep), "keep"), ScanRoot(str(clean), "clean"))
    )
    group = next(group for group in report.groups if group.records[0].item_kind == "folder")
    target = next(record for record in group.records if record.root_role == "clean")
    before = target_file.stat()
    target_file.write_bytes(b"B" * before.st_size)
    os.utime(target_file, ns=(before.st_atime_ns, before.st_mtime_ns))

    moved: list[str] = []
    action = LocalTrashExecutor(
        trash_func=moved.append,
        safety_policy=WindowsSafetyPolicy(protected_roots=()),
    ).trash(operation_items(report.groups, {target.key}))

    assert moved == []
    assert action.trashed == ()
    assert "資料夾內容已變更" in (action.skipped[0].error or "")


def test_folder_can_never_be_selected_for_permanent_delete(tmp_path: Path) -> None:
    keep, clean, roots = scan_roots(tmp_path)
    original = keep / "album"
    duplicate = clean / "album-copy"
    original.mkdir()
    duplicate.mkdir()
    payload = b"p" * (1024 * 1024)
    (original / "photo.jpg").write_bytes(payload)
    (duplicate / "photo.jpg").write_bytes(payload)
    report = LocalScanner(safety_policy=TEST_POLICY).scan(roots)
    group = next(group for group in report.groups if group.records[0].item_kind == "folder")
    target = next(record for record in group.records if record.root_role == "clean")

    with pytest.raises(ValueError):
        operation_items(report.groups, {target.key}, "permanent")
