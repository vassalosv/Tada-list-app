# TaDa v0.1.2 — start here

## Web application

1. Install a patched Node 22 LTS release (22.17+).
2. In this extracted directory run `npm ci` and `npm start`.
3. Open http://localhost:3001 and create your account.

The production web UI is already built in `dist/`. Running the server creates a fresh `data/` directory. No user data or passwords are shipped.

For development use `npm run dev` and http://localhost:5173. Rebuild changed web source with `npm run build`.

## Phone or foldable browser

Use the computer's current LAN IPv4 address with port 3001 on the same network, keeping the server running. Do not use localhost on the phone. The installation-specific LAN address in README is an example, not a packaged service address. Local mode discovers the server computer's IPv4 interfaces at startup; restart after switching networks. See README for firewall and network-isolation troubleshooting.

For ongoing or public use, deploy behind HTTPS and set APP_ORIGIN to the exact public origin. Docker Compose's default port binding is local-only for use with a reverse proxy. No service has been published by this release.

## Optional browser notifications

After creating your account:

```sh
npm run push:setup -- mailto:you@your-domain.com
```

Restart TaDa, open the notification bell, select Enable browser push and allow notifications. Keep the generated `.env` private and backed up. Phone push requires HTTPS. The package contains no push keys.

## Android preview

Install `artifacts/TaDa-v0.1.2-android-debug.apk` as an update to the previous debug build. Open TaDa, enter your server’s HTTPS origin and tap **Open TaDa**. The app remembers the address and checks the server before opening sign-in. Use Android Back to return to server setup.

The server URL must already work over HTTPS in the phone browser. For this installation it is `https://tada-list.duckdns.org`; that address will not work until its certificate and external connectivity are fixed. The chooser supports the existing v0.1.0 TaDa backend. Do not enter a localhost or plain HTTP LAN URL on the phone.

The APK is debug-signed and intended for testing, not app-store distribution. Native background push and offline mode are not included. Physical-device testing of the new chooser is still needed.

## Verify and test

`release-manifest.json` contains SHA-256 hashes of all packaged payload files. `SHA256SUMS.txt` beside the download contains hashes for the release ZIP, APK and release notes.

Run `npm test` for isolated API/worker tests. Read README for browser test commands and operational limits. Browser tests add temporary test accounts to whichever running server they target.

## Notification delivery

See `UPGRADE_v0.1.2.md` for browser push keys/permission and native Android reminder setup. Both updated server assets and APK are needed for Android reminder controls. No Firebase credentials are required for local device scheduling.
