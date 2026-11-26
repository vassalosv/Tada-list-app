import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const origin = process.env.TEST_ORIGIN || "http://localhost:3001";
// CSS viewport sizes, rather than hard-coded device detection: narrow covers,
// common phone sizes, unfolded near-square screens, landscape and split windows.
const sizes = [
  [280, 740],
  [320, 568],
  [344, 882],
  [360, 800],
  [375, 812],
  [390, 844],
  [393, 852],
  [402, 874],
  [412, 915],
  [430, 932],
  [440, 956],
  [448, 998],
  [568, 320],
  [740, 360],
  [844, 390],
  [932, 430],
  [600, 800],
  [690, 829],
  [717, 800],
  [768, 1024],
  [820, 1180],
  [884, 1104],
  [912, 768],
  [1000, 600],
  [1024, 768],
  [1440, 900],
];
mkdirSync("screenshots", { recursive: true });
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const response = await context.request.post(origin + "/api/auth/register", {
      data: {
        name: "Mobile tester",
        email: `mobile-${engine.name()}-${Date.now()}@example.com`,
        password: "secure-phone-password",
        confirmPassword: "secure-phone-password",
      },
      headers: { Origin: origin },
    });
    assert.equal(response.status(), 200, await response.text());
    const page = await context.newPage();
    let errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page.getByRole("heading", { name: /Hello, Mobile/ }).waitFor();
    async function noOverflow(label, selector = "html") {
      assert.ok(
        await page
          .locator(selector)
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        `${engine.name()} ${label}: horizontal overflow`,
      );
    }
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(220);
      await noOverflow(`${width}x${height} dashboard`);
      if (width <= 1000) {
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
        await page
          .getByRole("button", { name: "All tasks", exact: true })
          .click();
      } else
        await page
          .getByRole("button", { name: "All tasks", exact: true })
          .click();
      await page.getByRole("button", { name: "New task", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Task title", exact: true })
        .fill("A task on every screen");
      await page
        .getByRole("button", { name: "+ Add a step", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Subtask", exact: true })
        .fill("A small step");
      await noOverflow(`${width}x${height} task`, ".detail");
      await page
        .getByRole("button", { name: "+ Schedule a reminder", exact: true })
        .click();
      await noOverflow(`${width}x${height} reminder`, ".modal");
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      const save = page.getByRole("button", { name: "Save task", exact: true });
      await save.scrollIntoViewIfNeeded();
      assert.ok(await save.isVisible());
      await page
        .getByRole("button", { name: "Close task", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Change theme", exact: true })
        .click();
      await page.getByRole("button", { name: /^Custom/ }).click();
      await noOverflow(`${width}x${height} theme`, ".theme-dialog");
      await page
        .getByRole("button", { name: "Close themes", exact: true })
        .click();
    }
    // Folding/rotation must preserve an open unsaved task, including its staged data.
    await page.setViewportSize({ width: 344, height: 882 });
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Task title", exact: true })
      .fill("Keep this draft while unfolding");
    await page
      .getByRole("button", { name: "+ Add a step", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Subtask", exact: true })
      .fill("Still here");
    await page.locator(".detail input[type=file]").setInputFiles({
      name: "fold.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Keep my attachment"),
    });
    for (const [width, height] of [
      [717, 800],
      [1100, 720],
      [800, 717],
      [344, 882],
    ]) {
      await page.setViewportSize({ width, height });
      assert.equal(
        await page
          .getByRole("textbox", { name: "Task title", exact: true })
          .inputValue(),
        "Keep this draft while unfolding",
      );
      await noOverflow("folded draft", ".detail");
    }
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page.locator(".detail").waitFor({ state: "hidden" });
    const saved = (
      await (await page.request.get(origin + "/api/state")).json()
    ).tasks.find((t) => t.title === "Keep this draft while unfolding");
    assert.equal(saved.files.length, 1);
    assert.equal(saved.subtasks[0].title, "Still here");
    for (const [name, width, height] of [
      ["phone", 393, 852],
      ["fold-cover", 344, 882],
      ["fold-inner", 717, 800],
      ["phone-landscape", 852, 393],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${engine.name()}-${name}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      `${engine.name()}: ${sizes.length} viewport sizes passed; navigation, editors, theme picker, rotation and draft persistence.`,
    );
  } finally {
    await browser.close();
  }
}
