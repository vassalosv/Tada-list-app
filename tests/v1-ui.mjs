import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tada-ui-v1-")),
  origin = "http://localhost:3192";
const server = spawn(process.execPath, ["server/index.js"], {
  env: { ...process.env, PORT: "3192", APP_ORIGIN: origin, DATA_DIR: dir },
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
  mkdirSync("screenshots/v1.0.0", { recursive: true });
  for (const [width, height] of [
    [360, 800],
    [393, 852],
    [430, 932],
    [768, 1024],
    [1440, 1050],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width === 393,
    });
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
        path: "screenshots/v1.0.0/login.png",
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
    await page.locator(".compact-catalogue").waitFor();
    assert.equal(await page.locator(".compact-list").count(), 3);
    assert.equal(await page.locator(".dashboard .summary").count(), 4);
    assert.equal(await page.locator(".quick-lists").count(), 0);
    assert.ok(
      await page
        .getByRole("button", { name: "Add task", exact: true })
        .evaluate(
          (e) =>
            e.getBoundingClientRect().bottom <= innerHeight &&
            e.getBoundingClientRect().top > innerHeight * 0.65,
        ),
    );
    await page.screenshot({
      path: `screenshots/v1.0.0/lists-${width}.png`,
      fullPage: true,
    });
    const initialFirst = await page
      .locator(".compact-list")
      .first()
      .getAttribute("data-list-id");
    const from = await page.locator(".compact-list").first().boundingBox(),
      to = await page.locator(".compact-list").last().boundingBox();
    const reordered = page.waitForResponse(
      (r) => r.url().endsWith("/order") && r.request().method() === "PUT",
    );
    if (width === 393) {
      const touch = await context.newCDPSession(page);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from.x + 65, y: from.y + 25 }],
      });
      await page.waitForTimeout(480);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: to.x + 65, y: to.y + 25 }],
      });
      await page.waitForTimeout(100);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await touch.detach();
    } else {
      await page.mouse.move(from.x + 65, from.y + 25);
      await page.mouse.down();
      await page.waitForTimeout(480);
      await page.mouse.move(to.x + 65, to.y + 25, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
    }
    assert.equal((await reordered).status(), 200);
    await page.reload();
    await page.locator(".compact-list").first().waitFor();
    assert.equal(
      await page.locator(".compact-list").last().getAttribute("data-list-id"),
      initialFirst,
    );
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
    await page.locator(".compact-catalogue").waitFor();
    await page
      .locator(".compact-catalogue")
      .getByRole("button", { name: "New list", exact: true })
      .click();
    await page.getByLabel("List name", { exact: true }).fill("Project launch");
    await page
      .getByRole("button", { name: "Icon briefcase", exact: true })
      .click();
    await page.getByLabel("List color", { exact: true }).fill("#5b61a8");
    await page.locator(".modal button.primary").click();
    await page
      .locator(".compact-list")
      .filter({ hasText: "Project launch" })
      .locator(".list-open")
      .click();
    await page
      .getByRole("heading", { name: /Project launch/ })
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Add task", exact: true }).click();
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
    await page
      .getByLabel("Assign to", { exact: true })
      .selectOption({ label: "Spaces tester (me)" });
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page
      .getByRole("img", { name: "1 reminder set", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Account profile", exact: true })
      .click();
    await page
      .getByLabel("Change profile picture")
      .setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a04cAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    await page.locator(".account-trigger img").waitFor();
    await page.waitForFunction(
      () => document.querySelector(".account-trigger img")?.naturalWidth > 0,
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Share Space", exact: true })
      .click();
    await page
      .getByLabel("Invite email", { exact: true })
      .fill("family@example.com");
    await page
      .getByRole("button", { name: "Create invitation link", exact: true })
      .click();
    await page
      .getByLabel("Single-use invitation · expires in 7 days")
      .waitFor();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit list Project launch", exact: true })
      .click();
    await page.getByRole("button", { name: "Icon home", exact: true }).click();
    await page.getByRole("button", { name: "Save list", exact: true }).click();
    await page.locator(".modal").waitFor({ state: "hidden" });
    await page.screenshot({
      path: `screenshots/v1.0.0/tasks-${width}.png`,
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
      .locator(".compact-list")
      .filter({ hasText: "Project launch" })
      .waitFor();
    await openMenu();
    const work = state.workspaces.find((w) => w.name === "Work").id;
    await page.getByLabel("Space", { exact: true }).selectOption(work);
    await page.locator(".compact-catalogue").waitFor();
    assert.equal(await page.locator(".compact-list").count(), 0);
    await page.reload();

    await page.locator(".compact-catalogue").waitFor();
    assert.ok(
      (await page.locator(".compact-catalogue h2").textContent()).includes(
        "Work",
      ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Page overflow at " + width,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `screenshots/v1.0.0/spaces-${width}.png`,
      fullPage: true,
    });
    await context.close();
  }
  // Every preset supports dark appearance and keeps the preference after reload.
  const themed = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  const themes = await themed.newPage();
  await themes.goto(origin);
  for (const mode of ["Emerald", "Pastel", "Dark", "Material", "Custom"]) {
    await themes
      .getByRole("button", { name: "Change theme", exact: true })
      .click();
    await themes.getByRole("button", { name: new RegExp("^" + mode) }).click();
    await themes.getByLabel("Dark appearance", { exact: true }).check();
    await themes
      .getByRole("button", { name: "Apply theme", exact: true })
      .click();
    await themes.reload();
    await themes.waitForFunction(
      () => document.documentElement.dataset.appearance === "dark",
    );
    await themes.screenshot({
      path: `screenshots/v1.0.0/theme-${mode.toLowerCase()}-dark.png`,
      fullPage: true,
    });
    assert.equal(
      await themes
        .locator("html")
        .evaluate((e) => getComputedStyle(e).colorScheme),
      "dark",
    );
  }
  await themed.close();
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
  await phone.locator(".compact-catalogue").waitFor();
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
    "v1 UI passed at five widths: compact home/dashboard, list appearance, reminder badges, profile photos, bottom add button, dark presets and native notification controls.",
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  rmSync(dir, { recursive: true, force: true });
}
