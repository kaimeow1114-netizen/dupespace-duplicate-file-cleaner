from __future__ import annotations

import os
from pathlib import Path

import pytest

from dupespace.grouping import operation_items
from dupespace.local import LocalPermanentDeleteExecutor, LocalScanner, LocalTrashExecutor
from dupespace.models import ScanRoot
from dupespace.windows_safety import WindowsSafetyPolicy


@pytest.mark.skipif(
    os.name != "nt" or os.getenv("DUPESPACE_RECYCLE_QA") != "1",
    reason="Opt-in Windows Recycle Bin integration on isolated CI fixtures",
)
def test_real_recycle_bin_and_permanent_delete_use_only_generated_files(tmp_path: Path):
    clean = tmp_path / "clean"
    keep = clean / "protected"
    keep.mkdir(parents=True)
    original = keep / "dupespace-qa-original.bin"
    outside_original = clean / "dupespace-qa-outside-original.bin"
    reversible = clean / "dupespace-qa-trash-copy.bin"
    permanent = clean / "dupespace-qa-permanent-copy.bin"
    for path in (original, outside_original, reversible, permanent):
        path.write_bytes(b"DUPESPACE generated integration fixture, not user data")
    policy = WindowsSafetyPolicy([])
    scanner = LocalScanner(safety_policy=policy)
    roots = (ScanRoot(str(keep), "keep"), ScanRoot(str(clean), "clean"))
    scan = scanner.scan(roots)
    group = scan.groups[0]
    outside_keeper = Path(group.keeper.location)
    assert outside_keeper.parent == clean
    targets = [r for r in group.records if r.root_role == "clean" and r.key != group.keeper_key]
    assert len(targets) == 2
    target = targets[0]
    reversible, permanent = Path(target.location), Path(targets[1].location)
    action = LocalTrashExecutor(safety_policy=policy).trash(
        operation_items(scan.groups, {target.key})
    )
    assert len(action.trashed) == 1, action.outcomes
    assert original.is_file() and outside_keeper.is_file() and not reversible.exists()
    scan = scanner.scan(roots)
    target = next(
        record
        for group in scan.groups
        for record in group.records
        if record.location == str(permanent)
    )
    action = LocalPermanentDeleteExecutor(safety_policy=policy).delete(
        operation_items(scan.groups, {target.key}, "permanent")
    )
    assert len(action.deleted) == 1, action.outcomes
    assert original.is_file() and outside_keeper.is_file() and not permanent.exists()
