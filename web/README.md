# DUPESPACE Web

Bilingual local-first website with a read-only folder analyzer, Windows download guide,
privacy/terms, and advertising on public information pages.

## Runtime configuration

The analyzer needs no account, OAuth client or Web Secret. Existing deployments keep the
original SESSION_SECRET only for best-effort revocation of legacy encrypted sessions.
Do not replace that key until the migration window is over. Never commit .env files.

## Advertising boundary

Publisher: ca-pub-7998471640181666. The loader appears only on marketing, download and
guide pages. /local and /en/local/ use a strict same-origin CSP and no advertising code.
The public pages use fresh script nonces. Auto Ads is enabled in the account; as of
September 3, 2026 the site is under review, not Ready. Ads.txt is authorized.
Account-level exclusions are tracked in the transition notes until explicitly approved.

## Commands

```sh
npm ci
npm run dev
npm run build
npm run lint
node --test tests/*.test.mjs
```

See ../docs/LOCAL-FIRST-TRANSITION.md for current scope, migration behavior and known limits.
