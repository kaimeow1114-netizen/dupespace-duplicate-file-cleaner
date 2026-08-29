from __future__ import annotations

import json

from dupespace.diagnostics import append_diagnostic_event, safe_error_message


def test_diagnostic_log_strips_oauth_query_and_never_raises(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    error = RuntimeError(
        "OAuth failed at https://accounts.google.com/o/oauth2/auth?code=private&token=secret"
    )

    append_diagnostic_event("oauth_failed", error)

    target = tmp_path / "DupeSpace" / "desktop-events.jsonl"
    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["event"] == "oauth_failed"
    assert "private" not in payload["message"]
    assert "secret" not in payload["message"]
    assert safe_error_message(error).endswith("/auth")


def test_diagnostic_message_redacts_inline_oauth_secrets() -> None:
    error = RuntimeError(
        "refresh_token=refresh-secret client_secret:client-secret "
        "Authorization Bearer access-secret"
    )

    message = safe_error_message(error)

    assert "refresh-secret" not in message
    assert "client-secret" not in message
    assert "access-secret" not in message
    assert "refresh_token=[redacted]" in message
    assert "client_secret=[redacted]" in message
    assert "Bearer [redacted]" in message
