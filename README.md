# DUPESPACE

**Compare folders before merging. Find renamed duplicates. Clean safely on Windows.**

[資料夾合併前核對 / Folder merge preview](https://dupespace.app/merge) ·
[單一資料夾重複分析 / Duplicate finder](https://dupespace.app/local) ·
[Space Notes 數位工具與工作整理誌](https://dupespace.app/blog) ·
[Windows 下載說明](https://dupespace.app/download) ·
[English website](https://dupespace.app/en/) ·
[Latest release](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest)

## 本機優先，免費開源

DUPESPACE 是不依賴託管雲端帳號的本機優先檔案工具。網頁提供免登入、不把檔案傳送至伺服器的
兩資料夾合併前核對與單一資料夾重複分析；Windows 應用程式提供真正的本機清理。網站與桌面程式仍是不同產品表面，
網站部署不會自動改變已安裝的桌面版本。

內容相同只表示「重複候選」，不能證明另一份沒有用途。不同專案的設定檔、
套件、外掛與備份即使完全一樣，也可能需要同時存在。

## Browser tools

- Folder merge preview compares an incoming folder with a destination and separates same-path exact
  matches, renamed or moved exact matches, same-path content conflicts and files found on only one side.
  It is a read-only merge map, not an automatic copy, overwrite or deletion tool.

- Select a folder or drop individual files. No account, file upload, write permission or deletion.
- Size prefilter and edge sampling narrow the candidates. Versioned complete-content chunk
  SHA-256 fingerprints compare all bytes of remaining candidates in bounded 4 MiB reads.
  This is not a standard whole-file SHA-256 digest and is not BLAKE3.
- Video, image and document groups are ordered by type and candidate capacity. At most 20 groups
  are rendered per page; each visible image group uses one lightweight representative preview.
  Videos and PDFs use type icons rather than automatic decoding.
- Browser APIs do not reliably provide file creation time. The reference file is ordered by
  modification time, then path length; it is not claimed to be the original.
- Project/application/backup context is flagged for review. No result authorizes deletion.
- Safely stop analysis, choose the same folder again, or export a formula-neutralized CSV.
- A single-folder result can also be exported as a versioned `.dupejob` and opened in the Windows
  app. The handoff contains relative paths, sizes, timestamps and fingerprints, never file content
  or absolute paths. Desktop treats it as an untrusted hint: the user selects the matching folder,
  every listed file is constrained to that root and fully reverified, then ordinary keeper and
  cleanup protections apply. It skips walking unrelated files but never grants deletion authority.
- No AdSense, external frames or external social counter requests on the private analyzer routes.

## Windows application

The existing native Qt application provides a collapsible teal sidebar, folder picker and drag-and-drop,
optional protected subfolders, virtual duplicate groups, lightweight previews, audit history and issue reporting.
It recursively scans only the locations selected by the user. A protected subfolder never replaces
the separately protected keeper outside that subfolder.

Use **載入網頁分析檔** to continue from a browser `.dupejob`. Changed, missing, protected or
out-of-root entries are skipped or rejected; the report cannot bypass the normal review screen.

Protection rules take priority, followed by reliable creation time and deterministic path tie-breaks.
A keeper is never selectable. System directories, links, junctions, reparse points and cloud placeholders
are protected. A matching hash alone never overrides these rules.

**Move to Recycle Bin is the default.**

> **Permanent deletion cannot be undone.** It is a separate, explicitly selected high-risk action.
> A trash failure never falls back to permanent deletion. Mirror folders are trash-only.
> Targets and keepers are revalidated before operations; changed files are skipped.

Each cleanup produces one timestamped CSV with operation intent and individual results. A pending
entry is not proof of deletion. Files in the Recycle Bin still occupy disk space.

[Download DupeSpace-Setup.exe](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest/download/DupeSpace-Setup.exe).
The installer offers an optional desktop shortcut. Built-in updates check the public release,
verify installer size and SHA-256, and require confirmation before installation.

The v1.7.0 source removes desktop cloud navigation, startup authentication and cloud operations,
and adds verified `.dupejob` handoff from the browser analyzer.
Its executable excludes OAuth clients and credentials. Earlier installed versions are unchanged
until the user updates; see GitHub Releases for the actually published installer version.

## Cloud retirement and privacy

The hosted cloud cleaner is being retired. In the local-first website version, old file-access,
scan, thumbnail, trash, restore and permanent-delete APIs return HTTP 410. No new Google OAuth
login or permission expansion is performed. The old entry attempts to revoke a previous grant
using the encrypted session and then sends visitors to the local analyzer.

Revocation cannot be guaranteed while the external service is unreachable or when a user never
returns. Users can revoke the old grant in their account's third-party access settings.
No Web Client Secret is needed by the new analyzer. Never commit credentials, tokens or user reports.

AdSense runs only on public marketing, download, guide and Space Notes article pages. Its approval is independent of
OAuth verification. Ads.txt and a script do not prove that ads are approved, filled or earning revenue.
See [transition notes](docs/LOCAL-FIRST-TRANSITION.md) for the current rollout status.

## Roadmap

Three focused directions: safe folder merging, exact duplicate cleanup and media organization.
Two-folder merge preview and exact duplicate analysis are available now. Similar-photo search,
automatic merge execution and browser storage-history charts are not part of the current release.

## Development and tests

Desktop: Python 3.10+; Windows 10/11 for the native application.

```powershell
python -m pip install -e ".[dev,legacy-tests]"
pytest
ruff check .
```

Website: retain the repository's Node 22 LTS CI setup and npm lockfile.

```powershell
cd web
npm ci
npm run dev
npm run build
npm run lint
node --test tests/*.test.mjs
```

Web regression tests cover renamed matches, version conflicts, complete-content matching, false sampled
matches, bounded reads, 5,001 synthetic files, cancellation, CSV injection, retired cloud routes, server-rendered bilingual
pages, nonce-based scripts and ad-free private routes. Desktop safety tests remain separate.

For Windows builds, see [deployment documentation](docs/WEB_DEPLOYMENT.md) and the release workflow.
The installer retains its upgrade AppId. Google libraries are only needed to test legacy source,
not to run or package the new desktop app. The release workflow no longer injects OAuth secrets.

MIT License. Please report issues with reproduction steps and redacted diagnostics, never private
file names, raw audit reports, credentials or tokens.
