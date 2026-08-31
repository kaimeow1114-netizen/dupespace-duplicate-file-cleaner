export type ScanProgress = { phase: "listing" | "syncing" | "comparing"; examined: number };

/** A result is usable only after the complete response has been consumed. */
export async function readScanStream(response: Response, notify: (progress: ScanProgress) => void): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) return response.json();
  if (!response.body) throw new Error("The scan response was empty. Please scan again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: unknown;
  let finished = false;
  try {
    while (true) {
      const part = await reader.read();
      buffer += decoder.decode(part.value, { stream: !part.done });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(typeof event.error === "string" ? event.error : "Scan failed");
        if (event.type === "progress" && !finished && ["listing", "syncing", "comparing"].includes(event.phase) && Number.isSafeInteger(event.examined) && event.examined >= 0) notify(event);
        if (event.type === "result") {
          if (finished) throw new Error("Duplicate scan result");
          finished = true; result = event.result;
        }
      }
      if (part.done) break;
    }
    if (!finished || buffer.trim()) throw new Error("The scan was interrupted. No cleanup plan was created.");
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
