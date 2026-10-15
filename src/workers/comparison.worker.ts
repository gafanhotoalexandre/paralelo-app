import { compareJson } from "../core/comparison";
import { formatJson } from "../core/formatting";
import { generateMarkdown } from "../core/markdown";
import type { WorkerRequest, WorkerResponse } from "./protocol";
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const job = event.data;
  let message: WorkerResponse;
  try {
    const identity = { id: job.id, revision: job.revision };
    switch (job.operation) {
      case "compare":
        message = {
          ...identity,
          operation: "compare",
          response: compareJson(job.request),
        };
        break;
      case "format":
        message = {
          ...identity,
          operation: "format",
          response: formatJson(job.request),
        };
        break;
      case "markdown":
        message = {
          ...identity,
          operation: "markdown",
          response: generateMarkdown(job.result),
        };
        break;
    }
  } catch {
    message = { id: job.id, revision: job.revision, operation: "failed" };
  }
  self.postMessage(message);
};
