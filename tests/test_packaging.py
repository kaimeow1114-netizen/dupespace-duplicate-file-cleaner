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
    assert '"dupespace._desktop_oauth"' in spec
    assert '"dupespace.drive"' in spec
