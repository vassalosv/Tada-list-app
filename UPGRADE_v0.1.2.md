# Upgrade to TaDa v0.1.2 — notification delivery

Your reminder inbox already receiving entries means the server scheduler works. Browser and Android system alerts are separate delivery paths. The older APKs do not implement native device reminders. Browser push keys configured on the Windows development machine were deliberately excluded from the release: configure keys on the Pi separately.

## 1. Transfer and extract

Copy `TaDa-v0.1.2.zip` to `/home/vangelis/` on the Pi. Then:

```bash
mkdir -p ~/tada/update-v0.1.2
unzip ~/TaDa-v0.1.2.zip -d ~/tada/update-v0.1.2
cd ~/tada/TaDa-v0.1.0
```

Keep using the existing Docker Compose directory. Changing the project directory can create a different Docker volume and make your existing accounts appear missing.

## 2. Back up and update in place

```bash
mkdir -p ~/tada/backups
sudo docker compose stop tada
sudo docker compose run --rm --no-deps --entrypoint tar tada -C /app/data -czf - . > ~/tada/backups/tada-data-before-v0.1.2.tar.gz
cp .env ~/tada/backups/tada-env-before-v0.1.2
chmod 600 ~/tada/backups/tada-env-before-v0.1.2
cp -a ~/tada/update-v0.1.2/TaDa-v0.1.2/{server,shared,src,public,scripts,dist,package.json,package-lock.json,README.md,Dockerfile} .
sudo docker compose up --build -d
```

These commands preserve `.env`, `compose.yaml`, Caddy and your existing named data volume. Keep `APP_ORIGIN=https://tada-list.duckdns.org:8443` in `.env`. Do not run `docker compose down -v`.

## 3. Configure browser push ON THE PI

Use your real contact email in place of the placeholder:

```bash
sudo docker compose run --rm --no-deps --user "$(id -u):$(id -g)" -v "$PWD/.env:/app/.env" tada node scripts/configure-push.mjs "mailto:YOUR_EMAIL_ADDRESS"
sudo docker compose up -d
```

The setup preserves an existing key pair. A missing pair is generated and saved in the host `.env` through the bind mount. Key values are not printed. This contact is for VAPID authentication; it does not send an email. Never share `.env`, private keys, subscription endpoints or Duck DNS tokens.

Reload `https://tada-list.duckdns.org:8443` in Chrome/Edge/Firefox, open the bell, and select **Enable browser push**. Grant notification permission. Permission/subscriptions are specific to this HTTPS origin and browser, so enable it at the new `:8443` address even if enabled previously elsewhere.

The notification panel should show **Configured** and at least one registered browser. Click **Test server notification**. The inbox should update immediately; browser push should arrive if the provider and OS permit delivery. **Accepted by push service** confirms the provider accepted it, not that the OS displayed it. Check OS notification settings / Do Not Disturb if delivery is accepted without an alert. A provider failure code is shown in the panel; 401/403 may mean VAPID/subscription mismatch. The Enable action replaces a browser subscription when its application key differs from the server key.

## 4. Enable Android reminders

Install `TaDa-v0.1.2-android-debug.apk` as an update. The Pi server must also run the new source/assets: the APK loads the server's UI.

1. Connect to `https://tada-list.duckdns.org:8443` and sign in.
2. Open the bell and choose **Enable device reminders**; allow Android notifications.
3. If prompted by the status text, choose **Allow precise timing** and enable Alarms & reminders in Android settings. Return to TaDa.
4. Wait for a synced-alert count, then choose **Test device notification**.
5. Schedule an actual reminder at least two minutes ahead on an incomplete task, sync, then put the app in the background.

Device reminders are LOCAL Android alarms, not FCM/server push. The app syncs changes while open and on return to the foreground. It schedules the next 30 days of recurring occurrences plus the first future occurrence outside that window, capped at 256 alerts. Refresh by opening TaDa. Reopen after shared tasks change on another device; an app that stays closed cannot receive those changes/cancellations. Signing out cancels this app's pending device reminders and clears delivered local notifications. Android force-stop, denied permissions, battery settings, clock changes and OS idle limits may affect delivery. Without exact-alarm permission, Android may deliver late. Even with permission, idle-mode limits can delay closely spaced alarms. Native FCM delivery while closed remains out of scope for this release.

## 5. Diagnostics

```bash
sudo docker compose exec tada node scripts/check-reminders.mjs
sudo docker compose logs --tail=100 tada
```

The diagnostic prints key-presence flags, database counts, and upcoming/due reminder times; it does not print private keys or user/task contents. No browser alert with inbox delivery usually indicates missing configuration, browser subscription, denied permission, push-service failure or OS notification suppression. The native APK uses its separate device-reminder controls.

For a two-minute test, leave TaDa open long enough to synchronize. Browser reminders check every 15 seconds and the inbox refreshes every 15 seconds. Completed tasks do not generate new reminders.

Android native delivery has been compiled and its planning/synchronization logic unit-tested; physical-device delivery still needs verification on your phone. Actual browser push-provider delivery also needs your device permission/subscription test.
