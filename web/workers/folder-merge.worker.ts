/// <reference lib="webworker" />

import { compareFolders, type MergeProgress, type MergeRecord } from "../lib/folder-merge";

type WorkerRequest = { type: "compare"; incoming: MergeRecord[]; destination: MergeRecord[] };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "compare") return;
  const { incoming, destination } = event.data;
  const incomingIndexes = new Map(incoming.map((record, index) => [record, index]));
  const destinationIndexes = new Map(destination.map((record, index) => [record, index]));
  try {
    const result = await compareFolders(incoming, destination, new AbortController().signal, (value: MergeProgress) => {
      self.postMessage({ type: "progress", value });
    });
    self.postMessage({
      type: "result",
      result: {
        summary: result.summary,
        findings: result.findings.map(({ incoming: source, destination: target, ...finding }) => ({
          ...finding,
          incomingIndexes: source.map((record) => incomingIndexes.get(record)),
          destinationIndexes: target.map((record) => destinationIndexes.get(record)),
        })),
      },
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Comparison failed" });
  }
};

export {};
