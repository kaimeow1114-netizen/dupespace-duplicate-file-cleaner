import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/drive-index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const valid = { accountKey: "synthetic-account", snapshot: "synthetic-encrypted-blob", expiresAt: Date.now() + 60_000 };

test("device index rejects wrong accounts, expired data and oversized payloads", () => {
  assert.equal(api.validDriveIndex(valid, valid.accountKey), true);
  assert.equal(api.validDriveIndex(valid, "different-account"), false);
  assert.equal(api.validDriveIndex({ ...valid, expiresAt: Date.now() - 1 }, valid.accountKey), false);
  assert.equal(api.validDriveIndex({ ...valid, snapshot: "x".repeat(8 * 1024 * 1024 + 1) }, valid.accountKey), false);
});

test("logout changes the epoch before storage and prevents stale in-flight cache writes", async (t) => {
  const memory = new Map();
  const replace = (key, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key); });
  };
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  replace("localStorage", storage);
  replace("window", new EventTarget());
  replace("StorageEvent", class extends Event {});
  let opens = 0;
  replace("indexedDB", { open() { opens += 1; throw new Error("Optional storage unavailable"); } });
  const before = api.cacheEpoch();
  let notified = false;
  window.addEventListener(api.INDEX_CLEARED_EVENT, (event) => {
    notified = api.isSessionDisconnectEvent(event);
    assert.notEqual(api.cacheEpoch(), before);
    assert.equal(opens, 0);
  });
  await api.clearDriveIndex(true, true);
  assert.equal(notified, true);
  assert.equal(opens, 1);
  await api.writeDriveIndex(valid, before);
  assert.equal(opens, 1, "stale scan must not reopen or repopulate storage");
  assert.equal(await api.readDriveIndex(valid.accountKey), null, "storage failure falls back to a full scan");
});

test("scan, cleanup and undo discard results from an invalidated session generation", async () => {
  const client = await readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8");
  for (const name of ["startScan", "executeOperation", "undoTrash"]) {
    const body = client.slice(client.indexOf(`async function ${name}`));
    assert.match(body, /generation !== operationGeneration.current/);
  }
  assert.match(client, /setAudit\(\[\]\); setLastOutcomes\(\{\}\); setTreeDrawer\(null\); setConfirmation\(null\)/);
  const undo = client.slice(client.indexOf("async function undoTrash"), client.indexOf("function downloadCsv"));
  assert.doesNotMatch(undo, /startScan\(/);
});
