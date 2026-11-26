import test from "node:test";
import assert from "node:assert/strict";
import { syncDeviceState } from "../src/device-reminders.js";
test("device synchronization avoids duplicates and cancels completed or revoked tasks", async () => {
  let pending = [],
    scheduled = 0,
    cancelled = 0;
  const plugin = {
    getPending: async () => ({ notifications: pending }),
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    schedule: async ({ notifications }) => {
      scheduled += notifications.length;
      for (const n of notifications) {
        pending = pending.filter((p) => p.id !== n.id);
        pending.push(n);
      }
    },
    cancel: async ({ notifications }) => {
      cancelled += notifications.length;
      pending = pending.filter(
        (n) => !notifications.some((p) => p.id === n.id),
      );
    },
  };
  const state = {
    user: { id: "a" },
    tasks: [
      {
        id: "t",
        title: "Reminder",
        reminders: [{ id: "r", at: Date.now() + 3600000, repeat: "none" }],
      },
    ],
  };
  let status = await syncDeviceState(state, plugin, "https://example.com");
  assert.equal(status.count, 1);
  assert.equal(scheduled, 1);
  await syncDeviceState(state, plugin, "https://example.com");
  assert.equal(scheduled, 1);
  await syncDeviceState(state, plugin, "https://example.com", true);
  assert.equal(scheduled, 2);
  await syncDeviceState({ ...state, tasks: [] }, plugin, "https://example.com");
  assert.equal(pending.length, 0);
  assert.equal(cancelled, 1);
});

test("a delayed Android alarm is retained after the server consumes its one-off reminder", async () => {
  let cancelled = [];
  const plugin = {
    getPending: async () => ({
      notifications: [
        {
          id: 1,
          title: "Reminder",
          schedule: { at: new Date(Date.now() - 10000) },
          extra: { taskId: "t", user: "a", origin: "https://example.com" },
        },
      ],
    }),
    cancel: async (value) => {
      cancelled = value.notifications;
    },
    schedule: async () => {},
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
  };
  await syncDeviceState(
    { user: { id: "a" }, tasks: [{ id: "t", reminders: [] }] },
    plugin,
    "https://example.com",
  );
  assert.equal(cancelled.length, 0);
  await syncDeviceState(
    { user: { id: "a" }, tasks: [{ id: "t", done: true, reminders: [] }] },
    plugin,
    "https://example.com",
  );
  assert.equal(cancelled.length, 1);
});
