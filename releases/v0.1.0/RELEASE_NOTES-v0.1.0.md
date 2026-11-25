# TaDa v0.1.0

**Release date:** 24 November 2026  
**Status:** Initial preview release

TaDa brings personal and shared tasks into a responsive, self-hostable web app, with an Android wrapper built from the same UI.

## Included in this release

- Pastel Today, Scheduled, All and Overdue dashboards, themed lists, search, important stars, priority/date sorting and completion tracking.
- Task editing with due dates, notes, checkable substeps, recurring tasks, multiple one-off/repeating reminders, and photo/document/audio attachments. New tasks can include files and reminders before their first save.
- Shared lists with single-use, expiring invitation links, view/edit permissions, owner-controlled membership and server-side authorization.
- Email/password registration with password confirmation. The top-right account panel shows name, email and app version, and supports password changes with current-password verification. Changing a password signs out other sessions.
- Pastel, Dark, Material and Custom themes, including hex and Material HCT color controls. Preferences persist in the browser.
- Responsive phone/foldable layouts: compact covers, unfolded screens, portrait/landscape, safe-area spacing, touch controls and drafts preserved across resizing.
- Durable SQLite reminder scheduling, upcoming-deadline notification inbox, optional browser push with retry handling, and a push setup command that retains private keys locally.
- Self-hosting with Express/SQLite, Docker Compose configuration, setup documentation, and a generated Capacitor Android project.

Google/Microsoft login is not part of this release; authentication uses email/password.

## Package contents

`TaDa-v0.1.0.zip` contains source, dependency lockfile, built web assets, server, Android project, tests, deployment files, setup notes, dependency notices, per-file checksums, and the debug APK in `artifacts/`.

The companion `TaDa-v0.1.0-android-debug.apk` is a **debug-signed packaging preview**. It contains no backend address. Deploy a reachable HTTPS backend and rebuild with `TADA_SERVER_URL` before using Android as a connected app. It is not an app-store release or an offline standalone task application.

Personal accounts, databases, uploaded files, local environment files, push private keys, browser screenshots and local build caches are excluded. Browser push keys must be configured separately on each installation.

## Quick start

Requires Node 22.17+ and npm. Extract the ZIP, enter its `TaDa-v0.1.0` folder, then:

```sh
npm ci
npm start
```

Open http://localhost:3001 and register an account. The prebuilt UI is included; use `npm run build` after editing source. See `README.md` and `QUICK_START.md` for HTTPS deployment, Wi-Fi access, push and Android setup.

## Validation

- API/worker automated checks: authentication, sharing permissions, attachments, task recurrence, reminder catch-up/deduplication, push retry handling, password validation and session revocation.
- Chromium and WebKit: 26 viewport shapes each; navigation, editor layout and draft preservation during folding/rotation.
- Account/password browser checks at six viewport shapes in both engines.
- Local-network signup and task/subtask creation through the computer's LAN address.
- Production web build and Android debug compilation.
- Release archive contents and SHA-256 checksums are checked during packaging; a clean extraction is tested separately before delivery.

These are automated browser/layout checks, not certification of named phone models. Real push-service delivery, physical device behavior, Docker execution and app-store publication have not been verified.

## Known limitations

- Android needs a deployed HTTPS server; native Android background push, offline sync and app-store signing/publishing are not included.
- Browser push needs server keys, browser permission and HTTPS; localhost is suitable for desktop testing. Plain HTTP LAN addresses on phones do not support push. On iOS, browser/platform installation requirements also apply.
- Collaboration refreshes by polling; simultaneous whole-task saves use last-save-wins behavior.
- Recurrence follows UTC calendar time; it does not preserve local wall-clock time across daylight-saving changes.
- No email verification, forgotten-password recovery, profile name/email editing, email invitation delivery, malware scanning or administrator console.
- Keep the server running for reminders. Back up the database together with uploaded files. Push retries and notifications do not provide a delivery SLA.

This preview is intended for evaluation and small self-hosted installations. Read the operational limits in `README.md` before deployment.
