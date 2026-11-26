# TaDa v1.0.0 — Compact home and shared planning

**Release date:** 26 November 2026
**Android build:** Debug preview; versionCode 5

- Redesigned home: existing Today/Scheduled/All/Overdue cards followed by compact list rows; removed large list tiles and horizontal list catalogue.
- Editable list icons/colors with deep-green/list defaults. Touch or mouse hold-and-drag ordering, plus keyboard reorder controls, saved per user/Space.
- Share whole Spaces through expiring email-bound view/edit invitations, including current and future owned lists. Existing individual-list grants remain independent.
- Assign tasks to current list/Space participants or yourself. Server scheduling, browser dispatch and Android delivery enforce the assignee and current access.
- Protected profile photos update account avatars; initials remain the fallback.
- Lower-right mobile Add task button, visible Android system bars with theme-aware icons, and dark appearance for every theme.
- Android launches directly into the default HTTPS server; change the address in Account & profile.
- Native task alarms validate assignment and the saved event at delivery. This prevents stale cached task alerts from showing to a previous assignee; it requires connectivity and retries transient failure for up to one hour.

Update **both the server/web assets and APK**. See `UPGRADE_v1.0.0.md` for backup/migration, sharing semantics and Android setup. Physical-device alarm/status-bar/server-switch testing remains required. Native background inbox delivery is periodic, not real-time FCM push. No private settings, accounts, profile photos, databases, uploads or private keys are included in release artifacts.

Validation: 14 automated tests, five-width browser/UI checks including touch reorder and photos, production web build, Capacitor sync, Android compilation/JVM tests and artifact/private-value checks.

## Downloads

- `TaDa-v1.0.0-server.zip`: self-hostable server/web package for the Pi, with source, built UI and deployment files.
- `TaDa-v1.0.0-android-debug.apk`: Android installation package.
- `TaDa-v1.0.0.zip`: complete source package, Android project and debug APK.
- `UPGRADE_v1.0.0.md`: Pi update and Android setup instructions.
- `SHA256SUMS.txt`: checksums for the supplied files.
