import type { MergeFinding, MergeProgress, MergeRecord, MergeResult } from "./folder-merge";
import { WorkerStartupError } from "./analysis-worker-error";
import workerAssetUrl from "../workers/folder-merge.worker.ts?worker&url";

type CompactFinding = Omit<MergeFinding, "incoming" | "destination"> & {
  incomingIndexes: number[];
  destinationIndexes: number[];
};
type CompactResult = Omit<MergeResult, "findings"> & { findings: CompactFinding[] };
type WorkerReply =
  | { type: "progress"; value: MergeProgress }
  | { type: "result"; result: CompactResult }
  | { type: "error"; message: string };

export function compareFoldersInWorker(
  incoming: MergeRecord[],
  destination: MergeRecord[],
  signal: AbortSignal,
  progress: (value: MergeProgress) => void,
): Promise<MergeResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Comparison aborted", "AbortError"));
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL(workerAssetUrl, window.location.origin), { type: "module", name: "dupespace-folder-merge" });
    } catch {
      reject(new WorkerStartupError());
      return;
    }
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", stop);
      worker.terminate();
      callback();
    };
    const stop = () => finish(() => reject(new DOMException("Comparison aborted", "AbortError")));

    signal.addEventListener("abort", stop, { once: true });
    worker.onerror = () => finish(() => reject(new WorkerStartupError()));
    worker.onmessageerror = () => finish(() => reject(new WorkerStartupError()));
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === "progress") {
        progress(reply.value);
        return;
      }
      if (reply.type === "error") {
        finish(() => reject(new Error(reply.message)));
        return;
      }
      finish(() => resolve({
        summary: reply.result.summary,
        findings: reply.result.findings.map(({ incomingIndexes, destinationIndexes, ...finding }) => ({
          ...finding,
          incoming: incomingIndexes.map((index) => incoming[index]),
          destination: destinationIndexes.map((index) => destination[index]),
        })),
      }));
    };
    try {
      worker.postMessage({ type: "compare", incoming, destination });
    } catch {
      finish(() => reject(new WorkerStartupError()));
    }
  });
}
