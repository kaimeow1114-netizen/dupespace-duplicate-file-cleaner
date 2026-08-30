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
  assert.equal(result.examinedBytes,16);
});

async function authenticatedRequest(path, body) {
  const cookie = await api.encrypt({ accessToken:"synthetic-token", expiresAt:Date.now()+3600000 },env.SESSION_SECRET);
  return new Request(`https://dupespace.app/api/google/${path}`, { method:"POST", headers:{ origin:"https://dupespace.app", "content-type":"application/json", cookie:`dupespace_session=${cookie}` },body:JSON.stringify(body) });
}

test("private thumbnail uses authenticated bounded forwarding, never original media", async(t)=>{
  const files=[file("a",{mimeType:"video/mp4",thumbnailLink:"https://lh3.googleusercontent.com/drive-storage/test=s220"}),file("b")];
  const result=await scan(files,t);
  const record=result.groups[0].records.find(r=>r.id==="a");
  t.mock.method(globalThis,"fetch",async(url,init)=>{
    const u=new URL(url);
    assert.equal(new Headers(init.headers).get("authorization"),"Bearer synthetic-token");
    assert.notEqual(u.searchParams.get("alt"),"media");
    if(u.hostname==="www.googleapis.com") return Response.json(files[0]);
    assert.equal(u.hostname,"lh3.googleusercontent.com");
    assert.equal(init.redirect,"manual");
    assert.ok(u.pathname.endsWith("=s240"));
    return new Response(new Uint8Array([255,216,255,217]),{headers:{"content-type":"image/jpeg"}});
  });
  const response=await api.handleGoogleDriveApi(await authenticatedRequest("thumbnail",record),env);
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control"),/no-store/);
  assert.equal((await response.arrayBuffer()).byteLength,4);
});

test("thumbnail refuses unauthenticated callers, oversized data and external redirects",async(t)=>{
  const noAuth=await api.handleGoogleDriveApi(new Request("https://dupespace.app/api/google/thumbnail",{method:"POST",body:"{}"}),env);
  assert.equal(noAuth.status,401);
  const files=[file("a",{thumbnailLink:"https://lh3.googleusercontent.com/test=s220"}),file("b")];
  const result=await scan(files,t);
  const record=result.groups[0].records.find(r=>r.id==="a");
  for(const variant of ["redirect","large","external","html"]) {
    t.mock.method(globalThis,"fetch",async(url,init)=>{
      const u=new URL(url);
      if(u.hostname==="www.googleapis.com") return Response.json({...files[0],thumbnailLink:variant==="external"?"https://evil.example/thumbnail":files[0].thumbnailLink});
      assert.equal(u.hostname,"lh3.googleusercontent.com");
      assert.equal(init.redirect,"manual");
      if(variant==="redirect") return new Response(null,{status:302,headers:{location:"https://evil.example"}});
      if(variant==="html") return new Response("<html>",{headers:{"content-type":"text/html"}});
      return new Response(new Uint8Array(1048577),{headers:{"content-type":"image/jpeg"}});
    });
    const response=await api.handleGoogleDriveApi(await authenticatedRequest("thumbnail",record),env);
    assert.ok([400,404,413].includes(response.status));
  }
});

test("trash and permanent paths return complete outcomes with fresh keeper validation",async(t)=>{
  const files=[file("a"),file("b"),file("c")];
  const result=await scan(files,t);
  const copies=result.groups[0].records.filter(r=>!r.keeper);
  const calls=[];
  t.mock.method(globalThis,"fetch",async(url,init)=>{
    const id=new URL(url).pathname.split("/").at(-1);
    calls.push([init.method??"GET",id]);
    if(init.method==="PATCH") return new Response(null,{status:403});
    assert.notEqual(init.method,"DELETE","trash must never fall back to permanent delete");
    return Response.json(files.find(f=>f.id===id));
  });
  const response=await api.handleGoogleDriveApi(await authenticatedRequest("trash",{items:copies}),env);
  const body=await response.json();
  assert.equal(body.outcomes.length,2);
  assert.ok(body.outcomes.every(o=>o.status==="failed"));
  assert.equal(calls.filter(([method,id])=>method==="GET"&&id==="a").length,2);
});
