import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3001");
  await page.getByLabel("Email address").fill("connection@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("secure-connection-password");
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><h1>Web page</h1>",
    }),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "web page instead of the TaDa service" })
    .waitFor();
  assert.equal(await page.getByText(/Unexpected token/).count(), 0);
  await page.unroute("**/api/auth/login");
  await page.route("**/api/auth/login", (route) => route.abort());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Cannot reach your TaDa server" })
    .waitFor();
  console.log(
    "Browser regression passed: HTML and network failures show connection guidance, not JSON parser errors.",
  );
} finally {
  await browser.close();
}
