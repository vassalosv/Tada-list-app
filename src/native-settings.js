import { Capacitor, registerPlugin } from "@capacitor/core";
const NativeAlerts = registerPlugin("NativeAlerts");
export const defaultServer = "https://tada-list.duckdns.org:8443";
export const nativeSettingsAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeAlerts");
export function normalizeServer(value) {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw Error(
      "Enter an HTTPS server address without a path, credentials or query",
    );
  return url.origin;
}
export async function changeServer(value) {
  if (!nativeSettingsAvailable())
    throw Error("Install the v1.0.0 Android app to change its server");
  await NativeAlerts.setServer({ origin: normalizeServer(value) });
}
export function systemAppearance(dark, background) {
  if (nativeSettingsAvailable())
    NativeAlerts.setAppearance({ dark, background }).catch(() => {});
}
