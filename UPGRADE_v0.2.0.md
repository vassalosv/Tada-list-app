# TaDa v0.2.0 — Spaces and Android notifications

Update both your Pi's server/web files and the APK. The APK loads its UI from your selected HTTPS server. Use `https://tada-list.duckdns.org:8443` for this installation.

## Back up and update Docker on the Pi

Extract `TaDa-v0.2.0.zip` to `~/tada/update-v0.2.0/`. Keep using the original Compose directory and project name to retain the existing data volume:

```bash
cd ~/tada/TaDa-v0.1.0
mkdir -p ~/tada/backups
sudo docker compose stop tada
sudo docker compose run --rm --no-deps --entrypoint tar tada -C /app/data -czf - . > ~/tada/backups/tada-data-before-v0.2.0.tar.gz
cp .env ~/tada/backups/tada-env-before-v0.2.0
chmod 600 ~/tada/backups/tada-env-before-v0.2.0
cp -a ~/tada/update-v0.2.0/TaDa-v0.2.0/{server,shared,src,public,scripts,dist,package.json,package-lock.json,README.md,Dockerfile} .
sudo docker compose up --build -d
```

Keep your existing `.env`, `compose.yaml`, HTTPS proxy and data volume. Never use `docker compose down -v` during an upgrade. For a source checkout, update the files, run `npm ci` and `npm run build`, then restart the server. Node 22.13+ is required.

The first start automatically creates a **Personal** space for each existing account and places all its current lists there. Tasks, files, reminders and sharing permissions are retained. The migration is safe to repeat. Keep the pre-upgrade backup; rolling back should restore both the old source and that database backup.

## Spaces

- Use **Spaces** in the left menu to switch, and **Manage spaces** to create or rename one. Each account can have up to 20.
- New lists belong to the selected space. Within a list, use its **Space** selector to move it.
- Removing a space requires choosing another space and confirming the move. Its lists and tasks are preserved. The final space cannot be removed.
- Spaces are personal organization. Sharing one list does not expose its owner's other spaces or lists. Recipients can organize shared lists in their own spaces, including lists they can only view. Moving a shared list does not change anyone else's organization or permissions.
- Task dashboards, searches, counts and list choices follow the selected space. Notifications and Android reminder scheduling still cover all lists you can access, across every space.
- Phones and Android start with **My lists**. A left menu and quick list strip provide direct navigation. Desktop keeps its dashboard and persistent sidebar.

## Android system notifications

Install `TaDa-v0.2.0-android-debug.apk` over your existing debug build (same application ID and a compatible signing key are required). Open your HTTPS server, sign in, then choose **Enable notifications** on My lists or **Enable Android notifications** in the bell panel. Grant Android notification permission. For precise alarms, allow **Alarms & reminders** when offered.

- **Scheduled reminders:** Android's native alarm/notification APIs deliver saved reminders and due-date alerts in the system notification shade. No browser push or VAPID configuration is needed for the APK. Alarms are planned from the last synced state, up to 256 events over the rolling recurrence horizon.
- **Server alerts while closed:** a native WorkManager job checks the authenticated inbox approximately every 15 minutes, with network access. Android can postpone it during Doze or battery restrictions. It posts native notifications and suppresses matching recent local alarms to reduce duplicates. While the app is open, checks also run with its regular refresh.
- **Shared changes:** open TaDa after another person edits a reminder to refresh its precise alarm time. Background checks deliver newly generated server inbox alerts, but do not immediately reschedule or cancel previously saved local alarms.
- **Tests:** use **Test device notification** for the Android alarm path and **Test server notification** for the authenticated inbox/background path.
- **Privacy:** native checks use the selected trusted HTTPS server and the existing private WebView session; cookies are never returned to JavaScript or written into the release. Redirects are rejected, account identity is checked, revoked list access is filtered, and disabling/signing out cancels background work and scheduled local notifications. Android app-data backup is disabled.

Force-stopping the app prevents background delivery until it is reopened. Notification permission, channel settings, Do Not Disturb and battery controls still apply. Sessions expire after seven days; reopen and sign in again when needed. This release uses native alarms plus periodic native delivery, not real-time FCM push. Exact timing for newly changed remote reminders while the app stays closed would require a separate push transport. Physical-device delivery still needs testing on your phone.

## Web notifications and appearance

Browser tabs continue using browser push, with VAPID keys on the deployed Pi and per-browser permission/subscription. See `UPGRADE_v0.1.2.md` for that setup. Android hides browser-specific controls.

**Emerald** is the new default, matching the supplied green checkmark icon from sign-in through the dashboard. The app icon, favicon, Android launcher and launch screens use that supplied artwork. Saved theme choices are preserved; select **Change theme → Emerald → Apply theme** to switch an existing installation. Pastel, Dark, Material and Custom remain available.

## Validation

Run `npm test`, `npm run build`, `node tests/v020-ui.mjs`, and `npm run android:sync`. With JDK 21 and Android SDK 35, run `android/gradlew testDebugUnitTest assembleDebug`. The v0.2 UI check uses temporary accounts/data and covers five phone/foldable/desktop widths, space creation/isolation/persistence, list moves, reminder badges, and native-only notification controls. APK compilation and JVM tests do not establish physical Android notification delivery.
