export function thumbnailSource(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password &&
      (host === "googleusercontent.com" || host.endsWith(".googleusercontent.com") || host === "drive.google.com") ? value : null;
  } catch { return null; }
}

export class ThumbnailQueue {
  private active = 0;
  private pending: { start: (done: () => void) => void; cancelled: boolean; done?: () => void }[] = [];
  constructor(readonly limit = 3) {}
  enqueue(start: (done: () => void) => void): () => void {
    const job: (typeof this.pending)[number] = { start, cancelled: false };
    this.pending.push(job);
    this.pump();
    return () => { job.cancelled = true; job.done?.(); this.pending = this.pending.filter((item) => item !== job); };
  }
  private pump() {
    while (this.active < this.limit && this.pending.length) {
      const job = this.pending.shift()!;
      if (job.cancelled) continue;
      this.active++;
      let finished = false;
      job.done = () => { if (finished) return; finished = true; this.active--; this.pump(); };
      job.start(job.done);
    }
  }
}

export const thumbnailQueue = new ThumbnailQueue();
