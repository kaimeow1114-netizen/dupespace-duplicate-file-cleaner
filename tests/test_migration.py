from __future__ import annotations

import json
from pathlib import Path

import dupesweep
from dupespace.drive import default_token_path
from dupespace.migration import migrate_legacy_preferences


def test_legacy_preferences_migrate_but_oauth_token_does_not(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.delenv("APPDATA", raising=False)
    legacy = tmp_path / "DupeSweep"
    legacy.mkdir()
    settings = {"sound_muted": True, "sound_volume": 0.1}
    (legacy / "settings.json").write_text(json.dumps(settings), encoding="utf-8")
    (legacy / "token.json").write_text("legacy-secret-token", encoding="utf-8")

    destination = migrate_legacy_preferences()

    assert json.loads((destination / "settings.json").read_text(encoding="utf-8")) == settings
    assert not (destination / "token.json").exists()
    assert default_token_path() == tmp_path / "DupeSpace" / "token.json"
    assert (legacy / "token.json").read_text(encoding="utf-8") == "legacy-secret-token"


def test_legacy_package_is_read_only_migration_shim() -> None:
    assert hasattr(dupesweep, "migrate_legacy_preferences")
    assert not hasattr(dupesweep, "LocalScanner")
