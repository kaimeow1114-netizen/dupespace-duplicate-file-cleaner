import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(`${source}\nexport { encrypt };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const env = { GOOGLE_CLIENT_ID: "synthetic-client", GOOGLE_CLIENT_SECRET: "synthetic-secret",
  SESSION_SECRET: "synthetic-session-test-only-never-production" };

function file(id, properties = {}) {
  return { id, name: `${id}.txt`, size: "8", md5Checksum: "synthetic-digest", version: "1",
    mimeType: "text/plain", ownedByMe: true, trashed: false,
    createdTime: "2026-01-01T00:00:00Z", modifiedTime: "2026-01-01T00:00:00Z",
    capabilities: { canTrash: true, canDelete: true }, ...properties };
}

async function scan(files, context, profile = "project") {
  context.mock.method(globalThis, "fetch", async (url, options = {}) => {
    assert.ok(!options.method || options.method === "GET", "scan cannot mutate Drive");
    const path = new URL(url).pathname;
    if (path.endsWith("/about")) return Response.json({ user: { emailAddress: "fixture@example.test" } });
    if (path.endsWith("/files")) return Response.json({ files });
    throw new Error(`Unexpected request: ${path}`);
  });
  const cookie = await api.encrypt({ accessToken: "synthetic-token", expiresAt: Date.now() + 3600000 }, env.SESSION_SECRET);
  const response = await api.handleGoogleDriveApi(new Request("https://dupespace.app/api/google/scan", {
    method: "POST", headers: { origin: "https://dupespace.app", "content-type": "application/json",
      cookie: `dupespace_session=${cookie}` }, body: JSON.stringify({ protectedProfile: profile }),
  }), env);
  assert.equal(response.status, 200);
  return response.json();
}

test("web scan preselects small safe copies and keeps owner/project/zero-byte protections", async (t) => {
  const result = await scan([
    file("keeper"), file("copy", { createdTime: "2026-02-01T00:00:00Z" }),
    file("no-trash", { capabilities: { canTrash: false, canDelete: true } }),
    file("zero", { size: "0" }), file("shared", { ownedByMe: false }),
    file("project", { name: "package.json" }),
  ], t);
  const all = result.groups.flatMap((g) => g.records);
  const selected = all.filter((r) => !r.keeper && r.canTrash && r.autoSelectable);
  assert.deepEqual(selected.map((r) => r.id), ["copy"]);
  assert.ok(all.find((r) => r.id === "keeper").keeper);
  assert.ok(!all.some((r) => ["zero", "shared", "project"].includes(r.id)));
});

test("strict profile remains a deliberate no-preselection choice", async (t) => {
  const result = await scan([file("a"), file("b")], t, "strict");
  assert.ok(result.groups.flatMap((g) => g.records).every((r) => !r.autoSelectable));
});

test("small verified mirror folders are preselected for trash only", async (t) => {
  const folder = (id, createdTime) => file(id, { name: id, mimeType: "application/vnd.google-apps.folder",
    size: undefined, md5Checksum: undefined, createdTime });
  const result = await scan([
    folder("old-album", "2026-01-01T00:00:00Z"), folder("new-album", "2026-02-01T00:00:00Z"),
    file("a", { name: "photo.txt", parents: ["old-album"] }),
    file("b", { name: "photo.txt", parents: ["new-album"] }),
  ], t);
  const records = result.groups.filter((g) => g.itemKind === "folder").flatMap((g) => g.records);
  assert.equal(records.length, 2);
  assert.equal(records.find((r) => r.keeper).id, "old-album");
  assert.equal(records.find((r) => !r.keeper).autoSelectable, true);
  assert.ok(records.every((r) => !r.canDelete));
});
