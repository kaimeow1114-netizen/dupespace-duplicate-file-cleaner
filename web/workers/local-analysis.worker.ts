/// <reference lib="webworker" />

import { findLocalDuplicates, type LocalRecord, type ScanProgress } from "../lib/local-analysis";

type WorkerRequest = { type: "analyze"; records: LocalRecord[] };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "analyze") return;
  const records = event.data.records;
  const indexes = new Map(records.map((record, index) => [record, index]));
  const control = new AbortController();
  try {
    const groups = await findLocalDuplicates(records, control.signal, (value: ScanProgress) => {
      self.postMessage({ type: "progress", value });
    });
    self.postMessage({
      type: "result",
      groups: groups.map(({ files, ...group }) => ({
        ...group,
        recordIndexes: files.map((record) => indexes.get(record)),
      })),
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Analysis failed" });
  }
};

export {};
