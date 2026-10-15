import type {
  CompareJsonRequest,
  CompareJsonResponse,
  FormatJsonRequest,
  FormatJsonResponse,
  GenerateMarkdownResponse,
  JsonComparisonResult,
} from "../core/models";
export type WorkerOperation = "compare" | "format" | "markdown";
export type WorkerPayload =
  | { operation: "compare"; request: CompareJsonRequest; revision: number }
  | { operation: "format"; request: FormatJsonRequest; revision: number }
  | { operation: "markdown"; result: JsonComparisonResult; revision: number };
export type WorkerRequest = WorkerPayload & { id: number };
export type WorkerResponse = { id: number; revision: number } & (
  | { operation: "compare"; response: CompareJsonResponse }
  | { operation: "format"; response: FormatJsonResponse }
  | { operation: "markdown"; response: GenerateMarkdownResponse }
  | { operation: "failed" }
);
