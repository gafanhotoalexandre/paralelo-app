import type { ChangeKind, JsonDifference, Risk } from "@/core/models";
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
export function filterDifferences(
  differences: readonly JsonDifference[],
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
  differences: readonly JsonDifference[],
  page: number,
) {
  return differences.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}
