# DupeSweep

**Duplicate File Cleaner for Windows & Google Drive**

DupeSweep is a safety-first desktop tool for finding exact duplicate files and moving the
extra copies to the Recycle Bin or Google Drive trash. It is designed for large cleanups:
scans are streamed, Drive changes are sent in API-compliant batches of 100, and every long
operation can be cancelled between files or batches.

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

## Requirements

- Windows 10/11 (the core and tests also run on Linux/macOS)
- Python 3.10 or newer
- A Google Cloud OAuth desktop credential only if Google Drive support is needed

## Install and run

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
pyinstaller --noconfirm --windowed --name DupeSweep --paths src src/dupesweep/__main__.py
```

The executable is written to `dist\DupeSweep\`. OAuth credentials are deliberately not bundled.

## Limits

- Google Workspace-native files do not expose a stable binary checksum and are skipped.
- DupeSweep compares duplicates within each source. It does not delete a unique local file merely
  because an equivalent Drive copy exists, or vice versa.
- Moving thousands of files to trash can be rate-limited by Google; failed items are reported and
  can be retried after rescanning.

## License

MIT
