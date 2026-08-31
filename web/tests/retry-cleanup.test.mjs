import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`;
const operations = compile(await readFile(new URL("../lib/operation-results.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../lib/retry-cleanup.ts", import.meta.url), "utf8")).replace('"./operation-results"', JSON.stringify(operations));
const { retryCleanup } = await import(compile(source));
const result = (id, status = "trashed", retryable = false, mode = "trash") => ({ id, status, retryable, operationMode: mode });
const active = () => false;
const wait = async () => {};

test("all 47 copies traverse sequential batches; there is no 30-file cap", async () => {
  const items = Array.from({ length: 47 }, (_, id) => ({ id: String(id) }));
  const processed = [];
  for (let i = 0; i < items.length; i += 10) {
    processed.push(...await retryCleanup(items.slice(i, i + 10), "trash", async (pending) => pending.map(({ id }) => result(id)), active, wait));
  }
  assert.equal(processed.length, 47);
  assert.equal(new Set(processed.map(({ id }) => id)).size, 47);
});

test("partial transient failures retry only remaining targets with reconciliation", async () => {
  const calls = [];
  const results = await retryCleanup([{ id: "a" }, { id: "b" }], "trash", async (pending, reconcile) => {
    calls.push({ ids: pending.map(({ id }) => id), reconcile });
    return pending.map(({ id }) => result(id, calls.length === 1 && id === "b" ? "failed" : "trashed", true));
  }, active, wait);
  assert.deepEqual(calls, [{ ids: ["a", "b"], reconcile: false }, { ids: ["b"], reconcile: true }]);
  assert.equal(results.length, 2);
  assert.ok(results.every(({ status }) => status === "trashed"));
});

test("permissions and changed files are never automatically retried", async () => {
  let calls = 0;
  const outcomes = await retryCleanup([{ id: "denied" }, { id: "changed" }], "trash", async () => {
    calls++;
    return [result("denied", "failed"), result("changed", "skipped")];
  }, active, wait);
  assert.equal(calls, 1);
  assert.deepEqual(outcomes.map(({ status }) => status), ["failed", "skipped"]);
});

test("transient retries stop at three attempts and permanent deletion is attempted once", async () => {
  for (const mode of ["trash", "permanent"]) {
    let calls = 0;
    await retryCleanup([{ id: "a" }], mode, async () => { calls++; return [result("a", "failed", true, mode)]; }, active, wait);
    assert.equal(calls, mode === "trash" ? 3 : 1);
  }
});

test("stop prevents retries and incomplete responses never count as success", async () => {
  let stop = false;
  const stoppedResults = await retryCleanup([{ id: "a" }], "trash", async () => {
    stop = true; return [result("a", "failed", true)];
  }, () => stop, wait);
  assert.equal(stoppedResults[0].status, "failed");
  await assert.rejects(retryCleanup([{ id: "a" }], "trash", async () => [], active, wait), /Incomplete/);
});

test("a failed retry request preserves successful outcomes from the first attempt", async () => {
  let calls = 0;
  const outcomes = await retryCleanup([{ id: "a" }, { id: "b" }], "trash", async () => {
    if (++calls > 1) throw new Error("Network interrupted");
    return [result("a"), result("b", "failed", true)];
  }, active, wait);
  assert.deepEqual(outcomes.map(({ status }) => status), ["trashed", "failed"]);
});
