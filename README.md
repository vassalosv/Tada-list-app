# TaDa List ;)

A responsive collaborative todo task list app inspired by everyday life. React + Vite, Express, SQLite (Node's built-in driver), private filesystem attachments, and a Capacitor 7 Android project. Fonts are bundled; no CDN is required.

## Run locally

Requires Node **22.17+** and npm. From this directory:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3001** and create an account. Passwords require 12–256 characters. Each account starts with three themed lists and three sample tasks that you can edit or delete. There is no default administrator or shared demo password.

For hot reload, run `npm run dev` and open http://localhost:5173. With no environment file, development and production choose the matching origin automatically. If setting APP_ORIGIN yourself, use the exact address and port you open in your browser.

`npm start` and `npm run dev` load `.env` if present. Copy `.env.example` only when configuring deployment or push. Do not commit secrets.

## Implemented

- Today, Scheduled, All, Overdue and Important views with live counts; responsive desktop sidebar and mobile drawer; themed lists, search, due-date/priority/star sorting, completion, task detail editor and deletion.
- Due dates and notes, important stars, three priorities, editable/checkable substeps.
- Authenticated file upload/download/delete, including photos, documents and audio; 20 MB per attachment. Attachments download rather than execute inline.
- Multiple reminders per task: one-off, daily, weekly and monthly. Each has independent timing. Durable SQLite scheduling checks every 15 seconds and catches overdue reminders after a restart. Repeated missed reminders coalesce to one notification and advance to the next future time.
- Recurring tasks create the next occurrence when completed. The next occurrence resets substeps and copies existing reminder schedules with a due-date offset. Files are not duplicated. Completing an occurrence twice without reopening it does not duplicate the next task. Reopening then completing again intentionally creates another occurrence.
- Upcoming deadline notifications within 24 hours, overdue notifications, an account notification inbox and optional browser Web Push. Notifications go to current list members. Browser push uses a transactional durable outbox with backoff retries, dead-subscription cleanup and permission checks before sending. Requires HTTPS (localhost is allowed for development), VAPID keys and browser permission.
- Local accounts with salted scrypt password hashes; seven-day opaque sessions stored hashed in SQLite; HttpOnly, SameSite cookies, Secure on HTTPS; origin checks, request limits, basic auth throttling, server-side list permissions on every task/file/reminder action.
- Email/password sign-in only. Registration requires a matching confirmation password, validated both in the browser and on the server.
- Owner-created, single-use invitation links, optional email restriction, seven-day expiry, view/edit roles, member listing and owner revocation. Share a link manually; email delivery is not included. Editing members cannot invite or revoke members. All collaborative changes refresh in other clients within 15 seconds.

## Sharing and identity details

Open a list and click **Share**. Choose view or edit, optionally restrict to an email, then copy the generated link. Recipients open it and sign in or create an account; acceptance requires the secret link. Unrestricted links are bearer invitations: send them only to the intended recipient.

Sign in with an email/password account to accept invitations. Email addresses are self-asserted; possession of the invitation token is always required. No email verification or account recovery is provided. Google/Microsoft sign-in has been removed.

## Deploy

`compose.yaml` builds and runs one server with a durable named volume. Set APP_ORIGIN to the public HTTPS origin in `.env`, then:

```sh
docker compose up --build -d
```

Put a TLS reverse proxy in front of 127.0.0.1:3001. Forward the original Host and allow uploads of at least 21 MB. APP_ORIGIN must match the public origin exactly (no trailing slash). The server serves both the built UI and `/api`, so no cross-origin API configuration is needed. Keep the volume on persistent local storage; do not put SQLite on NFS. Run one application replica. The scheduler runs within that process and resumes after downtime. SQLite transactions prevent partial notification/outbox writes.

Without Docker: `npm ci`, `npm run build`, set APP_ORIGIN, PORT (default 3001) and DATA_DIR (default data), then `npm start` under a process supervisor. Use a current patched Node 22 LTS release. The built-in SQLite driver emits an experimental warning on Node 22.

Back up the SQLite database using SQLite's online backup command or stop the app and copy the entire data directory including its uploads. Restoring only the database loses attachments. Keep database, uploads and push secrets out of public hosting directories. No automatic retention or quotas beyond the per-file limit are implemented; monitor storage.

### Browser push configuration

Configure keys once without printing private values:

```sh
npm run push:setup -- mailto:you@your-domain.com
```

The setup command preserves existing keys and saves configuration in the ignored `.env` file. If there is exactly one non-test account, `npm run push:setup` can use that account’s email as the required push-service contact. Restart `npm start` after configuration. Keep `.env` in backups and never publish it.

Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (e.g. `mailto:admin@example.com`). Preserve the private key across deployments. Open the bell in the UI and choose **Enable browser push** on each device. Use a supported browser such as Chrome, Firefox or Edge. The server allows known Google, Mozilla, Apple and Windows browser push endpoints. A maximum of five subscriptions per account is supported. Sign-out unsubscribes the current browser. Push can be duplicated after a process crash during network delivery; notifications use a stable tag to replace duplicates. Retry stops after nine attempts. The inbox is the durable record even when push delivery fails.

Push keys have been configured for this local installation, and the public-key/permission flow has been checked. Delivery through an actual browser push service is **not live-tested**; the user still needs to grant notification permission and enroll their browser. Native Android FCM delivery is **not implemented**; it requires native plugin integration, Firebase setup and device testing, not merely adding a credential.

## Android

The `android/` directory is a generated Capacitor 7 project. Android compilation was verified with JDK 21 and Android SDK 35. Capacitor packaging follows the official [Android workflow](https://capacitorjs.com/docs/android).

The app needs a reachable **HTTPS** backend; it is not offline-first. Starting with **v0.1.1**, the Android launcher opens a native server setup screen before any web login page. Enter your server origin (for this installation, `https://tada-list.duckdns.org`), then choose **Open TaDa**. The app validates the certificate and checks that `/api/state` returns the TaDa JSON API before loading it in the WebView. A saved address is remembered across launches. Use Android Back from the root TaDa page to return to setup and change it. The setup screen remains available when the server cannot be reached.

The v0.1.0 APK had no configured backend address; login/signup incorrectly attempted `/api` against the packaged local web assets, producing an HTML-as-JSON error. Install the v0.1.1 debug APK as an update. It uses Android versionCode 2 and the same application ID. A compatible debug signing key is required for an in-place update.

The server chooser works with the v0.1.0 email/password backend; **no backend upgrade is required for Android setup**. Your public HTTPS address must work in the phone browser first. It cannot solve blocked router/ISP ports, certificate issuance failures, or an offline server. HTTP and untrusted/self-signed TLS are rejected. No certificate validation is bypassed. Plain HTTP LAN addresses are not supported by this Android setup flow.

To rebuild: `npm ci`, `npm run android:sync`, then `npx cap open android`. Android Studio/JDK 21 and SDK 35 are required. The launcher uses the address selected on the device; a build-time TADA_SERVER_URL is not needed for this flow.

Local email/password accounts and the responsive UI run against the selected server. Native background push, offline sync, native audio recording and app-store signing/publishing are not included. Existing audio files can be selected for attachment. Native server chooser runtime behavior has not been tested on a physical phone or emulator in this environment; Android compilation and URL-validation unit tests pass.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
# Start the production server on port 3001 first:
node tests/browser.mjs
```

The API test uses three isolated accounts and a temporary database to verify session protection, view/edit permissions, unauthorized downloads, attachments, single-use invites, recurrence, reminders, CSRF origin rejection, validation and logout. Worker tests cover restart catch-up, deduplication, completed tasks, calendar month clamping, push retries and expired subscriptions. Browser checks create an account, create/edit tasks and subtasks, reload persisted state, navigate a 390px phone layout, schedule a reminder and complete a task, asserting no JavaScript errors or horizontal overflow. Browser tests intentionally add a test account to the running local server. Screenshots are saved in `screenshots/`.

Verified: production web build, four automated test cases with many assertions, desktop/mobile Chromium flows, Android debug compilation. Not verified: real push delivery, Docker execution, physical Android device behavior or app-store release.

## Operational limits

This is a runnable foundation, not a claim of production certification. Collaboration uses polling and last-save-wins whole-task updates: simultaneous edits can overwrite one another. Recurrence follows UTC calendar time (monthly clamps to the last available day); it does not maintain a chosen local wall clock across daylight-saving changes. Reminders are bounded by server uptime and the 15-second tick; no delivery SLA is promised. Files are private but do not have malware scanning or encryption at rest. No account deletion, password reset, administrator console, audit log or automated migrations beyond additive table creation is included. Auth throttling is per-process/IP; configure a trusted edge limiter for public deployment. Monitor disk use and retained notification/outbox history.

Source map: `src/main.jsx` UI, `src/style.css` layout, `server/index.js` API/auth/authorization, `server/db.js` schema and reminder worker, `server/push.js` push dispatcher, `public/sw.js` browser notifications, `tests/` verification, `compose.yaml` deployment, `android/` native wrapper.

## Appearance and new task options

Use the palette icon on the login screen or dashboard header to select **Pastel** (the original), **Dark**, **Material**, or **Custom**. Custom offers a hex/native color picker and Material HCT hue, chroma and tone controls, plus light/dark appearance. Matching surfaces/text colors use Google's Material color utilities. Apply saves the preference in this browser, including across sign-out and reload; Cancel leaves the current theme unchanged.

A new task already includes **Attachments** and **Reminders**. Choose up to ten files (20 MB each) and add multiple one-off or repeating reminders before Save. These remain local drafts until the task is saved; closing the editor discards them. Saving creates the task, attachment metadata and reminders in one database transaction; failures clean uploaded temporary files. Existing tasks still support adding/removing files and reminders.

## Smartphones, foldables and local Wi-Fi

TaDa responds to the available **CSS viewport**, rather than detecting model names. Portrait and landscape phones, narrow foldable cover screens, unfolded near-square screens, and split-screen windows are supported. The responsive test matrix covers widths from 280 to 1440 CSS pixels, with 26 viewport shapes in Chromium and WebKit (Safari's engine). This includes sizes representative of iPhone regular/Pro/Max, Galaxy regular/Ultra and Fold cover/inner layouts. These are emulated viewport tests, not certification on specific model generations or unreleased phones.

Navigation becomes a drawer through 1000px; wider screens use the sidebar. On mid-sized unfolded displays all four dashboard cards fit in one row and themed lists appear beneath tasks. Compact covers use two dashboard columns. Editors adapt to width and dynamic viewport height, allow scrolling above a keyboard, use safe-area insets, and use 16px inputs to avoid iOS focus zoom. Open task drafts survive rotation and resizing. Reduced-motion preferences are respected. Dual-screen browser spanning over a physical hinge is not enabled; TaDa uses the contiguous viewport supplied by the OS.

To open the running local app from a phone:

1. Put the phone on the same home/local network as the computer running TaDa.
2. Start `npm start` on the computer, without APP_ORIGIN set for local mode.
3. Open the computer's LAN IPv4 address and port 3001 in the phone browser. On this machine, the current address is **http://192.168.11.2:3001**. It may change when the network changes; `ipconfig` shows the current address. `localhost` on a phone refers to the phone itself.
4. Keep the computer and server running. If a connection is blocked, allow the Node/TaDa application through the computer's firewall for your trusted local network; no router port forwarding is needed. The guest Wi-Fi/client-isolation setting can also prevent phone-to-computer access.

The server binds to all interfaces. Without explicit APP_ORIGIN it permits only localhost, loopback, and this computer's actual IPv4 interface origins at the configured port; arbitrary origins remain rejected. Invitations created through a LAN address retain that address. Explicit APP_ORIGIN deployments remain restricted to that origin. Local address detection happens at startup: restart the server after changing networks. HTTP LAN access is for local testing; deploy HTTPS for normal use and browser push. No firewall or router settings are changed automatically. Docker's default loopback-only port binding remains intended for deployment behind a reverse proxy.

Run responsive checks against the running server:

```sh
npx playwright install chromium webkit
node tests/responsive.mjs
node tests/local-network.mjs http://YOUR-COMPUTER-IP:3001
```

The responsive checks cover dashboard overflow, drawer navigation, task/reminder/theme editor overflow, reachable save controls, rotation/unfolding with an unsaved draft, and saved attachment/subtask persistence. The network test verifies signup and task/subtask creation through the real LAN IP using an insecure HTTP browser context. It runs from the host; actual phone connectivity, virtual-keyboard behavior and hardware folding still need testing on devices.

## Account profile and changing passwords

Tap/click the avatar at the top right on any screen size to open **Account & profile**. It displays your name, email address, account type and a masked password indicator. Stored passwords/hashes are never returned to the browser or displayed.

To change your password, enter the current password, a new password of 12–256 characters and matching confirmation. The server verifies the current password, rejects unchanged passwords, updates the salted scrypt hash transactionally and revokes other sessions while keeping the current session signed in. An account-based limit allows ten password-change attempts per ten minutes; a successful change resets the counter. The form clears entered passwords after success; closing the panel also discards them. Profile name/email are informational in this version.

`npm test` covers incorrect current passwords, mismatched confirmation, short/reused passwords, authentication requirements, successful updates, old/new login behavior and other-session revocation. With the server running, `node tests/profile.mjs` checks the panel in Chromium and WebKit at six viewport sizes, including password-change flows and clearing of entered secrets.

The push configuration smoke check is `node tests/push-config.mjs` against the running configured server. It confirms only the public key is returned and the enable action reaches browser permission, without granting permission or enrolling a temporary browser. Local `http://localhost:3001` supports browser push; a phone connecting through a LAN IP needs HTTPS.

## v0.1.2 notification delivery

See `UPGRADE_v0.1.2.md` for Pi Docker upgrade and notification setup. This version adds delivery diagnostics/test buttons and Android LOCAL device reminders (separate from browser push or native FCM). Install the new APK AND update the server UI. Native background FCM remains unimplemented; local scheduled alarms work from the last synced task/reminder state, with the horizon/OS limits described in the upgrade guide.
