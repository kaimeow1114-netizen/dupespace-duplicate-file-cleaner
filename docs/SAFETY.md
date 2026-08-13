# DupeSweep safety guide

DupeSweep treats a file as an exact duplicate only when both content size and a full content
checksum match. Names, extensions, dates, and folders are not enough.

The web cleaner adds encrypted HttpOnly OAuth sessions, 30-minute signed scan proofs, batches of at
most 100 items, and server-side metadata revalidation of both the selected file and protected
keeper before each Drive mutation. A browser request can only move a file to Drive trash; no web
endpoint performs permanent deletion.

## Before cleanup

1. Back up irreplaceable data independently.
2. Test with a small folder or a small Drive account first.
3. Close programs that may be editing the scanned files.
4. Review the protected keeper and every selected copy.
5. Check available Recycle Bin space and your Google Drive trash policy.

## Local files

- Directory traversal does not follow symbolic links.
- Multiple directory entries pointing at the same hard-link identity are scanned once.
- Unreadable or changing files are skipped and reported as scan warnings.
- Before trashing, DupeSweep verifies the file still has the same filesystem identity, byte size,
  and nanosecond modification timestamp observed during the scan.
- `send2trash` asks the operating system to move each item to the Recycle Bin. Recovery behavior
  ultimately depends on the operating system and filesystem.

## Google Drive

- Only owned binary files in My Drive are included by default.
- Shared-drive items and files shared by someone else are excluded.
- Native Google Docs, Sheets, Slides, folders, and shortcuts have no usable binary checksum and
  are excluded.
- The tool patches `trashed=true`; it does not call permanent-delete or empty-trash endpoints.
- Requests are split into batches of at most 100, matching the current Drive API limit.
- A cancelled operation stops before the next batch; the batch already in flight can finish.

## Keeper rule

The oldest item is protected. Ties are resolved by shorter location and then lexical order, making
the choice deterministic. A protected keeper cannot be toggled into the deletion set.

## Large operations

For 500 or more selected files, the UI requires the exact phrase `移除 N`, where `N` is the shown
file count. Progress and per-item failures remain visible. After any interruption, rescan before
retrying so the current filesystem and Drive state are evaluated again.
