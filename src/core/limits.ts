import type { IssueCode, ProcessingIssue } from "./models";
export const LIMITS = Object.freeze({
  documentBytes: 1024 * 1024,
  depth: 64,
  differences: 1000,
  previewCharacters: 512,
  resultBytes: 4 * 1024 * 1024,
  reportBytes: 8 * 1024 * 1024,
});
const encoder = new TextEncoder();
export function utf8Length(text: string) {
  return encoder.encode(text).length;
}
export class OutputLimitError extends Error {
  readonly issue: ProcessingIssue;
  constructor(code: IssueCode, message: string) {
    super(message);
    this.issue = { code, message };
  }
}
export function preview(text: string) {
  let end = Math.min(text.length, LIMITS.previewCharacters);
  if (
    end < text.length &&
    end > 0 &&
    text.charCodeAt(end - 1) >= 0xd800 &&
    text.charCodeAt(end - 1) <= 0xdbff
  )
    end--;
  return { text: text.slice(0, end), truncated: end < text.length };
}
