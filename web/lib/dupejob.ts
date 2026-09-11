import type { DuplicateGroup } from "./local-analysis";

export const DUPEJOB_SCHEMA = "https://dupespace.app/schemas/dupejob-v1";
export const DUPEJOB_ALGORITHM = "DUPESPACE-CHUNK-SHA256-v1";

export type DupeJob = {
  schema: typeof DUPEJOB_SCHEMA;
  version: 1;
  createdAt: string;
  source: "dupespace-browser-local";
  sourceRootName: string;
  fingerprintAlgorithm: typeof DUPEJOB_ALGORITHM;
  groups: Array<{
    fingerprint: string;
    category: DuplicateGroup["category"];
    contextReview: boolean;
    files: Array<{
      role: "reference_only" | "duplicate_candidate";
      relativePath: string;
      size: number;
      lastModified: number;
    }>;
  }>;
};

function normalizedPath(path: string): string {
  return path.replaceAll("\\", "/").normalize("NFC");
}

export function buildDupeJob(groups: DuplicateGroup[]): DupeJob {
  const paths = groups.flatMap((group) => group.files.map((record) => normalizedPath(record.path)));
  if (!paths.length || paths.some((path) => !path.includes("/"))) {
    throw new Error("A folder selection is required to create a DupeJob");
  }
  const sourceRootName = paths[0].split("/", 1)[0];
  const prefix = `${sourceRootName}/`;
  if (!sourceRootName || paths.some((path) => !path.startsWith(prefix))) {
    throw new Error("DupeJob files must share one selected root folder");
  }

  return {
    schema: DUPEJOB_SCHEMA,
    version: 1,
    createdAt: new Date().toISOString(),
    source: "dupespace-browser-local",
    sourceRootName,
    fingerprintAlgorithm: DUPEJOB_ALGORITHM,
    groups: groups.map((group) => ({
      fingerprint: group.id,
      category: group.category,
      contextReview: group.contextSensitive,
      files: group.files.map((record, index) => ({
        role: index === 0 ? "reference_only" : "duplicate_candidate",
        relativePath: normalizedPath(record.path).slice(prefix.length),
        size: record.size,
        lastModified: record.lastModified,
      })),
    })),
  };
}

export function dupeJobJson(groups: DuplicateGroup[]): string {
  return JSON.stringify(buildDupeJob(groups), null, 2);
}
