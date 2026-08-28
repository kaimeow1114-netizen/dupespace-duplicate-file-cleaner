param([string]$Python = "python")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

& $Python scripts/build_icon.py
if ($LASTEXITCODE -ne 0) { throw "Icon build failed" }
& $Python -m PyInstaller --noconfirm DupeSpace.spec
if ($LASTEXITCODE -ne 0) { throw "Windows executable build failed" }

$innoCandidates = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$inno = $innoCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $inno) {
    throw "Inno Setup 6 is required to build DupeSpace-Setup.exe"
}
& $inno "packaging\dupespace.iss"
if ($LASTEXITCODE -ne 0) { throw "Windows installer build failed" }
