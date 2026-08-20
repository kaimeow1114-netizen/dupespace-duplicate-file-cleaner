from __future__ import annotations

import os
from pathlib import Path

import pytest

from dupespace import windows_safety
from dupespace.local import LocalScanner
from dupespace.models import ScanRoot
from dupespace.windows_safety import UnsafePathError, WindowsSafetyPolicy


def test_protected_folder_and_child_cannot_be_scanned(tmp_path: Path) -> None:
    protected = tmp_path / "Windows"
    child = protected / "System32" / "drivers"
    child.mkdir(parents=True)
    policy = WindowsSafetyPolicy([protected])

    with pytest.raises(UnsafePathError):
        LocalScanner(safety_policy=policy).scan([ScanRoot(str(child), "keep")])


def test_case_and_dotdot_cannot_bypass_protected_folder(tmp_path: Path) -> None:
    protected = tmp_path / "Protected"
    child = protected / "Child"
    child.mkdir(parents=True)
    policy = WindowsSafetyPolicy([protected])
    bypass = child / ".." / "Child"

    assert policy.is_protected(bypass)
    if os.name == "nt":
        assert policy.is_protected(Path(str(protected).upper()) / "Child")


def test_symlink_or_junction_cannot_bypass_protection(tmp_path: Path) -> None:
    protected = tmp_path / "protected"
    protected.mkdir()
    link = tmp_path / "link"
    try:
        link.symlink_to(protected, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"symlink unavailable: {error}")
    policy = WindowsSafetyPolicy([protected])

    with pytest.raises(UnsafePathError):
        policy.validate_scan_root(link)


def test_short_path_alias_is_expanded_before_protection_check(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Create the simulated alias first. On Windows volumes with 8.3 names enabled,
    # creating the long directory first can make PROTEC~1 an existing system alias.
    alias = tmp_path / "DUPEQA~1"
    alias.mkdir()
    protected = tmp_path / "Protected Program Files"
    protected.mkdir()

    def expand(path: Path) -> Path:
        return protected if path.name == alias.name else path

    monkeypatch.setattr(windows_safety, "_expand_windows_long_path", expand)
    policy = WindowsSafetyPolicy([protected])

    with pytest.raises(UnsafePathError):
        policy.validate_scan_root(alias)


def test_reparse_point_attribute_is_rejected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = tmp_path / "duplicate.bin"
    candidate.write_bytes(b"duplicate")
    monkeypatch.setattr(
        windows_safety,
        "_attributes",
        lambda path: 0x400 if path == candidate else 0,
    )

    with pytest.raises(UnsafePathError):
        WindowsSafetyPolicy([]).validate_regular_file(candidate)
