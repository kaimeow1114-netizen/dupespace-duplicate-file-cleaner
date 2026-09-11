import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (await readFile(new URL("../lib/dupejob.ts", import.meta.url), "utf8"))
  .replace('import type { DuplicateGroup } from "./local-analysis";\n', "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function group(paths) {
  return { id: "fingerprint", category: "image", contextSensitive: false, duplicateBytes: 4, files: paths.map((path, index) => ({ file: { name: path.split("/").at(-1) }, path, size: 4, lastModified: 1000 + index })) };
}

test("DupeJob stores only relative paths and versioned fingerprints", () => {
  const job = api.buildDupeJob([group(["Photos/original/a.jpg", "Photos/copies/b.jpg"])]);
  assert.equal(job.version, 1);
  assert.equal(job.sourceRootName, "Photos");
  assert.equal(job.groups[0].files[0].relativePath, "original/a.jpg");
  assert.equal(job.groups[0].files[1].role, "duplicate_candidate");
  assert.doesNotMatch(JSON.stringify(job), /[A-Z]:\\\\|\/Users\//);
});

test("DupeJob rejects loose files and mixed selected roots", () => {
  assert.throws(() => api.buildDupeJob([group(["a.jpg", "b.jpg"])]), /folder selection/i);
  assert.throws(() => api.buildDupeJob([group(["A/a.jpg", "B/b.jpg"])]), /one selected root/i);
});
