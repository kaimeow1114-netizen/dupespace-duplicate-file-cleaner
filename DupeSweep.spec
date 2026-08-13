from pathlib import Path


root = Path(SPECPATH)
assets = root / "src" / "dupesweep" / "assets"

a = Analysis(
    [str(root / "scripts" / "dupesweep_entry.py")],
    pathex=[str(root / "src")],
    binaries=[],
    datas=[(str(assets), "dupesweep/assets")],
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
    name="DupeSweep",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon=str(assets / "dupesweep.ico"),
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="DupeSweep",
)
