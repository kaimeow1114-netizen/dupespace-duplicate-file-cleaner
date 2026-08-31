import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = ts.transpileModule(await readFile(new URL("../lib/scan-stream.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { readScanStream } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
function response(lines) {
  const bytes = new TextEncoder().encode(lines);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }), { headers: { "content-type": "application/x-ndjson" } });
}
test("chunk boundaries and Unicode do not corrupt scan progress/results", async () => {
  const progress = [];
  const result = await readScanStream(response(JSON.stringify({ type: "progress", phase: "listing", examined: 1000 }) + "\n" + JSON.stringify({ type: "result", result: { name: "測試檔案" } }) + "\n"), (event) => progress.push(event));
  assert.equal(progress[0].examined, 1000);
  assert.equal(result.name, "測試檔案");
});
test("truncated, failed and duplicate-result streams cannot create a cleanup plan", async () => {
  for (const content of [
    '{"type":"progress","phase":"listing","examined":1000}\n',
    '{"type":"result","result":{}}',
    '{"type":"error","error":"timeout"}\n',
    '{"type":"result","result":{}}\n{"type":"result","result":{}}\n',
  ]) await assert.rejects(readScanStream(response(content), () => {}));
});
