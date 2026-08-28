# DUPESPACE safety guide

DUPESPACE treats matching content as a duplicate candidate, not proof that every path is
disposable. Windows scans require at least one keep root and one clean root. Roots are resolved to
physical long paths and may not be equal, nested, or overlapping. Only size + full SHA-256 groups
that cross from keep to clean are shown; clean-only duplicates are completely excluded. All
keep-root records are locked and every group keeps at least one deterministic keeper.

Zero-byte files are ignored. Files below 1 MiB are visible but not preselected. Project/package
trees, applications/install resources, backups/snapshots, and sync folders are excluded from
whole-folder comparison; risky individual-file contexts remain locked by default and can be
unlocked only for the current scan after their full path, count, bytes, and exact confirmation
phrase are reviewed. Rescanning or changing roots resets that temporary unlock.
Offline and recall-on-access cloud placeholders are skipped without opening or hydrating them.

Duplicate folders are detected separately from files. Two folder trees must have identical
relative paths, byte sizes, and full checksums; empty folders alone do not qualify. Folder cleanup
is trash-only. Immediately before use, DUPESPACE rebuilds and compares the tree manifest, file
count, total bytes, and newest modification time. A detected change cancels the operation before
the trash request. This is not a filesystem transaction or snapshot: concurrent writes after
validation remain a race risk. Close editors and pause writers/synchronization before cleanup.
The optional `.DS_Store`/`Thumbs.db`/`desktop.ini` ignore rule is off by default;
when enabled, those files are ignored only for matching and still move with the folder to trash.

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
mount points, reparse points, shortcuts, hidden/system files, and path aliases cannot
bypass the restriction. Administrator privileges never disable these rules.

## Google Drive

Only owned binary files with a stable checksum are eligible. Verified, owner-controlled My Drive
mirror folders can be moved to trash, while native Google Workspace documents, shortcuts,
non-owner folders, shared-drive items, and items without the necessary capability are skipped.
The web cleaner uses encrypted Secure/HttpOnly/SameSite OAuth sessions with a sliding 30-day
maximum age, 30-minute HMAC-signed scan proofs, batches
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

The native desktop writes a durable per-operation intent before changing files and flushes
each result to an operation journal. If audit storage fails, later operations stop. A `pending`
entry without a result is uncertain, not proof of deletion. The final CSV has one row per
selected item, including those cancelled before execution. Spreadsheet formula prefixes in
untrusted names and paths are escaped with a leading apostrophe.

Moving files to trash does not free the disk space occupied by that trash. The desktop labels
successful moved/deleted *logical bytes* separately from disk-space claims; it never empties
the Recycle Bin automatically and does not manufacture a healthy score after a failed operation.

Before a large cleanup: keep an independent backup, test on a small set, close editors, inspect
the keeper and every selection, and download the audit report. Safe stop finishes only the current
file or API batch; rescan before retrying so current state is evaluated again.
