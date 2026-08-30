"""Read Google's existing thumbnail URL directly on the user's computer."""

from __future__ import annotations

import urllib.parse
import urllib.request

MAX_DOWNLOAD = 1024 * 1024


def allowed_url(value):
    try:
        url = urllib.parse.urlsplit(value or "")
        host = (url.hostname or "").lower()
        return (
            url.scheme == "https"
            and not url.username
            and not url.password
            and url.port in (None, 443)
            and (
                host == "googleusercontent.com"
                or host.endswith(".googleusercontent.com")
                or host == "drive.google.com"
            )
        )
    except ValueError:
        return False


class GoogleRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        if not allowed_url(newurl):
            raise ValueError("Thumbnail redirect was not a Google image URL")
        return super().redirect_request(request, fp, code, message, headers, newurl)


def read_thumbnail(url):
    from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QSize, Qt
    from PySide6.QtGui import QImage, QImageReader

    if not allowed_url(url):
        return QImage()
    request = urllib.request.Request(url, headers={"Accept": "image/*"})
    with urllib.request.build_opener(GoogleRedirects()).open(request, timeout=5) as response:
        if not response.headers.get("Content-Type", "").lower().startswith("image/"):
            return QImage()
        payload = response.read(MAX_DOWNLOAD + 1)
    if len(payload) > MAX_DOWNLOAD:
        return QImage()
    buffer = QBuffer()
    buffer.setData(QByteArray(payload))
    buffer.open(QIODevice.OpenModeFlag.ReadOnly)
    reader = QImageReader(buffer)
    reader.setAllocationLimit(32)
    reader.setAutoTransform(True)
    size = reader.size()
    if not size.isValid() or size.width() * size.height() > 4_000_000:
        return QImage()
    reader.setScaledSize(size.scaled(QSize(320, 200), Qt.AspectRatioMode.KeepAspectRatio))
    return reader.read()
