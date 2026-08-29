# DUPESPACE V1.0.0

DUPESPACE V1 is the first formal Windows local-cleanup release. It replaces the legacy utility
layout with a native Qt desktop application that shares the website's teal and emerald visual
language while keeping destructive actions visually and technically separate.

## Windows desktop

- Native sidebar navigation for local cleanup, Google Drive, history, safety, and preferences.
- Explicit keep roots and clean roots; keep-root files cannot be selected or deleted.
- Project, package, virtual-environment, system, reparse-point, shortcut, backup, sync, and cloud
  placeholder protections.
- Searchable virtual result table suitable for more than 5,000 items without one widget per row.
- Recoverable Recycle Bin mode by default and an independently confirmed permanent-delete mode.
- Durable intent journal plus per-item CSV audit outcomes.
- User-bound DPAPI protection for the Desktop OAuth token with no plaintext fallback.
- Existing v0.6.0 installations upgrade in place and preserve preferences and reports.

## Google Drive website

- Full-width working surface without a boxed application frame or advertising gutters.
- Group priority: video, image, PDF, important documents, audio, folders, archives, then other.
- One large protected-original preview per group; duplicate copies use text and full paths.
- Only the active group body is mounted, which bounds thumbnail decoding and large-result DOM work.
- The cleaner remains ad-free to avoid accidental ad clicks near file-selection and deletion controls.

## Release status and limitations

- The Windows installer is not Authenticode-signed. Windows may show an unknown-publisher warning;
  the release includes a SHA-256 checksum for independent verification.
- Google Drive uses the restricted full-Drive scope. Public OAuth publication does not replace
  Google's restricted-scope data-access verification; the real demonstration video and review
  remain an external release dependency for unrestricted Drive availability.
- AdSense review and ad inventory are external states. DUPESPACE does not claim ad delivery or
  revenue until AdSense reports the site as ready.
