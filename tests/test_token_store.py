from __future__ import annotations

import json
from pathlib import Path

from dupespace import token_store


def test_token_store_encrypts_and_round_trips_without_plaintext(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.setattr(
        token_store,
        "_dpapi_transform",
        lambda value, *, protect: value[::-1],
    )
    token_json = json.dumps({"refresh_token": "private-refresh-token"})

    target = token_store.save_protected_token(token_json)

    assert target.name == "oauth-token.dpapi"
    assert b"private-refresh-token" not in target.read_bytes()
    assert token_store.load_protected_token() == token_json


def test_legacy_plaintext_token_is_migrated_once(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.setattr(
        token_store,
        "_dpapi_transform",
        lambda value, *, protect: value[::-1],
    )
    legacy = token_store.legacy_token_path()
    legacy.parent.mkdir(parents=True)
    legacy.write_text(json.dumps({"token": "legacy"}), encoding="utf-8")

    loaded = token_store.load_protected_token()

    assert json.loads(loaded or "{}") == {"token": "legacy"}
    assert not legacy.exists()
    assert token_store.protected_token_path().exists()


def test_clear_tokens_preserves_reports(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    report = token_store.app_data_dir() / "reports" / "audit.csv"
    report.parent.mkdir(parents=True)
    report.write_text("audit", encoding="utf-8")
    token_store.protected_token_path().write_bytes(b"encrypted")

    token_store.clear_tokens()

    assert report.read_text(encoding="utf-8") == "audit"
    assert not token_store.protected_token_path().exists()
