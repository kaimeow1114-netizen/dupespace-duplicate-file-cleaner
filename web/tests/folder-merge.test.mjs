import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const localSource = await readFile(new URL("../lib/local-analysis.ts", import.meta.url), "utf8");
const localCompiled = ts.transpileModule(localSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const localUrl = `data:text/javascript;base64,${Buffer.from(localCompiled).toString("base64")}`;
const mergeSource = (await readFile(new URL("../lib/folder-merge.ts", import.meta.url), "utf8")).replace('"./local-analysis"', JSON.stringify(localUrl));
const mergeCompiled = ts.transpileModule(mergeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(mergeCompiled).toString("base64")}`);

function file(path, data, modified = 1000, type = "text/plain") {
  const value = new File([data], path.split("/").at(-1), { type, lastModified: modified });
  Object.defineProperty(value, "webkitRelativePath", { value: path, configurable: true });
  return value;
}

function records(root, side) { return api.recordsFromFolder(root, side); }
function compare(incoming, destination, signal = new AbortController().signal, progress = () => {}) {
  return api.compareFolders(records(incoming, "incoming"), records(destination, "destination"), signal, progress);
}

test("classifies renamed exact content, same-path equality, conflicts and one-sided files", async () => {
  const result = await compare([
    file("Incoming/photos/new-name.jpg", "photo", 1000, "image/jpeg"),
    file("Incoming/docs/same.txt", "same"),
    file("Incoming/docs/version.txt", "new version"),
    file("Incoming/new-only.txt", "incoming"),
    file("Incoming/empty.txt", ""),
  ], [
    file("Library/archive/old-name.jpg", "photo", 2000, "image/jpeg"),
    file("Library/docs/same.txt", "same"),
    file("Library/docs/version.txt", "old version"),
    file("Library/library-only.txt", "destination"),
  ]);
  assert.deepEqual(new Set(result.findings.map((item) => item.category)), new Set(["renamed_or_moved", "same_path_same_content", "same_path_conflict", "incoming_only", "destination_only"]));
  assert.equal(result.summary.avoidCopyFiles, 2);
  assert.equal(result.summary.avoidCopyBytes, 9);
  assert.equal(result.summary.incomingOnlyFiles, 1);
  assert.equal(result.summary.conflictPaths, 1);
  assert.equal(result.summary.ignoredEmptyFiles, 1);
});

test("same name never hides different content and a different name never hides identical content", async () => {
  const result = await compare([file("A/x.txt", "alpha"), file("A/renamed.txt", "same")], [file("B/x.txt", "bravo"), file("B/original.txt", "same")]);
  assert.equal(result.findings.find((item) => item.category === "same_path_conflict")?.incoming[0].relativePath, "x.txt");
  assert.equal(result.findings.find((item) => item.category === "renamed_or_moved")?.incoming[0].relativePath, "renamed.txt");
});

test("a same-path match does not hide additional renamed copies of the same content", async () => {
  const result = await compare([file("A/docs/x.txt", "same"), file("A/archive/renamed.txt", "same")], [file("B/docs/x.txt", "same")]);
  assert.equal(result.summary.avoidCopyFiles, 2);
  assert.equal(result.findings.filter((item) => item.category === "same_path_same_content").length, 1);
  assert.equal(result.findings.filter((item) => item.category === "renamed_or_moved").length, 1);
  assert.equal(result.findings.filter((item) => item.category === "incoming_only").length, 0);
});

test("project, application and backup contexts require review instead of deletion advice", async () => {
  const result = await compare([file("Import/project/package.json", "{}"), file("Import/project/src/index.js", "code"), file("Import/backup/photo.jpg", "photo")], [file("Library/project-copy/package.json", "{}"), file("Library/code-copy.js", "code"), file("Library/photo.jpg", "photo")]);
  assert.equal(result.summary.reviewFindings, 3);
  assert.ok(result.findings.filter((item) => item.contextSensitive).every((item) => item.category === "renamed_or_moved"));
});

test("unsafe relative paths fail closed and cancellation never returns partial output", async () => {
  assert.throws(() => records([file("Root/../outside.txt", "x")], "incoming"), /unsafe/);
  const control = new AbortController(); control.abort();
  await assert.rejects(compare([file("A/a", "same")], [file("B/b", "same")], control.signal), { name: "AbortError" });
  const mid = new AbortController();
  await assert.rejects(compare([file("A/a", "same")], [file("B/b", "same")], mid.signal, () => mid.abort()), { name: "AbortError" });
});

test("changed files fail closed and CSV neutralizes spreadsheet formulas", async () => {
  const changed = file("A/a.txt", "same");
  const originalSlice = changed.slice.bind(changed);
  changed.slice = (start, end) => { Object.defineProperty(changed, "lastModified", { value: 2000, configurable: true }); return originalSlice(start, end); };
  await assert.rejects(compare([changed], [file("B/b.txt", "same")]), /changed/);
  const result = await compare([file("A/=RUN.txt", "same")], [file("B/copy.txt", "same")]);
  assert.match(api.mergeCsv(result), /"'=RUN\.txt"/);
});

test("merge engine has no network, persistence or mutation capability", () => {
  assert.doesNotMatch(mergeSource, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|createWritable|removeEntry|localStorage|indexedDB|\.delete\s*\(/);
});
