import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
const env = {
  ...(existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {}),
  ...process.env,
};
const path = resolve(env.DATA_DIR || "data", "tada.sqlite");
const configured = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
].every((k) => !!env[k]);
console.log(
  JSON.stringify(
    {
      serverClockUTC: new Date().toISOString(),
      database: path,
      pushKeysPresent: configured,
    },
    null,
    2,
  ),
);
if (!existsSync(path)) {
  console.log(
    "Database not found. Check DATA_DIR and run from the application directory.",
  );
  process.exitCode = 1;
} else {
  const db = new DatabaseSync(path, { readOnly: true });
  const counts = {};
  for (const table of [
    "reminders",
    "notifications",
    "subscriptions",
    "push_jobs",
  ])
    counts[table] = db
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get().count;
  counts.dueReminders = db
    .prepare("SELECT COUNT(*) count FROM reminders WHERE at<=?")
    .get(Date.now()).count;
  counts.nextReminderUTC = (() => {
    const row = db.prepare("SELECT MIN(at) at FROM reminders").get();
    return row.at ? new Date(row.at).toISOString() : null;
  })();
  console.log(JSON.stringify(counts, null, 2));
  db.close();
  console.log(
    "This shows stored state, not whether the server process is currently running. No emails, tasks, tokens or keys were printed.",
  );
}
