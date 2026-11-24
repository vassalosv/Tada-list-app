import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
mkdirSync("screenshots", { recursive: true });
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      hasTouch: true,
    });
    const email = `profile-${engine.name()}-${Date.now()}@example.com`,
      old = "original-secure-password",
      updated = "updated-secure-password";
    await context.request.post("http://localhost:3001/api/auth/register", {
      data: {
        name: "Profile Tester",
        email,
        password: old,
        confirmPassword: old,
      },
    });
    const other = await browser.newContext();
    await other.request.post("http://localhost:3001/api/auth/login", {
      data: { email, password: old },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:3001");
    for (const [width, height] of [
      [280, 740],
      [320, 568],
      [393, 852],
      [717, 800],
      [852, 393],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page
        .getByRole("button", { name: "Account profile", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Account & profile", exact: true })
        .waitFor();
      await page.getByText(email, { exact: true }).waitFor();
      assert.ok(
        await page
          .locator(".modal")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      assert.ok(
        await page
          .locator("html")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      await page
        .getByRole("button", { name: "Update password", exact: true })
        .scrollIntoViewIfNeeded();
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page
      .getByRole("button", { name: "Account profile", exact: true })
      .click();
    await page
      .getByLabel("Current password", { exact: true })
      .fill("wrong-password");
    await page.getByLabel("New password", { exact: true }).fill(updated);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(updated);
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Current password is incorrect" })
      .waitFor();
    await page.getByLabel("Current password", { exact: true }).fill(old);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill("another-long-password");
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "New passwords do not match" })
      .waitFor();
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(updated);
    await page.getByLabel("Show entered passwords").check();
    assert.equal(
      await page
        .getByLabel("New password", { exact: true })
        .getAttribute("type"),
      "text",
    );
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Password updated" })
      .waitFor();
    assert.equal(
      await page.getByLabel("Current password", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await page
        .getByLabel("New password", { exact: true })
        .getAttribute("type"),
      "password",
    );
    assert.equal(
      (await other.request.get("http://localhost:3001/api/state")).status(),
      401,
    );
    assert.equal(
      (await context.request.get("http://localhost:3001/api/state")).status(),
      200,
    );
    assert.equal(
      (
        await other.request.post("http://localhost:3001/api/auth/login", {
          data: { email, password: old },
        })
      ).status(),
      401,
    );
    assert.equal(
      (
        await other.request.post("http://localhost:3001/api/auth/login", {
          data: { email, password: updated },
        })
      ).status(),
      200,
    );
    await page
      .getByLabel("Current password", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `screenshots/${engine.name()}-profile.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      `${engine.name()}: profile at six screen sizes, password validation, password change, field clearing and other-session revocation passed.`,
    );
  } finally {
    await browser.close();
  }
}
