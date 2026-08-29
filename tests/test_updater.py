from __future__ import annotations

import hashlib
import io
import json
from urllib.request import Request

import pytest

from dupespace.updater import (
    CHECKSUMS_NAME,
    INSTALLER_NAME,
    LATEST_RELEASE_API,
    ReleaseInfo,
    UpdateError,
    check_for_update,
    download_update,
    verify_installer,
)

RELEASE_ROOT = (
    "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases"
)


class Response(io.BytesIO):
    def __init__(self, data: bytes, url: str) -> None:
        super().__init__(data)
        self.url = url

    def geturl(self) -> str:
        return self.url

    def __enter__(self):
        return self

    def __exit__(self, *_args) -> None:
        self.close()


def release_payload(version: str, installer: bytes) -> dict:
    base = f"{RELEASE_ROOT}/download/v{version}"
    return {
        "tag_name": f"v{version}",
        "html_url": f"{RELEASE_ROOT}/tag/v{version}",
        "draft": False,
        "prerelease": False,
        "assets": [
            {
                "name": INSTALLER_NAME,
                "size": len(installer),
                "browser_download_url": f"{base}/{INSTALLER_NAME}",
            },
            {
                "name": CHECKSUMS_NAME,
                "size": 90,
                "browser_download_url": f"{base}/{CHECKSUMS_NAME}",
            },
        ],
    }


def test_newer_stable_release_is_recognized_and_same_version_is_ignored():
    installer = b"synthetic installer"
    payload = release_payload("1.1.0", installer)

    def opener(request: Request, **_kwargs):
        assert request.full_url == LATEST_RELEASE_API
        return Response(json.dumps(payload).encode(), request.full_url)

    update = check_for_update("1.0.1", opener=opener)
    assert update and update.version == "1.1.0"
    assert update.installer_size == len(installer)
    assert check_for_update("1.1.0", opener=opener) is None


@pytest.mark.parametrize("missing", [INSTALLER_NAME, CHECKSUMS_NAME])
def test_release_requires_both_exact_assets(missing):
    payload = release_payload("1.1.0", b"installer")
    payload["assets"] = [item for item in payload["assets"] if item["name"] != missing]

    def opener(request: Request, **_kwargs):
        return Response(json.dumps(payload).encode(), request.full_url)

    with pytest.raises(UpdateError, match="missing"):
        check_for_update("1.0.1", opener=opener)


def test_release_rejects_non_github_asset_transport():
    payload = release_payload("1.1.0", b"installer")
    payload["assets"][0]["browser_download_url"] = "http://example.test/DupeSpace-Setup.exe"

    def opener(request: Request, **_kwargs):
        return Response(json.dumps(payload).encode(), request.full_url)

    with pytest.raises(UpdateError, match="expected GitHub"):
        check_for_update("1.0.1", opener=opener)


def test_valid_download_is_streamed_and_sha256_verified(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    installer = b"signed release bytes" * 100
    payload = release_payload("1.1.0", installer)
    release = ReleaseInfo(
        "1.1.0",
        "v1.1.0",
        payload["assets"][0]["browser_download_url"],
        payload["assets"][1]["browser_download_url"],
        payload["html_url"],
        len(installer),
    )
    checksum = hashlib.sha256(installer).hexdigest()
    calls = []

    def opener(request: Request, **_kwargs):
        calls.append(request.full_url)
        if request.full_url.endswith(CHECKSUMS_NAME):
            return Response(f"{checksum}  {INSTALLER_NAME}\n".encode(), request.full_url)
        return Response(installer, request.full_url)

    progress = []
    verified = download_update(
        release,
        opener=opener,
        progress=lambda done, total: progress.append((done, total)),
    )
    assert verified.path.read_bytes() == installer
    assert verified.path.parent == tmp_path / "DupeSpace" / "updates"
    assert not verified.path.with_suffix(".part").exists()
    assert progress[-1] == (len(installer), len(installer))
    assert calls == [release.checksums_url, release.installer_url]
    assert verify_installer(verified) == verified.path
    verified.path.write_bytes(b"changed")
    with pytest.raises(UpdateError, match="changed"):
        verify_installer(verified)


def test_hash_mismatch_never_leaves_an_executable(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    installer = b"corrupt bytes"
    base = f"{RELEASE_ROOT}/download/v1.1.0"
    release = ReleaseInfo(
        "1.1.0",
        "v1.1.0",
        f"{base}/{INSTALLER_NAME}",
        f"{base}/{CHECKSUMS_NAME}",
        f"{RELEASE_ROOT}/tag/v1.1.0",
        len(installer),
    )

    def opener(request: Request, **_kwargs):
        if request.full_url.endswith(CHECKSUMS_NAME):
            return Response(f"{'0' * 64}  {INSTALLER_NAME}\n".encode(), request.full_url)
        return Response(installer, request.full_url)

    with pytest.raises(UpdateError, match="SHA-256"):
        download_update(release, opener=opener)
    assert list((tmp_path / "DupeSpace" / "updates").glob("*")) == []
