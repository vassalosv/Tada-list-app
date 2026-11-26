import multer from "multer";
import { createHash, randomBytes } from "node:crypto";
import { db, all, get, run, notificationRecipient } from "./db.js";

const reject = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function spaceAccess(user, space, write = false, owner = false) {
  if (typeof space !== "string") reject(400, "Choose a Space");
  const w = get("SELECT user FROM workspaces WHERE id=?", space);
  const role =
    w?.user === user
      ? "owner"
      : get(
          "SELECT role FROM space_members WHERE space=? AND user=?",
          space,
          user,
        )?.role;
  if (!role || (write && role === "view") || (owner && role !== "owner"))
    reject(403, "You do not have permission in this Space");
  return role;
}
const icons = [
  "list",
  "home",
  "briefcase",
  "shopping-cart",
  "heart",
  "book",
  "plane",
  "wallet",
  "film",
  "users",
  "school",
  "dumbbell",
  "coffee",
  "music",
  "pill",
  "gift",
];
export function listAppearance(body) {
  const icon = body.icon || "list",
    color = body.accent || body.color || "#006644";
  const legacy = {
    mint: "#006644",
    yellow: "#84741d",
    pink: "#a34058",
    lavender: "#6260a0",
  };
  if (
    !icons.includes(icon) ||
    (!/^#[0-9a-f]{6}$/i.test(color) && !legacy[color])
  )
    reject(400, "Choose a valid list icon and color");
  return { icon, color: legacy[color] || color };
}
export function validateAssignee(list, assignee) {
  if (assignee == null || assignee === "") return;
  if (
    typeof assignee !== "string" ||
    !get(
      "SELECT 1 FROM effective_members WHERE list=? AND user=?",
      list,
      assignee,
    )
  )
    reject(400, "Assign to someone who has access to this list");
}
export function installV1(app, { access, fail, wrap, origin, allowedOrigins }) {
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.patch(
    "/api/lists/:id",
    wrap((req, res) => {
      access(req.user, req.params.id, true);
      const list = get(
        "SELECT l.name,d.icon,d.color AS accent FROM lists l LEFT JOIN list_details d ON d.list=l.id WHERE l.id=?",
        req.params.id,
      );
      const name = req.body.name === undefined ? list.name : req.body.name;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 100)
        fail(400, "Enter a list name (up to 100 characters)");
      const appearance = listAppearance({
        ...list,
        ...req.body,
        accent: req.body.accent || req.body.color || list.accent || "#006644",
      });
      db.exec("BEGIN IMMEDIATE");
      try {
        run("UPDATE lists SET name=? WHERE id=?", name.trim(), req.params.id);
        run(
          "INSERT INTO list_details VALUES(?,?,?) ON CONFLICT(list) DO UPDATE SET icon=excluded.icon,color=excluded.color",
          req.params.id,
          appearance.icon,
          appearance.color,
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      res.json({ ok: true });
    }),
  );
  app.put(
    "/api/workspaces/:id/order",
    wrap((req, res) => {
      spaceAccess(req.user, req.params.id);
      const ids = req.body.ids;
      if (
        !Array.isArray(ids) ||
        ids.length > 1000 ||
        new Set(ids).size !== ids.length
      )
        fail(400, "Invalid list order");
      for (const list of ids) {
        access(req.user, list);
        if (
          !get(
            "SELECT 1 FROM list_workspaces WHERE user=? AND workspace=? AND list=?",
            req.user,
            req.params.id,
            list,
          ) &&
          !get(
            "SELECT 1 FROM space_lists sl JOIN space_members sm ON sm.space=sl.space WHERE sm.user=? AND sl.space=? AND sl.list=?",
            req.user,
            req.params.id,
            list,
          )
        )
          fail(403, "List does not belong to this Space");
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        ids.forEach((list, position) =>
          run(
            "INSERT INTO list_order VALUES(?,?,?,?) ON CONFLICT(user,space,list) DO UPDATE SET position=excluded.position",
            req.user,
            req.params.id,
            list,
            position,
          ),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/workspaces/:id/invite",
    wrap((req, res) => {
      spaceAccess(req.user, req.params.id, true, true);
      if (
        !["view", "edit"].includes(req.body.role) ||
        !/^\S+@\S+\.\S+$/.test(req.body.email || "")
      )
        fail(400, "Enter the invited email and a view/edit permission");
      const token = randomBytes(32).toString("hex");
      run(
        "INSERT INTO space_invites VALUES(?,?,?,?,?)",
        createHash("sha256").update(token).digest("hex"),
        req.params.id,
        req.body.email.toLowerCase(),
        req.body.role,
        Date.now() + 604800000,
      );
      res.json({
        url:
          (allowedOrigins.has(req.headers.origin)
            ? req.headers.origin
            : origin) +
          "/?spaceInvite=" +
          token,
      });
    }),
  );
  app.post(
    "/api/space-invites/accept",
    wrap((req, res) => {
      const invite = get(
        "SELECT * FROM space_invites WHERE token=? AND expires>?",
        createHash("sha256").update(String(req.body.token)).digest("hex"),
        Date.now(),
      );
      if (!invite || !get("SELECT 1 FROM workspaces WHERE id=?", invite.space))
        fail(400, "Invitation expired or already used");
      if (
        get("SELECT email FROM users WHERE id=?", req.user).email !==
        invite.email
      )
        fail(403, "Sign in with the invited email");
      if (
        get("SELECT user FROM workspaces WHERE id=?", invite.space).user ===
        req.user
      )
        fail(400, "You already own this Space");
      const exists = get(
        "SELECT 1 FROM space_members WHERE space=? AND user=?",
        invite.space,
        req.user,
      );
      if (
        !exists &&
        get(
          "SELECT (SELECT COUNT(*) FROM workspaces WHERE user=?)+(SELECT COUNT(*) FROM space_members WHERE user=?) AS n",
          req.user,
          req.user,
        ).n >= 20
      )
        fail(400, "You can have up to 20 Spaces, including shared Spaces");
      db.exec("BEGIN IMMEDIATE");
      try {
        run(
          "INSERT INTO space_members VALUES(?,?,?) ON CONFLICT(space,user) DO UPDATE SET role=excluded.role",
          invite.space,
          req.user,
          invite.role,
        );
        run("DELETE FROM space_invites WHERE token=?", invite.token);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      res.json({ id: invite.space });
    }),
  );
  app.get(
    "/api/workspaces/:id/members",
    wrap((req, res) => {
      spaceAccess(req.user, req.params.id);
      res.json(
        all(
          "SELECT u.id,u.name,'owner' AS role,(SELECT revision FROM avatars WHERE user=u.id) AS avatar FROM workspaces w JOIN users u ON u.id=w.user WHERE w.id=? UNION ALL SELECT u.id,u.name,sm.role,(SELECT revision FROM avatars WHERE user=u.id) FROM space_members sm JOIN users u ON u.id=sm.user WHERE sm.space=?",
          req.params.id,
          req.params.id,
        ),
      );
    }),
  );
  app.delete(
    "/api/workspaces/:id/members/:user",
    wrap((req, res) => {
      spaceAccess(req.user, req.params.id, true, true);
      run(
        "DELETE FROM space_members WHERE space=? AND user=?",
        req.params.id,
        req.params.user,
      );
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/notifications/eligible/:id",
    wrap((req, res) => {
      const task = get("SELECT * FROM tasks WHERE id=?", req.params.id);
      if (!task) fail(404, "Task not available");
      access(req.user, task.list);
      let eventValid = true;
      if (req.query.event) {
        const [kind, key, time] = String(req.query.event).split(":");
        const at = Number(time),
          data = JSON.parse(task.data);
        eventValid = Number.isSafeInteger(at) && at > 0;
        if (kind === "due")
          eventValid =
            eventValid &&
            key === task.id &&
            [Date.parse(data.due), Date.parse(data.due) - 86400000].includes(
              at,
            );
        else if (kind === "reminder") {
          const reminder = get(
            "SELECT at FROM reminders WHERE id=? AND task=?",
            key,
            task.id,
          );
          eventValid =
            eventValid &&
            (reminder?.at === at ||
              !!get(
                "SELECT 1 FROM notifications WHERE user=? AND task=? AND title LIKE 'Reminder:%' AND created BETWEEN ? AND ?",
                req.user,
                task.id,
                at - 60000,
                at + 60000,
              ));
        } else eventValid = false;
      }
      res.json({
        user: req.user,
        eligible: eventValid && notificationRecipient(task, req.user),
        title: JSON.parse(task.data).title,
      });
    }),
  );
  const photo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/profile/photo",
    photo.single("photo"),
    wrap((req, res) => {
      const bytes = req.file?.buffer;
      let mime;
      if (
        bytes
          ?.subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        mime = "image/png";
      else if (bytes?.[0] === 255 && bytes?.[1] === 216 && bytes?.[2] === 255)
        mime = "image/jpeg";
      else if (
        bytes?.toString("ascii", 0, 4) === "RIFF" &&
        bytes?.toString("ascii", 8, 12) === "WEBP"
      )
        mime = "image/webp";
      if (!mime) fail(400, "Choose a PNG, JPEG or WebP photo up to 2 MB");
      run(
        "INSERT INTO avatars VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET mime=excluded.mime,data=excluded.data,revision=excluded.revision",
        req.user,
        mime,
        bytes,
        randomBytes(10).toString("hex"),
      );
      res.json({ ok: true });
    }),
  );
  app.delete("/api/profile/photo", (req, res) => {
    run("DELETE FROM avatars WHERE user=?", req.user);
    res.json({ ok: true });
  });
  app.get(
    "/api/avatars/:id",
    wrap((req, res) => {
      if (
        req.params.id !== req.user &&
        !get(
          "SELECT 1 FROM effective_members a JOIN effective_members b ON b.list=a.list WHERE a.user=? AND b.user=?",
          req.user,
          req.params.id,
        ) &&
        !get(
          "SELECT 1 FROM workspaces w LEFT JOIN space_members a ON a.space=w.id AND a.user=? LEFT JOIN space_members b ON b.space=w.id AND b.user=? WHERE (w.user=? OR a.user IS NOT NULL) AND (w.user=? OR b.user IS NOT NULL)",
          req.user,
          req.params.id,
          req.user,
          req.params.id,
        )
      )
        fail(403, "Photo not available");
      const avatar = get(
        "SELECT mime,data FROM avatars WHERE user=?",
        req.params.id,
      );
      if (!avatar) fail(404, "No profile photo");
      res
        .type(avatar.mime)
        .set("Content-Security-Policy", "default-src 'none'; sandbox")
        .send(Buffer.from(avatar.data));
    }),
  );
}
