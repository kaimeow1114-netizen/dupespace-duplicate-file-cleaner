import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const helperSource = await readFile(new URL("../lib/analysis-worker-error.ts", import.meta.url), "utf8");
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { WorkerStartupError } = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`);

test("both analysis flows request bundled JavaScript on the live origin and separate startup errors", async () => {
  for (const name of ["local-analysis-worker", "folder-merge-worker"]) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
    assert.match(source, /\.worker\.ts\?worker&url/);
    assert.match(source, /new Worker\(new URL\(workerAssetUrl, window\.location\.origin\)/);
    assert.match(source, /worker\.onerror = .*WorkerStartupError/);
    assert.match(source, /worker\.onmessageerror = .*WorkerStartupError/);
  }
  assert.equal(new WorkerStartupError().name, "WorkerStartupError");
  for (const name of ["local-analyzer", "merge-analyzer"]) {
    const source = await readFile(new URL(`../app/components/${name}.tsx`, import.meta.url), "utf8");
    assert.match(source, /error instanceof WorkerStartupError/);
  }
});

test("production build emits executable same-origin JavaScript for both workers", async () => {
  const staticDirectory = fileURLToPath(new URL("../dist/client/_next/static/", import.meta.url));
  const chunksDirectory = join(staticDirectory, "chunks");
  const chunks = await readdir(chunksDirectory);
  for (const [component, worker] of [["local-analyzer", "local-analysis"], ["merge-analyzer", "folder-merge"]]) {
    const chunkName = chunks.find((name) => name.startsWith(`${component}-`) && name.endsWith(".js"));
    assert.ok(chunkName, `${component} chunk is missing`);
    const chunk = await readFile(join(chunksDirectory, chunkName), "utf8");
    const assetPath = chunk.match(new RegExp(`/_next/static/${worker}\\.worker-[\\w-]+\\.js`))?.[0];
    assert.ok(assetPath, `${worker} must resolve to bundled JavaScript, not source TypeScript`);
    const asset = join(staticDirectory, assetPath.slice("/_next/static/".length));
    assert.ok((await stat(asset)).size > 100, `${worker} JavaScript asset is missing or empty`);
    assert.match(chunk, /window\.location\.origin/);
    assert.doesNotMatch(chunk, /file:\/\/\/ROOT/);
  }
});
