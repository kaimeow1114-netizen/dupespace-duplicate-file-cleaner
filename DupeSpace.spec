from pathlib import Path
import ctypes
import os
from PyInstaller.utils.hooks import copy_metadata


root = Path(SPECPATH)
if os.name == "nt":
    system_buffer = ctypes.create_unicode_buffer(32768)
    length = ctypes.windll.kernel32.GetSystemDirectoryW(system_buffer, len(system_buffer))
    if not length or length >= len(system_buffer):
        raise RuntimeError("Cannot locate the Windows system DLL directory")
    system_directory = Path(system_buffer.value).resolve(strict=True)
    # Qt uses the OS ICU API. A developer toolchain can put a different ICU ABI on PATH.
    # Prefer real system DLLs so PyInstaller does not package foreign toolchain binaries.
    os.environ["PATH"] = str(system_directory) + os.pathsep + os.environ.get("PATH", "")
assets = root / "src" / "dupespace" / "assets"
dependency_notices = []
for distribution in ("PySide6-Essentials", "shiboken6", "send2trash"):
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
    excludes=[
        "tkinter", "PySide6.QtQml", "PySide6.QtQuick", "PySide6.QtWebEngineCore",
        "dupespace.drive", "dupespace.desktop_oauth", "dupespace._desktop_oauth",
        "dupespace.desktop.cloud_thumbnail", "googleapiclient", "google_auth_oauthlib",
    ],
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
