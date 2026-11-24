import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const origin = process.argv[2];
if (!origin) throw Error("Pass your computer’s local Wi-Fi URL");
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Your name").fill("Wi-Fi test");
  await page.getByLabel("Email address").fill(`wifi${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("secure-wifi-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("secure-wifi-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("heading", { name: /Hello, Wi-Fi/ }).waitFor();
  assert.equal(await page.evaluate(() => isSecureContext), false);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("Works over local Wi-Fi");
  await page.getByRole("button", { name: "+ Add a step", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Subtask", exact: true })
    .fill("No HTTPS-only draft identifier");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page.locator(".detail").waitFor({ state: "hidden" });
  const state = await (await page.request.get(origin + "/api/state")).json();
  assert.ok(
    state.tasks.some(
      (t) => t.title === "Works over local Wi-Fi" && t.subtasks.length === 1,
    ),
  );
  console.log(
    "Local network address: registration, cookie session, subtask creation and task save passed.",
  );
} finally {
  await browser.close();
}
