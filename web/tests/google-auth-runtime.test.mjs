import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
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

async function runtime(t, { redirectStatus, googleResponse, requestTimeoutMs } = {}) {
  const calls = [];
  // Accelerate failure-path tests only; the long scan uses the production 20s limit.
  const runtimeScript = requestTimeoutMs === undefined ? script : ts.transpileModule(
    source.replace("AbortSignal.timeout(20_000)", `AbortSignal.timeout(${requestTimeoutMs})`) + wrapper,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
  ).outputText;
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: "2026-05-15",
    script: runtimeScript,
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
      if (googleResponse) return googleResponse(url);
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

const scanAbout = {
  user: { displayName: "Synthetic scanner", emailAddress: "scan@example.test" },
  storageQuota: { limit: "15000000000", usage: "6144000" },
};

test("Workers: 6000 files across eight slow pages survive the production 20s request limit", { timeout: 60_000 }, async (t) => {
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  const pageSize = 750;
  const pages = [];
  const { mf, calls } = await runtime(t, {
    googleResponse: async (url) => {
      if (url.pathname === "/drive/v3/about") return Response.json(scanAbout);
      const page = Number(url.searchParams.get("pageToken") ?? 0);
      assert.equal(page, pages.length);
      pages.push(page);
      await delay(3000);
      const files = Array.from({ length: pageSize }, (_, offset) => {
        const index = page * pageSize + offset;
        return {
          id: `file-${index}`, name: `photo-${index}.jpg`, mimeType: "image/jpeg",
          size: "1024", md5Checksum: Math.floor(index / 2).toString(16).padStart(32, "0"),
          createdTime: "2026-01-01T00:00:00Z", modifiedTime: "2026-01-01T00:00:00Z",
          ownedByMe: true, version: "1", capabilities: { canTrash: true, canDelete: true },
        };
      });
      return Response.json({ files, ...(page < 7 ? { nextPageToken: String(page + 1) } : {}) });
    },
  });
  const started = Date.now();
  const response = await mf.dispatchFetch("https://dupespace.test/?scenario=scan");
  const body = await response.json();
  assert.ok(Date.now() - started > 20_000, "must exceed the actual production per-request deadline");
  assert.equal(response.status, 200, body.error);
  assert.equal(pages.length, 8);
  assert.equal(calls.length, 9);
  assert.equal(body.examined, 6000);
  assert.equal(body.groups.length, 3000);
  assert.equal(body.duplicateCopies, 3000);
  assert.equal(body.examinedBytes, 6000 * 1024);
  assert.equal(body.reclaimableBytes, 3000 * 1024);
  assert.deepEqual(body.storageQuota, scanAbout.storageQuota);
  assert.deepEqual(body.user, scanAbout.user);
  assert.ok(body.groups.every((group) => group.records.filter((record) => record.keeper).length === 1));
});

test("Workers: a genuinely timed-out page rejects the scan without partial results", async (t) => {
  let pages = 0;
  const { mf } = await runtime(t, {
    requestTimeoutMs: 250,
    googleResponse: async (url) => {
      if (url.pathname === "/drive/v3/about") return Response.json(scanAbout);
      pages += 1;
      if (pages === 1) return Response.json({ files: [], nextPageToken: "second" });
      await delay(600);
      return Response.json({ files: [] });
    },
  });
  const response = await mf.dispatchFetch("https://dupespace.test/?scenario=scan");
  const body = await response.json();
  assert.equal(response.status, 504);
  assert.match(body.error, /掃描未完成/);
  assert.equal(body.groups, undefined);
  assert.equal(pages, 2);
});

test("Workers: timeout still covers a delayed account response body", async (t) => {
  const { mf } = await runtime(t, {
    requestTimeoutMs: 250,
    googleResponse: async (url) => {
      if (url.pathname === "/drive/v3/files") return Response.json({ files: [] });
      let timer;
      return new Response(new ReadableStream({
        start(controller) {
          timer = setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(scanAbout)));
            controller.close();
          }, 600);
        },
        cancel() { clearTimeout(timer); },
      }), { headers: { "content-type": "application/json" } });
    },
  });
  const response = await mf.dispatchFetch("https://dupespace.test/?scenario=scan");
  const body = await response.json();
  assert.equal(response.status, 504);
  assert.match(body.error, /尚未執行清理/);
  assert.equal(body.groups, undefined);
});
