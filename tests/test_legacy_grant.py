from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from dupespace import legacy_grant


def test_reads_existing_protected_grant_without_creating_credentials(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    protected = legacy_grant.protected_grant_path()
    protected.parent.mkdir(parents=True)
    protected.write_bytes(b"synthetic-dpapi-payload")
    monkeypatch.setattr(
        legacy_grant,
        "_unprotect",
        lambda _: json.dumps({"refresh_token": "synthetic-only"}),
    )

    assert json.loads(legacy_grant.load_legacy_grant() or "{}") == {
        "refresh_token": "synthetic-only"
    }
    assert not hasattr(legacy_grant, "save_protected_token")
    assert not hasattr(legacy_grant, "protect_token")


def test_reads_legacy_plaintext_only_for_retirement(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    legacy = legacy_grant.plaintext_grant_path()
    legacy.parent.mkdir(parents=True)
    legacy.write_text(json.dumps({"token": "legacy"}), encoding="utf-8")
    monkeypatch.setattr(legacy_grant, "_protect", lambda _: b"synthetic-dpapi-payload")

    assert json.loads(legacy_grant.load_legacy_grant() or "{}") == {"token": "legacy"}
    assert not legacy.exists()
    assert legacy_grant.protected_grant_path().read_bytes() == b"synthetic-dpapi-payload"


def test_failed_protection_keeps_original_grant_for_manual_revocation(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    legacy = legacy_grant.plaintext_grant_path()
    legacy.parent.mkdir(parents=True)
    legacy.write_text('{"token":"legacy"}', encoding="utf-8")

    def fail_protection(_: str) -> bytes:
        raise legacy_grant.LegacyGrantError("DPAPI unavailable")

    monkeypatch.setattr(legacy_grant, "_protect", fail_protection)
    with pytest.raises(legacy_grant.LegacyGrantError, match="DPAPI unavailable"):
        legacy_grant.load_legacy_grant()
    assert legacy.read_text(encoding="utf-8") == '{"token":"legacy"}'
    assert not legacy_grant.protected_grant_path().exists()
    assert not list(legacy.parent.glob("oauth-retired-*.tmp"))


def test_matching_plaintext_is_removed_when_protected_grant_already_exists(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    protected = legacy_grant.protected_grant_path()
    protected.parent.mkdir(parents=True)
    protected.write_bytes(b"encrypted")
    legacy = legacy_grant.plaintext_grant_path()
    legacy.write_text('{"token":"legacy"}', encoding="utf-8")
    monkeypatch.setattr(legacy_grant, "_unprotect", lambda _: '{"token":"legacy"}')
    assert legacy_grant.load_legacy_grant() == '{"token":"legacy"}'
    assert not legacy.exists()


def test_conflicting_grants_are_not_silently_discarded(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    protected = legacy_grant.protected_grant_path()
    protected.parent.mkdir(parents=True)
    protected.write_bytes(b"encrypted")
    legacy = legacy_grant.plaintext_grant_path()
    legacy.write_text('{"token":"other"}', encoding="utf-8")
    monkeypatch.setattr(legacy_grant, "_unprotect", lambda _: '{"token":"legacy"}')
    with pytest.raises(legacy_grant.LegacyGrantError, match="兩份不同"):
        legacy_grant.load_legacy_grant()
    assert legacy.exists()
    assert protected.exists()


@pytest.mark.skipif(os.name != "nt", reason="DPAPI is available only on Windows")
def test_windows_dpapi_migrates_synthetic_grant(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    legacy = legacy_grant.plaintext_grant_path()
    legacy.parent.mkdir(parents=True)
    legacy.write_text('{"refresh_token":"synthetic-test-only"}', encoding="utf-8")

    assert json.loads(legacy_grant.load_legacy_grant() or "{}") == {
        "refresh_token": "synthetic-test-only"
    }
    assert not legacy.exists()
    assert legacy_grant.protected_grant_path().exists()
    assert json.loads(legacy_grant.load_legacy_grant() or "{}") == {
        "refresh_token": "synthetic-test-only"
    }


def test_clear_legacy_grant_preserves_reports(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    report = legacy_grant.app_data_dir() / "reports" / "audit.csv"
    report.parent.mkdir(parents=True)
    report.write_text("audit", encoding="utf-8")
    legacy_grant.protected_grant_path().write_bytes(b"encrypted")
    legacy_grant.plaintext_grant_path().write_text("{}", encoding="utf-8")

    legacy_grant.clear_legacy_grant()

    assert report.read_text(encoding="utf-8") == "audit"
    assert not legacy_grant.protected_grant_path().exists()
    assert not legacy_grant.plaintext_grant_path().exists()


def test_invalid_plaintext_grant_fails_closed(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    legacy = legacy_grant.plaintext_grant_path()
    legacy.parent.mkdir(parents=True)
    legacy.write_text("not-json", encoding="utf-8")

    with pytest.raises(legacy_grant.LegacyGrantError):
        legacy_grant.load_legacy_grant()


def test_non_object_plaintext_grant_fails_without_network_or_migration(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    legacy = legacy_grant.plaintext_grant_path()
    legacy.parent.mkdir(parents=True)
    legacy.write_text('["not-a-grant"]', encoding="utf-8")

    with pytest.raises(legacy_grant.LegacyGrantError, match="格式錯誤"):
        legacy_grant.load_legacy_grant()
    assert legacy.read_text(encoding="utf-8") == '["not-a-grant"]'
    assert not legacy_grant.protected_grant_path().exists()
