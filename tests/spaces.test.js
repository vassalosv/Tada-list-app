import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

test("legacy lists migrate into private spaces; sharing, moves, limits and native feed enforce identity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tada-spaces-")),
    port = 3195;
  // A real pre-spaces database, with a live session and existing list/task.
  const db = new DatabaseSync(join(dir, "tada.sqlite"));
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT,identity TEXT UNIQUE);
    CREATE TABLE sessions(token TEXT PRIMARY KEY,user TEXT,expires INTEGER);
    CREATE TABLE lists(id TEXT PRIMARY KEY,owner TEXT,name TEXT,color TEXT);
    CREATE TABLE members(list TEXT,user TEXT,role TEXT,PRIMARY KEY(list,user));
    CREATE TABLE tasks(id TEXT PRIMARY KEY,list TEXT,data TEXT);
    INSERT INTO users VALUES('legacy','legacy@example.com','Legacy',NULL,NULL);
    INSERT INTO lists VALUES('old-list','legacy','Existing plans','mint');
    INSERT INTO members VALUES('old-list','legacy','owner');`);
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    createHash("sha256").update("legacy-token").digest("hex"),
    "legacy",
    Date.now() + 600000,
  );
  db.prepare("INSERT INTO tasks VALUES(?,?,?)").run(
    "old-task",
    "old-list",
    JSON.stringify({
      title: "Keep me",
      subtasks: [],
      repeat: "none",
      done: false,
    }),
  );
  db.close();
  const child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir },
    stdio: "pipe",
  });
  const req = async (path, body, cookie, method) => {
    const r = await fetch(`http://localhost:${port}/api${path}`, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  try {
    for (let i = 0; i < 80; i++) {
      try {
        await req("/state");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const legacy = (await req("/state", undefined, "tada=legacy-token")).data;
    assert.equal(legacy.workspaces.length, 1);
    assert.equal(legacy.lists[0].workspace, legacy.workspaces[0].id);
    assert.equal(legacy.tasks[0].title, "Keep me");
    const register = (name) =>
      req("/auth/register", {
        name,
        email: name + "@example.com",
        password: "secure-spaces-password",
        confirmPassword: "secure-spaces-password",
      });
    const a = (await register("AliceSpaces")).cookie,
      b = (await register("BobSpaces")).cookie;
    const as = (await req("/state", undefined, a)).data,
      bs = (await req("/state", undefined, b)).data;
    const work = (await req("/workspaces", { name: "Work" }, a)).data.id;
    const home = (await req("/workspaces", { name: "Family" }, b)).data.id;
    assert.equal(
      (await req("/workspaces/" + work, { name: "Stolen" }, b, "PATCH")).status,
      403,
    );
    assert.equal(
      (await req("/lists", { name: "Denied", workspace: work }, b)).status,
      403,
    );
    const list = (await req("/lists", { name: "Project", workspace: work }, a))
      .data.id;
    const invite = (
      await req(
        `/lists/${list}/invite`,
        { email: "BobSpaces@example.com", role: "view" },
        a,
      )
    ).data.url;
    assert.equal(
      (
        await req(
          "/invites/accept",
          { token: new URL(invite).searchParams.get("invite") },
          b,
        )
      ).status,
      200,
    );
    let shared = (await req("/state", undefined, b)).data;
    assert.ok(!shared.workspaces.some((w) => w.id === work));
    assert.equal(
      shared.lists.find((l) => l.id === list).workspace,
      bs.workspaces[0].id,
    );
    assert.equal(
      (await req(`/lists/${list}/workspace`, { workspace: home }, b, "PUT"))
        .status,
      200,
    );
    assert.equal(
      (await req(`/lists/${list}/workspace`, { workspace: work }, b, "PUT"))
        .status,
      403,
    );
    assert.equal(
      (await req("/state", undefined, a)).data.lists.find((l) => l.id === list)
        .workspace,
      work,
    );
    assert.equal(
      (
        await req(
          "/workspaces/" + work,
          { destination: as.workspaces[0].id },
          a,
          "DELETE",
        )
      ).status,
      200,
    );
    assert.equal(
      (await req("/state", undefined, a)).data.lists.find((l) => l.id === list)
        .workspace,
      as.workspaces[0].id,
    );
    assert.equal(
      (
        await req(
          "/workspaces/" + as.workspaces[0].id,
          { destination: as.workspaces[0].id },
          a,
          "DELETE",
        )
      ).status,
      400,
    );
    for (let i = 1; i < 20; i++)
      assert.equal(
        (await req("/workspaces", { name: "Space " + i }, a)).status,
        200,
      );
    assert.equal(
      (await req("/workspaces", { name: "Over limit" }, a)).status,
      400,
    );
    assert.equal((await req("/notifications/native")).status, 401);
    await req("/notifications/test", {}, a);
    const feed = await req("/notifications/native", undefined, a);
    assert.equal(feed.data.user, as.user.id);
    assert.equal(feed.data.notifications.length, 1);
    assert.equal(
      (await req("/notifications/native", undefined, b)).data.notifications
        .length,
      0,
    );
    const n = feed.data.notifications[0];
    assert.equal(
      (
        await req(
          `/notifications/native?after=${n.created}&afterId=${n.id}`,
          undefined,
          a,
        )
      ).data.notifications.length,
      0,
    );
    assert.equal(
      (await req("/notifications/native?after=-1", undefined, a)).status,
      400,
    );
    const liveDb = new DatabaseSync(join(dir, "tada.sqlite"));
    try {
      const stamp = Date.now();
      const insert = liveDb.prepare(
        "INSERT INTO notifications(id,user,task,title,created) VALUES(?,?,?,?,?)",
      );
      for (let i = 0; i < 101; i++)
        insert.run(
          "page-" + String(i).padStart(3, "0"),
          bs.user.id,
          null,
          "Page item",
          stamp,
        );
      const first = (
        await req(`/notifications/native?after=${stamp - 1}`, undefined, b)
      ).data.notifications;
      assert.equal(first.length, 100);
      const last = first.at(-1);
      const second = (
        await req(
          `/notifications/native?after=${last.created}&afterId=${last.id}`,
          undefined,
          b,
        )
      ).data.notifications;
      assert.equal(second.length, 1);
      assert.equal(new Set([...first, ...second].map((n) => n.id)).size, 101);
      const task = (
        await req(
          "/tasks",
          { list, title: "Shared private task", subtasks: [], repeat: "none" },
          a,
        )
      ).data.id;
      insert.run(
        "restricted",
        bs.user.id,
        task,
        "Reminder: Shared private task",
        stamp + 1,
      );
      assert.equal(
        (await req(`/notifications/native?after=${stamp}&afterId=page-100`, undefined, b)).data
          .notifications.length,
        1,
      );
      await req(`/lists/${list}/members/${bs.user.id}`, {}, a, "DELETE");
      assert.equal(
        (await req(`/notifications/native?after=${stamp}&afterId=page-100`, undefined, b)).data
          .notifications.length,
        0,
      );
    } finally {
      liveDb.close();
    }
    // Existing accounts retain exactly one migrated default space.
    assert.equal(
      (await req("/state", undefined, "tada=legacy-token")).data.workspaces
        .length,
      1,
    );
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
