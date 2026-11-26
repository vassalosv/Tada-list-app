# TaDa v0.2.0 — Your spaces, closer at hand

**Release date:** 26 November 2026
**Status:** Preview / debug Android build

## Added and changed

- Up to 20 personal **Spaces**, with creation, renaming, list moves and safe removal that preserves lists/tasks. Existing accounts migrate into Personal automatically; shared-list permissions and each recipient’s private organization are preserved.
- Lists-first landing on phones/Android, a labelled left menu, and direct quick-list navigation.
- A compact bell beside task titles when reminders are set.
- A consistent **Emerald** default theme matching the supplied green checkmark icon, across sign-in, dashboard, navigation, dialogs and native server setup. Existing theme choices remain available and saved preferences are retained.
- Supplied artwork for the app brand, favicon, Android launcher and launch screens.
- Android system notifications through native alarms and a native authenticated background inbox worker. Android settings now expose Android controls; VAPID/browser setup is reserved for the web app.
- Native delivery deduplicates matching recent local alarms, validates account identity and current list access, and cancels work on disable/logout. Credentials are not exposed to JavaScript or included in release artifacts.

## Deployment and limits

Update both the server/web assets and Android APK. See `UPGRADE_v0.2.0.md` for backup, Docker update and permission steps. Android versionCode is 4; the APK is debug signed.

Native background inbox checks run approximately every 15 minutes and can be delayed by Android. Saved local alarms provide scheduled timing; open the app after remote edits to refresh their times/cancellations. Force-stop, notification denial, session expiry, Doze, exact-alarm permission and battery restrictions affect delivery. Real-time FCM push is not implemented. Physical-device delivery needs verification on your phone.

The release excludes private settings, accounts, databases, uploads and private push keys.

## Validation

- Automated API, scheduling, native synchronization and legacy-to-Spaces migration/access-control tests.
- Production web build and phone/foldable/desktop UI checks at five widths, including Android-specific notification presentation.
- Android APK compilation and JVM tests for server URL validation and notification duplicate policy.

---

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
