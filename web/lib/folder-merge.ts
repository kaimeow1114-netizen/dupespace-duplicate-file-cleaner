import {
  contextSensitive,
  csvCell,
  fileCategory,
  fullFingerprint,
  sampleFingerprint,
  type DuplicateGroup,
  type LocalRecord,
} from "./local-analysis";

export type MergeSide = "incoming" | "destination";
export type MergeCategory =
  | "same_path_conflict"
  | "renamed_or_moved"
  | "same_path_same_content"
  | "incoming_only"
  | "destination_only";

export type MergeRecord = LocalRecord & {
  side: MergeSide;
  relativePath: string;
  rootName: string;
};

export type MergeFinding = {
  id: string;
  category: MergeCategory;
  incoming: MergeRecord[];
  destination: MergeRecord[];
  fingerprint?: string;
  contextSensitive: boolean;
  fileCategory: DuplicateGroup["category"];
};

export type MergeProgress = {
  percent: number;
  path: string;
  phase: "inventory" | "sample" | "full" | "classify";
};

export type MergeSummary = {
  incomingFiles: number;
  destinationFiles: number;
  ignoredEmptyFiles: number;
  avoidCopyFiles: number;
  avoidCopyBytes: number;
  incomingOnlyFiles: number;
  conflictPaths: number;
  reviewFindings: number;
};

export type MergeResult = { findings: MergeFinding[]; summary: MergeSummary };

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) values.push(value); else map.set(key, [value]);
}

function pathParts(path: string): string[] {
  const parts = path.replaceAll("\\", "/").split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) throw new Error("Folder selection contains an unsafe relative path");
  return parts;
}

export function recordsFromFolder(files: File[], side: MergeSide): MergeRecord[] {
  return files.map((file) => {
    const selectedPath = file.webkitRelativePath || file.name;
    const parts = pathParts(selectedPath);
    const rootName = file.webkitRelativePath && parts.length > 1 ? parts[0] : "";
    const relativeParts = rootName ? parts.slice(1) : parts;
    const relativePath = relativeParts.join("/");
    if (!relativePath) throw new Error("Folder selection contains an empty file path");
    return {
      file,
      path: selectedPath.replaceAll("\\", "/"),
      relativePath,
      rootName,
      side,
      size: file.size,
      lastModified: file.lastModified,
    };
  });
}

function pathKey(path: string): string {
  return path.normalize("NFC").toLocaleLowerCase("en-US");
}

function contextRoots(records: MergeRecord[]): Set<string> {
  const roots = new Set<string>();
  for (const record of records) {
    const parts = record.relativePath.replaceAll("\\", "/").split("/");
    const directoryMarker = parts.findIndex((part) => /^(?:\.git|\.svn|node_modules|\.venv|venv|site-packages)$/i.test(part));
    const manifest = /^(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|pyproject\.toml|requirements[^/]*\.txt)$/i.test(parts.at(-1) ?? "");
    const application = /\.(?:exe|dll|msi|sys)$/i.test(parts.at(-1) ?? "");
    if (directoryMarker >= 0) roots.add(`${record.side}:${pathKey(parts.slice(0, directoryMarker).join("/"))}`);
    if (manifest || application) roots.add(`${record.side}:${pathKey(parts.slice(0, -1).join("/"))}`);
  }
  return roots;
}

function requiresContextReview(record: MergeRecord, roots: Set<string>): boolean {
  if (contextSensitive(record.path)) return true;
  const parts = record.relativePath.replaceAll("\\", "/").split("/");
  for (let length = parts.length - 1; length >= 0; length -= 1) {
    if (roots.has(`${record.side}:${pathKey(parts.slice(0, length).join("/"))}`)) return true;
  }
  return false;
}

function crossesSides(records: MergeRecord[]): boolean {
  return records.some((record) => record.side === "incoming") && records.some((record) => record.side === "destination");
}

function finding(
  category: MergeCategory,
  incoming: MergeRecord[],
  destination: MergeRecord[],
  id: string,
  fingerprint?: string,
  reviewRoots: Set<string> = new Set(),
): MergeFinding {
  const all = [...incoming, ...destination];
  return {
    id,
    category,
    incoming,
    destination,
    fingerprint,
    contextSensitive: all.some((record) => requiresContextReview(record, reviewRoots)),
    fileCategory: fileCategory(all[0].file),
  };
}

export async function compareFolders(
  incomingInput: MergeRecord[],
  destinationInput: MergeRecord[],
  signal: AbortSignal,
  progress: (value: MergeProgress) => void = () => {},
): Promise<MergeResult> {
  signal.throwIfAborted();
  const ignoredEmptyFiles = [...incomingInput, ...destinationInput].filter((record) => record.size === 0).length;
  const incoming = incomingInput.filter((record) => record.size > 0);
  const destination = destinationInput.filter((record) => record.size > 0);
  const all = [...incoming, ...destination];
  const reviewRoots = contextRoots(all);
  progress({ percent: 4, path: "", phase: "inventory" });

  const sizes = new Map<number, MergeRecord[]>();
  all.forEach((record) => append(sizes, record.size, record));
  const crossSizeBuckets = [...sizes.values()].filter(crossesSides);
  const sampleTotal = crossSizeBuckets.reduce((sum, records) => sum + records.length, 0);
  const sampleGroups: MergeRecord[][] = [];
  let sampled = 0;
  for (const records of crossSizeBuckets) {
    const bySample = new Map<string, MergeRecord[]>();
    for (const record of records) {
      append(bySample, await sampleFingerprint(record, signal), record);
      progress({ percent: 4 + (++sampled / Math.max(1, sampleTotal)) * 31, path: record.path, phase: "sample" });
    }
    for (const matches of bySample.values()) if (crossesSides(matches)) sampleGroups.push(matches);
  }

  const fullBytes = sampleGroups.reduce((sum, records) => sum + records.reduce((bytes, record) => bytes + record.size, 0), 0);
  const fingerprints = new Map<MergeRecord, string>();
  let readBytes = 0;
  for (const records of sampleGroups) {
    for (const record of records) {
      const value = await fullFingerprint(record, signal, (bytes) => {
        readBytes += bytes;
        progress({ percent: 35 + (readBytes / Math.max(1, fullBytes)) * 60, path: record.path, phase: "full" });
      });
      fingerprints.set(record, `${record.size}:${value}`);
    }
  }

  signal.throwIfAborted();
  const findings: MergeFinding[] = [];
  const consumed = new Set<MergeRecord>();
  const paths = new Map<string, MergeRecord[]>();
  all.forEach((record) => append(paths, pathKey(record.relativePath), record));

  for (const [key, records] of paths) {
    const left = records.filter((record) => record.side === "incoming");
    const right = records.filter((record) => record.side === "destination");
    if (!left.length || !right.length) continue;
    const ids = new Set(records.map((record) => fingerprints.get(record)).filter((value): value is string => Boolean(value)));
    const identical = ids.size === 1 && records.every((record) => fingerprints.has(record));
    findings.push(finding(identical ? "same_path_same_content" : "same_path_conflict", left, right, `path:${key}`, identical ? [...ids][0] : undefined, reviewRoots));
    records.forEach((record) => consumed.add(record));
  }

  const byFingerprint = new Map<string, MergeRecord[]>();
  all.forEach((record) => { const id = fingerprints.get(record); if (id) append(byFingerprint, id, record); });
  for (const [id, records] of byFingerprint) {
    if (!crossesSides(records)) continue;
    const remaining = records.filter((record) => !consumed.has(record));
    if (!remaining.length) continue;
    const allIncoming = records.filter((record) => record.side === "incoming");
    const allDestination = records.filter((record) => record.side === "destination");
    const remainingIncoming = remaining.filter((record) => record.side === "incoming");
    const remainingDestination = remaining.filter((record) => record.side === "destination");
    findings.push(finding(
      "renamed_or_moved",
      remainingIncoming.length ? remainingIncoming : allIncoming,
      remainingDestination.length ? remainingDestination : allDestination,
      `content:${id}`,
      id,
      reviewRoots,
    ));
    remaining.forEach((record) => consumed.add(record));
  }

  for (const record of all) {
    if (consumed.has(record)) continue;
    const category = record.side === "incoming" ? "incoming_only" : "destination_only";
    findings.push(finding(category, record.side === "incoming" ? [record] : [], record.side === "destination" ? [record] : [], `${record.side}:${pathKey(record.relativePath)}`, undefined, reviewRoots));
  }

  const order: Record<MergeCategory, number> = {
    same_path_conflict: 0,
    renamed_or_moved: 1,
    same_path_same_content: 2,
    incoming_only: 3,
    destination_only: 4,
  };
  findings.sort((a, b) => Number(b.contextSensitive) - Number(a.contextSensitive) || order[a.category] - order[b.category] || a.id.localeCompare(b.id));
  progress({ percent: 100, path: "", phase: "classify" });

  const fingerprintsInDestination = new Set(destination.map((record) => fingerprints.get(record)).filter((value): value is string => Boolean(value)));
  const avoidIncoming = incoming.filter((record) => { const id = fingerprints.get(record); return Boolean(id && fingerprintsInDestination.has(id)); });
  return {
    findings,
    summary: {
      incomingFiles: incoming.length,
      destinationFiles: destination.length,
      ignoredEmptyFiles,
      avoidCopyFiles: avoidIncoming.length,
      avoidCopyBytes: avoidIncoming.reduce((sum, record) => sum + record.size, 0),
      incomingOnlyFiles: findings.filter((item) => item.category === "incoming_only").reduce((sum, item) => sum + item.incoming.length, 0),
      conflictPaths: findings.filter((item) => item.category === "same_path_conflict").length,
      reviewFindings: findings.filter((item) => item.contextSensitive).length,
    },
  };
}

export function mergeCsv(result: MergeResult): string {
  const rows = [["finding", "category", "side", "relative_path", "size_bytes", "modified_time", "fingerprint_algorithm", "fingerprint", "context_review"].map(csvCell).join(",")];
  result.findings.forEach((item, index) => [...item.incoming, ...item.destination].forEach((record) => {
    const date = new Date(record.lastModified);
    rows.push([
      index + 1,
      item.category,
      record.side,
      record.relativePath,
      record.size,
      Number.isFinite(date.getTime()) ? date.toISOString() : "unknown",
      item.fingerprint ? "DUPESPACE-CHUNK-SHA256-v1" : "not_required",
      item.fingerprint ?? "",
      item.contextSensitive ? "required" : "review_before_merge",
    ].map(csvCell).join(","));
  }));
  return `\uFEFF${rows.join("\r\n")}`;
}
