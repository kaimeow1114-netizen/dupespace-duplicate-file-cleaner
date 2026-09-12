param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,
    [string]$Python = 'python'
)

$ErrorActionPreference = 'Stop'
$target = (Resolve-Path -LiteralPath $Executable -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Packaged executable not found: $target"
}

$pythonCommand = (Get-Command $Python -ErrorAction Stop).Source
$modules = @(& $pythonCommand -m PyInstaller.utils.cliutils.archive_viewer -r -b $target |
    ForEach-Object { $_.Trim() })
if ($LASTEXITCODE -ne 0 -or $modules.Count -eq 0) {
    throw 'Could not inspect the packaged Python module archive'
}

$forbidden = @(
    'dupespace.drive',
    'dupespace.desktop_oauth',
    'dupespace.token_store',
    'dupespace.desktop.cloud_thumbnail'
)
foreach ($module in $forbidden) {
    if ($modules -contains $module) {
        throw "Retired cloud module was packaged: $module"
    }
}
foreach ($prefix in @('googleapiclient', 'google_auth_oauthlib', 'google_auth_httplib2')) {
    if ($modules | Where-Object { $_ -eq $prefix -or $_.StartsWith("$prefix.") }) {
        throw "Google Drive SDK module was packaged: $prefix"
    }
}
if ($modules -notcontains 'dupespace.legacy_grant' -or $modules -notcontains 'dupespace.retirement') {
    throw 'The explicit, revoke-only legacy grant helper is missing'
}

$bundle = Split-Path -Parent $target
$credentialNames = @('token.json', 'oauth-token.dpapi', 'client_secret.json', 'desktop-client.json')
$credentials = @(Get-ChildItem -LiteralPath $bundle -Recurse -File | Where-Object {
    $credentialNames -contains $_.Name
})
if ($credentials.Count -gt 0) {
    throw 'A credential-like file was found in the packaged application'
}

Write-Output 'Frozen application contains only the revoke-only legacy grant helper; no Drive client or credential file.'
