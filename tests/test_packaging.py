from pathlib import Path


def test_installer_preserves_upgrade_app_id_and_uses_new_names() -> None:
    root = Path(__file__).resolve().parents[1]
    installer = (root / "packaging" / "dupespace.iss").read_text(encoding="utf-8")

    assert "90C16F8A-44AF-4B0C-A389-F26143240E0A" in installer
    assert '#define MyAppVersion "1.0.0"' in installer
    assert "OutputBaseFilename=DupeSpace-Setup" in installer
