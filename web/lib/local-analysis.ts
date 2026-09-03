export type LocalRecord = { file: File; path: string; size: number; lastModified: number };
export type DuplicateGroup = { id: string; category: "image" | "video" | "document" | "other"; files: LocalRecord[]; duplicateBytes: number; contextSensitive: boolean };
export type ScanProgress = { percent: number; path: string; phase: "sample" | "full" };

export const CHUNK_BYTES = 4 * 1024 * 1024;
const SAMPLE_BYTES = 128 * 1024;
const fingerprintDomain = new TextEncoder().encode("DUPESPACE-CHUNK-SHA256-v1");

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) values.push(value); else map.set(key, [value]);
}
function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
function sizeHeader(size: number): Uint8Array<ArrayBuffer> {
  const value = new Uint8Array(8);
  new DataView(value.buffer).setBigUint64(0, BigInt(size));
  return value;
}
async function digest(data: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}
function hex(value: Uint8Array): string { return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(""); }

async function read(record: LocalRecord, start: number, end: number, signal: AbortSignal): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  const data = await record.file.slice(start, end).arrayBuffer();
  signal.throwIfAborted();
  if (data.byteLength !== end - start || record.file.size !== record.size || record.file.lastModified !== record.lastModified) throw new Error("File changed during analysis");
  return data;
}
async function sample(record: LocalRecord, signal: AbortSignal): Promise<string> {
  if (record.size <= 2 * SAMPLE_BYTES) return hex(await digest(await read(record, 0, record.size, signal)));
  const head = new Uint8Array(await read(record, 0, SAMPLE_BYTES, signal));
  const tail = new Uint8Array(await read(record, record.size - SAMPLE_BYTES, record.size, signal));
  return hex(await digest(join([sizeHeader(record.size), head, tail])));
}

// This is a versioned complete-content chunk fingerprint, not a standard file SHA-256 digest.
export async function fullFingerprint(record: LocalRecord, signal: AbortSignal, onBytes: (bytes: number) => void = () => {}): Promise<string> {
  const leaves: Uint8Array[] = [];
  for (let offset = 0; offset < record.size; offset += CHUNK_BYTES) {
    const end = Math.min(record.size, offset + CHUNK_BYTES);
    leaves.push(await digest(await read(record, offset, end, signal)));
    signal.throwIfAborted();
    onBytes(end - offset);
    if (record.size > CHUNK_BYTES) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  return hex(await digest(join([fingerprintDomain, sizeHeader(record.size), ...leaves])));
}

export function contextSensitive(path: string): boolean {
  return /(?:^|[\\/])(?:\.git|\.svn|node_modules|\.venv|venv|site-packages|appdata|windows|program files(?: \(x86\))?|programdata|backup|backups|snapshot|snapshots)(?:[\\/]|$)/i.test(path)
    || /(?:^|[\\/])(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|pyproject\.toml|requirements[^\\/]*\.txt|\.env(?:\.[^\\/]*)?)$/i.test(path)
    || /\.(?:exe|dll|msi|sys|lnk|ini|cfg|config)$/i.test(path);
}
function category(file: File): DuplicateGroup["category"] {
  if (file.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi)$/i.test(file.name)) return "video";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|psd)$/i.test(file.name)) return "image";
  if (file.type.startsWith("text/") || /\.(docx?|xlsx?|pptx?|pdf|txt|md|csv)$/i.test(file.name)) return "document";
  return "other";
}
export function referenceOrder(a: LocalRecord, b: LocalRecord): number {
  const aTime = a.lastModified > 0 ? a.lastModified : Number.MAX_SAFE_INTEGER;
  const bTime = b.lastModified > 0 ? b.lastModified : Number.MAX_SAFE_INTEGER;
  return aTime - bTime || a.path.length - b.path.length || a.path.localeCompare(b.path);
}
export async function findLocalDuplicates(records: LocalRecord[], signal: AbortSignal, progress: (value: ScanProgress) => void): Promise<DuplicateGroup[]> {
  const sizes = new Map<number, LocalRecord[]>();
  for (const record of records) { signal.throwIfAborted(); if (record.size > 0) append(sizes, record.size, record); }
  const candidates = [...sizes.values()].filter((items) => items.length > 1);
  const total = candidates.reduce((sum, items) => sum + items.length, 0);
  const sampled: LocalRecord[][] = [];
  let done = 0;
  for (const records of candidates) {
    const matches = new Map<string, LocalRecord[]>();
    for (const record of records) {
      append(matches, await sample(record, signal), record);
      signal.throwIfAborted();
      progress({ percent: ++done / total * 35, path: record.path, phase: "sample" });
    }
    for (const values of matches.values()) if (values.length > 1) sampled.push(values);
  }
  const fullBytes = sampled.reduce((sum, items) => sum + items.reduce((bytes, item) => bytes + item.size, 0), 0);
  let readBytes = 0;
  const groups: DuplicateGroup[] = [];
  for (const records of sampled) {
    const matches = new Map<string, LocalRecord[]>();
    for (const record of records) append(matches, await fullFingerprint(record, signal, (bytes) => {
      readBytes += bytes;
      progress({ percent: 35 + readBytes / fullBytes * 65, path: record.path, phase: "full" });
    }), record);
    for (const [id, files] of matches) {
      if (files.length < 2) continue;
      files.sort(referenceOrder);
      groups.push({ id, files, category: category(files[0].file), duplicateBytes: files[0].size * (files.length - 1), contextSensitive: files.some((record) => contextSensitive(record.path)) });
    }
  }
  signal.throwIfAborted();
  const order = { video: 0, image: 1, document: 2, other: 3 };
  return groups.sort((a, b) => order[a.category] - order[b.category] || b.duplicateBytes - a.duplicateBytes || a.files[0].path.localeCompare(b.files[0].path));
}
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function analysisCsv(groups: DuplicateGroup[]): string {
  const rows = [["group", "role", "path", "size_bytes", "modified_time", "fingerprint_algorithm", "fingerprint", "context_review"].map(csvCell).join(",")];
  groups.forEach((group, index) => group.files.forEach((record, fileIndex) => {
    const date = new Date(record.lastModified);
    rows.push([index + 1, fileIndex === 0 ? "reference_only" : "duplicate_candidate", record.path, record.size, Number.isFinite(date.getTime()) ? date.toISOString() : "unknown", "DUPESPACE-CHUNK-SHA256-v1", group.id, group.contextSensitive ? "required" : "review_usage_before_removal"].map(csvCell).join(","));
  }));
  return `\uFEFF${rows.join("\r\n")}`;
}
