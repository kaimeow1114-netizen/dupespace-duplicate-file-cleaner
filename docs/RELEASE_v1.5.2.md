# DUPESPACE v1.5.2

This release fixes Desktop Google Drive sign-in and aligns the native client with the Google
verification declaration.

## Fixed

- The Windows app now requests only the existing Google Drive scope. Account name, email and
  avatar continue to come from Drive `about.get`; no separate userinfo email scope is requested.
- The protected Desktop OAuth companion value is injected by GitHub Actions. The confidential
  Web Client Secret is never included in the installer.
- Existing Drive-only and legacy Drive/email tokens can be reused without prompting for an
  unnecessary email permission.
- The release is versioned as 1.5.2 so installations of the broken 1.5.1 build can discover the
  update instead of incorrectly reporting that they are current.

## Verified

- Real Desktop OAuth authorization, account display and DPAPI-backed restart persistence.
- A read-only Google Drive scan completed successfully; no cleanup operation was used for this
  acceptance test.
- Windows packaged startup, Recycle Bin integration, upgrade and uninstall in GitHub Actions.

## Release guard

The release workflow now rejects inconsistent versions across Python package metadata, runtime
UI and Inno Setup, and rejects a Git tag that does not match those version sources.
