export function canSelectCopy(
  record: { keeper: boolean; itemKind: string; canTrash: boolean; canDelete: boolean },
  mode: "trash" | "permanent",
): boolean {
  return !record.keeper && (mode === "trash" ? record.canTrash : record.itemKind === "file" && record.canDelete);
}

export function hasCompleteOutcomes(
  ids: string[], outcomes: { id: string; status: string; operationMode: string }[], mode: string,
): boolean {
  const expected = new Set(ids);
  const actual = new Set(outcomes.map((item) => item.id));
  const statuses = mode === "trash" ? ["trashed", "skipped", "failed"] : ["deleted", "skipped", "failed"];
  return ids.length === expected.size && outcomes.length === ids.length && actual.size === expected.size &&
    outcomes.every((item) => expected.has(item.id) && item.operationMode === mode && statuses.includes(item.status));
}

export async function readJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body: unknown = await response.json();
    return { response, body };
  } finally { clearTimeout(timeout); }
}
