import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test(
  "live server timer delivers a due one-off reminder to the account inbox",
  { timeout: 35000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "tada-live-reminder-"));
    const port = 3196;
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
    let cookie;
    const request = async (path, body) => {
      const response = await fetch(`http://localhost:${port}/api${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      assert.equal(response.status, 200);
      return response.json();
    };
    try {
      for (let i = 0; i < 60; i++) {
        try {
          await fetch(`http://localhost:${port}/api/state`);
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      await request("/auth/register", {
        name: "Timer",
        email: "timer@example.com",
        password: "secure-timer-password",
        confirmPassword: "secure-timer-password",
      });
      const initial = await request("/state");
      const task = await request("/tasks", {
        list: initial.lists[0].id,
        title: "Real timer check",
        subtasks: [],
        repeat: "none",
      });
      await request(`/tasks/${task.id}/reminders`, {
        at: new Date(Date.now() + 1200).toISOString(),
        repeat: "none",
      });
      let found = false;
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const current = await request("/state");
        if (
          current.notifications.some(
            (n) => n.title === "Reminder: Real timer check",
          )
        ) {
          found = true;
          assert.equal(
            current.tasks.find((t) => t.id === task.id).reminders.length,
            0,
          );
          break;
        }
      }
      assert.ok(
        found,
        "The real interval should deliver within one worker tick",
      );
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((r) => child.once("exit", r));
      }
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
