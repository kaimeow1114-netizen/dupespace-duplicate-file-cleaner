import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the DupeSweep product landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>DupeSweep｜重複檔案清理工具<\/title>/);
  assert.match(html, /線上清理 Google Drive/);
  assert.match(html, /DupeSweep-Setup\.exe/);
  assert.match(html, /ca-pub-7998471640181666/);
  assert.match(html, /<a[^>]+href="\/#features"[^>]*>功能<\/a>/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("uses native navigation links that work in the deployed Worker", async () => {
  const source = await readFile(new URL("../app/components/site-shell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /next\/link|<Link/);
  assert.match(source, /<a href="\/#features">功能<\/a>/);
  assert.match(source, /<a className="nav-cta" href="\/cleaner">/);
});

test("renders legal and cleaner routes with security headers", async () => {
  for (const path of ["/cleaner", "/privacy", "/terms", "/support"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.match(response.headers.get("x-content-type-options") ?? "", /nosniff/);
  }
});

test("keeps Google Drive API disconnected until an encrypted session exists", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("https://dupesweep.example/api/google/status"),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "not-a-real-secret",
      SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connected: false, configured: true });
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);

  const unconfigured = await worker.fetch(
    new Request("https://dupesweep.example/api/google/status"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(unconfigured.status, 200);
  assert.deepEqual(await unconfigured.json(), { connected: false, configured: false });
});
