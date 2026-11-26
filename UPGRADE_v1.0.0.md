# TaDa v1.0.0 — compact home, shared Spaces and assignments

Update **both the Pi server/web files and Android APK**. Back up first: the server adds shared-Space permissions, list appearance/order, and private profile-photo storage. Existing accounts, tasks, files, lists and individual-list shares are retained.

## Pi / Docker upgrade

Copy `TaDa-v1.0.0.zip` to `/home/vangelis/`, then run on the Pi:

```bash
mkdir -p ~/tada/update-v1.0.0
unzip -o ~/TaDa-v1.0.0.zip -d ~/tada/update-v1.0.0
(
set -e
umask 077
cd ~/tada/TaDa-v0.1.0
backup_dir="$HOME/tada/backups/pre-v1.0.0-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
sudo docker compose stop tada
sudo docker compose run --rm --no-deps --entrypoint tar tada -C /app/data -czf - . > "$backup_dir/tada-data.tar.gz"
cp .env "$backup_dir/tada.env"
cp -a ~/tada/update-v1.0.0/TaDa-v1.0.0/{server,shared,src,public,scripts,dist,package.json,package-lock.json,README.md,Dockerfile} .
sudo docker compose up --build -d tada
sudo docker compose logs --tail=50 tada
)
```

Keep the original Compose directory/project name, `.env`, `compose.yaml`, data volume and Caddy configuration. Do not use `docker compose down -v`. `APP_ORIGIN` remains `https://tada-list.duckdns.org:8443`. Refresh the browser after updating. Restore the pre-upgrade database **and** old source together if rolling back. Source-only installations use `npm ci`, `npm run build`, then restart their Node service; Node 22.13+ is required.

## Android upgrade

Install `TaDa-v1.0.0-android-debug.apk` over a build signed with the same debug key. App ID stays `app.tada.tasks`; versionCode is 5. This is a debug build, not an app-store signed release.

The launcher now opens TaDa directly at **https://tada-list.duckdns.org:8443**, or a previously saved custom server. The initial server chooser is removed. Change it in **Account & profile → TaDa server**. The address must be an HTTPS origin with a trusted certificate. Switching servers clears this phone's sessions and scheduled alerts, then opens the new server for sign-in.

Status/navigation bars stay visible and content is inset below/above them, including Android 15 enforced edge-to-edge behavior. Icon brightness follows the selected light/dark appearance. Physical-phone checks for cutouts, system bars, background restrictions and server switching remain required.

## UI and collaboration

- Home retains Today, Scheduled, All and Overdue cards. Compact list rows follow immediately. The old large list tiles and horizontal list catalogue are removed. The mobile Add task button sits at the lower right.
- New lists default to a list icon and deep green. Choose an icon/color when creating a list, or use its three-dot **Edit list** control later. Editors can change list appearance; viewers cannot.
- Hold a list for about 0.4 seconds, drag, then release. Touch scrolling works before the hold activates. Keyboard users focus its reorder handle and press Up/Down. Ordering is saved per person and Space; it does not change another member's arrangement.
- **Share Space** creates an email-bound, single-use, seven-day invitation with view/edit permission. The owner can remove members. Access covers the Space's current and future lists; only an owner can invite or remove Space members. Space editors may create/edit lists; viewers may read them.
- A list received individually from someone else is not re-shared when its recipient shares a Space. Existing direct-list grants remain independent of Space grants. Revoking Space access leaves an independently shared list accessible. Moving/removing an owned Space can remove its inherited grants; review membership before reorganizing shared Spaces.
- **Assign to** includes yourself and everyone who currently has access to the list, including Space members. An assigned task sends new reminder/deadline notifications only to its assignee. Unassigned tasks retain notification delivery to list members. A former member must regain access or the task must be reassigned. Assignment does not change edit/view permissions.
- Profile pictures accept PNG, JPEG or WebP up to 2 MB. They are private database content, available only to yourself and people sharing a list/Space with you. Removing the picture restores initials; it also updates the top-right account icon.
- Every theme has a **Dark appearance** checkbox. Existing preferences are retained.

## Reminder delivery

The server scheduler, browser push dispatcher and Android inbox feed enforce current assignment and list access. Browser alerts still require deployed VAPID keys and per-browser permission/subscription. The APK uses native Android notifications without browser push keys.

**Task alarms now verify current assignment/access with the server before showing task text.** They also check the saved reminder/due event so deleted or changed reminders can be suppressed. A network connection and valid session are therefore needed at delivery. A temporary network failure is retried when connectivity returns, up to one hour after the scheduled time; no stale task text is shown while offline. A separate device test uses the native local-notification plugin without a task/server check.

Open TaDa to refresh precise alarm schedules after remote edits. Native background inbox checks still run approximately every 15 minutes and can be delayed by Android. Force-stop, Doze, battery restrictions, notification/channel settings, exact-alarm permission and session expiry can affect delivery. There is no real-time FCM transport. Already-displayed notifications cannot be recalled instantly on every offline device.

## Validation

`npm test` covers legacy migration, Space/list permissions, sharing current/future lists, order persistence, assignee validation, live interval-driven recipient delivery, reassignment/revocation, photo privacy, scheduling and server-address validation. `node tests/v1-ui.mjs` uses temporary accounts/data at five phone/foldable/desktop widths, including touch/mouse hold-to-reorder, list appearance, photos, lower Add task controls, Space invitations and dark appearance for every preset.

Web production build, Capacitor sync and `android/gradlew testDebugUnitTest assembleDebug` are checked with JDK 21 / Android SDK 35. These checks do not replace physical Android alarm/system-bar/server-switch testing. Release manifests/checksums are verified and private installation values are excluded from artifacts.
