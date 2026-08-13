# DupeSpace Web

The public DupeSpace website combines a product landing page, Windows installer download,
Google Drive duplicate cleaner, safety guide, privacy policy, terms, and Google AdSense setup.

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and configure these production secrets
through the hosting provider:

- `GOOGLE_CLIENT_ID`: Google OAuth **Web application** client ID.
- `GOOGLE_CLIENT_SECRET`: matching OAuth client secret.
- `SESSION_SECRET`: at least 32 random characters, used to encrypt HttpOnly cookies and sign
  short-lived scan proofs.

The OAuth authorized redirect URI is `https://YOUR-SITE/api/google/callback`. The Drive API and
OAuth consent screen must be enabled in the same Google Cloud project. Public use of the full Drive
scope requires Google verification before accounts outside the test-user list can authorize it.

AdSense publisher `ca-pub-7998471640181666` and `public/ads.txt` are included. Revenue begins only
after the deployed domain is added to AdSense, approved, and Auto ads are enabled.

## Commands

```bash
npm ci
npm run dev
npm run build
npm run lint
node --test tests/rendered-html.test.mjs
```
