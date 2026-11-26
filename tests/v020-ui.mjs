import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tada-ui-v020-")),
  origin = "http://localhost:3194";
const server = spawn(process.execPath, ["server/index.js"], {
  env: { ...process.env, PORT: "3194", APP_ORIGIN: origin, DATA_DIR: dir },
  stdio: "ignore",
});
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(origin + "/api/state");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch();
  mkdirSync("screenshots/v0.2.0", { recursive: true });
  for (const [width, height] of [
    [360, 800],
    [393, 852],
    [430, 932],
    [768, 1024],
    [1440, 1050],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const errors = [];
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "emerald",
    );
    assert.equal(
      await page
        .locator(".auth-form .primary")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(0, 102, 68)",
    );
    assert.ok(
      await page.locator(".brand .app-icon").first().getAttribute("src"),
    );
    if (width === 1440)
      await page.screenshot({
        path: "screenshots/v0.2.0/login.png",
        fullPage: true,
      });
    await context.request.post(origin + "/api/auth/register", {
      data: {
        name: "Spaces tester",
        email: `spaces${width}@example.com`,
        password: "secure-ui-spaces-password",
        confirmPassword: "secure-ui-spaces-password",
      },
    });
    await page.reload();
    if (width <= 1000) await page.locator(".lists-home").waitFor();
    else await page.getByRole("button", { name: /^My lists/ }).click();
    assert.equal(await page.locator(".workspace-list-card").count(), 3);
    await page.screenshot({
      path: `screenshots/v0.2.0/lists-${width}.png`,
      fullPage: true,
    });
    const openMenu = async () => {
      if (width <= 1000)
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
    };
    await openMenu();
    await page
      .getByRole("button", { name: "Manage spaces", exact: true })
      .click();
    await page.getByLabel("Space name", { exact: true }).fill("Work");
    await page
      .getByRole("button", { name: "Create space", exact: true })
      .click();
    await page.locator(".workspace-empty").waitFor();
    await page.getByRole("button", { name: "New list", exact: true }).click();
    await page.getByLabel("List name", { exact: true }).fill("Project launch");
    await page.locator(".modal button.primary").click();
    await page
      .getByRole("heading", { name: /Project launch/ })
      .first()
      .waitFor();
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Task title", exact: true })
      .fill("Plan the release");
    await page
      .getByRole("button", { name: "+ Schedule a reminder", exact: true })
      .click();
    await page.getByLabel("Remind me at").fill("2027-02-01T10:00");
    await page
      .getByRole("button", { name: "Schedule reminder", exact: true })
      .click();
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page
      .getByRole("img", { name: "1 reminder set", exact: true })
      .waitFor();
    await page.screenshot({
      path: `screenshots/v0.2.0/tasks-${width}.png`,
      fullPage: true,
    });
    const state = await (
      await context.request.get(origin + "/api/state")
    ).json();
    const personal = state.workspaces.find((w) => w.name === "Personal").id;
    await page
      .getByLabel("Move list to space", { exact: true })
      .selectOption(personal);
    await page
      .locator(".workspace-list-card")
      .filter({ hasText: "Project launch" })
      .waitFor();
    await openMenu();
    const work = state.workspaces.find((w) => w.name === "Work").id;
    await page.getByLabel("Space", { exact: true }).selectOption(work);
    await page.locator(".workspace-empty").waitFor();
    assert.equal(await page.locator(".workspace-list-card").count(), 0);
    await page.reload();
    if (width > 1000)
      await page.getByRole("button", { name: /^My lists/ }).click();
    await page.locator(".lists-home").waitFor();
    assert.ok((await page.locator(".lists-home h1").textContent()) === "Work");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Page overflow at " + width,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `screenshots/v0.2.0/spaces-${width}.png`,
      fullPage: true,
    });
    await context.close();
  }
  // Android presentation must never direct the user into browser push setup.
  const native = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  await native.addInitScript(() => {
    window.androidBridge = { postMessage() {} };
  });
  await native.request.post(origin + "/api/auth/register", {
    data: {
      name: "Native tester",
      email: "native@example.com",
      password: "secure-native-ui-password",
      confirmPassword: "secure-native-ui-password",
    },
  });
  const phone = await native.newPage();
  await phone.goto(origin);
  await phone.locator(".lists-home").waitFor();
  await phone
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  assert.equal(
    await phone
      .getByText("Browser push on this server", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await phone
      .getByRole("button", { name: "Enable browser push", exact: true })
      .count(),
    0,
  );
  await phone
    .getByRole("button", { name: "Enable Android notifications", exact: true })
    .waitFor();
  await native.close();
  console.log(
    "v0.2 UI passed at five phone/foldable/desktop widths: emerald login, spaces creation/isolation/persistence, list moves, reminder badges, and native-only notification controls.",
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  rmSync(dir, { recursive: true, force: true });
}
