import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { Miniflare } from "miniflare";

const source = await readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8");
const script = ts.transpileModule(source + `
export default { async fetch(input) {
  const env = { GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture", SESSION_SECRET: "isolated-index-fixture-not-for-production" };
  const headers = new Headers(input.headers);
  headers.set("origin", "https://dupespace.test");
  headers.set("cookie", "dupespace_session=" + await encrypt({ accessToken: headers.get("x-test-account") || "account-a", expiresAt: Date.now()+3600000 }, env.SESSION_SECRET));
  const request = new Request(input, { headers });
  return handleGoogleDriveApi(request, env);
} };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;

const file = (id, createdTime = "2025-01-01T00:00:00Z") => ({
  id, name: `${id}.jpg`, size: "2000", md5Checksum: "same", mimeType: "image/jpeg", createdTime,
  modifiedTime: "2025-01-01T00:00:00Z", version: "1", parents: ["root"], ownedByMe: true,
  trashed: false, capabilities: { canTrash: true, canDelete: true },
});

async function setup(t) {
  const state = { files: [file("original"), file("copy", "2025-02-01T00:00:00Z")], changes: [], reads: 0, writes: 0, expired: false, changeFailure: false };
  const mf = new Miniflare({ modules: true, compatibilityDate: "2026-05-15", script,
    outboundService: async (request) => {
      const url = new URL(request.url);
      assert.equal(url.origin, "https://www.googleapis.com");
      if (url.pathname.endsWith("/about")) return Response.json({ user: { permissionId: request.headers.get("authorization"), emailAddress: "fixture@example.test" } });
      if (url.pathname.endsWith("/changes/startPageToken")) return Response.json({ startPageToken: "baseline" });
      if (url.pathname.endsWith("/changes")) {
        if (state.expired) return new Response(null, { status: 410 });
        if (state.changeFailure) return new Response(null, { status: 503 });
        return Response.json({ changes: state.changes, newStartPageToken: "next" });
      }
      if (url.pathname === "/drive/v3/files") { state.reads++; return Response.json({ files: state.files.filter((item) => !item.trashed) }); }
      const item = state.files.find((item) => url.pathname.endsWith(`/${item.id}`));
      assert.ok(item);
      if (request.method === "PATCH") {
        if (state.patchFailure) return new Response(null, { status: state.patchFailure });
        state.writes++;
        const body = await request.json();
        item.trashed = body.trashed;
        item.version = String(Number(item.version) + 1);
      }
      return Response.json(item);
    },
  });
  t.after(() => mf.dispose());
  const post = async (path, body = {}, account = "account-a", stream = false) => {
    const response = await mf.dispatchFetch(`https://dupespace.test/api/google/${path}`, {
      method: "POST", headers: { "content-type": "application/json", "x-test-account": account, accept: stream ? "application/x-ndjson" : "application/json" }, body: JSON.stringify(body),
    });
    return { status: response.status, body: stream ? (await response.text()).trim().split("\n").map((line) => JSON.parse(line)) : await response.json() };
  };
  return { state, post };
}

test("encrypted per-account index reads only changes on the next scan", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.ok(first.body.cache.snapshot);
  assert.doesNotMatch(first.body.cache.snapshot, /original|accessToken|refreshToken/);
  const next = file("another", "2026-01-01T00:00:00Z");
  state.changes = [{ fileId: next.id, file: next }];
  const second = await post("scan", { snapshot: first.body.cache.snapshot });
  assert.equal(second.body.scanMode, "incremental");
  assert.equal(second.body.duplicateCopies, 2);
  assert.equal(state.reads, 1);
  assert.equal(state.writes, 0);
});

test("stream reports real examined counts before returning a complete result", async (t) => {
  const { post } = await setup(t);
  const { body } = await post("scan", {}, "account-a", true);
  assert.deepEqual(body[0], { type: "progress", phase: "listing", examined: 0 });
  assert.ok(body.some((event) => event.type === "progress" && event.examined === 2));
  assert.equal(body.at(-1).type, "result");
  assert.equal(body.at(-1).result.duplicateCopies, 1);
});

test("tampering and cross-account replay cannot supply a cleaning plan", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  const snapshot = first.body.cache.snapshot;
  const tampered = await post("scan", { snapshot: "xxxx" + snapshot.slice(4) });
  assert.equal(tampered.body.scanMode, "full");
  const other = await post("scan", { snapshot }, "account-b");
  assert.equal(other.body.scanMode, "full");
  assert.notEqual(other.body.cache.accountKey, first.body.cache.accountKey);
  assert.equal(state.writes, 0);
});

test("removed files and newly added project markers invalidate candidates", async (t) => {
  const { state, post } = await setup(t);
  state.files.push({ id: "root", name: "Projects", mimeType: "application/vnd.google-apps.folder", ownedByMe: true, parents: [] });
  const first = await post("scan");
  state.changes = [{ fileId: "copy", removed: true }];
  assert.equal((await post("scan", { snapshot: first.body.cache.snapshot })).body.duplicateCopies, 0);
  state.changes = [{ fileId: "marker", file: { ...file("marker"), name: "package.json" } }];
  assert.equal((await post("scan", { snapshot: first.body.cache.snapshot })).body.duplicateCopies, 0);
});

test("folder changes and expired cursors rebuild; partial changes fail closed", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  state.changes = [{ fileId: "folder", file: { ...file("folder"), mimeType: "application/vnd.google-apps.folder" } }];
  assert.equal((await post("scan", { snapshot: first.body.cache.snapshot })).body.scanMode, "full");
  state.changes = []; state.expired = true;
  assert.equal((await post("scan", { snapshot: first.body.cache.snapshot })).body.scanMode, "full");
  state.expired = false; state.changeFailure = true;
  const failed = await post("scan", { snapshot: first.body.cache.snapshot });
  assert.notEqual(failed.status, 200);
  assert.equal(failed.body.groups, undefined);
});

test("changed targets remain protected even with a valid previous index/proof", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  const copy = first.body.groups[0].records.find((item) => !item.keeper);
  state.files.find((item) => item.id === copy.id).version = "2";
  const result = await post("trash", { items: [{ id: copy.id, proof: copy.proof }] });
  assert.equal(result.body.outcomes[0].status, "skipped");
  assert.equal(state.writes, 0);
});

test("restore returns a fresh proof without listing the whole Drive", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  const copy = first.body.groups[0].records.find((item) => !item.keeper);
  const items = [{ id: copy.id, proof: copy.proof }];
  assert.equal((await post("trash", { items })).body.outcomes[0].status, "trashed");
  const restored = await post("restore", { items });
  assert.equal(restored.body.outcomes[0].status, "restored");
  assert.ok(restored.body.outcomes[0].refreshedProof);
  assert.notEqual(restored.body.outcomes[0].refreshedProof, copy.proof);
  assert.equal(state.reads, 1);
  assert.equal(state.writes, 2);
});

test("trash marks transient errors retryable but denies permission errors", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  const copy = first.body.groups[0].records.find((item) => !item.keeper);
  const items = [{ id: copy.id, proof: copy.proof }];
  state.patchFailure = 503;
  assert.equal((await post("trash", { items })).body.outcomes[0].retryable, true);
  state.patchFailure = 403;
  assert.equal((await post("trash", { items })).body.outcomes[0].retryable, false);
  state.patchFailure = 0;
  assert.equal((await post("trash", { items, reconcile: true })).body.outcomes[0].status, "trashed");
  assert.equal(state.writes, 1);
});

test("retry reconciles an already trashed target without a second write or undo claim", async (t) => {
  const { state, post } = await setup(t);
  const first = await post("scan");
  const copy = first.body.groups[0].records.find((item) => !item.keeper);
  const items = [{ id: copy.id, proof: copy.proof }];
  await post("trash", { items });
  const reconciled = (await post("trash", { items, reconcile: true })).body.outcomes[0];
  assert.equal(reconciled.status, "trashed");
  assert.equal(reconciled.restorable, false);
  assert.equal(state.writes, 1);
  state.files.find((item) => item.id === "original").version = "2";
  assert.equal((await post("trash", { items, reconcile: true })).body.outcomes[0].status, "skipped");
  assert.equal(state.writes, 1);
});

test("creation time then full path is deterministic, never modified time", async (t) => {
  const { state, post } = await setup(t);
  state.files = [{ ...file("old"), name: "longer.jpg" }, { ...file("new", "2026-01-01T00:00:00Z"), name: "a.jpg" }];
  assert.equal((await post("scan")).body.groups[0].records.find((item) => item.keeper).id, "old");
  state.files[0].createdTime = undefined;
  assert.equal((await post("scan")).body.groups[0].records.find((item) => item.keeper).id, "new");
});

test("folder cleanup cannot override the earlier-created file keeper", async (t) => {
  const { state, post } = await setup(t);
  const folder = (id, time) => ({ ...file(id, time), name: id, size: undefined, md5Checksum: undefined, mimeType: "application/vnd.google-apps.folder", shared: false });
  state.files = [folder("older-folder", "2020-01-01T00:00:00Z"), folder("newer-folder", "2025-01-01T00:00:00Z"),
    { ...file("new-file", "2026-01-01T00:00:00Z"), name: "photo.jpg", parents: ["older-folder"] },
    { ...file("old-file", "2019-01-01T00:00:00Z"), name: "photo.jpg", parents: ["newer-folder"] }];
  const result = await post("scan");
  assert.equal(result.status, 200);
  assert.equal(result.body.groups.length, 1);
  assert.equal(result.body.groups[0].itemKind, "file");
  assert.equal(result.body.groups[0].records.find((record) => record.keeper).id, "old-file");
});
