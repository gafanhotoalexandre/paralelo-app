import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComparisonWorkerClient,
  WorkerFailure,
  WORKER_TIMEOUT_MS,
} from "./client";
import type { WorkerRequest, WorkerResponse } from "./protocol";
class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn((_message: WorkerRequest) => {});
  terminate = vi.fn();
  reply(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
  request() {
    return this.postMessage.mock.calls.at(-1)![0];
  }
  success() {
    const { id, revision } = this.request();
    this.reply({
      id,
      revision,
      operation: "format",
      response: { status: "success", text: "{}" },
    });
  }
}
function setup() {
  const workers: FakeWorker[] = [];
  const factory = vi.fn(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { client: new ComparisonWorkerClient(factory), workers, factory };
}
const payload = {
  operation: "format" as const,
  revision: 1,
  request: { text: "{}", side: "before" as const },
};
afterEach(() => vi.useRealTimers());
describe("one concrete worker with a bounded lifecycle", () => {
  it("starts lazily, reuses one worker and rejects concurrent jobs without replacing the active one", async () => {
    const { client, workers, factory } = setup();
    expect(factory).not.toHaveBeenCalled();
    const first = client.run(payload);
    await expect(client.run(payload)).rejects.toMatchObject({
      reason: "processingFailed",
    });
    workers[0]!.success();
    await expect(first).resolves.toMatchObject({ operation: "format" });
    const second = client.run(payload);
    workers[0]!.success();
    await second;
    expect(factory).toHaveBeenCalledTimes(1);
    client.dispose();
  });
  it("terminates on cancellation, recreates and ignores old ids or revisions", async () => {
    const { client, workers } = setup();
    const first = client.run(payload).catch((e) => e);
    const old = workers[0]!.request();
    client.cancel();
    expect(await first).toMatchObject({ reason: "cancelled" });
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    const next = client.run({ ...payload, revision: 2 });
    const current = workers[1]!.request();
    const resolve = vi.fn();
    void next.then(resolve);
    workers[0]!.reply({
      id: old.id,
      revision: 1,
      operation: "format",
      response: { status: "success", text: "old" },
    });
    workers[1]!.reply({
      id: current.id,
      revision: 1,
      operation: "format",
      response: { status: "success", text: "wrong revision" },
    });
    workers[0]!.onerror!(new ErrorEvent("error"));
    workers[0]!.onmessageerror!();
    await Promise.resolve();
    expect(resolve).not.toHaveBeenCalled();
    expect(workers[1]!.terminate).not.toHaveBeenCalled();
    workers[1]!.success();
    await next;
    client.dispose();
  });
  it("enforces 10 seconds with termination and allows a fresh operation after timeout", async () => {
    vi.useFakeTimers();
    const { client, workers } = setup();
    const pending = client.run(payload).catch((e) => e);
    await vi.advanceTimersByTimeAsync(WORKER_TIMEOUT_MS - 1);
    expect(workers[0]!.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ reason: "timeout" });
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    const next = client.run(payload);
    workers[1]!.success();
    await next;
    client.dispose();
  });
  it.each(["error", "messageerror", "failed"] as const)(
    "handles %s without exposing error content",
    async (kind) => {
      const { client, workers } = setup();
      const pending = client.run(payload).catch((e) => e),
        worker = workers[0]!;
      if (kind === "error") {
        const event = new ErrorEvent("error", { message: "PRIVATE DOCUMENT" });
        vi.spyOn(event, "preventDefault");
        worker.onerror!(event);
        expect(event.preventDefault).toHaveBeenCalled();
      } else if (kind === "messageerror") worker.onmessageerror!();
      else {
        const { id, revision } = worker.request();
        worker.reply({ id, revision, operation: "failed" });
      }
      const failure = await pending;
      expect(failure).toBeInstanceOf(WorkerFailure);
      expect(failure.reason).toBe("processingFailed");
      expect(failure.message).not.toContain("PRIVATE");
      expect(worker.terminate).toHaveBeenCalledOnce();
      client.dispose();
    },
  );
  it("handles construction failure and disposal predictably", async () => {
    const failure = new ComparisonWorkerClient(() => {
      throw new Error("secret");
    });
    await expect(failure.run(payload)).rejects.toMatchObject({
      reason: "processingFailed",
    });
    failure.dispose();
    const { client, workers } = setup();
    const pending = client.run(payload).catch((e) => e);
    client.dispose();
    expect(await pending).toMatchObject({ reason: "cancelled" });
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    await expect(client.run(payload)).rejects.toMatchObject({
      reason: "processingFailed",
    });
  });
});
