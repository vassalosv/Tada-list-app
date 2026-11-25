# TaDa v0.1.1 — Android connection hotfix

**Release date:** 25 November 2026  
**Status:** Preview / debug Android build

## Fixed

The v0.1.0 debug APK displayed a local copy of the web login screen without a configured backend. Sign-in and registration requested the packaged `/api` path, received an HTML page and displayed “Unexpected token '<' … is not valid JSON”.

## Changed

- Android now starts with a native server setup screen. Enter an HTTPS origin and choose **Open TaDa**.
- Setup checks the trusted HTTPS certificate and the TaDa JSON API before opening sign-in. Wrong addresses, HTML responses, network failures and TLS failures display connection guidance.
- The server address is remembered on the device. Android Back from the root TaDa screen returns to server setup.
- The web API client now handles HTML, malformed JSON and network errors without exposing raw parser errors or returned HTML.
- App/package version is 0.1.1; Android versionCode is 2, application ID remains `app.tada.tasks`.

## Installation

Install `TaDa-v0.1.1-android-debug.apk` over the previous debug APK. It uses the same development signing key on this machine. Enter `https://tada-list.duckdns.org` once that server is reachable with a valid certificate.

The new chooser works with the existing v0.1.0 email/password backend. No server/database migration is needed for this client fix. The ZIP also includes updated web source/assets for deployments that need the friendlier API error messages.

## Important limits

This fixes the Android backend-selection problem. It does **not** fix the separate router/ISP connectivity and certificate problem for the Duck DNS hostname. The HTTPS address must work in the phone browser before the app can connect. HTTP origins and invalid certificates are rejected.

This is a debug testing build, not a signed app-store release. Offline mode and native Android background push remain unimplemented. Accounts, uploads, local server data and private push keys are excluded from the package. The original v0.1.0 release files are retained unchanged.

## Validation

- Production web build passed.
- Five API/client/worker automated test cases passed, including HTML-response and network-failure handling.
- Chromium regression checks passed for login error handling and the existing task/signup workflows.
- Android debug compilation and two JVM unit tests passed for allowed/rejected server origins.
- The package includes SHA-256 checksums and a per-file manifest, and is scanned for local account/password/push secrets.
- No Android phone or emulator was connected; the native setup UI and successful end-to-end Android server login still require device testing.

See README and QUICK_START for setup instructions and the earlier release's operational limits.
