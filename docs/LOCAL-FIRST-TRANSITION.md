# Local-first website transition

## Delivered website scope

- Existing full-bleed DUPESPACE visual identity and motion retained.
- `/local` and `/en/local/` analyze explicitly selected local files without an account, upload, or write permission.
- Size prefilter, edge samples and versioned complete-content chunk SHA-256 fingerprints. The fingerprint is not a standard whole-file SHA-256 or BLAKE3 digest.
- Reference order uses browser modification time; it must not be advertised as detecting the original creation date. No candidate is automatically deleted.
- Project, program and backup context receives a review warning. Zero-byte files are ignored.
- Twenty groups per page; bounded image previews; videos are never automatically decoded.
- Stop/unmount cancellation, no overlapping runs, CSV formula neutralization, and deterministic tests including 5,001 synthetic files.
- All previous cloud file APIs return 410. Session migration uses only the existing session encryption key to attempt token revocation. No new OAuth login, no Web Secret use, no scope expansion.
- A failed revocation retains the encrypted legacy cookie for retry, never for file access. Users can revoke the old grant through account settings. Devices that do not revisit cannot be remotely wiped.

## Advertising

AdSense publisher: `pub-7998471640181666`.

AdSense script is included on marketing, download and guide pages. The analyzer has no ad script, no external social counter, no external frames, and a separate CSP. Marketing scripts use request-specific CSP nonces. No ad gutters or placeholder frames are reserved.

On September 3, 2026 the AdSense dashboard showed Auto Ads enabled, ads.txt authorized, and the site still under review. This is not Ready and does not establish ad delivery or income. Account-level page exclusions require confirmation before saving.

## Not included in this website release

- Similar-photo detection, media library management, missing-file backup verification and storage trend history are roadmap features, not current browser capabilities.
- A desktop BLAKE3 engine remains future work. The desktop v1.6.0 source now removes cloud UI,
  startup authentication and cloud operations; packaging excludes the old OAuth modules and secrets.
  Earlier installed releases do not change until the user installs the new release.
- The owner confirmed they personally sent the Google cancellation reply. No further email is required.

## Verification

September 3 local verification: production build and TypeScript passed; 36 automated web tests passed.
Browser file-picker QA used only three synthetic files and correctly returned one duplicate group.
The local analyzer had no horizontal overflow at 390, 768 and 1440 pixel viewport settings.
Credential-pattern and environment-key scans found no matches in 167 source/build text files.
This does not undo the earlier environment-key exposure in a diagnostic task log; its manager
should rotate that key. Public deployment and account-level changes are pending approval.

Run TypeScript, ESLint, `vinext build`, then `node --test tests/*.test.mjs`. Removed cloud runtime tests are replaced with 410/no-file-access and legacy-session-revocation regression tests. Reusable legacy utility safety tests remain.

The new social preview was edited with the built-in image tool. Prompt: preserve the DUPESPACE wordmark, Chinese title, navy/teal composition and cloud-document brand mark; replace the subtitle with “Windows + Web | 零上傳・本機分析”, replace the metric heading with “重複候選容量”, and label the number “介面示意”. No real user data or credentials were used.

## September 3 copy and desktop follow-up

- Product copy names the actual category: duplicate file finder and Windows cleaner. Vendor-specific
  ad jargon stays in privacy disclosures, not the product pitch. Existing homepage motion is retained.
- Added two practical guide topics in both languages, Article/Breadcrumb metadata, unique share
  metadata, matching visible FAQ/JSON-LD and page-preserving language links.
- See `SEO-AND-MONETIZATION.md` for the search-intent map and non-blocking advertising boundaries.
- Desktop local-first release source is v1.6.0. Cloud cleanup is rejected before journaling or mutation;
  the remaining explicit legacy revocation helper cannot log in, refresh tokens or follow redirects.
- Desktop build output is isolated under `outputs/local-first-1.6.0/`; no installed application or
  user folder was replaced. Publishing the website, tag, release and installer still awaits approval.

Final follow-up validation:

- Web: TypeScript, ESLint, production build and all 39 regression tests passed.
- Python: 176 passed and 2 existing platform/integration skips across isolated runs
  (52 desktop UI, 122 other tests, one native DPAPI test, one 5,001-real-file scan).
- The DPAPI synthetic-token test required the normal user context outside the restricted sandbox.
- The 5,001-file native scan passed in 69.50 seconds on this development environment. This includes
  fixture setup and is not a public speed claim. A combined diagnostic run was interrupted and a
  30-second faulthandler run crashed; the isolated functional runs above passed. CI's diagnostic
  threshold is now 180 seconds; its job timeout and all safety assertions remain in place.
- The packaged v1.6.0 EXE passed its isolated startup smoke test. Its module archive contains neither
  the old Drive SDK nor desktop OAuth client/configuration modules.
- Local homepage preview responds HTTP 200. The previous viewport checks predate this copy/guide
  pass; no new visual screenshot or live-domain verification is claimed here.
