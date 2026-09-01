# DUPESPACE v1.5.3

This release gives the Windows Google Drive authorization flow a clear, branded and safer
completion experience.

## Improved

- The loopback OAuth completion page now uses the DUPESPACE visual language, confirms that Google
  Drive is connected, tells the user to return to the app and provides a close-tab action.
- The page is self-contained and loads no advertising, analytics, remote scripts, fonts or images.
- The one-time authorization response is removed from the visible address bar after completion.

## Security

- The local callback keeps the exclusive loopback listener, PKCE, OAuth state validation and the
  existing Drive-only scope.
- The completion response uses a restrictive Content Security Policy, no-store caching,
  no-referrer behavior, MIME sniffing protection and a disabled browser permissions policy.
- OAuth tokens remain protected with the current Windows user's DPAPI; no Web Client Secret is
  added to the desktop package.

## Verification

- The Google verification video is now <https://youtu.be/F1SJ4HhlEvw> and covers both Web and
  Desktop OAuth clients.
