from pathlib import Path
from PyInstaller.utils.hooks import copy_metadata


root = Path(SPECPATH)
assets = root / "src" / "dupespace" / "assets"
dependency_notices = []
for distribution in ("PySide6-Essentials", "shiboken6", "send2trash", "google-api-python-client"):
    dependency_notices.extend(copy_metadata(distribution, recursive=True))

a = Analysis(
    [str(root / "scripts" / "dupespace_entry.py")],
    pathex=[str(root / "src")],
    binaries=[],
    datas=[(str(assets), "dupespace/assets"), *dependency_notices],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "PySide6.QtQml", "PySide6.QtQuick", "PySide6.QtWebEngineCore"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="DupeSpace",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon=str(assets / "dupespace.ico"),
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="DupeSpace",
)
