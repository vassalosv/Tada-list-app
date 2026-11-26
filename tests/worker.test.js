import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "tada-worker-"));
const { db, id, run, all, tick, nextDate } = await import("../server/db.js");
test("durable worker catches missed runs, deduplicates and skips completed tasks", () => {
  run("INSERT INTO lists VALUES(?,?,?,?)", "l", "u", "List", "mint");
  run("INSERT INTO members VALUES(?,?,?)", "l", "u", "owner");
  let due = new Date(Date.now() - 1000).toISOString();
  run(
    "INSERT INTO tasks VALUES(?,?,?)",
    "t",
    "l",
    JSON.stringify({ title: "Deadline", due, done: false }),
  );
  run(
    "INSERT INTO reminders VALUES(?,?,?,?)",
    "r",
    "t",
    Date.now() - 86400000 * 3,
    "daily",
  );
  tick();
  assert.equal(all("SELECT * FROM notifications").length, 2);
  assert.ok(all("SELECT * FROM reminders")[0].at > Date.now());
  tick();
  assert.equal(all("SELECT * FROM notifications").length, 2);
  run(
    "UPDATE tasks SET data=? WHERE id=?",
    JSON.stringify({ title: "Done", done: true }),
    "t",
  );
  run("INSERT INTO reminders VALUES(?,?,?,?)", "r2", "t", 1, "none");
  tick();
  assert.equal(all("SELECT * FROM notifications").length, 2);
  assert.equal(all("SELECT * FROM reminders WHERE id=?", "r2").length, 0);
});
test("calendar recurrence clamps end of month and preserves UTC time", () => {
  assert.equal(
    nextDate("2027-01-31T10:00:00Z", "monthly"),
    "2027-02-28T10:00:00.000Z",
  );
  assert.equal(
    nextDate("2027-01-01T10:00:00Z", "weekly"),
    "2027-01-08T10:00:00.000Z",
  );
});
test("push outbox retries failures and removes dead subscriptions", async () => {
  const { sendPush } = await import("../server/push.js");
  run(
    "UPDATE tasks SET data=? WHERE id=?",
    JSON.stringify({ title: "Active push test", done: false }),
    "t",
  );
  run(
    "INSERT INTO subscriptions VALUES(?,?,?)",
    "https://fcm.googleapis.com/test",
    "u",
    JSON.stringify({ endpoint: "https://fcm.googleapis.com/test" }),
  );
  await sendPush({
    enabled: true,
    send: async () => {
      throw { statusCode: 503 };
    },
  });
  assert.ok(all("SELECT * FROM push_jobs").every((j) => j.attempts === 1));
  run("UPDATE push_jobs SET next=0");
  await sendPush({
    enabled: true,
    send: async () => {
      throw { statusCode: 410 };
    },
  });
  assert.equal(all("SELECT * FROM subscriptions").length, 0);
  assert.equal(all("SELECT * FROM push_jobs").length, 0);
});
test("queued browser push is delivered only to the current assignee", async () => {
  const { sendPush } = await import("../server/push.js");
  run("INSERT INTO members VALUES(?,?,?)", "l", "assignee", "edit");
  run(
    "INSERT INTO tasks VALUES(?,?,?)",
    "assigned-task",
    "l",
    JSON.stringify({
      title: "Assigned task",
      done: false,
      assignee: "assignee",
    }),
  );
  for (const user of ["u", "assignee"]) {
    const nid = id();
    run(
      "INSERT INTO notifications(id,user,task,title,created) VALUES(?,?,?,?,?)",
      nid,
      user,
      "assigned-task",
      "Reminder: Assigned task",
      Date.now(),
    );
    run("INSERT INTO push_jobs(id,notification) VALUES(?,?)", id(), nid);
    const endpoint = "https://push.example.com/" + user;
    run(
      "INSERT INTO subscriptions VALUES(?,?,?)",
      endpoint,
      user,
      JSON.stringify({ endpoint }),
    );
  }
  const delivered = [];
  await sendPush({
    enabled: true,
    send: async (subscription) => {
      delivered.push(subscription.endpoint);
    },
  });
  assert.deepEqual(delivered, ["https://push.example.com/assignee"]);
  assert.equal(all("SELECT * FROM push_jobs").length, 0);
});
process.on("exit", () => {
  db.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
