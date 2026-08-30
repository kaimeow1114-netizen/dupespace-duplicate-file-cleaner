import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Miniflare } from "miniflare";
import ts from "typescript";

const source = await readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8");
// Test-only fixture generation stays outside the production module and build.
const wrapper = `
export default {
  async fetch(input) {
    const env = {
      GOOGLE_CLIENT_ID: "synthetic-client",
      GOOGLE_CLIENT_SECRET: "synthetic-secret",
      SESSION_SECRET: "synthetic-runtime-test-secret-not-for-production",
    };
    const scenario = new URL(input.url).searchParams.get("scenario");
    const headers = new Headers({ origin: "https://dupespace.test" });
    if (scenario !== "anonymous") {
      headers.set("cookie", "dupespace_session=" + await encrypt({
        accessToken: "synthetic-access-token",
        refreshToken: "synthetic-refresh-token",
        expiresAt: Date.now() + (scenario === "refresh" ? -1000 : 3600000),
      }, env.SESSION_SECRET));
    }
    const scanning = scenario === "scan";
    const request = new Request("https://dupespace.test" +
      (scanning ? "/api/google/scan" : "/api/auth/session"), {
      method: scanning ? "POST" : "GET", headers,
      ...(scanning ? { body: "{}" } : {}),
    });
    return handleGoogleDriveApi(request, env);
  },
};`;
const script = ts.transpileModule(source + wrapper, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

async function runtime(t, { redirectStatus } = {}) {
  const calls = [];
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: "2026-05-15",
    script,
    // All outbound traffic is intercepted; no real Google credentials or files.
    outboundService: async (request) => {
      const url = new URL(request.url);
      calls.push({ url: request.url, method: request.method, authorization: request.headers.get("authorization") });
      if (url.origin === "https://oauth2.googleapis.com" && url.pathname === "/token") {
        assert.equal(request.method, "POST");
        return Response.json({ access_token: "synthetic-refreshed-token", expires_in: 3600 });
      }
      assert.equal(url.origin, "https://www.googleapis.com", "must never follow a redirect with credentials");
      assert.equal(request.method, "GET", "this test never mutates Drive files");
      if (redirectStatus) return new Response(null, {
        status: redirectStatus, headers: { location: "https://untrusted.example.test/collect" },
      });
      if (url.pathname === "/drive/v3/about") return Response.json({
        user: { displayName: "Runtime test", emailAddress: "test@example.test" },
        storageQuota: { limit: "1000000", usage: "0" },
      });
      assert.equal(url.pathname, "/drive/v3/files");
      return Response.json({ files: [] });
    },
  });
  t.after(() => mf.dispose());
  return { mf, calls };
}

test("Workers: anonymous session does not call Google", async (t) => {
  const { mf, calls } = await runtime(t);
  const response = await mf.dispatchFetch("https://dupespace.test/?scenario=anonymous");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).connected, false);
  assert.equal(calls.length, 0);
});

test("Workers: existing encrypted session restores the connected account", async (t) => {
  const { mf, calls } = await runtime(t);
  const response = await mf.dispatchFetch("https://dupespace.test/");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.connected, true);
  assert.equal(body.user.emailAddress, "test@example.test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].authorization, "Bearer synthetic-access-token");
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/);
  assert.doesNotMatch(JSON.stringify(body), /synthetic-access-token|synthetic-refresh-token/);
});

test("Workers: expired access token refreshes before the account request", async (t) => {
  const { mf, calls } = await runtime(t);
  const response = await mf.dispatchFetch("https://dupespace.test/?scenario=refresh");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).connected, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].authorization, "Bearer synthetic-refreshed-token");
});

test("Workers: authenticated scan uses the same compatible Google request path", async (t) => {
  const { mf, calls } = await runtime(t);
  const response = await mf.dispatchFetch("https://dupespace.test/?scenario=scan");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).groups, []);
  assert.equal(calls.length, 2);
});

for (const redirectStatus of [301, 302, 303, 307, 308]) {
  test(`Workers: ${redirectStatus} redirects fail closed without forwarding credentials`, async (t) => {
    const { mf, calls } = await runtime(t, { redirectStatus });
    const response = await mf.dispatchFetch("https://dupespace.test/");
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /非預期轉址/);
    assert.equal(calls.length, 1);
  });
}
