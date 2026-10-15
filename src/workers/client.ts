import type {
  WorkerOperation,
  WorkerPayload,
  WorkerResponse,
} from "./protocol";
export const WORKER_TIMEOUT_MS = 10000;
export type WorkerFailureReason = "cancelled" | "timeout" | "processingFailed";
export class WorkerFailure extends Error {
  constructor(readonly reason: WorkerFailureReason) {
    super(reason);
  }
}
// One concrete client, one active job. No queue, pool or retained document cache.
export class ComparisonWorkerClient {
  private worker: Worker | undefined;
  private sequence = 0;
  private disposed = false;
  private pending:
    | {
        id: number;
        revision: number;
        operation: WorkerOperation;
        timer: ReturnType<typeof setTimeout>;
        resolve(value: WorkerResponse): void;
        reject(error: WorkerFailure): void;
      }
    | undefined;
  constructor(
    private readonly createWorker = () =>
      new Worker(new URL("./comparison.worker.ts", import.meta.url), {
        type: "module",
        name: "paralelo-json",
      }),
  ) {}
  run(payload: WorkerPayload): Promise<WorkerResponse> {
    if (this.disposed || this.pending)
      return Promise.reject(new WorkerFailure("processingFailed"));
    return new Promise((resolve, reject) => {
      try {
        if (!this.worker) {
          const worker = this.createWorker();
          this.worker = worker;
          worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const job = this.pending,
              message = event.data;
            if (
              !job ||
              !message ||
              message.id !== job.id ||
              message.revision !== job.revision
            )
              return;
            if (
              message.operation === "failed" ||
              message.operation !== job.operation
            ) {
              this.stop("processingFailed");
              return;
            }
            clearTimeout(job.timer);
            this.pending = undefined;
            job.resolve(message);
          };
          worker.onerror = (event) => {
            event.preventDefault();
            if (this.worker === worker) this.stop("processingFailed");
          };
          worker.onmessageerror = () => {
            if (this.worker === worker) this.stop("processingFailed");
          };
        }
        const id = ++this.sequence;
        this.pending = {
          id,
          revision: payload.revision,
          operation: payload.operation,
          resolve,
          reject,
          timer: setTimeout(() => this.stop("timeout"), WORKER_TIMEOUT_MS),
        };
        this.worker.postMessage({ ...payload, id });
      } catch {
        if (this.pending) this.stop("processingFailed");
        else reject(new WorkerFailure("processingFailed"));
      }
    });
  }
  private stop(reason: WorkerFailureReason) {
    const job = this.pending;
    this.pending = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    if (job) {
      clearTimeout(job.timer);
      job.reject(new WorkerFailure(reason));
    }
  }
  cancel() {
    this.stop("cancelled");
  }
  dispose() {
    this.disposed = true;
    this.stop("cancelled");
  }
}
