from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .paths import app_data_dir

REPOSITORY = "kaimeow1114-netizen/dupespace-duplicate-file-cleaner"
LATEST_RELEASE_API = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
INSTALLER_NAME = "DupeSpace-Setup.exe"
CHECKSUMS_NAME = "SHA256SUMS.txt"
MAX_RELEASE_RESPONSE = 512 * 1024
MAX_CHECKSUM_RESPONSE = 64 * 1024
MAX_INSTALLER_SIZE = 250 * 1024 * 1024
REPARSE_POINT = 0x400
ALLOWED_DOWNLOAD_HOSTS = {
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
}


class UpdateError(RuntimeError):
    """An update could not be proven safe enough to install."""


@dataclass(frozen=True)
class ReleaseInfo:
    version: str
    tag: str
    installer_url: str
    checksums_url: str
    release_url: str
    installer_size: int


@dataclass(frozen=True)
class VerifiedInstaller:
    path: Path
    version: str
    sha256: str
    size: int


def _version(value: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", value.strip())
    if not match:
        raise UpdateError("Release version is not a stable semantic version.")
    return tuple(int(part) for part in match.groups())  # type: ignore[return-value]


def _request(url: str, *, accept: str) -> Request:
    return Request(
        url,
        headers={
            "Accept": accept,
            "User-Agent": "DUPESPACE-Desktop-Updater",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )


def _open(
    opener: Callable[..., Any],
    request: Request,
    *,
    timeout: float,
    allowed_hosts: set[str],
):
    response = opener(request, timeout=timeout)
    final_url = getattr(response, "geturl", lambda: request.full_url)()
    parsed = urlparse(final_url)
    if parsed.scheme != "https" or parsed.hostname not in allowed_hosts:
        response.close()
        raise UpdateError("Update transport endpoint is not accepted.")
    return response


def _read_limited(response: BinaryIO, maximum: int) -> bytes:
    data = response.read(maximum + 1)
    if len(data) > maximum:
        raise UpdateError("Update response exceeded its safety limit.")
    return data


def _asset_url(asset: dict[str, Any], name: str) -> tuple[str, int]:
    url = str(asset.get("browser_download_url", ""))
    size = int(asset.get("size", 0) or 0)
    parsed = urlparse(url)
    prefix = f"/{REPOSITORY}/releases/download/"
    if (
        parsed.scheme != "https"
        or parsed.hostname != "github.com"
        or not parsed.path.startswith(prefix)
    ):
        raise UpdateError(f"{name} does not use the expected GitHub release URL.")
    if not parsed.path.endswith(f"/{name}"):
        raise UpdateError(f"{name} release asset has an unexpected filename.")
    return url, size


def check_for_update(
    current_version: str,
    *,
    opener: Callable[..., Any] = urlopen,
    timeout: float = 8.0,
) -> ReleaseInfo | None:
    with _open(
        opener,
        _request(LATEST_RELEASE_API, accept="application/vnd.github+json"),
        timeout=timeout,
        allowed_hosts={"api.github.com"},
    ) as response:
        payload = json.loads(_read_limited(response, MAX_RELEASE_RESPONSE))
    if not isinstance(payload, dict) or payload.get("draft") or payload.get("prerelease"):
        raise UpdateError("Latest GitHub release is not a stable public release.")
    tag = str(payload.get("tag_name", ""))
    latest = _version(tag)
    if latest <= _version(current_version):
        return None
    assets = payload.get("assets")
    if not isinstance(assets, list):
        raise UpdateError("Release assets are missing.")
    valid_assets = [item for item in assets if isinstance(item, dict)]
    named = {str(item.get("name")): item for item in valid_assets}
    if set((INSTALLER_NAME, CHECKSUMS_NAME)) - named.keys():
        raise UpdateError("Installer or SHA-256 checksum asset is missing.")
    for name in (INSTALLER_NAME, CHECKSUMS_NAME):
        if sum(item.get("name") == name for item in valid_assets) != 1:
            raise UpdateError(f"Release contains duplicate {name} assets.")
    installer_url, installer_size = _asset_url(named[INSTALLER_NAME], INSTALLER_NAME)
    checksums_url, checksum_size = _asset_url(named[CHECKSUMS_NAME], CHECKSUMS_NAME)
    if installer_size <= 0 or installer_size > MAX_INSTALLER_SIZE:
        raise UpdateError("Installer size is outside the accepted range.")
    if checksum_size <= 0 or checksum_size > MAX_CHECKSUM_RESPONSE:
        raise UpdateError("Checksum file size is outside the accepted range.")
    release_url = str(payload.get("html_url", ""))
    expected_release_prefix = f"https://github.com/{REPOSITORY}/releases/tag/"
    if not release_url.startswith(expected_release_prefix):
        raise UpdateError("Release page URL is unexpected.")
    return ReleaseInfo(
        version=".".join(str(part) for part in latest),
        tag=tag,
        installer_url=installer_url,
        checksums_url=checksums_url,
        release_url=release_url,
        installer_size=installer_size,
    )


def _checksum(text: str) -> str:
    matches = []
    for line in text.splitlines():
        match = re.fullmatch(rf"([0-9a-fA-F]{{64}})\s+\*?{re.escape(INSTALLER_NAME)}", line.strip())
        if match:
            matches.append(match.group(1).lower())
    if len(matches) != 1:
        raise UpdateError("Release checksum file does not contain one exact installer digest.")
    return matches[0]


def _is_reparse(path: Path) -> bool:
    try:
        info = path.lstat()
    except OSError as error:
        raise UpdateError("Update directory could not be inspected.") from error
    return path.is_symlink() or bool(getattr(info, "st_file_attributes", 0) & REPARSE_POINT)


def update_directory() -> Path:
    base = app_data_dir()
    if base.exists() and _is_reparse(base):
        raise UpdateError("Application data directory cannot be a link or reparse point.")
    base.mkdir(parents=True, exist_ok=True)
    folder = base / "updates"
    if folder.exists() and _is_reparse(folder):
        raise UpdateError("Update directory cannot be a link or reparse point.")
    folder.mkdir(mode=0o700, exist_ok=True)
    return folder


def download_update(
    release: ReleaseInfo,
    *,
    opener: Callable[..., Any] = urlopen,
    timeout: float = 20.0,
    progress: Callable[[int, int], None] | None = None,
) -> VerifiedInstaller:
    if _version(release.tag) != _version(release.version):
        raise UpdateError("Release version and tag do not match.")
    with _open(
        opener,
        _request(release.checksums_url, accept="text/plain"),
        timeout=timeout,
        allowed_hosts=ALLOWED_DOWNLOAD_HOSTS,
    ) as response:
        checksum_text = _read_limited(response, MAX_CHECKSUM_RESPONSE).decode("utf-8-sig")
    expected = _checksum(checksum_text)
    folder = update_directory()
    destination = folder / f"DupeSpace-{release.version}-Setup.exe"
    temporary = destination.with_suffix(".part")
    temporary.unlink(missing_ok=True)
    digest = hashlib.sha256()
    received = 0
    try:
        with _open(
            opener,
            _request(release.installer_url, accept="application/octet-stream"),
            timeout=timeout,
            allowed_hosts=ALLOWED_DOWNLOAD_HOSTS,
        ) as response, temporary.open("xb") as handle:
            while chunk := response.read(1024 * 1024):
                received += len(chunk)
                if received > MAX_INSTALLER_SIZE or received > release.installer_size + 1024:
                    raise UpdateError("Installer download exceeded the declared size.")
                handle.write(chunk)
                digest.update(chunk)
                if progress:
                    progress(received, release.installer_size)
            handle.flush()
            os.fsync(handle.fileno())
        if received != release.installer_size:
            raise UpdateError("Installer size did not match the GitHub release asset.")
        if not hmac.compare_digest(digest.hexdigest(), expected):
            raise UpdateError("Installer SHA-256 verification failed.")
        os.replace(temporary, destination)
        return VerifiedInstaller(destination, release.version, expected, received)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def verify_installer(installer: VerifiedInstaller) -> Path:
    """Revalidate the downloaded installer immediately before execution."""
    path = installer.path
    folder = update_directory()
    if path.parent != folder or path.name != f"DupeSpace-{installer.version}-Setup.exe":
        raise UpdateError("Verified installer path changed unexpectedly.")
    if not path.is_file() or _is_reparse(path) or path.stat().st_size != installer.size:
        raise UpdateError("Verified installer changed after download.")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    if not hmac.compare_digest(digest.hexdigest(), installer.sha256):
        raise UpdateError("Verified installer changed after download.")
    return path
