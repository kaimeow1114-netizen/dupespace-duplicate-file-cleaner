import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/thumbnails.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { ThumbnailQueue, thumbnailSource } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("thumbnail URLs retain the original Google URL without a proxy or media download", () => {
  for (const url of ["https://lh3.googleusercontent.com/test=s220", "https://drive.google.com/thumbnail?id=fixture"]) {
    assert.equal(thumbnailSource(url), url);
  }
  for (const url of [null, "javascript:alert(1)", "http://lh3.googleusercontent.com/x", "https://googleusercontent.com.evil.test/x", "https://user:secret@lh3.googleusercontent.com/x", "file:///x"]) {
    assert.equal(thumbnailSource(url), null);
  }
});

test("5000 queued thumbnails never start more than three requests concurrently", () => {
  const queue = new ThumbnailQueue(3);
  const active = new Set();
  let peak = 0;
  for (let i = 0; i < 5000; i++) queue.enqueue((done) => {
    const finish = () => { active.delete(finish); done(); done(); };
    active.add(finish); peak = Math.max(peak, active.size);
  });
  while (active.size) [...active][0]();
  assert.equal(peak, 3);
});

test("unmounted waiting and active requests are safely removed", () => {
  const queue = new ThumbnailQueue(1);
  const started = [];
  const first = queue.enqueue(() => started.push(1));
  const second = queue.enqueue(() => started.push(2));
  second(); first(); first();
  queue.enqueue((done) => { started.push(3); done(); });
  assert.deepEqual(started, [1, 3]);
});

test("outer thumbnail is additional; the expanded keeper preview remains", async () => {
  const ui = await readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8");
  assert.match(ui, /<GroupThumbnail/);
  assert.match(ui, /keeper\.thumbnailLink/);
  assert.match(ui, /className="keeper-preview"/);
});
