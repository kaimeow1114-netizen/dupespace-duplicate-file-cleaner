# DUPESPACE

**Local file analysis in your browser. Safe duplicate cleanup for Windows.**

[本機唯讀分析 / Local analyzer](https://dupespace.app/local) ·
[Windows 下載說明](https://dupespace.app/download) ·
[English website](https://dupespace.app/en/) ·
[Latest release](https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/releases/latest)

## 本機優先，免費開源

DUPESPACE 正在轉型為不依賴託管雲端帳號的檔案整理工具。網頁提供免登入、零上傳的
本機重複檔案分析；Windows 應用程式提供真正的本機清理。網站與桌面程式仍是不同產品表面，
網站部署不會自動改變已安裝的桌面版本。

內容相同只表示「重複候選」，不能證明另一份沒有用途。不同專案的設定檔、
套件、外掛與備份即使完全一樣，也可能需要同時存在。

## Browser analyzer

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
- No AdSense, external frames or external social counter requests on the analyzer routes.

## Windows application

The existing native Qt application provides a collapsible teal sidebar, folder picker and drag-and-drop,
optional protected subfolders, virtual duplicate groups, lightweight previews, audit history and issue reporting.
It recursively scans only the locations selected by the user. A protected subfolder never replaces
the separately protected keeper outside that subfolder.

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

The v1.6.0 source removes desktop cloud navigation, startup authentication and cloud operations.
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

AdSense runs only on public marketing, download and guide pages. Its approval is independent of
OAuth verification. Ads.txt and a script do not prove that ads are approved, filled or earning revenue.
See [transition notes](docs/LOCAL-FIRST-TRANSITION.md) for the current rollout status.

## Roadmap

Three focused directions: exact duplicate cleanup, media organization, and folder/backup integrity.
Similar-photo search, missing-file backup verification and browser storage-history charts are not
part of the current browser release. Homepage concept visuals are labelled as demonstrations.

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

Web regression tests cover complete-content matching, false sampled matches, bounded reads,
5,001 synthetic files, cancellation, CSV injection, retired cloud routes, server-rendered bilingual
pages, nonce-based scripts and ad-free private routes. Desktop safety tests remain separate.

For Windows builds, see [deployment documentation](docs/WEB_DEPLOYMENT.md) and the release workflow.
The installer retains its upgrade AppId. Google libraries are only needed to test legacy source,
not to run or package the new desktop app. The release workflow no longer injects OAuth secrets.

MIT License. Please report issues with reproduction steps and redacted diagnostics, never private
file names, raw audit reports, credentials or tokens.
