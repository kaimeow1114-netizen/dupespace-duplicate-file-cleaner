# DupeSweep

**Duplicate File Cleaner for Windows & Google Drive**

DupeSweep is a safety-first desktop tool for finding exact duplicate files and moving the
extra copies to the Recycle Bin or Google Drive trash. It is designed for large cleanups:
scans are streamed, Drive changes are sent in API-compliant batches of 100, and every long
operation can be cancelled between files or batches.

The 0.2 release adds a branded Windows installer, an optional desktop shortcut, animated progress
and reclaimed-space percentages, plus a public website with a browser-based Google Drive cleaner,
free download promotion, privacy/terms pages, and AdSense publisher integration.

> DupeSweep never permanently deletes files. It protects one deterministic keeper in every
> duplicate group and asks for explicit confirmation before moving anything to trash.

## What it does

- Finds local duplicates by file size and a full SHA-256 content hash.
- Ignores symbolic links and repeated hard-link identities.
- Re-checks local file identity, size, and modification time immediately before trashing.
- Scans owned binary files in My Drive with Google-provided content checksums.
- Skips Google Docs/Sheets/Slides, shortcuts, shared-drive items, and anything the account
  cannot trash.
- Paginates Drive listings at 1,000 items per page and trashes in batches of at most 100.
- Keeps the oldest copy by default; the protected keeper cannot be selected in the UI.
- Shows the exact file count and reclaimable bytes before acting.
- Requires typing a confirmation phrase for large operations (500 or more files).
- Writes a UTF-8 CSV outcome report under `%LOCALAPPDATA%\DupeSweep\reports`.
- Animates scan and cleanup progress while quantifying selected bytes, reclaimable percentage,
  scanned-data percentage, and device/cloud capacity percentage.
- Ships as `DupeSweep.exe` inside a Windows installer that asks whether to create a desktop shortcut.

## Requirements

- Windows 10/11 (the core and tests also run on Linux/macOS)
- Python 3.10 or newer
- A Google Cloud OAuth desktop credential only if Google Drive support is needed

## Install and run

Windows users can download the latest installer from
[GitHub Releases](https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner/releases/latest).
The installer offers an optional desktop shortcut and launches `DupeSweep.exe` directly—Python is
not required on the user's computer.

Developers can run from source:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e .
dupesweep
```

You can also start it without the installed launcher:

```powershell
python -m dupesweep
```

## Connect Google Drive

1. In Google Cloud Console, create or select a project.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen. While the app is in testing, add your Google account
   as a test user.
4. Create an OAuth client with application type **Desktop app**.
5. Download its JSON file. In DupeSweep, choose that file and click **連接並掃描 Google Drive**.
6. Review Google's consent screen and approve only if the shown app and permission are yours.

DupeSweep needs the `https://www.googleapis.com/auth/drive` scope because identifying and
trashing pre-existing files cannot be done with the narrower `drive.file` scope. The OAuth
token is stored only in `%LOCALAPPDATA%\DupeSweep\token.json`; neither credentials nor tokens
belong in Git. Publicly distributing an OAuth client that uses this restricted scope can
require Google verification and, depending on the deployment, a security assessment.

DupeSweep has no telemetry and sends no file contents to its own server. Google Drive metadata
and mutation requests go directly from the desktop app to Google's API. Local cleanup reports can
contain filenames and paths, remain on the computer, and should be handled as private data.

## Safety model

Read [docs/SAFETY.md](docs/SAFETY.md) before a large cleanup. Start with a small test folder,
review every group, and confirm that Recycle Bin / Drive trash retention meets your needs.

## Tests

```powershell
python -m pip install -e ".[dev]"
pytest
ruff check .
```

The test suite includes a 5,001-file selection scenario and verifies that Drive mutations are
never placed in batches larger than 100 requests.

## Build a Windows executable

```powershell
python -m pip install -e ".[build]"
python scripts/build_icon.py
python -m PyInstaller --noconfirm --clean DupeSweep.spec
```

The executable is written to `dist\DupeSweep\`. Run `scripts\build_windows.ps1` on a system with
Inno Setup 6 to also create `release\DupeSweep-Setup.exe`. OAuth credentials are deliberately not
bundled. Tagged GitHub releases build and publish the installer automatically.

## Browser-based Google Drive cleaner

The `web/` application provides the product website and browser cleaner. It uses encrypted
HttpOnly OAuth cookies, 30-minute signed scan proofs, batches of at most 100 selected files, and
server-side revalidation of the selected file and protected keeper before every Drive mutation.
It never exposes OAuth tokens to browser JavaScript and never permanently deletes files.

Deployment requires a Google OAuth **Web application** client and three hosting secrets:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random 32+ character `SESSION_SECRET`. See
[docs/WEB_DEPLOYMENT.md](docs/WEB_DEPLOYMENT.md). The full Drive scope requires Google's public-app
verification before accounts outside the configured test-user list can authorize it.

Google AdSense publisher `ca-pub-7998471640181666` and the matching `ads.txt` declaration are
included. Ads begin serving only after the deployed domain is added to AdSense and approved.

## Limits

- Google Workspace-native files do not expose a stable binary checksum and are skipped.
- DupeSweep compares duplicates within each source. It does not delete a unique local file merely
  because an equivalent Drive copy exists, or vice versa.
- Moving thousands of files to trash can be rate-limited by Google; failed items are reported and
  can be retried after rescanning.

## License

MIT
