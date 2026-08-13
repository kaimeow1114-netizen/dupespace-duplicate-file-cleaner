# DUPESWEEP safety guide

DUPESWEEP treats files as exact duplicates only when content size and a full content checksum
match. Names, extensions, dates, and folders are never enough. Every group has one deterministic,
locked keeper that cannot be selected or removed.

## Two independent operation modes

**Move to trash is always the default and recommended mode.** Windows files go through the
Recycle Bin API and Google Drive files are updated with `trashed=true`. A failure is reported as a
failure; it never falls back to permanent deletion.

> **Permanent deletion cannot be undone.** It is an independent advanced mode that the user must
> actively select. Its warning cannot be disabled. More than five files requires a second red
> confirmation and the exact phrase `永久刪除 N 個檔案`; 500+ files, 1 GB+, or 5,000+ files also
> triggers a full summary and countdown.

Before either operation, DUPESWEEP revalidates the target and its keeper. Local checks cover the
physical path, file type, identity, byte size, modification time, and SHA-256. Drive checks cover
file ID, version, MIME type, ownership, modification time, size, checksum, keeper status, and the
specific trash/delete capability. Any changed item is skipped.

## Windows protected locations

Windows, System32, SysWOW64, WinSxS, Program Files, ProgramData, System Volume Information,
`$Recycle.Bin`, Recovery, EFI/Boot, Windows Installer/update caches, and OS-managed files are
excluded. Paths are discovered from Windows APIs, Known Folder/environment data, volume roots, and
file attributes rather than assuming Windows is installed on `C:`. Symbolic links, junctions,
mount points, reparse points, shortcuts, folders, hidden/system files, and path aliases cannot
bypass the restriction. Administrator privileges never disable these rules.

## Google Drive

Only owned binary files with a stable checksum are eligible. Native Google Workspace documents,
folders, shortcuts, shared-drive items, and files without the necessary capability are skipped.
The web cleaner uses encrypted HttpOnly OAuth sessions, 30-minute HMAC-signed scan proofs, batches
of at most 100 items, and distinct `/trash` and `/delete` server paths. File contents never pass
through the DUPESWEEP server.

## Audit and recovery

Every outcome is written to or downloadable as UTF-8 CSV with timestamp, source, operation mode,
status, name/path or Drive ID, size, checksum, and reason. Trash recovery depends on Windows and
Google retention policies. Permanent deletion has no recovery path.

Before a large cleanup: keep an independent backup, test on a small set, close editors, inspect
the keeper and every selection, and download the audit report. Safe stop finishes only the current
file or API batch; rescan before retrying so current state is evaluated again.
