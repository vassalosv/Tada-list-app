import test from "node:test";
import assert from "node:assert/strict";
import { devicePlan } from "../src/reminder-plan.js";
const now = Date.parse("2026-11-25T08:00:00Z");
test("device plan preserves reminder times, clamps monthly recurrence and ignores completed tasks", () => {
  const task = {
    id: "t",
    title: "Test",
    due: null,
    reminders: [{ id: "r", at: now + 60000, repeat: "none" }],
  };
  let plan = devicePlan([task], now);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].at, now + 60000);
  assert.deepEqual(devicePlan([task], now), plan);
  assert.equal(devicePlan([{ ...task, done: true }], now).length, 0);
  plan = devicePlan(
    [
      {
        ...task,
        reminders: [
          {
            id: "monthly",
            at: Date.parse("2027-01-31T10:00:00Z"),
            repeat: "monthly",
          },
        ],
      },
    ],
    Date.parse("2027-01-30T00:00:00Z"),
  );
  assert.equal(plan[1].at, Date.parse("2027-02-28T10:00:00Z"));
});
test("device plan catches up recurring reminders and bounds future alarms", () => {
  const task = {
    id: "t",
    title: "Task",
    reminders: [
      { id: "repeat", at: now - 86400000 * 5 + 60000, repeat: "daily" },
    ],
  };
  const plan = devicePlan([task], now);
  assert.ok(plan.length > 1);
  assert.equal(plan[0].at, now + 60000);
  assert.ok(plan.every((n) => n.id > 0 && n.id < 2147480001 && n.at > now));
  const many = devicePlan(
    Array.from({ length: 300 }, (_, i) => ({
      ...task,
      id: "t" + i,
      reminders: [{ id: "r" + i, at: now + 60000, repeat: "none" }],
    })),
    now,
  );
  assert.equal(many.length, 256);
  assert.equal(new Set(many.map((n) => n.id)).size, 256);
});
