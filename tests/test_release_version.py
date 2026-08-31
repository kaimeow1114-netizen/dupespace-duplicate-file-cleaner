from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_release_version_sources_match(monkeypatch) -> None:
    monkeypatch.delenv("GITHUB_REF_TYPE", raising=False)
    monkeypatch.delenv("GITHUB_REF_NAME", raising=False)
    module = runpy.run_path(str(ROOT / "scripts/check_release_version.py"))
    assert module["main"]() == 0


def test_release_tag_must_match_application_version(monkeypatch) -> None:
    monkeypatch.setenv("GITHUB_REF_TYPE", "tag")
    monkeypatch.setenv("GITHUB_REF_NAME", "v0.0.0")
    module = runpy.run_path(str(ROOT / "scripts/check_release_version.py"))
    assert module["main"]() == 1
