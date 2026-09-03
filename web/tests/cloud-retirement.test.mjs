import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { handleGoogleDriveApi: handle } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const env = { SESSION_SECRET: "synthetic-test-secret-never-production" };
async function session() {
  const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.SESSION_SECRET)), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" })));
  return Buffer.concat([iv, Buffer.from(data)]).toString("base64url");
}
test("all previous file access and mutation routes return 410 without network access", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected outbound request"); });
  for (const path of ["scan", "trash", "delete", "restore", "thumbnail", "start", "auth"]) {
    for (const method of ["GET", "POST", "DELETE"]) { const response = await handle(new Request(`https://dupespace.app/api/google/${path}`, { method }), env); assert.equal(response.status, 410); }
  }
});
test("status never refreshes tokens and retains legacy cookie for later revocation", async () => {
  const response = await handle(new Request("https://dupespace.app/api/auth/session"), env);
  assert.equal((await response.json()).connected, false); assert.equal(response.headers.get("set-cookie"), null);
});
test("same-origin disconnect revokes only a legacy grant and never uses Web Secret", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => { calls++; assert.equal(url, "https://oauth2.googleapis.com/revoke"); assert.equal(options.redirect, "error"); assert.ok(options.signal); assert.equal(options.body.get("token"), "synthetic-refresh"); return new Response(null, { status: 200 }); });
  const response = await handle(new Request("https://dupespace.app/api/google/disconnect", { method: "POST", headers: { origin: "https://dupespace.app", cookie: `dupespace_session=${await session()}` } }), env);
  assert.equal(calls, 1); assert.equal((await response.json()).revoked, true); assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});
test("failed revocation does not discard a usable grant before retry", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  const response = await handle(new Request("https://dupespace.app/api/google/disconnect", { method: "POST", headers: { cookie: `dupespace_session=${await session()}` } }), env);
  assert.equal((await response.json()).revoked, false); assert.equal(response.headers.get("set-cookie"), null);
});
test("cross-origin disconnect cannot revoke or clear a session", async () => {
  const response = await handle(new Request("https://dupespace.app/api/google/disconnect", { method: "POST", headers: { origin: "https://untrusted.test" } }), env);
  assert.equal(response.status, 403); assert.equal(response.headers.get("set-cookie"), null);
});
