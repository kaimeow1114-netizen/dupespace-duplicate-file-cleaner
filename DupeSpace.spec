from pathlib import Path


root = Path(SPECPATH)
assets = root / "src" / "dupespace" / "assets"

a = Analysis(
    [str(root / "scripts" / "dupespace_entry.py")],
    pathex=[str(root / "src")],
    binaries=[],
    datas=[(str(assets), "dupespace/assets")],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
