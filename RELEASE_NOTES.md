# TaDa v0.1.2 — notification delivery update

**Release date:** 25 November 2026  
**Status:** Preview / debug Android build

## Added

- A notification status panel reports worker health, browser push configuration, registered browsers, next reminder and the last push-service outcome.
- A **Test server notification** button separates inbox scheduling from browser push delivery.
- Native Android scheduled notifications, permission controls, precise-timing settings, sync count and a device test notification. This is local scheduling without Firebase credentials, not native server push.
- A private diagnostic command, `npm run reminders:check`, for clock/database/key-presence checks. Push failures now produce sanitized status codes in server logs.

## Fixed

- Browser permission is requested directly from the enable action, before waiting for server configuration.
- Browser subscriptions with an outdated VAPID application key are replaced during enable.
- Push test events can be delivered without a task ID.
- Device schedules use stable IDs, synchronize edits/cancellations while open, avoid duplicate alarms and refresh on foregrounding.

## Deploy

**Update both the Pi server/web assets and the Android APK.** See `UPGRADE_v0.1.2.md` for an in-place Docker upgrade that preserves the existing Compose project/data volume and private `.env`. The public origin remains `https://tada-list.duckdns.org:8443`. Browser push keys must be configured on the Pi; keys from development were not shipped.

The Android APK has application ID `app.tada.tasks`, versionName 0.1.2 and versionCode 3, and is debug signed. The original v0.1.0/v0.1.1 release files are retained unchanged. No local accounts, databases, uploads or private keys are included.

## Behavior and limits

Browser delivery still requires a supported browser, notification permission, a valid subscription, VAPID keys and an operating system that allows notification display. The UI's accepted status indicates provider acceptance, not guaranteed OS display.

Android reminders need the v0.1.2 APK and server UI. Scheduled local alerts can fire after backgrounding; shared edits made elsewhere do not update a closed app. Open TaDa to refresh. Recurring schedules use a rolling 30-day horizon, plus the next occurrence outside it, capped at 256 alerts. Android permissions, exact-alarm access, force-stop, Doze and battery restrictions can affect delivery. Native background server/FCM push is not implemented.

## Validation

- API/client/worker tests include real interval-driven reminder delivery to the inbox, status/test authorization and throttling, retry/expired-subscription behavior, local schedule planning and duplicate/cancellation handling.
- Chromium browser checks cover the delivery-status panel, test inbox notification, phone layout and existing task/signup flows.
- Android compilation and JVM URL-validator tests pass.
- Release manifest/checksums and local-secret scan are verified during packaging.
- Physical Android alarm delivery and actual browser push-provider delivery require testing on your device; no phone/emulator was connected here.
