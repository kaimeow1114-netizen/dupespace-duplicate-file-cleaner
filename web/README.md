# DupeSpace Web

The public DupeSpace website combines a product landing page, Windows installer download,
Google Drive duplicate cleaner, safety guide, privacy policy, terms, and Google AdSense setup.

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and configure these production secrets
through the hosting provider:

- `GOOGLE_CLIENT_ID`: Google OAuth **Web application** client ID.
- `GOOGLE_CLIENT_SECRET`: matching OAuth client secret.
- `SESSION_SECRET`: at least 32 random characters, used to encrypt 30-minute HttpOnly cookies and sign
  short-lived scan proofs.

The OAuth authorized redirect URI is `https://YOUR-SITE/api/google/callback`. The Drive API and
OAuth consent screen must be enabled in the same Google Cloud project. Public use of the full Drive
scope requires Google verification before accounts outside the test-user list can authorize it.

AdSense publisher `ca-pub-7998471640181666`, the official Auto Ads loader, and `public/ads.txt`
are included on public information pages. The cleaner and its file-operation routes do not load
AdSense. In AdSense, exclude `/cleaner` and turn off side rail, vignette, and anchor formats before
enabling Auto Ads. Revenue begins only after the deployed domain is approved and marked Ready.

The homepage and privacy policy publish explicit Google API Services User Data Policy and Limited
Use disclosures. Google user data is never supplied to AdSense, used for ad personalization, or
used for any purpose beyond the user-requested duplicate-file workflow.

## Commands

```bash
npm ci
npm run dev
npm run build
npm run lint
node --test tests/rendered-html.test.mjs
```
