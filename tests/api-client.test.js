import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/api.js";
test("API reports connection and non-JSON responses without exposing HTML", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("<!doctype html><h1>Not an API</h1>", {
        headers: { "content-type": "text/html" },
      });
    await assert.rejects(
      () => api("/state"),
      /web page instead of the TaDa service/,
    );
    globalThis.fetch = async () =>
      new Response("broken", {
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(() => api("/state"), /invalid response/);
    globalThis.fetch = async () => {
      throw Error("network failure");
    };
    await assert.rejects(() => api("/state"), /Cannot reach your TaDa server/);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "Incorrect email or password" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(
      () => api("/auth/login", {}),
      /Incorrect email or password/,
    );
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    assert.deepEqual(await api("/state"), { ok: true });
  } finally {
    globalThis.fetch = original;
  }
});
