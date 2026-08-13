# Web deployment and Google OAuth

DupeSweep Web is a Cloudflare Worker-compatible Vinext application under `web/`. It stores no file
contents and has no application database. Google access and refresh tokens remain inside an
AES-GCM encrypted, HttpOnly, SameSite cookie. Every deletion candidate also carries a server-signed
proof that expires after 30 minutes.

## Google Cloud setup

1. Enable Google Drive API in a Google Cloud project.
2. Configure the OAuth consent screen, application homepage, privacy policy, and terms URLs.
3. Create an OAuth client of type **Web application**.
4. Add `https://YOUR-SITE/api/google/callback` as an authorized redirect URI.
5. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random 32+ character
   `SESSION_SECRET` as hosting secrets.
6. Submit the `https://www.googleapis.com/auth/drive` scope for Google verification before public
   launch. Until approval, only explicitly listed test users can sign in.

The web cleaner lists owned binary My Drive files in pages of 1,000. It skips Workspace-native
files, shortcuts, shared-drive items, files without checksums, and files that cannot be trashed.
Browser cleanup calls contain at most 100 selected files. Before every mutation, the server checks
the signed proof, current version, checksum, ownership, trash permission, and protected keeper.

## AdSense setup

The site declares publisher `ca-pub-7998471640181666` and publishes the required `ads.txt` entry.
After deployment, add the final domain in AdSense, complete ownership review, and enable Auto ads.
Do not place ads inside the deletion confirmation flow or encourage clicks.
