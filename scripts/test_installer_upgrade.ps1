param(
    [Parameter(Mandatory=$true)][string]$PreviousInstaller,
    [Parameter(Mandatory=$true)][string]$NewInstaller
)
$ErrorActionPreference = "Stop"
if ($env:GITHUB_ACTIONS -ne "true" -or [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    throw "Installer upgrade QA is restricted to the disposable GitHub Actions runner"
}
$previous = (Resolve-Path -LiteralPath $PreviousInstaller).Path
$current = (Resolve-Path -LiteralPath $NewInstaller).Path
if ([IO.Path]::GetExtension($previous) -ne ".exe" -or [IO.Path]::GetExtension($current) -ne ".exe") {
    throw "Both installer inputs must be executable files"
}
$runnerTemp = (Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path
$installDir = [IO.Path]::GetFullPath((Join-Path $runnerTemp "DupeSpace-Upgrade-QA"))
if (-not $installDir.StartsWith($runnerTemp.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Invalid isolated installer target"
}
if (Test-Path -LiteralPath $installDir) { throw "QA install directory must not exist yet" }
$arguments = @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", "/DIR=`"$installDir`"", "/TASKS=desktopicon")
$oldInstall = Start-Process -FilePath $previous -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($oldInstall.ExitCode -ne 0) { throw "Previous installer failed" }
$dataDir = Join-Path $env:LOCALAPPDATA "DupeSpace"
$reportDir = Join-Path $dataDir "reports"
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
$report = Join-Path $reportDir "upgrade-qa-report.csv"
$preferences = Join-Path $dataDir "settings.json"
[IO.File]::WriteAllText($report, "synthetic-upgrade-fixture", [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($preferences, '{"sound_muted":true,"reduced_motion":true}', [Text.UTF8Encoding]::new($false))
$newInstall = Start-Process -FilePath $current -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($newInstall.ExitCode -ne 0) { throw "V1 upgrade failed" }
if ([IO.File]::ReadAllText($report) -ne "synthetic-upgrade-fixture") { throw "Upgrade changed the user's report" }
if ((Get-Content -LiteralPath $preferences -Raw | ConvertFrom-Json).sound_muted -ne $true) { throw "Upgrade changed the user's preferences" }
$appPath = Join-Path $installDir "DupeSpace.exe"
$app = Start-Process -FilePath $appPath -ArgumentList "--smoke-test" -WindowStyle Hidden -PassThru
if (-not $app.WaitForExit(60000)) { throw "Installed application failed to finish its smoke test" }
if ($app.ExitCode -ne 0) { throw "Installed application failed to launch" }
$desktop = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path -LiteralPath (Join-Path $desktop "DupeSpace.lnk"))) { throw "Desktop shortcut was not created" }
$uninstaller = Join-Path $installDir "unins000.exe"
if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw "Uninstaller is missing" }
$uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -WindowStyle Hidden -Wait -PassThru
if ($uninstall.ExitCode -ne 0) { throw "Uninstaller failed" }
if (-not (Test-Path -LiteralPath $report) -or -not (Test-Path -LiteralPath $preferences)) {
    throw "Uninstaller removed user reports or preferences"
}
Write-Output "Isolated v0.6.0 to V1 upgrade, launch, desktop shortcut, and uninstall preservation passed."
