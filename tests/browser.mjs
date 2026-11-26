import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
let errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3001");
await page.getByRole("button", { name: "New here? Create an account" }).click();
await page.getByLabel("Your name").fill("Alex");
await page.getByLabel("Email address").fill(`alex${Date.now()}@example.com`);
await page
  .getByLabel("Password", { exact: true })
  .fill("wonderful-secure-password");
await page
  .getByLabel("Confirm password", { exact: true })
  .fill("wonderful-secure-password");
await page
  .getByLabel("Confirm password", { exact: true })
  .fill("does-not-match");
await page.getByRole("button", { name: "Create account", exact: true }).click();
await page
  .getByRole("alert")
  .filter({ hasText: "Passwords do not match" })
  .waitFor();
await page
  .getByLabel("Confirm password", { exact: true })
  .fill("wonderful-secure-password");
if (await page.getByRole("link", { name: /Google|Microsoft/ }).count())
  throw Error("OAuth links still shown");
await page.getByRole("button", { name: "Create account", exact: true }).click();
await page.getByRole("heading", { name: /Hello, Alex/ }).waitFor();
mkdirSync("screenshots", { recursive: true });
for (const mode of ["Dark", "Material", "Custom"]) {
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  await page.getByRole("button", { name: new RegExp("^" + mode) }).click();
  if (mode === "Custom") {
    await page.getByLabel("Hex color", { exact: true }).fill("#008577");
    await page.getByRole("slider", { name: "Hue", exact: true }).fill("180");
  }
  await page.getByRole("button", { name: "Apply theme", exact: true }).click();
  if (
    (await page.locator("html").getAttribute("data-theme")) !==
    mode.toLowerCase()
  )
    throw Error("Theme did not apply");
  await page.reload();
  await page.getByRole("heading", { name: /Hello, Alex/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "screenshots/theme-" + mode.toLowerCase() + ".png",
    fullPage: true,
  });
  if (
    (await page.locator("html").getAttribute("data-theme")) !==
    mode.toLowerCase()
  )
    throw Error("Theme not persisted");
}
await page.getByRole("button", { name: "Change theme", exact: true }).click();
await page.getByRole("button", { name: /^Pastel/ }).click();
await page.getByRole("button", { name: "Apply theme", exact: true }).click();

await page.getByRole("button", { name: "New task", exact: true }).click();
await page
  .getByRole("textbox", { name: "Task title" })
  .fill("Browser-tested little win");
await page.getByRole("button", { name: "+ Add a step", exact: true }).click();
await page
  .getByRole("textbox", { name: "Subtask", exact: true })
  .fill("First little step");
await page.locator(".detail input[type=file]").setInputFiles([
  {
    name: "draft.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Draft attachment"),
  },
]);
await page.getByText("Ready to upload when saved").waitFor();
await page
  .getByRole("button", { name: "+ Schedule a reminder", exact: true })
  .click();
await page.getByLabel("Remind me at").fill("2027-02-01T10:00");
await page
  .getByRole("button", { name: "Schedule reminder", exact: true })
  .click();
await page.locator(".modal").waitFor({ state: "hidden" });
if (
  (
    await (await page.request.get("http://localhost:3001/api/state")).json()
  ).tasks.some((t) => t.title === "Browser-tested little win")
)
  throw Error("Draft saved too early");
await page.getByRole("button", { name: "Save task", exact: true }).click();
await page.locator(".detail").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "All tasks", exact: true }).click();
await page.getByText("Browser-tested little win", { exact: true }).waitFor();
await page
  .getByRole("button", { name: "Edit Browser-tested little win", exact: true })
  .click();
await page
  .getByRole("textbox", { name: "Task title" })
  .fill("Edited little win");
await page.getByRole("button", { name: "Save task", exact: true }).click();
await page.getByText("Edited little win", { exact: true }).waitFor();
await page.reload();
await page.getByRole("heading", { name: /Hello, Alex/ }).waitFor();
mkdirSync("screenshots", { recursive: true });
await page.screenshot({ path: "screenshots/desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(350);
await page.screenshot({ path: "screenshots/mobile.png", fullPage: true });
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw Error("Mobile overflow");
await page.getByRole("button", { name: "Open menu", exact: true }).click();
await page.getByRole("button", { name: "All tasks", exact: true }).click();
await page.getByText("Edited little win", { exact: true }).waitFor();
await page.getByText("Edited little win", { exact: true }).click();
await page
  .getByRole("button", { name: "+ Schedule a reminder", exact: true })
  .click();
await page.getByLabel("Remind me at").fill("2027-01-01T10:00");
await page
  .getByRole("button", { name: "Schedule reminder", exact: true })
  .click();
await page.locator(".modal").waitFor({ state: "hidden" });
await page.getByRole("link", { name: "draft.txt", exact: true }).waitFor();
if ((await page.locator(".detail .attachment").count()) !== 3)
  throw Error("Staged reminders or file missing");
await page.getByRole("button", { name: "Close task", exact: true }).click();
await page
  .getByRole("button", { name: "Complete Edited little win", exact: true })
  .click();
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "Browser checks passed: account, create/edit/subtasks, persistence, mobile navigation, reminder, completion; no JS errors or horizontal overflow.",
);
await browser.close();
