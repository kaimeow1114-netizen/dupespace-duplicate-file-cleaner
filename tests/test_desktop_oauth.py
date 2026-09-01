from __future__ import annotations

from typing import Any

from dupespace.desktop_oauth import _CompletionApp, branded_success_html


def test_branded_success_page_is_self_contained_and_clear() -> None:
    html = branded_success_html()

    assert "DUPESPACE" in html
    assert "Google Drive 已安全連線" in html
    assert "關閉這個分頁" in html
    assert "history.replaceState" in html
    assert "https://" not in html
    assert "http://" not in html
    assert "adsbygoogle" not in html


def test_completion_response_is_html_no_store_and_does_not_echo_oauth_code() -> None:
    app = _CompletionApp()
    response: dict[str, Any] = {}

    def start_response(status: str, headers: list[tuple[str, str]]) -> None:
        response["status"] = status
        response["headers"] = dict(headers)

    body = b"".join(
        app(
            {
                "wsgi.url_scheme": "http",
                "SERVER_NAME": "127.0.0.1",
                "SERVER_PORT": "49152",
                "SCRIPT_NAME": "",
                "PATH_INFO": "/",
                "QUERY_STRING": "code=secret-code&state=expected-state",
            },
            start_response,
        )
    ).decode("utf-8")

    assert response["status"] == "200 OK"
    assert response["headers"]["Content-Type"] == "text/html; charset=utf-8"
    assert response["headers"]["Cache-Control"] == "no-store"
    assert "default-src 'none'" in response["headers"]["Content-Security-Policy"]
    assert "secret-code" not in body
    assert app.last_request_uri == (
        "http://127.0.0.1:49152/?code=secret-code&state=expected-state"
    )
