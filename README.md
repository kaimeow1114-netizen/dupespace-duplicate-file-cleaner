# DUPESPACE

**Duplicate File Cleaner for Windows & Google Drive**

[Use DUPESPACE online](https://dupespace.app/cleaner) ·
[Read the Windows download guide](https://dupespace.app/download) ·
[View the latest release](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest)

## Windows V1 桌面版

V1 採用原生 Qt 桌面介面：可收合深青色側邊導覽、明亮工作區、可點擊及拖放的
資料夾選取區、Google 帳號、可搜尋的虛擬群組卡片、清理紀錄、安全中心與 GitHub 回報頁。
Windows 本機整理不需登入；登入後的帳號與頭像固定顯示於側邊欄底部。

操作流程是「選擇位置 → 掃描 → 檢查副本 → 移至垃圾桶 → 結果」。
掃描後會選取所有符合安全條件的副本（包含小於 1 MiB 的檔案及已驗證資料夾）；
一般垃圾桶操作不再跳出確認視窗，永久刪除仍有不可略過的高風險確認。
每組只載入一張保留檔圖片預覽，其他副本只顯示文字。點擊檔名或路徑即可開啟右側
詳細資料，勾選框與預覽互不干擾。資料夾列右側的 X 只移出掃描清單，不刪除檔案。
v1.4 在網頁群組收合時另顯示小縮圖，展開後的大預覽與完整路徑維持原樣。
桌面群組採左右比對，副本分段展開；窄視窗的詳情以抽屜呈現，不壓縮比對區。
本機影片使用 Windows 縮圖提供者，背景子程序逾時即停止；不播放影片。
Google Drive 網頁縮圖經登入及掃描證明驗證後按需轉送，每張最多 1 MiB，
不儲存於伺服器或 CDN，不下載原始檔案，也不增加 OAuth scope。Google 未提供縮圖、格式不支援或載入失敗時顯示類型圖示。
常用位置預設以第一個整理資料夾命名，支援直接載入、改名、編輯位置與刪除設定檔。
永久刪除切換後清空所有選取，資料夾只能移至垃圾桶；重新掃描會撤銷這次解鎖與確認。
本機只會遞迴掃描使用者加入的整理位置。每個精確重複群組自動鎖定最舊檔案，
不再強制要求獨立保留區；使用者仍可把整理位置內的子資料夾設成永遠不可選取的
保護資料夾；這些副本全部保留，保護資料夾外再保留最舊一份，不能互相取代。常用位置可以儲存成設定檔，但不儲存解鎖、刪除選取或高風險確認。

每批清理只產生一個以日期時間命名的 CSV。清理前先寫入操作意圖，每個結果都落盤，
完成後在同一路徑原子整併；中斷時 pending 紀錄不代表已刪除。垃圾桶中的檔案仍占用儲存空間，
「已移至垃圾桶容量」不會被描述為「已實際釋放磁碟空間」。

開發者可執行 `python scripts/desktop_preview.py` 產生原生介面預覽（全部為合成資料），
或執行 `DupeSpace.exe --smoke-test` 驗證打包介面能啟動；這兩種檢查不會清理使用者檔案。

DUPESPACE is a free, open-source, safety-first duplicate file and mirror-folder cleaner. Windows
scans only user-added cleanup roots and recursively visits their ordinary subfolders. Every exact
content group locks its oldest outside file as the keeper. Optional nested protected folders never
replace that outside keeper, and every file inside them remains unselectable. Folder trash must not
contain protected subfolders or any file keeper; ambiguous hard-linked folder trees are excluded. Google Drive keeps its separate
global oldest-file keeper policy. The desktop uses native virtual group cards, the web progressively
renders large result sets, and both produce per-file CSV audits.

Content equality means “duplicate candidate”, not “safe to delete everywhere.” Zero-byte files are
ignored. Desktop and web scans preselect safe trash-eligible copies of any positive size, including
verified mirror folders. Explicit protection profiles and locked contexts remain excluded. The scan selects
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
the operation. Changed files are skipped. Every permanent operation requires an unchecked risk
acknowledgment checkbox; Enter never confirms it. Operations involving 500+ files, 1 GB+, or 5,000+ files add
a full summary and countdown.

## Highlights

- Full SHA-256 comparison for Windows files and stable Google-provided checksums for Drive files;
  mirror folders also require identical relative trees.
- Native Qt desktop flow with a sidebar, account area, cards, animation, empty/error/success states,
  safe stop, and metrics for scan count, groups, copies, selected files, successful logical bytes, duplicate
  percentage, and disk/cloud capacity percentage.
- Progressive result rendering and small Drive batches of 10 operations, with request timeouts,
  fresh per-item keeper validation, and immediate removal of confirmed results from the web UI.
- A wide Google Drive workbench that sorts duplicate groups by video, image, PDF, important
  document, audio, folder, archive, and other types. Only one expanded group is rendered at a
  time, and it loads one protected-keeper preview; duplicate copies remain lightweight text/path
  rows. AdSense remains excluded from every cleaner, login, scan, result, and mutation surface.
- A two-click Google Drive trash flow with a non-blocking 10-second undo bar. Undo calls a real,
  same-origin restore API and requires the original signed scan proof; it is not a visual-only
  rollback. Permanent deletion keeps its separate high-risk confirmations.
- A transparent 0–100 storage-health organization score based on continuous duplicate-capacity bands (not group
  count), plus device-local aggregate history, path-based duplicate-cause estimates, protected
  profiles, and a prefilled, editable capacity-cost equivalent calculator. These are organization
  aids, not disk-failure diagnostics or claims about actual billing savings.
- Windows cleanup roots reject equal, nested, overlapping, short-path, junction, symlink,
  reparse-point, and path-normalization bypasses. Optional protected folders must be strictly nested
  inside one cleanup root. Cloud placeholders are skipped without hydration.
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
  Client ID and its Google-issued Desktop-only companion value. Native client values are
  extractable from the installer and are not a security boundary; Web secrets are never bundled.

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
4. Authorize the existing Drive scope. The identity label comes from Drive `about.user`, without a new email scope.
5. Never put a Web Client Secret in the desktop application or GitHub.

The Desktop app is a public/native OAuth client: it uses a loopback redirect and PKCE. Google
may require the issued Desktop client companion value during token exchange. The build accepts
only `DUPESPACE_GOOGLE_DESKTOP_CLIENT_ID` and `DUPESPACE_GOOGLE_DESKTOP_CLIENT_SECRET`.
That value is extractable from an EXE, even when supplied through Actions Secrets; it does not
replace user consent, PKCE, state validation or Windows DPAPI token protection. The confidential
Web client secret stays only in the Sites runtime secret store.

DUPESPACE uses the restricted `https://www.googleapis.com/auth/drive` scope because finding and
managing pre-existing duplicates cannot use the narrower `drive.file` scope. Both trash and permanent deletion use the same Drive scope; permanent deletion does not
add another Drive permission. Public distribution requires Google verification and may require a
security assessment.

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
automatically. Desktop-only OAuth configuration is injected from protected Actions configuration
during the release build; missing values fail the build. The Web Client Secret is never bundled.
The build keeps Qt DLLs separate and includes third-party notices and LGPL/GPL license texts.
See `src/dupespace/assets/third-party-notices.txt` for source/rebuild and library replacement details.

## Known limits

- Keeper selection: protection rules first, then earliest reliable creation time. If any eligible
  candidate lacks a usable creation time, compare full path lengths for the whole group; equal
  creation times also use shorter paths. Modification time is never a substitute. This is a
  deterministic policy, not proof that a file was historically the original.
- Repeat web scans can use an account-bound, AES-GCM encrypted browser index valid for seven days.
  It contains metadata, never OAuth tokens or original file contents. The server replays Drive
  changes and issues fresh operation proofs. Tampering, account mismatch, expiry and folder
  structure changes require a full scan. Serialized indices above 4 MiB are not cached.
- Undo updates only confirmed restored items without a full scan. Fresh file proofs require
  target and keeper revalidation; restored folders must be rescanned before another cleanup.
  Clearing the scan cache or disconnecting invalidates in-flight results in other open tabs.
- Real English pages are available under `/en/`, with matching canonical and language alternate
  links. Chinese URLs remain unchanged; Japanese pages are not published yet.

- Google Workspace-native files do not expose a stable binary checksum and are skipped. Shortcuts,
  non-owner folders, shared drives, project/package trees, and unverifiable folder descendants are
  excluded from whole-folder cleanup.
- DUPESPACE compares duplicates within each source. A local group keeps its oldest exact copy or a
  copy inside an optional protected subfolder; Drive follows its separate oldest-keeper policy.
- DUPESPACE does not guess at temporary or junk files. Use Windows Storage Sense or Cleanup
  recommendations for operating-system cleanup.
- Google may rate-limit very large operations. Failed items remain unchanged and are recorded;
  rescan before retrying.
- Google brand and publishing status do not replace restricted-scope review. Do not claim unrestricted
  public authorization until the requested scope description and demonstration-video review are complete.

## License

MIT
