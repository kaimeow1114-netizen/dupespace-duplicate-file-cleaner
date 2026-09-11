import type { DuplicateGroup, LocalRecord, ScanProgress } from "./local-analysis";

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

    const worker = new Worker(new URL("../workers/local-analysis.worker.ts", import.meta.url), { type: "module", name: "dupespace-local-analysis" });
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
    worker.onerror = () => finish(() => reject(new Error("The analysis worker could not start")));
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
    worker.postMessage({ type: "analyze", records });
  });
}
