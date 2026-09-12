export class WorkerStartupError extends Error {
  constructor() {
    super("The browser could not load the analysis worker");
    this.name = "WorkerStartupError";
  }
}
