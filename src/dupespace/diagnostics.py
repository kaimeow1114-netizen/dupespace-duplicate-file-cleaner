from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from .paths import app_data_dir

MAX_LOG_BYTES = 2 * 1024 * 1024
_URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
_SENSITIVE_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(access_token|refresh_token|id_token|client_secret|code|token)\s*[:=]\s*"
    r"([^\s,;&]+)"
)
_BEARER_PATTERN = re.compile(r"(?i)\bbearer\s+[^\s,;&]+")


def safe_error_message(error: BaseException) -> str:
    """Keep useful context while removing URL queries that may contain OAuth data."""

    message = str(error).replace("\r", " ").replace("\n", " ")[:1200]

    def strip_query(match: re.Match[str]) -> str:
        return match.group(0).split("?", 1)[0]

    message = _URL_PATTERN.sub(strip_query, message)
    message = _SENSITIVE_ASSIGNMENT_PATTERN.sub(r"\1=[redacted]", message)
    return _BEARER_PATTERN.sub("Bearer [redacted]", message)


def append_diagnostic_event(event: str, error: BaseException) -> None:
    """Write a small local-only diagnostic event. Never record tokens or file contents."""

    try:
        target = app_data_dir() / "desktop-events.jsonl"
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.stat().st_size > MAX_LOG_BYTES:
            rotated = target.with_suffix(".previous.jsonl")
            target.replace(rotated)
        payload = {
            "time": datetime.now(timezone.utc).isoformat(),
            "event": event[:80],
            "error_type": type(error).__name__,
            "message": safe_error_message(error),
        }
        with target.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except OSError:
        pass
