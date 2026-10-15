export type Mode = "structural" | "content";
export type Risk = "potential" | "informative";
export type ChangeKind =
  | "PropertyAdded"
  | "PropertyRemoved"
  | "TypeChanged"
  | "NullChanged"
  | "ArrayItemAdded"
  | "ArrayItemRemoved"
  | "ValueChanged";
export type Side = "before" | "after";
export interface SourceRange {
  from: number;
  to: number;
}
export interface Snapshot {
  text: string;
  range: SourceRange;
}
export interface DemoDifference {
  id: string;
  path: string;
  kind: ChangeKind;
  risk: Risk;
  description: string;
  before: Snapshot | null;
  after: Snapshot | null;
}
export interface DemoExample {
  id: string;
  title: string;
  subtitle: string;
  letter: string;
  before: string;
  after: string;
  differences: readonly DemoDifference[];
}
export const changeLabels: Record<ChangeKind, string> = {
  PropertyAdded: "Propriedade adicionada",
  PropertyRemoved: "Propriedade removida",
  TypeChanged: "Tipo alterado",
  NullChanged: "Transição envolvendo null",
  ArrayItemAdded: "Elemento adicionado",
  ArrayItemRemoved: "Elemento removido",
  ValueChanged: "Valor alterado",
};
export const PAGE_SIZE = 25;
export function differencesForMode(example: DemoExample, mode: Mode) {
  return example.differences.filter(
    (d) => mode === "content" || d.kind !== "ValueChanged",
  );
}
export function filterDifferences(
  differences: readonly DemoDifference[],
  risk: Risk | "all",
  kind: ChangeKind | "all",
) {
  return differences.filter(
    (d) =>
      (risk === "all" || d.risk === risk) &&
      (kind === "all" || d.kind === kind),
  );
}
export function pageDifferences(
  differences: readonly DemoDifference[],
  page: number,
) {
  return differences.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}
export function isCurrentDemo(
  example: DemoExample,
  texts: Record<Side, string>,
  mode: Mode,
  comparedMode: Mode,
) {
  return (
    texts.before === example.before &&
    texts.after === example.after &&
    mode === comparedMode
  );
}
