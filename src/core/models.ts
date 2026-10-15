export type Mode = "structural" | "content";
export type Side = "before" | "after";
export type Risk = "potential" | "informative";
export type ChangeKind =
  | "PropertyAdded"
  | "PropertyRemoved"
  | "TypeChanged"
  | "NullChanged"
  | "ArrayItemAdded"
  | "ArrayItemRemoved"
  | "ValueChanged";
export interface SourceRange {
  readonly from: number;
  readonly to: number;
}
export interface Snapshot {
  readonly text: string;
  readonly range: SourceRange;
  readonly truncated: boolean;
}
export interface JsonDifference {
  readonly id: string;
  readonly path: string;
  readonly kind: ChangeKind;
  readonly risk: Risk;
  readonly description: string;
  readonly before: Snapshot | null;
  readonly after: Snapshot | null;
}
export interface JsonComparisonResult {
  readonly mode: Mode;
  readonly differences: readonly JsonDifference[];
  readonly counts: {
    readonly total: number;
    readonly potential: number;
    readonly informative: number;
  };
}
export type IssueCode =
  | "syntax"
  | "unicode"
  | "duplicateProperty"
  | "documentSize"
  | "depth"
  | "differenceCount"
  | "resultSize"
  | "formattedSize"
  | "reportSize";
export interface ProcessingIssue {
  readonly code: IssueCode;
  readonly message: string;
  readonly side?: Side;
  readonly line?: number;
  readonly column?: number;
}
export type OperationFailure = {
  readonly status: "invalidInput" | "limitExceeded";
  readonly errors: readonly ProcessingIssue[];
};
export interface CompareJsonRequest {
  readonly before: string;
  readonly after: string;
  readonly mode: Mode;
}
export type CompareJsonResponse =
  | { readonly status: "success"; readonly result: JsonComparisonResult }
  | OperationFailure;
export interface FormatJsonRequest {
  readonly text: string;
  readonly side: Side;
}
export type FormatJsonResponse =
  | { readonly status: "success"; readonly text: string }
  | OperationFailure;
export type GenerateMarkdownResponse =
  | { readonly status: "success"; readonly markdown: string }
  | {
      readonly status: "limitExceeded";
      readonly errors: readonly ProcessingIssue[];
    };
