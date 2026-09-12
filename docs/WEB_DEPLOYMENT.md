# Web deployment and retired Google access

DUPESPACE Web is a Cloudflare Worker-compatible Vinext application under `web/`. The current public
product is local-first: `/local` and `/merge` read only the files a visitor explicitly chooses and
perform analysis in that browser tab. File contents, paths and reports are not sent to DUPESPACE,
and the application has no file-analysis database.

## Google Drive retirement boundary

The public Google Drive analyzer and every Drive mutation route are retired. Do not enable the Drive
API, add restricted scopes, restore OAuth buttons or deploy new Google OAuth credentials for the
current product. Retired file-access routes fail closed with HTTP 410 before making a network call.

Two compatibility endpoints remain temporarily so previous users can inspect and revoke an existing
encrypted login cookie. Status checks never refresh a token. Disconnect is same-origin only, attempts
revocation first and retains a still-usable grant when revocation fails so the user can retry. These
endpoints must never be expanded into listing, scanning, trash or permanent-delete operations.

The endpoint publishes an HTTP `Sunset` date of **2027-03-31**. On or before that release boundary,
remove the compatibility cookie code and delete the unused hosting secrets. Until then, never print a token, cookie,
`GOOGLE_CLIENT_SECRET` or `SESSION_SECRET` in builds, logs, diagnostics or error pages.

## Browser analysis safety

The browser workspaces are read-only. They have no application code path for upload, move, delete or
permanent deletion. Candidate reduction may use file size and samples, but a duplicate result is
emitted only after complete content verification. If a file changes, cannot be read completely or the
visitor cancels, the analysis fails closed instead of returning partial results. Reports distinguish
content identity from user intent: project, application and backup copies remain review items, not
deletion advice.

## AdSense and search

The site declares publisher `ca-pub-7998471640181666` and publishes
`google.com, pub-7998471640181666, DIRECT, f08c47fec0942fa0` in `ads.txt`. Add `dupespace.app` to
AdSense, complete ownership review, and enable Auto Ads only after approval. The complete
`/local` and `/merge` workspaces do not load the AdSense script; file selection, analysis results and
other private work surfaces never contain ads. Enable Google Privacy & Messaging/CMP before public personalized ads.

Submit `https://dupespace.app/sitemap.xml` to Google Search Console and Bing Webmaster Tools after
verifying domain ownership. Canonicals always point to `https://dupespace.app`; legacy
`*.chatgpt.site` GET/HEAD requests redirect permanently to the canonical domain while preserving
path and query. `www.dupespace.app` redirects to the apex domain.
