# Web deployment and Google OAuth

DUPESWEEP Web is a Cloudflare Worker-compatible Vinext application under `web/`. It stores no file
contents and has no application database. Google access and refresh tokens remain inside an
AES-GCM encrypted, HttpOnly, SameSite cookie. Every operation candidate carries a server-signed
proof that expires after 30 minutes.

## Google Cloud setup

1. Enable Google Drive API in the DUPESWEEP Google Cloud project.
2. Configure the OAuth brand as **DUPESWEEP** with:
   - Homepage: `https://dupesweep.app`
   - Privacy: `https://dupesweep.app/privacy`
   - Terms: `https://dupesweep.app/terms`
3. Create a **Web application** client with origin `https://dupesweep.app` and redirect URI
   `https://dupesweep.app/api/google/callback`.
4. Create a separate **Desktop application** client for the Windows app. Never package the Web
   Client Secret in the desktop executable.
5. Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random 32+ character `SESSION_SECRET`
   only as encrypted production hosting variables. Never commit credentials, tokens, or user data.
6. Add explicit test users until Google verification is complete.
7. Submit the restricted `https://www.googleapis.com/auth/drive` scope for verification. Public
   users outside the test list cannot be promised access before approval; Google may also require
   an independent security assessment.

The full Drive scope is required to find and manage pre-existing user-selected duplicate files.
Both trash and permanent deletion use that same already-declared scope; the permanent operation
does not introduce an additional scope. The application still checks `canTrash` or `canDelete`
immediately before the corresponding API call.

## Runtime safety

Listings use Drive pages of up to 1,000 items and mutations use application batches of at most 100.
`PATCH trashed=true` and `DELETE files/{id}` are separate endpoints and code paths. A trash failure
never invokes permanent delete. Every operation revalidates target and keeper metadata, ownership,
checksum, version, modified time, and capability, then returns a full per-item audit outcome.

## AdSense and search

The site declares publisher `ca-pub-7998471640181666` and publishes
`google.com, pub-7998471640181666, DIRECT, f08c47fec0942fa0` in `ads.txt`. Add `dupesweep.app` to
AdSense, complete ownership review, and enable ads only after approval. Ads must stay outside all
confirmation dialogs.

Submit `https://dupesweep.app/sitemap.xml` to Google Search Console and Bing Webmaster Tools after
verifying domain ownership. Canonicals always point to `https://dupesweep.app`; legacy
`*.chatgpt.site` hosts redirect permanently to the canonical domain.
