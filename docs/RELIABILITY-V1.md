# DUPESPACE reliability qualification

This phase proves the existing product instead of adding another utility.

## Release gates

- The Windows release workflow installs the published v1.5.1, v1.6.0 and v1.7.0 packages, places
  synthetic preferences and an audit report in the user-data directory, upgrades in place,
  starts the packaged app, verifies the optional desktop shortcut, uninstalls it and confirms
  that user data remains.
- The packaged executable must start in its isolated smoke mode and ship with a SHA-256 checksum.
- The release source and package contain no Google Drive scanner, cleanup client, OAuth flow,
  OAuth client configuration or Google SDK dependency.
- The only temporary cloud code is the hosted, revoke-only legacy session endpoint. It publishes
  a `Sunset` date of 2027-03-31 and cannot scan, preview, restore, trash or delete a file.
- The explicit Windows grant-revocation command first migrates an old plaintext `token.json` to
  current-user DPAPI storage. If encryption fails, it stops without contacting Google; if the
  revoke request fails, only the protected copy remains for a later retry. No new OAuth client or
  Drive access is created.

## Browser-to-Windows handoff

The `.dupejob` file is an untrusted hint, not deletion authority. The Windows app:

1. rejects unknown schemas, algorithms, malformed relative paths and repeated records;
2. constrains every path to the folder selected by the user;
3. reads only manifest candidates instead of enumerating unrelated files;
4. rechecks size, modification time, safety context and complete content;
5. rebuilds duplicate groups and keeper selection using current desktop rules;
6. sends changed, missing, project, protected and invalid entries to warnings instead of cleanup.

The report contains names and relative paths. Users must redact it before attaching it to a public
issue. It contains no file content and cannot bypass the normal review or cleanup confirmation.

## Automated scale test

The manual `stress-windows-local-scan` workflow supports 10,000, 100,000 and 500,000 generated
files. It writes only to the disposable GitHub runner, performs no cleanup, and records enumeration,
hashing, duplicate counts, elapsed time and process peak working-set memory. Memory is measured
without instrumenting every allocation, so the benchmark does not distort normal scanner timing.

## Hardware matrix

These cases require real hardware and must not be claimed as passed until evidence is recorded:

| Storage or interruption | Scan | Cancel | Recycle Bin | Device/permission loss | Evidence |
| --- | --- | --- | --- | --- | --- |
| Internal NTFS SSD | Pending | Pending | Pending | Pending | Pending |
| Internal NTFS HDD | Pending | Pending | Pending | Pending | Pending |
| External NTFS drive | Pending | Pending | Pending | Pending | Pending |
| External exFAT drive | Pending | Pending | Not assumed | Pending | Pending |
| SMB/UNC network share | Pending | Pending | Not assumed | Pending | Pending |

For unsupported Recycle Bin targets, the application must fail closed. A failure must never become
permanent deletion. Device removal, permission loss and file changes must be represented in the
single CSV audit report without claiming that an unconfirmed target was removed.
