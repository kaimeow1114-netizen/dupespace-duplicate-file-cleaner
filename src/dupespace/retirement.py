"""Revoke legacy grants without importing an OAuth client or renewing access."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from .token_store import clear_tokens, load_protected_token


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def revoke_legacy_tokens() -> bool:
    """Explicit disconnect only; never called on startup or before a local scan.

    Keep local encrypted credentials on network failure so revocation can be retried.
    A 400 invalid_token response means the grant no longer needs revocation.
    """
    saved = load_protected_token()
    if not saved:
        return True
    data = json.loads(saved)
    if not isinstance(data, dict):
        return False
    token = data.get("refresh_token") or data.get("token")
    if not isinstance(token, str) or not token:
        return False
    request = urllib.request.Request(
        "https://oauth2.googleapis.com/revoke",
        data=urllib.parse.urlencode({"token": token}).encode("ascii"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.build_opener(_NoRedirect()).open(request, timeout=8) as response:
            if response.status != 200:
                return False
    except urllib.error.HTTPError as error:
        if error.code != 400:
            return False
        try:
            if json.loads(error.read(4096)).get("error") != "invalid_token":
                return False
        except (ValueError, AttributeError):
            return False
    except OSError:
        return False
    clear_tokens()
    return True
