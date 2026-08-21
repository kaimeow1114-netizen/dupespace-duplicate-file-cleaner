# DUPESPACE

**Duplicate File Cleaner for Windows & Google Drive**

[Use DUPESPACE online](https://dupespace.app/cleaner) ·
[Read the Windows download guide](https://dupespace.app/download) ·
[View the latest release](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest)

DUPESPACE is a free, open-source, safety-first duplicate file cleaner. Windows scans use explicit
**keep roots** and **clean roots**: a result is shown only when the same size and full SHA-256
content exist in both roles. Every keep-root file is protected. Google Drive keeps its global,
oldest-file keeper policy. Both surfaces page large result sets and produce per-file CSV audits.

Content equality means “duplicate candidate”, not “safe to delete everywhere.” Clean-root-only
groups are not shown. Zero-byte files are ignored; on Windows, files smaller than 1 MiB can be
reviewed but are never preselected. The Google Drive web scan preselects every trash-eligible
non-keeper duplicate so a recoverable trash operation takes one click after review. On Windows
and Google Drive, recognized source-code projects and package
environments are hard-excluded because identical configuration, dependency, and plug-in files can
be independently required by different projects. Application, backup, and sync contexts remain
locked until the user reviews the full folder path, count, and bytes and types a folder-specific
phrase.

## Trash and permanent deletion

**Move to trash is always the default and recommended mode.** Local files go to the Windows
Recycle Bin; Drive files go to Google Drive trash. These operations may be recoverable according
to Windows or Google retention rules.

> **WARNING — permanent deletion cannot be undone.** “Delete permanently now” is a separate,
> red, high-risk advanced option. It is never preselected, its warning cannot be disabled, and a
> trash failure never falls back to it. DUPESPACE never permanently deletes a keeper, protected
> system object, folder, shortcut, symbolic link, junction, mount point, or reparse point.

For permanent deletion, DUPESPACE revalidates the target and protected keeper immediately before
the operation. Changed files are skipped. More than five files requires a second confirmation and
the exact phrase `永久刪除 N 個檔案`. Operations involving 500+ files, 1 GB+, or 5,000+ files add
a full summary and countdown.

## Highlights

- Full SHA-256 comparison for Windows files and stable Google-provided checksums for Drive files.
- Seven-step, friendly desktop flow with cards, animation, empty/error/success states, safe stop,
  and metrics for scan count, groups, copies, selected files, estimated/actual bytes, duplicate
  percentage, and disk/cloud capacity percentage.
- Progressive result rendering and small Drive batches of 10 operations, with request timeouts,
  shared keeper validation, and immediate removal of confirmed results from the web UI.
- Windows keep/clean root pairs reject equal, nested, overlapping, short-path, junction, symlink,
  reparse-point, and path-normalization bypasses. Cloud placeholders are skipped without hydration.
- Deterministic locked keeper in every group; every operation independently revalidates both target
  and keeper identity, size, modification time/version, checksum, ownership, and permission.
- Strong Windows protection discovered with system APIs, volume roots, Known Folder/environment
  data, canonical physical paths, and file attributes. Administrator mode does not bypass it.
- Original low-volume DUPESPACE sounds for confirmation, trash, permanent warnings/completion,
  success, and errors. The web experience keeps sound on by default without a settings step, and
  plays it once per batch/operation rather than once per file.
- UTF-8 CSV audit outcomes with timestamp, source, mode, status, path/Drive ID, bytes, checksum,
  and reason.
- Windows installer with optional first-install desktop shortcut.
- Free browser cleaner, privacy/terms pages, PWA icon suite, SEO metadata, and AdSense declaration.

## Requirements and installation

- Windows 10/11 for the desktop app (core tests also run on Linux/macOS)
- Python 3.10+ when running from source
- A release build whose protected GitHub Actions configuration injects the public Desktop OAuth
  Client ID; no Desktop Client Secret is used or bundled

Download
[DupeSpace-Setup.exe](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest/download/DupeSpace-Setup.exe).
The installer offers an optional desktop shortcut; Python is not required on the user’s computer.

Developers can run from source:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e .
dupespace
```

The website build uses Node.js 22 LTS. On Windows, Node.js 24 can currently crash inside the
native Vinext/Rolldown build tool before it prints a useful error; this does not affect the
published web runtime or the Windows desktop application.

## Google Drive OAuth

1. Enable Google Drive API in a Google Cloud project.
2. Configure the OAuth consent screen and add test users until verification is approved.
3. Create a **Desktop application** client for the Windows app and a separate **Web application**
   client for `https://dupespace.app`.
4. Never put a Web Client Secret in the desktop application or GitHub.

The Desktop app is a public/native OAuth client: it uses a loopback redirect and PKCE, and does
not use a client secret. A secret embedded in an EXE could always be extracted, even if it passed
through GitHub Actions Secrets first. The web client is confidential and keeps its secret only in
the Sites runtime secret store.

DUPESPACE uses the restricted `https://www.googleapis.com/auth/drive` scope because finding and
managing pre-existing duplicates cannot use the narrower `drive.file` scope. Both trash and
permanent deletion use this same scope; permanent deletion does not add another scope. Public
distribution requires Google verification and may require a security assessment.

The web app stores OAuth tokens only inside an encrypted HttpOnly cookie. File content never
passes through the DUPESPACE server. The Windows app stores its desktop token only under the
current user’s DupeSpace local application data. Credentials, secrets, tokens, and user data do
not belong in Git.

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
python -m PyInstaller --noconfirm --clean DupeSpace.spec
powershell -ExecutionPolicy Bypass -File scripts/build_windows.ps1
```

The executable is written to `dist\DupeSpace\`; the installer is
`release\DupeSpace-Setup.exe`. Tagged GitHub releases build and publish the installer
automatically. Only the public Desktop OAuth Client ID is injected from protected Actions
configuration during the release build; the Web Client Secret is never bundled.

## Known limits

- Google Workspace-native files do not expose a stable binary checksum and are skipped.
- DUPESPACE compares duplicates within each source. A local clean-root candidate must have an
  equivalent keep-root copy; a Drive candidate follows the separate oldest-keeper policy.
- DUPESPACE does not guess at temporary or junk files. Use Windows Storage Sense or Cleanup
  recommendations for operating-system cleanup.
- Google may rate-limit very large operations. Failed items remain unchanged and are recorded;
  rescan before retrying.
- Until Google completes restricted-scope verification, only configured test users can authorize
  the public web app.

## License

MIT
