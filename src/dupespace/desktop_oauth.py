# ruff: noqa: E501 -- the self-contained HTML/CSS stays legible as browser source.

from __future__ import annotations

import base64
import hashlib
import socket
import webbrowser
import wsgiref.simple_server
import wsgiref.util
from importlib.resources import files
from typing import Any

_SUCCESS_SCRIPT = """history.replaceState(null, '', '/complete');
document.getElementById('close-page').addEventListener('click', () => window.close());"""
_SCRIPT_HASH = base64.b64encode(hashlib.sha256(_SUCCESS_SCRIPT.encode("utf-8")).digest()).decode(
    "ascii"
)


def branded_success_html() -> str:
    """Return a self-contained OAuth completion page with no remote dependencies."""

    icon = files("dupespace.assets").joinpath("dupespace-icon.png").read_bytes()
    icon_url = "data:image/png;base64," + base64.b64encode(icon).decode("ascii")
    return f"""<!doctype html>
<html lang="zh-Hant" translate="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>DUPESPACE｜Google Drive 已連線</title>
  <style>
    *{{box-sizing:border-box}}
    html,body{{min-height:100%;margin:0}}
    body{{display:grid;place-items:center;padding:24px;background:
      radial-gradient(circle at 20% 12%,rgba(20,184,166,.18),transparent 38%),
      radial-gradient(circle at 85% 85%,rgba(16,185,129,.12),transparent 35%),#f8fafc;
      color:#0f172a;font-family:"Segoe UI","Microsoft JhengHei UI",sans-serif}}
    main{{width:min(560px,100%);padding:42px;border:1px solid rgba(13,148,136,.18);
      border-radius:28px;background:rgba(255,255,255,.92);box-shadow:0 28px 80px rgba(15,23,42,.14);
      text-align:center;backdrop-filter:blur(18px)}}
    .brand{{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px;
      color:#0f766e;font-size:18px;font-weight:800;letter-spacing:.16em}}
    .brand img{{width:42px;height:42px;filter:drop-shadow(0 8px 16px rgba(13,148,136,.28))}}
    .check{{display:grid;place-items:center;width:74px;height:74px;margin:0 auto 22px;border-radius:24px;
      color:#fff;background:linear-gradient(135deg,#0d9488,#10b981);box-shadow:0 18px 38px rgba(13,148,136,.3)}}
    .check svg{{width:36px;height:36px;fill:none;stroke:currentColor;stroke-width:2.6;
      stroke-linecap:round;stroke-linejoin:round}}
    h1{{margin:0 0 12px;font-size:clamp(27px,5vw,38px);line-height:1.2;letter-spacing:-.035em}}
    p{{margin:0 auto;max-width:420px;color:#475569;font-size:17px;line-height:1.75}}
    .status{{display:flex;align-items:center;justify-content:center;gap:9px;margin:24px 0 28px;
      padding:13px 16px;border:1px solid #a7f3d0;border-radius:14px;background:#ecfdf5;color:#047857;
      font-weight:700}}
    .dot{{width:9px;height:9px;border-radius:999px;background:#10b981;box-shadow:0 0 0 6px rgba(16,185,129,.12)}}
    button{{min-height:48px;padding:0 25px;border:0;border-radius:14px;background:#0f766e;color:#fff;
      font:inherit;font-weight:750;cursor:pointer;box-shadow:0 12px 28px rgba(15,118,110,.22)}}
    button:hover{{background:#115e59;transform:translateY(-1px)}}
    button:focus-visible{{outline:3px solid rgba(20,184,166,.35);outline-offset:3px}}
    small{{display:block;margin-top:22px;color:#94a3b8;font-size:13px;line-height:1.6}}
    @media (prefers-reduced-motion:no-preference){{main{{animation:enter .45s cubic-bezier(.2,.8,.2,1)}}
      @keyframes enter{{from{{opacity:0;transform:translateY(14px) scale(.98)}}}}}}
  </style>
</head>
<body>
  <main>
    <div class="brand"><img src="{icon_url}" alt="DUPESPACE 圖示"><span>DUPESPACE</span></div>
    <div class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
    <h1>Google Drive 已安全連線</h1>
    <p>授權已完成。DUPESPACE 正在桌面應用程式中確認帳號並恢復你的清理工作區。</p>
    <div class="status"><span class="dot" aria-hidden="true"></span>可以回到 DUPESPACE 繼續操作</div>
    <button id="close-page" type="button">關閉這個分頁</button>
    <small>這個本機完成頁不會載入廣告、分析工具或外部內容。</small>
  </main>
  <script>{_SUCCESS_SCRIPT}</script>
</body>
</html>"""


class _ExclusiveWSGIServer(wsgiref.simple_server.WSGIServer):
    allow_reuse_address = False

    def server_bind(self) -> None:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class _CompletionApp:
    def __init__(self) -> None:
        self.last_request_uri: str | None = None

    def __call__(self, environ: dict[str, Any], start_response: Any) -> list[bytes]:
        self.last_request_uri = wsgiref.util.request_uri(environ)
        headers = [
            ("Content-Type", "text/html; charset=utf-8"),
            ("Cache-Control", "no-store"),
            ("Pragma", "no-cache"),
            ("Referrer-Policy", "no-referrer"),
            ("X-Content-Type-Options", "nosniff"),
            ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
            (
                "Content-Security-Policy",
                "default-src 'none'; img-src data:; style-src 'unsafe-inline'; "
                f"script-src 'sha256-{_SCRIPT_HASH}'; base-uri 'none'; form-action 'none'; "
                "frame-ancestors 'none'",
            ),
        ]
        start_response("200 OK", headers)
        return [branded_success_html().encode("utf-8")]


def run_branded_local_server(
    flow: Any,
    *,
    host: str = "127.0.0.1",
    port: int = 0,
    timeout_seconds: int = 180,
) -> Any:
    """Complete an InstalledAppFlow using an exclusive branded loopback page."""

    app = _CompletionApp()
    server = wsgiref.simple_server.make_server(
        host,
        port,
        app,
        server_class=_ExclusiveWSGIServer,
        handler_class=wsgiref.simple_server.WSGIRequestHandler,
    )
    try:
        flow.redirect_uri = f"http://{host}:{server.server_port}/"
        auth_url, _ = flow.authorization_url()
        webbrowser.open(auth_url, new=1, autoraise=True)
        server.timeout = timeout_seconds
        server.handle_request()
        if not app.last_request_uri:
            raise TimeoutError("Google OAuth 登入逾時，請重新連線。")
        flow.fetch_token(authorization_response=app.last_request_uri.replace("http", "https", 1))
        return flow.credentials
    finally:
        server.server_close()
