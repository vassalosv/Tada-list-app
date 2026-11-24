import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const registered = await context.request.post(
    "http://localhost:3001/api/auth/register",
    {
      data: {
        name: "Push check",
        email: `push${Date.now()}@example.com`,
        password: "secure-push-password",
        confirmPassword: "secure-push-password",
      },
    },
  );
  assert.equal(registered.status(), 200);
  const config = await (
    await context.request.get("http://localhost:3001/api/push/config")
  ).json();
  assert.match(config.publicKey, /^[A-Za-z0-9_-]{87}$/);
  assert.deepEqual(Object.keys(config), ["publicKey"]);
  const page = await context.newPage();
  await page.goto("http://localhost:3001");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  // Confirm the UI now proceeds past server configuration, without enrolling a
  // temporary browser or granting system notification permission on the user's behalf.
  await page.evaluate(() => {
    Notification.requestPermission = async () => "denied";
  });
  await page
    .getByRole("button", { name: "Enable browser push", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Allow notifications in your browser settings" })
    .waitFor();
  assert.ok(await page.evaluate(() => isSecureContext));
  console.log(
    "Push configuration active: valid public key exposed; private key absent; enable flow now reaches browser permission.",
  );
} finally {
  await browser.close();
}
