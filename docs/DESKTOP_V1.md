# DUPESPACE Windows V1

## Design

Native Qt Widgets, not an embedded website. A deep teal sidebar anchors a light, spacious
workspace. Teal is the primary action, emerald marks protected originals, amber explains
attention states, and rose is reserved for permanent deletion. No emoji or artificial health
scores are used. The existing DUPESPACE icon and original sounds are retained.

- First launch exposes one large click/drop target and shows only the selected recursive scope.
- Navigation: local cleanup, Google Drive, history, safety, GitHub/reporting, preferences.
- The sidebar collapses, and its bottom account area shows unauthenticated state or the connected
  Google identity and avatar.
- Account email comes from Drive's authenticated `about.user`; Desktop OAuth uses the existing
  Drive scope without a separate email scope for the identity label.
- Root profiles are explicit, local-only, revalidated on load, and never store unlocked state.
- The result model virtualizes rows without creating a checkbox widget for each file.
- A full-path detail view includes safe local image previews or two folder trees.
- Primary actions remain separate from the scrollable result list.
- Motion is subtle: page fades, a scan orbit, a result counter. Reduced motion preserves all text.

## Release boundary

Windows local cleanup is the V1 release target. Drive remains visibly marked as pending
data-access verification until the real demonstration video and Google review are completed.
The website's production authorization screen and the desktop data-access review are not
the same as completed restricted-scope verification.

## Safety and audit

- Each cleanup-root group locks its oldest exact copy; an optional nested protected folder can
  supply the keeper and is never eligible for selection.
- Permanent mode clears selection. Its warnings and countdown cannot be disabled.
- Trash and permanent deletion use separate executors; no automatic fallback exists.
- The desktop writes intent before each operation/batch and flushes results to disk.
- An audit-write failure stops later work. An incomplete intent means an uncertain result.
- Stop/close waits for the current operation to finish; it never kills the worker mid-mutation.
- Every attempt exports results, including skipped/failed/cancelled items.
- Moving to trash does not claim to release physical disk space.
- Revalidation narrows TOCTOU exposure but is not an atomic filesystem snapshot.

## Verification commands

```powershell
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe scripts/desktop_preview.py
.venv/Scripts/python.exe -m dupespace --smoke-test
```

The DPAPI integration test uses a synthetic token and must run under a normal Windows user
token; a restricted execution sandbox can reject the underlying Windows API. It does not
require elevation to Administrator. Local deletion tests use isolated fixtures or injected
no-op executors, never personal files. Real Drive deletion is not part of this suite.

## Before publishing the final V1 tag

- Pass CI on Windows/Linux and Python 3.10/3.13.
- Run the frozen EXE smoke test, then verify the real installer on a clean Windows environment.
- Verify upgrade from v0.6.0, preserving the Inno AppId and user reports/preferences.
- Verify the optional desktop shortcut and uninstall behavior without deleting user data.
- Publish installer SHA-256 and accurately disclose Authenticode signing status.
- Update the website only after the new release artifact is actually downloadable.
- Keep Google verification and AdSense review status truthful and separate from desktop readiness.
