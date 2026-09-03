import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/local-analysis.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
function record(path, data, modified = 1000) { const file = new File([data], path.split("/").at(-1), { lastModified: modified }); return { file, path, size: file.size, lastModified: modified }; }
const scan = (records, signal = new AbortController().signal, progress = () => {}) => api.findLocalDuplicates(records, signal, progress);

test("only complete content matches; empty files ignored; reference is not a deletion keeper", async () => {
  const groups = await scan([record("b/copy.txt", "same", 2000), record("a/source.txt", "same"), record("x/different.txt", "else"), record("empty1", ""), record("empty2", "")]);
  assert.equal(groups.length, 1); assert.equal(groups[0].files.length, 2); assert.equal(groups[0].files[0].path, "a/source.txt"); assert.equal(groups[0].duplicateBytes, 4);
  assert.match(api.analysisCsv(groups), /reference_only/);
});
test("same size and sampled edges cannot conceal a different middle", async () => {
  const a = new Uint8Array(600000); const b = a.slice(); b[300000] = 1;
  assert.equal((await scan([record("a", a), record("b", b)])).length, 0);
});
test("reads at most 4 MiB per request and reports full-content byte progress", async () => {
  const data = new Uint8Array(api.CHUNK_BYTES * 2 + 1); const a = record("a", data); const b = record("b", data);
  let maxRead = 0; const slice = a.file.slice.bind(a.file); a.file.slice = (start, end) => { maxRead = Math.max(maxRead, end - start); return slice(start, end); };
  const updates = []; const groups = await scan([a, b], undefined, (value) => updates.push(value));
  assert.equal(groups.length, 1); assert.ok(maxRead <= api.CHUNK_BYTES); assert.equal(updates.at(-1).percent, 100);
  assert.ok(updates.every((value, index) => index === 0 || value.percent >= updates[index - 1].percent));
});
test("cancellation rejects instead of returning partial results", async () => {
  const control = new AbortController(); control.abort(); await assert.rejects(scan([record("a", "a"), record("b", "a")], control.signal), { name: "AbortError" });
  const mid = new AbortController(); await assert.rejects(scan([record("a", "a"), record("b", "a")], mid.signal, () => mid.abort()), { name: "AbortError" });
});
test("short reads and changed metadata fail closed", async () => {
  const a = record("a", "same"); a.file.slice = () => new Blob(["s"]);
  await assert.rejects(scan([a, record("b", "same")]), /changed/);
});
test("5001 files are fully processed, no 30-file cap, one representative per group", { timeout: 30000 }, async () => {
  const groups = await scan(Array.from({ length: 5001 }, (_, i) => record(`photos/${i}.jpg`, "same")));
  assert.equal(groups.length, 1); assert.equal(groups[0].files.length, 5001); assert.equal(groups[0].duplicateBytes, 20000);
  assert.equal(api.analysisCsv(groups).split("\r\n").length, 5002);
});
test("project/config/backup copies are flagged even if content matches", async () => {
  for (const path of ["app/node_modules/a.js", "app/package.json", "app/.env", "backup/a.jpg", "tool.dll", "x/settings.ini"]) assert.equal(api.contextSensitive(path), true);
  assert.equal(api.contextSensitive("photos/family.jpg"), false);
  const groups = await scan([record("a/package.json", "{}"), record("b/package.json", "{}")]); assert.equal(groups[0].contextSensitive, true);
});
test("CSV neutralizes formula injection, commas, quotes and multiline paths", () => {
  for (const value of ["=1+1", "+cmd", "-1", "@SUM(A1)", " \t=1", "\rmalicious"]) assert.ok(api.csvCell(value).startsWith('"\''));
  assert.equal(api.csvCell('a,"b"'), '"a,""b"""');
});
test("browser engine has no network or filesystem mutation capability", () => {
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|createWritable|removeEntry|localStorage|indexedDB/);
});
