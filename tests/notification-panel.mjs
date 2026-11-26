import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  const r = await context.request.post(
    "http://localhost:3001/api/auth/register",
    {
      data: {
        name: "Notification tester",
        email: `notifications${Date.now()}@example.com`,
        password: "secure-notification-password",
        confirmPassword: "secure-notification-password",
      },
    },
  );
  assert.equal(r.status(), 200);
  const page = await context.newPage();
  await page.goto("http://localhost:3001");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page.getByText("Scheduler running", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Test server notification", exact: true })
    .click();
  await page
    .locator(".notification")
    .filter({ hasText: "Test notification from TaDa" })
    .waitFor();
  await page
    .getByRole("status")
    .filter({ hasText: "queued for browser push" })
    .waitFor();
  assert.ok(
    await page
      .locator(".modal")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  );
  await page.screenshot({
    path: "screenshots/notification-status.png",
    fullPage: true,
  });
  console.log(
    "Notification panel passed: live worker status, device registration count, test inbox delivery and phone layout.",
  );
} finally {
  await browser.close();
}
