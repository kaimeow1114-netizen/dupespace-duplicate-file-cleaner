$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

python scripts/build_icon.py
python -m PyInstaller --noconfirm --clean DupeSpace.spec

$innoCandidates = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$inno = $innoCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $inno) {
    throw "Inno Setup 6 is required to build DupeSpace-Setup.exe"
}
& $inno "packaging\dupespace.iss"
