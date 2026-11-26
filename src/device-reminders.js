import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { devicePlan } from "./reminder-plan.js";
export const isNativeDevice = () => Capacitor.isNativePlatform();
const NativeAlerts = registerPlugin("NativeAlerts");
const backgroundReady = () =>
  isNativeDevice() && Capacitor.isPluginAvailable("NativeAlerts");
export async function pollNativeAlerts() {
  if (backgroundReady()) await NativeAlerts.poll();
}
const taskAlarmPlugin = {
  getPending: async () => {
    try {
      return await NativeAlerts.getAlarms();
    } catch {
      throw Error(
        "Update the Android APK to v1.0.0 to enable assignment-aware task alarms",
      );
    }
  },
  cancel: (data) => NativeAlerts.cancelAlarms(data),
  schedule: ({ notifications }) =>
    NativeAlerts.scheduleAlarms({
      notifications: notifications.map((n) => ({
        ...n,
        schedule: { ...n.schedule, at: new Date(n.schedule.at).getTime() },
      })),
    }),
  checkExactNotificationSetting: () =>
    LocalNotifications.checkExactNotificationSetting(),
};
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
      if (backgroundReady()) await NativeAlerts.disable();
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
  const wanted = devicePlan(state.tasks, Date.now(), state.user.id);
  const pending = (await plugin.getPending()).notifications.filter(
    (n) => n.extra?.kind !== "test",
  );
  const byId = new Map(pending.map((n) => [n.id, n]));
  const ids = new Set(wanted.map((n) => n.id));
  const liveTasks = new Set(
    state.tasks
      .filter((t) => !t.done && (!t.assignee || t.assignee === state.user.id))
      .map((t) => t.id),
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
        smallIcon: "ic_stat_tada",
        iconColor: "#006644",
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        extra: {
          taskId: n.taskId,
          eventKey: n.key,
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
        if (localStorage.getItem("tada.nativeDeliveryVersion") !== "1") {
          const old = await LocalNotifications.getPending();
          if (old.notifications.length)
            await LocalNotifications.cancel({
              notifications: old.notifications.map((n) => ({ id: n.id })),
            });
          localStorage.setItem("tada.nativeDeliveryVersion", "1");
        }
        const result = await syncDeviceState(
          state,
          taskAlarmPlugin,
          location.origin,
          needsReschedule,
        );
        needsReschedule = false;
        if (backgroundReady()) {
          await NativeAlerts.configure({
            user: state.user.id,
            after: state.notificationCursor?.created || 0,
            afterId: state.notificationCursor?.id || "",
            alarms: devicePlan(state.tasks, Date.now(), state.user.id).map(
              ({ taskId, at }) => ({
                taskId,
                at,
              }),
            ),
          });
          await NativeAlerts.poll();
        }
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
    background: backgroundReady(),
    enable: async () => {
      if (!ready())
        throw Error(
          "Install the v1.0.0 Android app to enable Android notifications",
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
      if (!ready()) throw Error("Install the v1.0.0 Android app first");
      if ((await LocalNotifications.checkPermissions()).display !== "granted")
        throw Error("Enable device reminders first");
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2147480001,
            title: "TaDa notification test",
            body: "Device notifications are working.",
            channelId: "tada-reminders",
            smallIcon: "ic_stat_tada",
            iconColor: "#006644",
            schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
            extra: { kind: "test" },
          },
        ],
      });
    },
  };
}
