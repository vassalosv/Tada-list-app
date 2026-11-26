import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { devicePlan } from "../src/reminder-plan.js";
import { normalizeServer } from "../src/native-settings.js";

test(
  "v1 shared Spaces, list appearance/order, assignments, photo privacy and live recipient routing",
  { timeout: 35000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "tada-v1-")),
      port = 3191;
    const child = spawn(process.execPath, ["server/index.js"], {
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: dir,
        VAPID_PUBLIC_KEY: "",
        VAPID_PRIVATE_KEY: "",
        VAPID_SUBJECT: "",
      },
      stdio: "ignore",
    });
    const req = async (path, body, cookie, method) => {
      const r = await fetch(`http://localhost:${port}/api${path}`, {
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
      return {
        status: r.status,
        data: r.headers.get("content-type")?.includes("application/json")
          ? await r.json()
          : await r.arrayBuffer(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    };
    try {
      for (let i = 0; i < 60; i++) {
        try {
          await req("/state");
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      const register = async (name) =>
        (
          await req("/auth/register", {
            name,
            email: name + "@example.com",
            password: "secure-v1-test-password",
            confirmPassword: "secure-v1-test-password",
          })
        ).cookie;
      const a = await register("AliceV1"),
        b = await register("BobV1"),
        e = await register("EveV1");
      const alice = (await req("/state", undefined, a)).data,
        bob = (await req("/state", undefined, b)).data,
        eve = (await req("/state", undefined, e)).data;
      const space = (await req("/workspaces", { name: "Family" }, a)).data.id;
      const list = (
        await req("/lists", { workspace: space, name: "Groceries" }, a)
      ).data.id;
      let state = (await req("/state", undefined, a)).data;
      assert.equal(state.lists.find((l) => l.id === list).icon, "list");
      assert.equal(state.lists.find((l) => l.id === list).accent, "#006644");
      assert.equal(
        (
          await req(
            `/lists/${list}`,
            { name: "Shopping", icon: "shopping-cart", accent: "#5b61a8" },
            a,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await req(
            `/lists/${list}`,
            { icon: "script", accent: "red" },
            a,
            "PATCH",
          )
        ).status,
        400,
      );
      const invite = (
        await req(
          `/workspaces/${space}/invite`,
          { email: "BobV1@example.com", role: "edit" },
          a,
        )
      ).data.url;
      assert.equal(
        (
          await req(
            "/space-invites/accept",
            { token: new URL(invite).searchParams.get("spaceInvite") },
            e,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await req(
            "/space-invites/accept",
            { token: new URL(invite).searchParams.get("spaceInvite") },
            b,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await req(
            "/space-invites/accept",
            { token: new URL(invite).searchParams.get("spaceInvite") },
            b,
          )
        ).status,
        400,
      );
      state = (await req("/state", undefined, b)).data;
      assert.ok(state.lists.find((l) => l.id === list).spaces.includes(space));
      assert.equal(state.lists.find((l) => l.id === list).role, "edit");
      assert.equal(
        (
          await req(
            `/workspaces/${space}/invite`,
            { email: "EveV1@example.com", role: "edit" },
            b,
          )
        ).status,
        403,
      );
      const later = (
        await req("/lists", { workspace: space, name: "New shared list" }, b)
      ).data.id;
      assert.ok(
        (await req("/state", undefined, a)).data.lists.some(
          (l) => l.id === later,
        ),
      );
      assert.equal(
        (
          await req(
            `/workspaces/${space}/order`,
            { ids: [later, list] },
            b,
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await req(
            `/workspaces/${space}/order`,
            { ids: [alice.lists[0].id] },
            b,
            "PUT",
          )
        ).status,
        403,
      );
      const order = (await req("/state", undefined, b)).data.lists
        .find((l) => l.id === later)
        .order.find((o) => o.space === space);
      assert.equal(order.position, 0);
      assert.equal(
        (await req(`/lists/${list}/members`, undefined, b)).data.length,
        2,
      );
      const draft = {
        list,
        title: "Assigned reminder",
        subtasks: [],
        repeat: "none",
        assignee: bob.user.id,
      };
      assert.equal(
        (await req("/tasks", { ...draft, assignee: eve.user.id }, a)).status,
        400,
      );
      const tid = (await req("/tasks", draft, a)).data.id;
      await req(
        `/tasks/${tid}/reminders`,
        { at: new Date(Date.now() + 1000).toISOString(), repeat: "none" },
        a,
      );
      const saved = (await req("/state", undefined, b)).data.tasks.find(
        (t) => t.id === tid,
      );
      assert.equal(devicePlan([saved], Date.now(), alice.user.id).length, 0);
      assert.equal(devicePlan([saved], Date.now(), bob.user.id).length, 1);
      const reminder = saved.reminders[0],
        event = `reminder:${reminder.id}:${reminder.at}`;
      assert.equal(
        (
          await req(
            `/notifications/eligible/${tid}?event=${event}`,
            undefined,
            a,
          )
        ).data.eligible,
        false,
      );
      assert.equal(
        (
          await req(
            `/notifications/eligible/${tid}?event=${event}`,
            undefined,
            b,
          )
        ).data.eligible,
        true,
      );
      assert.equal(
        (
          await req(
            `/notifications/eligible/${tid}?event=due:${tid}:1`,
            undefined,
            b,
          )
        ).data.eligible,
        false,
      );
      const photo = new FormData();
      photo.append(
        "photo",
        new Blob(
          [
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a04cAAAAASUVORK5CYII=",
              "base64",
            ),
          ],
          { type: "image/png" },
        ),
        "photo.png",
      );
      assert.equal((await req("/profile/photo", photo, a)).status, 200);
      assert.ok((await req("/state", undefined, a)).data.user.avatar);
      assert.equal(
        (await req(`/avatars/${alice.user.id}`, undefined, b)).status,
        200,
      );
      assert.equal(
        (await req(`/avatars/${alice.user.id}`, undefined, e)).status,
        403,
      );
      const invalid = new FormData();
      invalid.append(
        "photo",
        new Blob(["<svg/>"], { type: "image/svg+xml" }),
        "photo.svg",
      );
      assert.equal((await req("/profile/photo", invalid, a)).status, 400);
      const viewInvite = (
        await req(
          `/workspaces/${space}/invite`,
          { email: "EveV1@example.com", role: "view" },
          a,
        )
      ).data.url;
      await req(
        "/space-invites/accept",
        { token: new URL(viewInvite).searchParams.get("spaceInvite") },
        e,
      );
      assert.equal(
        (await req("/lists", { workspace: space, name: "Denied" }, e)).status,
        403,
      );
      assert.equal((await req(`/tasks/${tid}`, draft, e, "PUT")).status, 403);
      assert.equal(
        (await req(`/avatars/${alice.user.id}`, undefined, e)).status,
        200,
      );
      await req(`/workspaces/${space}/members/${eve.user.id}`, {}, a, "DELETE");
      assert.equal(
        (await req(`/notifications/eligible/${tid}`, undefined, e)).status,
        403,
      );
      assert.equal(
        (await req(`/avatars/${alice.user.id}`, undefined, e)).status,
        403,
      );
      let delivered = false;
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 450));
        const inbox = (await req("/notifications/native", undefined, b)).data
          .notifications;
        if (inbox.some((n) => n.task === tid)) {
          delivered = true;
          break;
        }
      }
      assert.ok(delivered, "Assignee gets the actual timer-driven reminder");
      assert.ok(
        !(
          await req("/notifications/native", undefined, a)
        ).data.notifications.some((n) => n.task === tid),
      );
      await req(
        `/tasks/${tid}`,
        { ...draft, assignee: alice.user.id },
        a,
        "PUT",
      );
      assert.equal(
        (await req(`/notifications/eligible/${tid}`, undefined, b)).data
          .eligible,
        false,
      );
      assert.ok(
        !(
          await req("/notifications/native", undefined, b)
        ).data.notifications.some((n) => n.task === tid),
      );
      await req(`/workspaces/${space}/members/${bob.user.id}`, {}, a, "DELETE");
      assert.ok(
        !(await req("/state", undefined, b)).data.lists.some(
          (l) => l.id === list,
        ),
      );
      assert.equal(
        (await req(`/notifications/eligible/${tid}`, undefined, b)).status,
        403,
      );
      assert.equal((await req("/profile/photo", {}, a, "DELETE")).status, 200);
      assert.equal((await req("/state", undefined, a)).data.user.avatar, null);
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await once(child, "exit");
      }
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
test("Account server accepts HTTPS origins and rejects credential/path confusion", () => {
  assert.equal(
    normalizeServer("https://tada-list.duckdns.org:8443/"),
    "https://tada-list.duckdns.org:8443",
  );
  for (const value of [
    "http://example.com",
    "https://name:secret@example.com",
    "https://example.com/path",
    "https://example.com/?token=x",
  ])
    assert.throws(() => normalizeServer(value));
});
