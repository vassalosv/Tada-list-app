import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "tada-test-"));
const port = 3198;
let child;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(path, body, cookie, method) {
  let r = await fetch(`http://localhost:${port}/api${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  let data = await r.json();
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const task = (list, extra = {}) => ({
  list,
  title: "Test task",
  notes: "A note",
  subtasks: [{ id: "s1", title: "First step", done: false }],
  priority: 2,
  repeat: "none",
  ...extra,
});
test("authenticated collaboration, durable files, recurrence, reminders and access controls", async () => {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir },
    stdio: "pipe",
  });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(`http://localhost:${port}/api/state`);
        break;
      } catch {
        await wait(100);
      }
    }
    assert.equal((await request("/state")).status, 401);
    let a = await request("/auth/register", {
      name: "Alice",
      email: "alice@example.com",
      password: "long-secure-pass",
      confirmPassword: "long-secure-pass",
    });
    assert.equal(a.status, 200);
    let ac = a.cookie;
    let b = await request("/auth/register", {
      name: "Bob",
      email: "bob@example.com",
      password: "long-secure-pass",
      confirmPassword: "long-secure-pass",
    });
    let bc = b.cookie;
    let c = await request("/auth/register", {
      name: "Carol",
      email: "carol@example.com",
      password: "long-secure-pass",
      confirmPassword: "long-secure-pass",
    });
    let cc = c.cookie;
    let state = (await request("/state", undefined, ac)).data;
    let list = state.lists[0].id;
    let created = await request(
      "/tasks",
      task(list, { due: "2027-01-31T10:00:00Z", repeat: "monthly" }),
      ac,
    );
    assert.equal(created.status, 200);
    let tid = created.data.id;
    assert.equal(
      (await request("/tasks/" + tid, task(list), bc, "PUT")).status,
      403,
    );
    let invite = await request(
      `/lists/${list}/invite`,
      { email: "bob@example.com", role: "view" },
      ac,
    );
    let token = new URL(invite.data.url).searchParams.get("invite");
    assert.equal((await request("/invites/accept", { token }, bc)).status, 200);
    assert.equal((await request("/invites/accept", { token }, bc)).status, 400);
    assert.equal(
      (await request("/tasks/" + tid, task(list), bc, "PUT")).status,
      403,
    );
    assert.equal(
      (await request("/tasks/" + tid, {}, bc, "DELETE")).status,
      403,
    );
    const form = new FormData();
    form.append("file", new Blob(["private photo"]), "photo.txt");
    assert.equal(
      (await request("/tasks/" + tid + "/files", form, ac)).status,
      200,
    );
    state = (await request("/state", undefined, bc)).data;
    let file = state.tasks.find((t) => t.id === tid).files[0];
    let download = await fetch(
      `http://localhost:${port}/api/files/${file.id}`,
      { headers: { cookie: bc } },
    );
    assert.equal(await download.text(), "private photo");
    assert.equal(
      (await request("/files/" + file.id, undefined, cc)).status,
      403,
    );
    assert.equal(
      (
        await request(
          "/tasks/" + tid + "/reminders",
          { at: new Date(Date.now() + 60000).toISOString(), repeat: "weekly" },
          bc,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "/tasks/" + tid + "/reminders",
          { at: new Date(Date.now() + 60000).toISOString(), repeat: "weekly" },
          ac,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/tasks/" + tid,
          task(list, {
            due: "2027-01-31T10:00:00Z",
            repeat: "monthly",
            done: true,
          }),
          ac,
          "PUT",
        )
      ).status,
      200,
    );
    state = (await request("/state", undefined, ac)).data;
    assert.ok(
      state.tasks.some(
        (t) =>
          t.title === "Test task" &&
          !t.done &&
          t.due === "2027-02-28T10:00:00.000Z",
      ),
    );
    invite = await request(
      `/lists/${list}/invite`,
      { email: "bob@example.com", role: "edit" },
      ac,
    );
    token = new URL(invite.data.url).searchParams.get("invite");
    await request("/invites/accept", { token }, bc);
    assert.equal(
      (
        await request(
          "/tasks/" + tid,
          task(list, { title: "Edited together" }),
          bc,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (await request(`/lists/${list}/invite`, { role: "edit" }, bc)).status,
      403,
    );
    await request(`/lists/${list}/members/${state.user.id}`, {}, ac, "DELETE");
    let attack = await fetch(`http://localhost:${port}/api/lists`, {
      method: "POST",
      headers: {
        cookie: ac,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: '{"name":"evil"}',
    });
    assert.equal(attack.status, 403);
    assert.equal(
      (await request("/tasks", task(list, { due: "bad" }), ac)).status,
      400,
    );
    assert.equal(
      (
        await request("/auth/register", {
          name: "Mismatch",
          email: "mismatch@example.com",
          password: "long-secure-pass",
          confirmPassword: "different-password",
        })
      ).status,
      400,
    );
    const staged = new FormData();
    staged.append(
      "task",
      JSON.stringify(task(list, { title: "Created with everything" })),
    );
    staged.append(
      "reminders",
      JSON.stringify([
        { at: new Date(Date.now() + 3600000).toISOString(), repeat: "weekly" },
        { at: new Date(Date.now() + 7200000).toISOString(), repeat: "none" },
      ]),
    );
    staged.append("files", new Blob(["draft audio"]), "voice.mp3");
    staged.append("files", new Blob(["draft notes"]), "notes.txt");
    const together = await request("/tasks/create", staged, ac);
    assert.equal(together.status, 200);
    const togetherState = (
      await request("/state", undefined, ac)
    ).data.tasks.find((t) => t.id === together.data.id);
    assert.equal(togetherState.reminders.length, 2);
    assert.equal(togetherState.files.length, 2);
    const before = (await request("/state", undefined, ac)).data.tasks.length;
    const invalid = new FormData();
    invalid.append("task", JSON.stringify(task(list)));
    invalid.append(
      "reminders",
      JSON.stringify([{ at: "invalid", repeat: "none" }]),
    );
    invalid.append("files", new Blob(["should clean up"]), "discard.txt");
    assert.equal((await request("/tasks/create", invalid, ac)).status, 400);
    assert.equal(
      (await request("/state", undefined, ac)).data.tasks.length,
      before,
    );
    const forbidden = new FormData();
    forbidden.append("task", JSON.stringify(task(list)));
    assert.equal((await request("/tasks/create", forbidden, cc)).status, 403);
    assert.equal((await request("/auth/google", undefined, ac)).status, 404);
    const second = (
      await request("/auth/login", {
        email: "alice@example.com",
        password: "long-secure-pass",
      })
    ).cookie;
    const passwordBody = {
      currentPassword: "long-secure-pass",
      newPassword: "a-new-secure-password",
      confirmPassword: "a-new-secure-password",
    };
    assert.equal(
      (await request("/profile/password", passwordBody)).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/profile/password",
          { ...passwordBody, currentPassword: "wrong-current" },
          ac,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/profile/password",
          { ...passwordBody, confirmPassword: "different" },
          ac,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/profile/password",
          { ...passwordBody, newPassword: "short", confirmPassword: "short" },
          ac,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/profile/password",
          {
            ...passwordBody,
            newPassword: "long-secure-pass",
            confirmPassword: "long-secure-pass",
          },
          ac,
        )
      ).status,
      400,
    );
    assert.equal(
      (await request("/profile/password", passwordBody, ac)).status,
      200,
    );
    assert.equal((await request("/state", undefined, second)).status, 401);
    assert.equal((await request("/state", undefined, ac)).status, 200);
    assert.equal((await request("/state", undefined, bc)).status, 200);
    assert.equal(
      (
        await request("/auth/login", {
          email: "alice@example.com",
          password: "long-secure-pass",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/auth/login", {
          email: "alice@example.com",
          password: "a-new-secure-password",
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/state", undefined, ac)).data.user.password,
      undefined,
    );
    await request("/logout", {}, ac);
    assert.equal((await request("/state", undefined, ac)).status, 401);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
