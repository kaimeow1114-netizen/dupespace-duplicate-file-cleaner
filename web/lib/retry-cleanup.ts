import { hasCompleteOutcomes } from "./operation-results";

type Item = { id: string };
type Outcome = { id: string; status: string; operationMode: string; retryable?: boolean };

/** Retry only server-classified transient failures; never retry permanent deletion. */
export async function retryCleanup<T extends Item, R extends Outcome>(
  items: T[], mode: "trash" | "permanent",
  request: (pending: T[], reconcile: boolean) => Promise<R[]>,
  stopped: () => boolean,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<R[]> {
  let pending = items;
  const results = new Map<string, R>();
  for (let attempt = 0; attempt < (mode === "trash" ? 3 : 1); attempt++) {
    if (stopped()) {
      if (results.size === items.length) break;
      throw new DOMException("Operation stopped", "AbortError");
    }
    let outcomes: R[];
    try { outcomes = await request(pending, attempt > 0); }
    catch (error) {
      // Preserve already confirmed successes if a later retry loses its response.
      // Remaining failed outcomes stay failed; never guess that a write succeeded.
      if (results.size === items.length) break;
      throw error;
    }
    if (!hasCompleteOutcomes(pending.map((item) => item.id), outcomes, mode)) {
      throw new Error("Incomplete operation results; rescan before continuing.");
    }
    for (const outcome of outcomes) results.set(outcome.id, outcome);
    pending = pending.filter((item) => {
      const outcome = results.get(item.id)!;
      return outcome.status === "failed" && outcome.retryable === true;
    });
    if (!pending.length || mode !== "trash") break;
    if (attempt < 2) await wait(1000 * (attempt + 1));
  }
  return items.map((item) => results.get(item.id)!);
}
