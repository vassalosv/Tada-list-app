import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
export const dir = process.env.DATA_DIR || "data";
mkdirSync(dir, { recursive: true });
export const db = new DatabaseSync(`${dir}/tada.sqlite`);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT,identity TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS lists(id TEXT PRIMARY KEY,owner TEXT,name TEXT,color TEXT);
CREATE TABLE IF NOT EXISTS members(list TEXT,user TEXT,role TEXT,PRIMARY KEY(list,user));
CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,list TEXT,email TEXT,role TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,list TEXT,data TEXT);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,task TEXT,name TEXT,path TEXT);
CREATE TABLE IF NOT EXISTS reminders(id TEXT PRIMARY KEY,task TEXT,at INTEGER,repeat TEXT);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user TEXT,task TEXT,title TEXT,created INTEGER,seen INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS deadline_sent(task TEXT,due TEXT,PRIMARY KEY(task,due));
CREATE TABLE IF NOT EXISTS subscriptions(endpoint TEXT PRIMARY KEY,user TEXT,data TEXT);
CREATE TABLE IF NOT EXISTS push_delivery(user TEXT PRIMARY KEY,status TEXT,code INTEGER,at INTEGER);
CREATE TABLE IF NOT EXISTS push_jobs(id TEXT PRIMARY KEY,notification TEXT,attempts INTEGER DEFAULT 0,next INTEGER DEFAULT 0);`);
export const all = (q, ...p) => db.prepare(q).all(...p);
export const get = (q, ...p) => db.prepare(q).get(...p);
export const run = (q, ...p) => db.prepare(q).run(...p);
export const id = () => randomUUID();
import { nextDate } from "../shared/dates.js";
export { nextDate };
export const schedulerStatus = { lastRun: null, lastError: null };
export function tick(now = Date.now()) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const notify = (task, title) => {
      const t = get("SELECT * FROM tasks WHERE id=?", task);
      if (!t) return;
      for (const m of all("SELECT user FROM members WHERE list=?", t.list)) {
        let nid = id();
        run(
          "INSERT INTO notifications(id,user,task,title,created) VALUES(?,?,?,?,?)",
          nid,
          m.user,
          task,
          title,
          now,
        );
        run("INSERT INTO push_jobs(id,notification) VALUES(?,?)", id(), nid);
      }
    };
    for (const r of all("SELECT * FROM reminders WHERE at<=?", now)) {
      const t = get("SELECT data FROM tasks WHERE id=?", r.task);
      if (t && !JSON.parse(t.data).done)
        notify(r.task, `Reminder: ${JSON.parse(t.data).title}`);
      if (r.repeat !== "none") {
        let at = r.at;
        do {
          at = Date.parse(nextDate(at, r.repeat));
        } while (at <= now);
        run("UPDATE reminders SET at=? WHERE id=?", at, r.id);
      } else run("DELETE FROM reminders WHERE id=?", r.id);
    }
    for (const t of all("SELECT * FROM tasks")) {
      let d = JSON.parse(t.data);
      if (
        !d.done &&
        d.due &&
        Date.parse(d.due) <= now + 86400000 &&
        !get("SELECT 1 FROM deadline_sent WHERE task=? AND due=?", t.id, d.due)
      ) {
        notify(
          t.id,
          `${Date.parse(d.due) < now ? "Overdue" : "Coming up"}: ${d.title}`,
        );
        run("INSERT INTO deadline_sent VALUES(?,?)", t.id, d.due);
      }
    }
    db.exec("COMMIT");
    schedulerStatus.lastRun = now;
    schedulerStatus.lastError = null;
  } catch (e) {
    db.exec("ROLLBACK");
    schedulerStatus.lastError = "Reminder worker failed; check server logs";
    throw e;
  }
}
