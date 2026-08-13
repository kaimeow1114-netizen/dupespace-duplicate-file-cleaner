# DUPESWEEP

**Duplicate File Cleaner for Windows & Google Drive**

[Use DUPESWEEP online](https://dupesweep.app) ·
[Download the Windows installer](https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner/releases/latest/download/DupeSweep-Setup.exe) ·
[View the latest release](https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner/releases/latest)

DUPESWEEP is a safety-first duplicate file cleaner for everyday users. It finds exact duplicate
content on Windows and Google Drive, protects one keeper in every group, handles more than 5,000
results through paging and small batches, and produces a per-file CSV audit report.

## Trash and permanent deletion

**Move to trash is always the default and recommended mode.** Local files go to the Windows
Recycle Bin; Drive files go to Google Drive trash. These operations may be recoverable according
to Windows or Google retention rules.

> **WARNING — permanent deletion cannot be undone.** “Delete permanently now” is a separate,
> red, high-risk advanced option. It is never preselected, its warning cannot be disabled, and a
> trash failure never falls back to it. DUPESWEEP never permanently deletes a keeper, protected
> system object, folder, shortcut, symbolic link, junction, mount point, or reparse point.

For permanent deletion, DUPESWEEP revalidates the target and protected keeper immediately before
the operation. Changed files are skipped. More than five files requires a second confirmation and
the exact phrase `永久刪除 N 個檔案`. Operations involving 500+ files, 1 GB+, or 5,000+ files add
a full summary and countdown.

## Highlights

- Full SHA-256 comparison for Windows files and stable Google-provided checksums for Drive files.
- Seven-step, friendly desktop flow with cards, animation, empty/error/success states, safe stop,
  and metrics for scan count, groups, copies, selected files, estimated/actual bytes, duplicate
  percentage, and disk/cloud capacity percentage.
- Progressive result rendering and batches of at most 100 Drive operations.
- Deterministic locked keeper in every group; every operation independently revalidates both target
  and keeper identity, size, modification time/version, checksum, ownership, and permission.
- Strong Windows protection discovered with system APIs, volume roots, Known Folder/environment
  data, canonical physical paths, and file attributes. Administrator mode does not bypass it.
- Original low-volume DUPESWEEP sounds for confirmation, trash, permanent warnings/completion,
  success, and errors. Sound is played once per batch/operation, not once per file.
- UTF-8 CSV audit outcomes with timestamp, source, mode, status, path/Drive ID, bytes, checksum,
  and reason.
- Windows installer with optional first-install desktop shortcut.
- Free browser cleaner, privacy/terms pages, PWA icon suite, SEO metadata, and AdSense declaration.

## Requirements and installation

- Windows 10/11 for the desktop app (core tests also run on Linux/macOS)
- Python 3.10+ when running from source
- A Google Cloud OAuth desktop credential only for desktop Drive support

Download
[DupeSweep-Setup.exe](https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner/releases/latest/download/DupeSweep-Setup.exe).
The installer offers an optional desktop shortcut; Python is not required on the user’s computer.

Developers can run from source:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e .
dupesweep
```

## Google Drive OAuth

1. Enable Google Drive API in a Google Cloud project.
2. Configure the OAuth consent screen and add test users until verification is approved.
3. Create a **Desktop application** client for the Windows app and a separate **Web application**
   client for `https://dupesweep.app`.
4. Never put a Web Client Secret in the desktop application or GitHub.

DUPESWEEP uses the restricted `https://www.googleapis.com/auth/drive` scope because finding and
managing pre-existing duplicates cannot use the narrower `drive.file` scope. Both trash and
permanent deletion use this same scope; permanent deletion does not add another scope. Public
distribution requires Google verification and may require a security assessment.

The web app stores OAuth tokens only inside an encrypted HttpOnly cookie. File content never
passes through the DUPESWEEP server. The Windows app stores its desktop token only under the
current user’s local application data. Credentials, secrets, tokens, and user data do not belong
in Git.

See [docs/SAFETY.md](docs/SAFETY.md) and [docs/WEB_DEPLOYMENT.md](docs/WEB_DEPLOYMENT.md).

## Tests

```powershell
python -m pip install -e ".[dev]"
pytest
ruff check .
cd web
npm run lint
npm test
```

The suite covers keeper protection, no trash-to-delete fallback, system-folder/path-alias defense,
changed-file skipping, confirmations, session-only trash suppression, safe batching/stopping,
separate local/Drive operation paths, CSV reporting, sound batching, PWA/SEO assets, navigation,
and responsive no-overflow rules.

## Build a Windows installer

```powershell
python -m pip install -e ".[build]"
python scripts/build_icon.py
python -m PyInstaller --noconfirm --clean DupeSweep.spec
powershell -ExecutionPolicy Bypass -File scripts/build_windows.ps1
```

The executable is written to `dist\DupeSweep\`; the installer is
`release\DupeSweep-Setup.exe`. Tagged GitHub releases build and publish the installer
automatically. OAuth credentials are deliberately not bundled.

## Known limits

- Google Workspace-native files do not expose a stable binary checksum and are skipped.
- DUPESWEEP compares duplicates within each source; it does not delete a unique local file only
  because an equivalent Drive file exists.
- Google may rate-limit very large operations. Failed items remain unchanged and are recorded;
  rescan before retrying.
- Until Google completes restricted-scope verification, only configured test users can authorize
  the public web app.

## License

MIT
