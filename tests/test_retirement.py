from __future__ import annotations

import io
import threading
import urllib.error
from dataclasses import replace

import pytest

from dupespace import retirement
from dupespace.desktop.operations import run_cleanup
from dupespace.models import FileRecord, OperationItem


@pytest.mark.parametrize("mode", ["trash", "permanent"])
def test_cloud_cleanup_is_rejected_before_journaling_or_mutation(tmp_path, mode):
    keeper = FileRecord("keep", "drive", "a.jpg", "cloud/a.jpg", 20, "hash")
    item = OperationItem(replace(keeper, key="copy"), keeper)
    with pytest.raises(ValueError, match="只接受本機"):
        run_cleanup(
            (item,),
            mode,
            service=object(),
            directory=tmp_path,
            cancel_event=threading.Event(),
            progress=lambda _: None,
        )
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "outcome,cleared", [(200, True), (400, True), (503, False), (302, False), ("timeout", False)]
)
def test_explicit_revocation_never_refreshes_tokens_or_follows_redirects(
    monkeypatch, outcome, cleared
):
    removals = []
    monkeypatch.setattr(
        retirement, "load_protected_token", lambda: '{"refresh_token":"synthetic-only"}'
    )
    monkeypatch.setattr(retirement, "clear_tokens", lambda: removals.append(True))

    class Opener:
        def open(self, request, timeout):
            assert request.full_url == "https://oauth2.googleapis.com/revoke"
            assert request.get_method() == "POST"
            assert timeout == 8
            if outcome == "timeout":
                raise TimeoutError()
            if outcome != 200:
                raise urllib.error.HTTPError(
                    request.full_url, outcome, "test", {}, io.BytesIO(b'{"error":"invalid_token"}')
                )
            return self

        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def opener(handler):
        assert handler.redirect_request(None, None, 302, "", {}, "https://example.test") is None
        return Opener()

    monkeypatch.setattr(retirement.urllib.request, "build_opener", opener)
    assert retirement.revoke_legacy_tokens() is cleared
    assert bool(removals) is cleared


def test_no_saved_grant_requires_no_network(monkeypatch):
    monkeypatch.setattr(retirement, "load_protected_token", lambda: None)
    monkeypatch.setattr(
        retirement.urllib.request, "build_opener", lambda *_: pytest.fail("network")
    )
    assert retirement.revoke_legacy_tokens()
