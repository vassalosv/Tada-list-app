import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { devicePlan } from "./reminder-plan.js";
export const isNativeDevice = () => Capacitor.isNativePlatform();
const ready = () =>
  isNativeDevice() && Capacitor.isPluginAvailable("LocalNotifications");
const key = (user) => "tada.deviceReminders." + user;
let queue = Promise.resolve();
let needsReschedule = true;
export function clearDeviceReminders() {
  if (!ready()) return Promise.resolve();
  return (queue = queue
    .catch(() => {})
    .then(async () => {
      const p = await LocalNotifications.getPending();
      if (p.notifications.length)
        await LocalNotifications.cancel({
          notifications: p.notifications.map((n) => ({ id: n.id })),
        });
      await LocalNotifications.removeAllDeliveredNotifications();
    }));
}
export async function syncDeviceState(
  state,
  plugin = LocalNotifications,
  origin = location.origin,
  force = false,
) {
  const wanted = devicePlan(state.tasks);
  const pending = (await plugin.getPending()).notifications.filter(
    (n) => n.extra?.kind !== "test",
  );
  const byId = new Map(pending.map((n) => [n.id, n]));
  const ids = new Set(wanted.map((n) => n.id));
  const liveTasks = new Set(
    state.tasks.filter((t) => !t.done).map((t) => t.id),
  );
  const stale = pending.filter((n) => {
    if (
      n.extra?.user !== state.user.id ||
      n.extra?.origin !== origin ||
      !liveTasks.has(n.extra?.taskId)
    )
      return true;
    const at = new Date(n.schedule?.at).getTime();
    // The server consumes one-off reminders at their due time. Do not cancel
    // a still-pending Android alarm merely because the OS is delivering late.
    if (!ids.has(n.id) && at <= Date.now() && at >= Date.now() - 3600000)
      return false;
    return !ids.has(n.id);
  });
  if (stale.length)
    await plugin.cancel({
      notifications: stale.map((n) => ({ id: n.id })),
    });
  const changed = wanted.filter((n) => {
    const old = byId.get(n.id);
    return (
      force ||
      !old ||
      old.title !== n.title ||
      old.body !== n.body ||
      old.extra?.user !== state.user.id ||
      old.extra?.origin !== origin
    );
  });
  if (changed.length)
    await plugin.schedule({
      notifications: changed.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        channelId: "tada-reminders",
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        extra: {
          taskId: n.taskId,
          user: state.user.id,
          origin: origin,
        },
      })),
    });
  return {
    count: wanted.length,
    precise:
      (await plugin.checkExactNotificationSetting()).exact_alarm === "granted",
  };
}
export function useDeviceReminders(state) {
  const [status, setStatus] = useState({
    enabled: false,
    count: 0,
    precise: false,
    error: "",
  });
  const [revision, bump] = useState(0);
  useEffect(() => {
    if (!ready()) return;
    let alive = true;
    if (!state) return;
    if (localStorage.getItem(key(state.user.id)) !== "true") {
      clearDeviceReminders().catch(() => {});
      setStatus({ enabled: false, count: 0, precise: false, error: "" });
      return;
    }
    queue = queue
      .catch(() => {})
      .then(async () => {
        if ((await LocalNotifications.checkPermissions()).display !== "granted")
          throw Error("Android notification permission is disabled");
        const result = await syncDeviceState(
          state,
          LocalNotifications,
          location.origin,
          needsReschedule,
        );
        needsReschedule = false;
        return result;
      });
    queue
      .then((result) => {
        if (alive) setStatus({ enabled: true, error: "", ...result });
      })
      .catch((e) => {
        if (alive) setStatus((s) => ({ ...s, error: e.message }));
      });
    return () => {
      alive = false;
    };
  }, [state, revision]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") {
        needsReschedule = true;
        bump((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, []);
  return {
    ...status,
    native: isNativeDevice(),
    available: ready(),
    enable: async () => {
      if (!ready())
        throw Error(
          "Install the v0.1.2 Android app to enable device reminders",
        );
      if ((await LocalNotifications.requestPermissions()).display !== "granted")
        throw Error("Allow TaDa notifications in Android settings");
      await LocalNotifications.createChannel({
        id: "tada-reminders",
        name: "Task reminders",
        description: "Scheduled TaDa reminders and deadlines",
        importance: 4,
        visibility: 0,
      });
      localStorage.setItem(key(state.user.id), "true");
      needsReschedule = true;
      bump((n) => n + 1);
    },
    disable: async () => {
      localStorage.removeItem(key(state.user.id));
      await clearDeviceReminders();
      bump((n) => n + 1);
    },
    preciseSettings: () => LocalNotifications.changeExactNotificationSetting(),
    test: async () => {
      if (!ready()) throw Error("Install the v0.1.2 Android app first");
      if ((await LocalNotifications.checkPermissions()).display !== "granted")
        throw Error("Enable device reminders first");
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2147480001,
            title: "TaDa notification test",
            body: "Device notifications are working.",
            channelId: "tada-reminders",
            schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
            extra: { kind: "test" },
          },
        ],
      });
    },
  };
}
