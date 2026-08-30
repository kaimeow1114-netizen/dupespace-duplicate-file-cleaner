import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadModule(name) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { calculateHealthScore } = await loadModule("health-score");
const { storageMetrics, capacityEquivalent } = await loadModule("storage-metrics");
const { canSelectCopy, hasCompleteOutcomes, readJsonWithTimeout } = await loadModule("operation-results");
const gib = 1024 ** 3;

test("small duplicate payloads barely affect score even when there are many groups", () => {
  assert.equal(calculateHealthScore(0, 600 * 1024, 900), 97);
  assert.equal(calculateHealthScore(15 * gib, 600 * 1024, 1), 97);
  assert.equal(calculateHealthScore(15 * gib, 0, 0), 100);
  assert.equal(calculateHealthScore(15 * gib, gib, 1), 43);
  assert.equal(calculateHealthScore(15 * gib, 5 * gib, 5000), 16);
  assert.equal(calculateHealthScore(15 * gib, gib, 1), calculateHealthScore(15 * gib, gib, 5000));
  assert.equal(calculateHealthScore(100 * gib, gib, 1), calculateHealthScore(15 * gib, gib, 1));
  for (const value of [NaN, Infinity, -1]) assert.ok(Number.isFinite(calculateHealthScore(value, value, 0)));
});

test("manual permanent select-all permits files but never keepers or folders", () => {
  const copy = { keeper: false, itemKind: "file", canTrash: true, canDelete: true };
  assert.ok(canSelectCopy(copy, "permanent"));
  assert.ok(!canSelectCopy({ ...copy, keeper: true }, "permanent"));
  assert.ok(!canSelectCopy({ ...copy, itemKind: "folder" }, "permanent"));
  assert.ok(!canSelectCopy({ ...copy, canDelete: false }, "permanent"));
});

test("score interpolates across each band and declines monotonically", () => {
  const mib = 1024 ** 2;
  for (const [bytes, score] of [[mib,95],[10*mib,85],[100*mib,70],[500*mib,50],[2*gib,30],[4*gib,20]]) {
    assert.equal(calculateHealthScore(0, bytes, 1), score);
    assert.ok(Math.abs(calculateHealthScore(0, bytes-1, 1) - calculateHealthScore(0, bytes+1, 1)) <= 1);
  }
  let previous = 100;
  for (let bytes=0; bytes<=5*gib; bytes+=7*mib) {
    const value=calculateHealthScore(0,bytes,2);
    assert.ok(value<=previous); previous=value;
  }
});

test("ratios aggregate all groups independently of selection and pagination", () => {
  const r=(id,size,keeper=false)=>({id,size,keeper});
  const groups=[{records:[r("k1",10,true),r("a",10)]},{records:[r("k2",30,true),r("b",30),r("c",30)]}];
  assert.deepEqual(storageMetrics(groups,140,700),{duplicateBytes:70,duplicateCount:3,duplicatePercent:50,quotaPercent:10});
  assert.equal(storageMetrics([...groups,groups[1]],140,700).duplicateBytes,70);
  assert.equal(storageMetrics(groups,0,0).quotaPercent,null);
  assert.equal(capacityEquivalent(gib,65,100),.65);
  assert.equal(capacityEquivalent(gib,130,100),1.3);
});

test("a mutation must account for every requested ID exactly once", () => {
  const one = { id: "a", status: "trashed", operationMode: "trash" };
  const two = { id: "b", status: "skipped", operationMode: "trash" };
  assert.ok(hasCompleteOutcomes(["a", "b"], [one, two], "trash"));
  assert.ok(!hasCompleteOutcomes(["a", "b"], [one], "trash"));
  assert.ok(!hasCompleteOutcomes(["a", "b"], [one, one], "trash"));
  assert.ok(!hasCompleteOutcomes(["a"], [{ ...one, status: "deleted" }], "trash"));
});

test("timeout covers response body consumption, not only response headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => ({
    json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
  }));
  await assert.rejects(readJsonWithTimeout("https://example.test", {}, 15), { name: "AbortError" });
});
