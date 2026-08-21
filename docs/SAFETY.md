# DUPESPACE safety guide

DUPESPACE treats matching content as a duplicate candidate, not proof that every path is
disposable. Windows scans require at least one keep root and one clean root. Roots are resolved to
physical long paths and may not be equal, nested, or overlapping. Only size + full SHA-256 groups
that cross from keep to clean are shown; clean-only duplicates are completely excluded. All
keep-root records are locked and every group keeps at least one deterministic keeper.

Zero-byte files are ignored. Files below 1 MiB are visible but not preselected. Project/package
trees, applications/install resources, backups/snapshots, and sync folders are locked by default.
A folder can be unlocked only for the current scan after its full path, count, and bytes are shown
and the exact phrase `允許清理 <資料夾名稱>` is entered. Rescanning or changing roots resets it.
Offline and recall-on-access cloud placeholders are skipped without opening or hydrating them.

## Two independent operation modes

**Move to trash is always the default and recommended mode.** Windows files go through the
Recycle Bin API and Google Drive files are updated with `trashed=true`. A failure is reported as a
failure; it never falls back to permanent deletion.

> **Permanent deletion cannot be undone.** It is an independent advanced mode that the user must
> actively select. Its warning cannot be disabled. More than five files requires a second red
> confirmation and the exact phrase `永久刪除 N 個檔案`; 500+ files, 1 GB+, or 5,000+ files also
> triggers a full summary and countdown.

Before either operation, DUPESPACE revalidates the target and its keeper. Local checks cover the
physical path, file type, identity, byte size, modification time, and SHA-256. Drive checks cover
file ID, version, MIME type, ownership, modification time, size, checksum, keeper status, and the
specific trash/delete capability. Any changed item is skipped.

## Windows protected locations

Windows, System32, SysWOW64, WinSxS, Program Files, ProgramData, AppData, System Volume Information,
`$Recycle.Bin`, Recovery, EFI/Boot, Windows Installer/update caches, and OS-managed files are
excluded. Paths are discovered from Windows APIs, Known Folder/environment data, volume roots, and
file attributes rather than assuming Windows is installed on `C:`. Symbolic links, junctions,
mount points, reparse points, shortcuts, folders, hidden/system files, and path aliases cannot
bypass the restriction. Administrator privileges never disable these rules.

## Google Drive

Only owned binary files with a stable checksum are eligible. Native Google Workspace documents,
folders, shortcuts, shared-drive items, and files without the necessary capability are skipped.
The web cleaner uses encrypted HttpOnly OAuth sessions, 30-minute HMAC-signed scan proofs, batches
of 10 items, and distinct `/trash` and `/delete` server paths. Every trash response must explicitly
confirm `trashed=true`; confirmed items disappear from the result list immediately. File contents
never pass through the DUPESPACE server. Google-hosted thumbnails load directly in the user's
browser and are never proxied through DUPESPACE.

Drive uses its separately defined global policy: the oldest file is the keeper and zero-byte files
are ignored. A web scan selects all trash-eligible non-keeper duplicates for a one-click,
recoverable trash operation. Permanent mode always clears every selection and requires the user to
select targets again with the full high-risk confirmation.

## Windows temporary and junk files

DUPESPACE does not remove general Windows junk, caches, temporary files, update data, or delivery
optimization data. Those categories depend on operating-system state and should be reviewed with
Windows Storage Sense or Cleanup recommendations rather than guessed from filenames or folders.

## Audit and recovery

Every outcome is written to or downloadable as UTF-8 CSV with timestamp, source, operation mode,
status, name/path or Drive ID, size, checksum, and reason. Trash recovery depends on Windows and
Google retention policies. Permanent deletion has no recovery path.

Before a large cleanup: keep an independent backup, test on a small set, close editors, inspect
the keeper and every selection, and download the audit report. Safe stop finishes only the current
file or API batch; rescan before retrying so current state is evaluated again.
