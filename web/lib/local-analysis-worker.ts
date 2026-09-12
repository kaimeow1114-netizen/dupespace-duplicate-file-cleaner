import type { DuplicateGroup, LocalRecord, ScanProgress } from "./local-analysis";
import { WorkerStartupError } from "./analysis-worker-error";
import workerAssetUrl from "../workers/local-analysis.worker.ts?worker&url";

type CompactGroup = Omit<DuplicateGroup, "files"> & { recordIndexes: number[] };
type WorkerReply =
  | { type: "progress"; value: ScanProgress }
  | { type: "result"; groups: CompactGroup[] }
  | { type: "error"; message: string };

export function findLocalDuplicatesInWorker(
  records: LocalRecord[],
  signal: AbortSignal,
  progress: (value: ScanProgress) => void,
): Promise<DuplicateGroup[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Analysis aborted", "AbortError"));
      return;
    }

    // Vite bundles ?worker&url as executable JavaScript, not a raw .ts asset.
    let worker: Worker;
    try {
      worker = new Worker(new URL(workerAssetUrl, window.location.origin), { type: "module", name: "dupespace-local-analysis" });
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
    const stop = () => finish(() => reject(new DOMException("Analysis aborted", "AbortError")));

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
      finish(() => resolve(reply.groups.map(({ recordIndexes, ...group }) => ({
        ...group,
        files: recordIndexes.map((index) => records[index]),
      }))));
    };
    try {
      worker.postMessage({ type: "analyze", records });
    } catch {
      finish(() => reject(new WorkerStartupError()));
    }
  });
}
