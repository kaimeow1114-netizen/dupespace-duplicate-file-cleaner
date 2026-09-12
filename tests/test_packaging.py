import re
from pathlib import Path


def test_installer_preserves_upgrade_app_id_and_uses_new_names() -> None:
    root = Path(__file__).resolve().parents[1]
    installer = (root / "packaging" / "dupespace.iss").read_text(encoding="utf-8")
    project = (root / "pyproject.toml").read_text(encoding="utf-8")
    version_match = re.search(r'^version = "([^"]+)"$', project, re.MULTILINE)
    assert version_match is not None
    version = version_match.group(1)

    assert "90C16F8A-44AF-4B0C-A389-F26143240E0A" in installer
    assert f'#define MyAppVersion "{version}"' in installer
    assert "OutputBaseFilename=DupeSpace-Setup" in installer
    assert "CloseApplications=yes" in installer
    assert "RestartApplications=no" in installer


def test_local_first_release_never_injects_oauth_configuration() -> None:
    root = Path(__file__).resolve().parents[1]
    workflow = (root / ".github/workflows/release.yml").read_text(encoding="utf-8")
    assert "secrets.DUPESPACE_GOOGLE_DESKTOP_CLIENT_ID" not in workflow
    assert "secrets.DUPESPACE_GOOGLE_DESKTOP_CLIENT_SECRET" not in workflow
    assert "secrets.GOOGLE_CLIENT_SECRET" not in workflow
    spec = (root / "DupeSpace.spec").read_text(encoding="utf-8")
    project = (root / "pyproject.toml").read_text(encoding="utf-8")
    assert "google-api-python-client" not in project
    assert "google-auth-oauthlib" not in project
    assert not (root / "src/dupespace/drive.py").exists()
    assert not (root / "src/dupespace/desktop_oauth.py").exists()
    assert not (root / "src/dupespace/desktop/cloud_thumbnail.py").exists()
    assert '"googleapiclient"' in spec
    assert '"google_auth_httplib2"' in spec
    assert '"google_auth_oauthlib"' in spec
    assert "scripts/check_frozen_contents.ps1" in workflow


def test_release_validates_supported_v1_upgrade_paths() -> None:
    root = Path(__file__).resolve().parents[1]
    workflow = (root / ".github/workflows/release.yml").read_text(encoding="utf-8")
    script = (root / "scripts/test_installer_upgrade.ps1").read_text(encoding="utf-8")
    for version in ("v1.5.1", "v1.6.0"):
        assert version in workflow
    assert "BaselineVersion" in script
    assert "$env:GITHUB_ACTIONS" in script
    assert "$env:RUNNER_TEMP" in script
