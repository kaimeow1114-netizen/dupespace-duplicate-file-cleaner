from __future__ import annotations

import os

import pytest


@pytest.mark.skipif(os.name != "nt", reason="Windows Shell API")
def test_windows_shell_returns_real_bounded_thumbnail(tmp_path, monkeypatch):
    from PySide6.QtGui import QColor, QImage

    from dupespace.desktop.shell_thumbnail import _extract
    from dupespace.windows_safety import WindowsSafetyPolicy

    monkeypatch.setattr(
        "dupespace.windows_safety.DEFAULT_WINDOWS_SAFETY_POLICY", WindowsSafetyPolicy([])
    )
    path = tmp_path / "thumbnail-fixture.jpg"
    picture = QImage(640, 400, QImage.Format.Format_RGB32)
    picture.fill(QColor("#14B8A6"))
    assert picture.save(str(path))
    data = _extract(str(path))
    assert data is not None
    width, height = int.from_bytes(data[:4], "little"), int.from_bytes(data[4:8], "little")
    assert 0 < width <= 320 and 0 < height <= 200
    assert len(data) == width * height * 4 + 8


def test_native_media_preview_does_not_use_video_playback():
    from dupespace.desktop.review import SHELL_SUFFIXES

    assert {".mp4", ".mov", ".psd", ".heic"} <= SHELL_SUFFIXES


def test_cloud_thumbnail_never_accepts_other_origins_or_local_paths():
    from dupespace.desktop.cloud_thumbnail import allowed_url, read_thumbnail

    assert allowed_url("https://lh3.googleusercontent.com/fixture=s220")
    for value in (
        None,
        "file:///C:/private.png",
        "http://lh3.googleusercontent.com/x",
        "https://evil.test/x",
        "https://user:secret@drive.google.com/x",
        "https://lh3.googleusercontent.com:123/x",
    ):
        assert not allowed_url(value)
        assert read_thumbnail(value).isNull()
