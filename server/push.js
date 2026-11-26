import * as webpush from "web-push";
import { all, get, run } from "./db.js";
export const pushEnabled = !!(
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
);
if (pushEnabled)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
let sending = false;
export async function sendPush({
  send = webpush.sendNotification,
  enabled = pushEnabled,
} = {}) {
  if (!enabled || sending) return;
  sending = true;
  try {
    for (const job of all(
      "SELECT * FROM push_jobs WHERE next<=? LIMIT 30",
      Date.now(),
    )) {
      let notification = get(
        "SELECT * FROM notifications WHERE id=?",
        job.notification,
      );
      let task =
        notification &&
        get("SELECT * FROM tasks WHERE id=?", notification.task);
      if (
        !notification ||
        (notification.task &&
          (!task ||
            !get(
              "SELECT 1 FROM members WHERE list=? AND user=?",
              task.list,
              notification.user,
            )))
      ) {
        run("DELETE FROM push_jobs WHERE id=?", job.id);
        continue;
      }
      let subscriptions = all(
        "SELECT * FROM subscriptions WHERE user=?",
        notification.user,
      );
      let retry = false,
        delivered = 0,
        lastCode = null;
      for (const s of subscriptions) {
        try {
          await send(
            JSON.parse(s.data),
            JSON.stringify({ title: notification.title, id: notification.id }),
            { TTL: 86400, timeout: 10000 },
          );
          delivered++;
        } catch (e) {
          lastCode = Number.isInteger(e.statusCode) ? e.statusCode : 0;
          console.warn("Browser push delivery failed", {
            status: lastCode,
            retrying: ![404, 410].includes(lastCode),
          });
          if ([404, 410].includes(e.statusCode))
            run("DELETE FROM subscriptions WHERE endpoint=?", s.endpoint);
          else retry = true;
        }
      }
      const status = !subscriptions.length
        ? "no_devices"
        : retry
          ? delivered
            ? "partial"
            : "retrying"
          : delivered
            ? "delivered"
            : "expired_subscription";
      run(
        "INSERT INTO push_delivery VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET status=excluded.status,code=excluded.code,at=excluded.at",
        notification.user,
        status,
        lastCode,
        Date.now(),
      );
      if (retry && job.attempts < 8)
        run(
          "UPDATE push_jobs SET attempts=attempts+1,next=? WHERE id=?",
          Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
          job.id,
        );
      else run("DELETE FROM push_jobs WHERE id=?", job.id);
    }
  } finally {
    sending = false;
  }
}
