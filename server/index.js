import express from "express";
import { networkInterfaces } from "node:os";
import helmet from "helmet";
import multer from "multer";
import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { resolve } from "node:path";
import { unlinkSync } from "node:fs";
import {
  db,
  dir,
  all,
  get,
  run,
  id,
  tick,
  nextDate,
  schedulerStatus,
} from "./db.js";
import { pushEnabled, sendPush } from "./push.js";
const app = express();
const origin =
  process.env.APP_ORIGIN ||
  (process.argv.includes("--dev")
    ? "http://localhost:5173"
    : "http://localhost:3001");
// In local mode, permit only this computer's actual addresses. Explicit
// APP_ORIGIN deployments remain locked to their configured public origin.
const allowedOrigins = new Set([origin]);
if (!process.env.APP_ORIGIN) {
  const port = process.argv.includes("--dev") ? 5173 : process.env.PORT || 3001;
  allowedOrigins.add(`http://127.0.0.1:${port}`);
  for (const addresses of Object.values(networkInterfaces()))
    for (const a of addresses || []) {
      if (a.family === "IPv4" && !a.internal)
        allowedOrigins.add(`http://${a.address}:${port}`);
    }
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "upgrade-insecure-requests": null,
      },
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.origin &&
    !allowedOrigins.has(req.headers.origin)
  )
    return res.status(403).json({ error: "Invalid origin" });
  next();
});
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const fail = (code, message) => {
  let e = new Error(message);
  e.status = code;
  throw e;
};
const hash = (p) => {
  let salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
const cookie = (req, name) =>
  req.headers.cookie
    ?.split("; ")
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
function login(res, user) {
  let token = randomBytes(32).toString("hex");
  run(
    "INSERT INTO sessions VALUES(?,?,?)",
    createHash("sha256").update(token).digest("hex"),
    user,
    Date.now() + 604800000,
  );
  res.cookie("tada", token, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 604800000,
  });
}
const attempts = new Map();
app.use("/api/auth", (req, res, next) => {
  let key = req.ip;
  let v = attempts.get(key) || { n: 0, time: Date.now() };
  if (Date.now() - v.time > 600000) v = { n: 0, time: Date.now() };
  attempts.set(key, v);
  if (++v.n > 40)
    return res.status(429).json({ error: "Try again in ten minutes" });
  next();
});
function seed(user) {
  for (const [name, color] of [
    ["Personal", "mint"],
    ["Work studio", "lavender"],
    ["Home & life", "yellow"],
  ]) {
    let list = id();
    run("INSERT INTO lists VALUES(?,?,?,?)", list, user, name, color);
    run("INSERT INTO members VALUES(?,?,?)", list, user, "owner");
    if (name === "Personal") {
      for (const [title, h, star] of [
        ["Make a little room for yourself", 2, true],
        ["Plan the weekend escape", 26, false],
        ["Pick up groceries", 4, false],
      ]) {
        let t = id();
        run(
          "INSERT INTO tasks VALUES(?,?,?)",
          t,
          list,
          JSON.stringify({
            title,
            due: new Date(Date.now() + h * 3600000).toISOString(),
            star,
            priority: 1,
            done: false,
            notes: "",
            subtasks: [],
            repeat: "none",
          }),
        );
      }
    }
  }
}
app.post(
  "/api/auth/register",
  wrap((req, res) => {
    let { email, name, password, confirmPassword } = req.body;
    if (password !== confirmPassword) fail(400, "Passwords do not match");
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      typeof name !== "string" ||
      !name.trim() ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 256
    )
      fail(
        400,
        "Use a valid email, name, and password of at least 12 characters",
      );
    if (get("SELECT 1 FROM users WHERE email=?", email.toLowerCase()))
      fail(409, "Email already registered");
    let user = id();
    run(
      "INSERT INTO users VALUES(?,?,?,?,?)",
      user,
      email.toLowerCase(),
      name.slice(0, 80),
      hash(password),
      null,
    );
    seed(user);
    login(res, user);
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/login",
  wrap((req, res) => {
    if (typeof req.body.password !== "string" || req.body.password.length > 256)
      fail(400, "Invalid password");
    let u = get(
      "SELECT * FROM users WHERE email=?",
      String(req.body.email).toLowerCase(),
    );
    let [s, h] = (u?.password || hash("dummy password")).split(":");
    let candidate = scryptSync(String(req.body.password), s, 64);
    if (!u?.password || !timingSafeEqual(candidate, Buffer.from(h, "hex")))
      fail(401, "Incorrect email or password");
    login(res, u.id);
    res.json({ ok: true });
  }),
);
app.use("/api", (req, res, next) => {
  let token = cookie(req, "tada");
  let s =
    token &&
    get(
      "SELECT user FROM sessions WHERE token=? AND expires>?",
      createHash("sha256").update(token).digest("hex"),
      Date.now(),
    );
  if (!s) return res.status(401).json({ error: "Please sign in" });
  req.user = s.user;
  next();
});
function access(user, list, write = false, owner = false) {
  let m = get("SELECT role FROM members WHERE list=? AND user=?", list, user);
  if (!m || (write && m.role === "view") || (owner && m.role !== "owner"))
    fail(403, "You do not have permission");
  return m.role;
}
function task(req, write = false) {
  let t = get("SELECT * FROM tasks WHERE id=?", req.params.id);
  if (!t) fail(404, "Task not found");
  access(req.user, t.list, write);
  return t;
}
app.post(
  "/api/profile/password",
  wrap((req, res) => {
    const key = "password:" + req.user;
    let attempt = attempts.get(key) || { n: 0, time: Date.now() };
    if (Date.now() - attempt.time > 600000)
      attempt = { n: 0, time: Date.now() };
    attempts.set(key, attempt);
    if (++attempt.n > 10)
      fail(429, "Too many attempts. Try again in ten minutes");
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (typeof currentPassword !== "string" || currentPassword.length > 256)
      fail(400, "Enter your current password");
    if (
      typeof newPassword !== "string" ||
      newPassword.length < 12 ||
      newPassword.length > 256
    )
      fail(400, "Use a new password of 12–256 characters");
    if (newPassword !== confirmPassword)
      fail(400, "New passwords do not match");
    const user = get("SELECT password FROM users WHERE id=?", req.user);
    if (!user?.password)
      fail(400, "Password changes are unavailable for this account");
    const [salt, stored] = user.password.split(":");
    if (
      !timingSafeEqual(
        scryptSync(currentPassword, salt, 64),
        Buffer.from(stored, "hex"),
      )
    )
      fail(401, "Current password is incorrect");
    if (newPassword === currentPassword)
      fail(400, "Choose a password different from your current password");
    const password = hash(newPassword);
    const currentToken = createHash("sha256")
      .update(cookie(req, "tada"))
      .digest("hex");
    db.exec("BEGIN IMMEDIATE");
    try {
      run("UPDATE users SET password=? WHERE id=?", password, req.user);
      run(
        "DELETE FROM sessions WHERE user=? AND token<>?",
        req.user,
        currentToken,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    attempts.delete(key);
    res.json({ ok: true });
  }),
);
app.post("/api/logout", (req, res) => {
  run(
    "DELETE FROM sessions WHERE token=?",
    createHash("sha256")
      .update(cookie(req, "tada") || "")
      .digest("hex"),
  );
  res.clearCookie("tada");
  res.json({ ok: true });
});
app.get("/api/state", (req, res) => {
  let lists = all(
    "SELECT l.*,m.role FROM lists l JOIN members m ON m.list=l.id WHERE m.user=?",
    req.user,
  );
  res.json({
    user: get("SELECT id,name,email FROM users WHERE id=?", req.user),
    lists,
    tasks: all(
      "SELECT t.* FROM tasks t JOIN members m ON m.list=t.list WHERE m.user=?",
      req.user,
    ).map((t) => ({
      ...JSON.parse(t.data),
      id: t.id,
      list: t.list,
      files: all("SELECT id,name FROM files WHERE task=?", t.id),
      reminders: all("SELECT * FROM reminders WHERE task=?", t.id),
    })),
    notifications: all(
      "SELECT * FROM notifications WHERE user=? ORDER BY created DESC LIMIT 100",
      req.user,
    ),
  });
});
app.post(
  "/api/lists",
  wrap((req, res) => {
    let name = String(req.body.name || "").trim();
    if (!name || name.length > 100) fail(400, "Enter a list name");
    let list = id();
    run(
      "INSERT INTO lists VALUES(?,?,?,?)",
      list,
      req.user,
      name,
      ["mint", "yellow", "pink", "lavender"].includes(req.body.color)
        ? req.body.color
        : "mint",
    );
    run("INSERT INTO members VALUES(?,?,?)", list, req.user, "owner");
    res.json({ id: list });
  }),
);
app.post(
  "/api/lists/:id/invite",
  wrap((req, res) => {
    access(req.user, req.params.id, true, true);
    if (!["view", "edit"].includes(req.body.role))
      fail(400, "Invalid permission");
    let token = randomBytes(32).toString("hex");
    run(
      "INSERT INTO invites VALUES(?,?,?,?,?)",
      createHash("sha256").update(token).digest("hex"),
      req.params.id,
      String(req.body.email || "").toLowerCase(),
      req.body.role,
      Date.now() + 604800000,
    );
    res.json({
      url:
        (allowedOrigins.has(req.headers.origin) ? req.headers.origin : origin) +
        "/?invite=" +
        token,
    });
  }),
);
app.post(
  "/api/invites/accept",
  wrap((req, res) => {
    let token = createHash("sha256")
      .update(String(req.body.token))
      .digest("hex");
    let i = get(
      "SELECT * FROM invites WHERE token=? AND expires>?",
      token,
      Date.now(),
    );
    if (!i) fail(400, "Invitation expired or already used");
    let u = get("SELECT * FROM users WHERE id=?", req.user);
    if (i.email && u.email !== i.email)
      fail(403, "Sign in with the invited email.");
    run(
      "INSERT INTO members VALUES(?,?,?) ON CONFLICT(list,user) DO UPDATE SET role=CASE WHEN members.role='owner' THEN 'owner' ELSE excluded.role END",
      i.list,
      req.user,
      i.role,
    );
    run("DELETE FROM invites WHERE token=?", token);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/lists/:id/members",
  wrap((req, res) => {
    access(req.user, req.params.id);
    res.json(
      all(
        "SELECT u.id,u.name,m.role FROM members m JOIN users u ON u.id=m.user WHERE m.list=?",
        req.params.id,
      ),
    );
  }),
);
app.delete(
  "/api/lists/:id/members/:user",
  wrap((req, res) => {
    access(req.user, req.params.id, true, true);
    run(
      "DELETE FROM members WHERE list=? AND user=? AND role!='owner'",
      req.params.id,
      req.params.user,
    );
    res.json({ ok: true });
  }),
);
function clean(b) {
  if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 500)
    fail(400, "Enter a task title (up to 500 characters)");
  if (b.due && !Number.isFinite(Date.parse(b.due)))
    fail(400, "Invalid due date");
  if (!["none", "daily", "weekly", "monthly"].includes(b.repeat || "none"))
    fail(400, "Invalid recurrence");
  if (!Array.isArray(b.subtasks) || b.subtasks.length > 100)
    fail(400, "Invalid subtasks");
  return {
    title: b.title.trim(),
    notes: String(b.notes || "").slice(0, 20000),
    due: b.due || null,
    done: !!b.done,
    star: !!b.star,
    priority: [0, 1, 2].includes(+b.priority) ? +b.priority : 0,
    repeat: b.repeat || "none",
    subtasks: b.subtasks.map((s) => ({
      id: String(s.id || id()),
      title: String(s.title).slice(0, 500),
      done: !!s.done,
    })),
  };
}
app.post(
  "/api/tasks",
  wrap((req, res) => {
    access(req.user, req.body.list, true);
    let d = clean(req.body),
      tid = id();
    run(
      "INSERT INTO tasks VALUES(?,?,?)",
      tid,
      req.body.list,
      JSON.stringify(d),
    );
    res.json({ id: tid });
  }),
);
app.put(
  "/api/tasks/:id",
  wrap((req, res) => {
    let t = task(req, true),
      old = JSON.parse(t.data),
      d = clean(req.body);
    db.exec("BEGIN IMMEDIATE");
    try {
      run("UPDATE tasks SET data=? WHERE id=?", JSON.stringify(d), t.id);
      if (d.done && !old.done && d.repeat !== "none") {
        let next = {
          ...d,
          done: false,
          due: nextDate(d.due || new Date().toISOString(), d.repeat),
          subtasks: d.subtasks.map((s) => ({ ...s, done: false })),
        };
        let nextId = id();
        run(
          "INSERT INTO tasks VALUES(?,?,?)",
          nextId,
          t.list,
          JSON.stringify(next),
        );
        for (let r of all("SELECT * FROM reminders WHERE task=?", t.id)) {
          let at =
            r.at +
            (Date.parse(next.due) -
              Date.parse(d.due || new Date().toISOString()));
          run(
            "INSERT INTO reminders VALUES(?,?,?,?)",
            id(),
            nextId,
            at,
            r.repeat,
          );
        }
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/tasks/:id",
  wrap((req, res) => {
    task(req, true);
    for (let f of all("SELECT * FROM files WHERE task=?", req.params.id)) {
      try {
        unlinkSync(f.path);
      } catch {}
    }
    for (let table of ["files", "reminders", "notifications", "deadline_sent"])
      run(`DELETE FROM ${table} WHERE task=?`, req.params.id);
    run("DELETE FROM tasks WHERE id=?", req.params.id);
    res.json({ ok: true });
  }),
);
app.post(
  "/api/tasks/:id/reminders",
  wrap((req, res) => {
    task(req, true);
    let at = Date.parse(req.body.at);
    if (
      !Number.isFinite(at) ||
      at <= Date.now() ||
      !["none", "daily", "weekly", "monthly"].includes(req.body.repeat)
    )
      fail(400, "Choose a future reminder and valid recurrence");
    run(
      "INSERT INTO reminders VALUES(?,?,?,?)",
      id(),
      req.params.id,
      at,
      req.body.repeat,
    );
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/tasks/:id/reminders/:rid",
  wrap((req, res) => {
    task(req, true);
    run(
      "DELETE FROM reminders WHERE id=? AND task=?",
      req.params.rid,
      req.params.id,
    );
    res.json({ ok: true });
  }),
);
const upload = multer({
  dest: dir + "/uploads",
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});
// Create a task and its staged attachments/reminders together. Roll back all rows
// and remove staged files on failure so retrying never creates a partial task.
app.post(
  "/api/tasks/create",
  upload.array("files", 10),
  wrap((req, res) => {
    let transaction = false;
    try {
      const body = JSON.parse(req.body.task);
      access(req.user, body.list, true);
      const data = clean(body),
        reminders = JSON.parse(req.body.reminders || "[]");
      if (!Array.isArray(reminders) || reminders.length > 50)
        fail(400, "Maximum 50 reminders per task");
      for (const r of reminders) {
        if (
          !Number.isFinite(Date.parse(r.at)) ||
          Date.parse(r.at) <= Date.now() ||
          !["none", "daily", "weekly", "monthly"].includes(r.repeat)
        )
          fail(400, "Choose a future reminder and valid recurrence");
      }
      const tid = id();
      db.exec("BEGIN IMMEDIATE");
      transaction = true;
      run(
        "INSERT INTO tasks VALUES(?,?,?)",
        tid,
        body.list,
        JSON.stringify(data),
      );
      for (const r of reminders)
        run(
          "INSERT INTO reminders VALUES(?,?,?,?)",
          id(),
          tid,
          Date.parse(r.at),
          r.repeat,
        );
      for (const f of req.files || [])
        run(
          "INSERT INTO files VALUES(?,?,?,?)",
          id(),
          tid,
          f.originalname,
          resolve(f.path),
        );
      db.exec("COMMIT");
      transaction = false;
      res.json({ id: tid });
    } catch (error) {
      if (transaction) db.exec("ROLLBACK");
      for (const f of req.files || []) {
        try {
          unlinkSync(f.path);
        } catch {}
      }
      throw error;
    }
  }),
);
app.post(
  "/api/tasks/:id/files",
  wrap((req, res, next) => {
    task(req, true);
    next();
  }),
  upload.single("file"),
  wrap((req, res) => {
    if (!req.file) fail(400, "Choose a file");
    run(
      "INSERT INTO files VALUES(?,?,?,?)",
      id(),
      req.params.id,
      req.file.originalname,
      resolve(req.file.path),
    );
    res.json({ ok: true });
  }),
);
app.get(
  "/api/files/:fid",
  wrap((req, res) => {
    let f = get("SELECT * FROM files WHERE id=?", req.params.fid);
    if (!f) fail(404, "File not found");
    let t = get("SELECT * FROM tasks WHERE id=?", f.task);
    access(req.user, t.list);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.download(f.path, f.name);
  }),
);
app.delete(
  "/api/tasks/:id/files/:fid",
  wrap((req, res) => {
    task(req, true);
    let f = get(
      "SELECT * FROM files WHERE id=? AND task=?",
      req.params.fid,
      req.params.id,
    );
    if (f) {
      unlinkSync(f.path);
      run("DELETE FROM files WHERE id=?", f.id);
    }
    res.json({ ok: true });
  }),
);
app.post("/api/notifications/read", (req, res) => {
  run("UPDATE notifications SET seen=1 WHERE user=?", req.user);
  res.json({ ok: true });
});
app.get("/api/notifications/status", (req, res) =>
  res.json({
    serverTime: new Date().toISOString(),
    worker: schedulerStatus,
    pushConfigured: pushEnabled,
    devices: get(
      "SELECT COUNT(*) count FROM subscriptions WHERE user=?",
      req.user,
    ).count,
    dueReminders: get(
      "SELECT COUNT(*) count FROM reminders r JOIN tasks t ON t.id=r.task JOIN members m ON m.list=t.list WHERE m.user=? AND r.at<=?",
      req.user,
      Date.now(),
    ).count,
    nextReminder: get(
      "SELECT MIN(r.at) at FROM reminders r JOIN tasks t ON t.id=r.task JOIN members m ON m.list=t.list WHERE m.user=?",
      req.user,
    )?.at,
    lastDelivery:
      get("SELECT status,code,at FROM push_delivery WHERE user=?", req.user) ||
      null,
  }),
);
const testTimes = new Map();
app.post(
  "/api/notifications/test",
  wrap((req, res) => {
    if (Date.now() - (testTimes.get(req.user) || 0) < 30000)
      fail(429, "Wait 30 seconds before another test");
    testTimes.set(req.user, Date.now());
    const nid = id();
    db.exec("BEGIN IMMEDIATE");
    try {
      run(
        "INSERT INTO notifications(id,user,task,title,created) VALUES(?,?,?,?,?)",
        nid,
        req.user,
        null,
        "Test notification from TaDa",
        Date.now(),
      );
      run("INSERT INTO push_jobs(id,notification) VALUES(?,?)", id(), nid);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    sendPush().catch(console.error);
    res.json({ ok: true, pushConfigured: pushEnabled });
  }),
);
app.get("/api/push/config", (req, res) =>
  res.json({ publicKey: pushEnabled ? process.env.VAPID_PUBLIC_KEY : null }),
);
app.post(
  "/api/push/subscribe",
  wrap((req, res) => {
    if (!pushEnabled) fail(503, "Push is not configured on this server");
    let s = req.body;
    let url = new URL(s.endpoint);
    if (
      url.protocol !== "https:" ||
      url.port ||
      (![
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(url.hostname) &&
        !url.hostname.endsWith(".notify.windows.com"))
    )
      fail(400, "Unsupported push service");
    if (!s.keys?.p256dh || !s.keys?.auth)
      fail(400, "Invalid push subscription");
    if (
      all("SELECT * FROM subscriptions WHERE user=?", req.user).length >= 5 &&
      !get("SELECT 1 FROM subscriptions WHERE endpoint=?", s.endpoint)
    )
      fail(400, "Maximum five push devices per account");
    run(
      "INSERT INTO subscriptions VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user=excluded.user,data=excluded.data",
      s.endpoint,
      req.user,
      JSON.stringify(s),
    );
    res.json({ ok: true });
  }),
);
app.post(
  "/api/push/unsubscribe",
  wrap((req, res) => {
    run(
      "DELETE FROM subscriptions WHERE endpoint=? AND user=?",
      String(req.body.endpoint),
      req.user,
    );
    res.json({ ok: true });
  }),
);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
app.use(express.static(resolve("dist")));
app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
app.use((e, req, res, next) => {
  console.error(e.message);
  res
    .status(e.status || 400)
    .json({ error: e.status ? e.message : "Request could not be processed" });
});
setInterval(() => {
  try {
    tick();
    sendPush().catch(console.error);
  } catch (e) {
    console.error(e);
  }
}, 15000).unref();
tick();
sendPush().catch(console.error);
app.listen(process.env.PORT || 3001, "0.0.0.0", () =>
  console.log("TaDa ready on port " + (process.env.PORT || 3001)),
);
