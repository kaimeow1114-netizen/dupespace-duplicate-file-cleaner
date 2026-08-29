# DUPESPACE

**Duplicate File Cleaner for Windows & Google Drive**

[Use DUPESPACE online](https://dupespace.app/cleaner) ·
[Read the Windows download guide](https://dupespace.app/download) ·
[View the latest release](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest)

## Windows V1 桌面版

V1 採用原生 Qt 桌面介面：深青色側邊導覽、明亮工作區、保留區／清理區卡片、
Google 帳號區、可搜尋的虛擬列表、清理紀錄與安全中心。Windows 本機整理不需登入。
Google Drive 資料存取權驗證仍在準備示範影片與審查階段，不能視為已完成驗證的正式服務。

操作流程是「選擇位置 → 掃描 → 檢查副本 → 選擇方式／確認 → 執行 → 結果」。
永久刪除切換後清空所有選取，資料夾只能移至垃圾桶；重新掃描會撤銷這次解鎖與確認。
常用位置可以儲存成設定檔，但不儲存解鎖、刪除選取或高風險確認。

清理前先寫入操作日誌，每個結果都落盤。垃圾桶中的檔案仍占用儲存空間，
「已移至垃圾桶容量」不會被描述為「已實際釋放磁碟空間」。

開發者可執行 `python scripts/desktop_preview.py` 產生原生介面預覽（全部為合成資料），
或執行 `DupeSpace.exe --smoke-test` 驗證打包介面能啟動；這兩種檢查不會清理使用者檔案。

DUPESPACE is a free, open-source, safety-first duplicate file and mirror-folder cleaner. Windows scans use explicit
**keep roots** and **clean roots**: a result is shown only when the same size and full SHA-256
content exist in both roles. Every keep-root file is protected. Google Drive keeps its global,
oldest-file keeper policy. The desktop uses a native virtual table, the web progressively renders
large result sets, and both produce per-file CSV audits.

Content equality means “duplicate candidate”, not “safe to delete everywhere.” Clean-root-only
groups are not shown. Zero-byte files are ignored; on Windows, files smaller than 1 MiB can be
reviewed but are never preselected. The Google Drive web scan preselects every trash-eligible
non-keeper duplicate so a recoverable trash operation takes one click after review. On Windows
and Google Drive, recognized source-code projects and package
environments are hard-excluded because identical configuration, dependency, and plug-in files can
be independently required by different projects. Application, backup, sync, project, package,
shortcut, reparse-point, and cloud-placeholder contexts are excluded from whole-folder matching.

An entire folder is a duplicate candidate only when both trees have the same relative paths,
byte sizes, and full content checksums. The folder is always moved to trash as one recoverable
operation and can never enter permanent-delete mode. Immediately before the move, DUPESPACE
rechecks the tree's file count, total bytes, newest modification time, and manifest checksum; any
change cancels the operation. The optional system-metadata rule is off by default. If explicitly
enabled, `.DS_Store`, `Thumbs.db`, and `desktop.ini` are ignored for comparison but still travel
with the folder to trash.

## Trash and permanent deletion

**Move to trash is always the default and recommended mode.** Local files go to the Windows
Recycle Bin; Drive files go to Google Drive trash. These operations may be recoverable according
to Windows or Google retention rules.

> **WARNING — permanent deletion cannot be undone.** “Delete permanently now” is a separate,
> red, high-risk advanced option. It is never preselected, its warning cannot be disabled, and a
> trash failure never falls back to it. DUPESPACE never permanently deletes a keeper, protected
> system object, shortcut, symbolic link, junction, mount point, or reparse point. Verified mirror
> folders are trash-only and never participate in permanent deletion.

For permanent deletion, DUPESPACE revalidates the target and protected keeper immediately before
the operation. Changed files are skipped. More than five files requires a second confirmation and
the exact phrase `永久刪除 N 個檔案`. Operations involving 500+ files, 1 GB+, or 5,000+ files add
a full summary and countdown.

## Highlights

- Full SHA-256 comparison for Windows files and stable Google-provided checksums for Drive files;
  mirror folders also require identical relative trees.
- Native Qt desktop flow with a sidebar, account area, cards, animation, empty/error/success states,
  safe stop, and metrics for scan count, groups, copies, selected files, successful logical bytes, duplicate
  percentage, and disk/cloud capacity percentage.
- Progressive result rendering and small Drive batches of 10 operations, with request timeouts,
  shared keeper validation, and immediate removal of confirmed results from the web UI.
- A wide Google Drive workbench that sorts duplicate groups by video, image, PDF, important
  document, audio, folder, archive, and other types. Only one expanded group is rendered at a
  time, and it loads one protected-keeper preview; duplicate copies remain lightweight text/path
  rows. AdSense remains excluded from every cleaner, login, scan, result, and mutation surface.
- A two-click Google Drive trash flow with a non-blocking 10-second undo bar. Undo calls a real,
  same-origin restore API and requires the original signed scan proof; it is not a visual-only
  rollback. Permanent deletion keeps its separate high-risk confirmations.
- A transparent 0–100 storage-health organization score based only on duplicate bytes and group
  count, plus device-local aggregate history, path-based duplicate-cause estimates, protected
  profiles, and a user-configured capacity-cost equivalent calculator. These are organization
  aids, not disk-failure diagnostics or claims about actual billing savings.
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
- A built-in Windows updater that checks the public GitHub Release at most once per day, downloads
  in the background, verifies the declared size and SHA-256 twice, and starts the visible installer
  only after the user confirms. It never silently executes or elevates an update.
- Full-bleed public landing pages, a separate ad-free browser cleaner, privacy/terms pages, PWA
  icon suite, SEO metadata, AdSense Auto Ads verification code, and Google Limited Use disclosures.
- A shared teal motion language across web and desktop: spring dashboard entrance, subtle SHA-256
  particles, animated space counters, staggered safety cards, pointer-following glow, and a complete
  reduced-motion fallback that never hides safety information.
- A zero-emoji web interface whose status and action indicators use Lucide SVG icons, with a real
  English alternate route, corrected hreflang links, semantic image alternatives, and persistent
  session status through `/api/auth/session`.

## Requirements and installation

- Windows 10/11 for the desktop app (core tests also run on Linux/macOS)
- Python 3.10+ when running from source
- A release build whose protected GitHub Actions configuration injects the public Desktop OAuth
  Client ID; no Desktop Client Secret is used or bundled

Download
[DupeSpace-Setup.exe](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest/download/DupeSpace-Setup.exe).
The installer offers an optional desktop shortcut; Python is not required on the user’s computer.
Users installing v1.1.0 or later can check for updates from the desktop sidebar. Existing v1.0.1
installations need this one manual upgrade before in-app updates become available.

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

The web app stores OAuth tokens only inside an encrypted Secure, HttpOnly, SameSite cookie with a
sliding maximum age of 30 days. Short-lived signed scan proofs still expire after 30 minutes, and
disconnecting attempts to revoke the Google token before clearing the session. File content never
passes through the DUPESPACE server. The Windows app stores its desktop token only under the
current user’s DupeSpace local application data, protected by user-bound Windows DPAPI. Failed
encryption never falls back to plaintext. DPAPI does not protect against malware already running
as that user. Credentials, secrets, tokens, and user data do
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

The suite covers keeper protection, mirror-folder matching, strict/optional metadata handling,
folder TOCTOU cancellation, owner/shared-drive protection, no trash-to-delete fallback,
system-folder/path-alias defense, changed-file skipping, confirmations, session-only trash
suppression, safe batching/stopping, separate local/Drive operation paths, CSV reporting, sound
batching, persistent encrypted login, PWA/SEO assets, navigation, and responsive no-overflow rules.
The web suite also locks the motion primitives and verifies that the server-rendered homepage still
contains its full product-purpose and privacy copy for search engines and Google brand review.

## Build a Windows installer

```powershell
python -m pip install -e ".[build]"
python scripts/build_icon.py
python -m PyInstaller --noconfirm --clean DupeSpace.spec
powershell -File scripts/build_windows.ps1 -Python .venv/Scripts/python.exe
```

The executable is written to `dist\DupeSpace\`; the installer is
`release\DupeSpace-Setup.exe`. Tagged GitHub releases build and publish the installer
automatically. Only the public Desktop OAuth Client ID is injected from protected Actions
configuration during the release build; the Web Client Secret is never bundled.
The build keeps Qt DLLs separate and includes third-party notices and LGPL/GPL license texts.
See `src/dupespace/assets/third-party-notices.txt` for source/rebuild and library replacement details.

## Known limits

- Google Workspace-native files do not expose a stable binary checksum and are skipped. Shortcuts,
  non-owner folders, shared drives, project/package trees, and unverifiable folder descendants are
  excluded from whole-folder cleanup.
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
