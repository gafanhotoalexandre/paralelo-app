import type { Node } from "jsonc-parser";
import { validateJson } from "./validation";
import { canonicalNumber } from "./numbers";
import { LIMITS, OutputLimitError, preview, utf8Length } from "./limits";
import type {
  ChangeKind,
  CompareJsonRequest,
  CompareJsonResponse,
  JsonDifference,
  Risk,
  Snapshot,
} from "./models";
const types: Record<string, string> = {
  object: "object",
  array: "array",
  number: "number",
  string: "string",
  boolean: "boolean",
  null: "null",
};
const descriptions: Record<ChangeKind, string> = {
  PropertyAdded: "A propriedade passou a aparecer no JSON atualizado.",
  PropertyRemoved:
    "A propriedade deixou de aparecer no JSON atualizado. Consumidores podem depender dela.",
  TypeChanged: "O tipo observado mudou.",
  NullChanged: "O valor observado mudou envolvendo null.",
  ArrayItemAdded: "Um elemento apareceu nesta posição do array.",
  ArrayItemRemoved: "Um elemento deixou de aparecer nesta posição do array.",
  ValueChanged: "O valor mudou, mantendo o tipo observado.",
};
const escapePointer = (name: string) =>
  name.replaceAll("~", "~0").replaceAll("/", "~1");
export function compareJson(request: CompareJsonRequest): CompareJsonResponse {
  const before = validateJson(request.before, "before"),
    after = validateJson(request.after, "after");
  if (before.status !== "success" || after.status !== "success") {
    const failures = [before, after].filter(
      (item) => item.status !== "success",
    );
    return {
      status: failures.some((item) => item.status === "limitExceeded")
        ? "limitExceeded"
        : "invalidInput",
      errors: failures.flatMap((item) => item.errors),
    };
  }
  const differences: JsonDifference[] = [];
  let bytes = utf8Length(request.mode);
  function snapshot(node: Node | undefined, source: string): Snapshot | null {
    if (!node) return null;
    return Object.freeze({
      ...preview(source.slice(node.offset, node.offset + node.length)),
      range: Object.freeze({
        from: node.offset,
        to: node.offset + node.length,
      }),
    });
  }
  function emit(kind: ChangeKind, path: string, old?: Node, updated?: Node) {
    if (differences.length === LIMITS.differences)
      throw new OutputLimitError(
        "differenceCount",
        "A comparação ultrapassa 1.000 diferenças.",
      );
    const risk: Risk =
      kind === "PropertyRemoved" ||
      kind === "TypeChanged" ||
      (kind === "NullChanged" && updated?.type === "null")
        ? "potential"
        : "informative";
    const description =
      kind === "NullChanged"
        ? old?.type === "null"
          ? `O valor observado passou de null para ${types[updated!.type]}. A amostra anterior não define seu tipo contratual.`
          : `O valor observado passou de ${types[old!.type]} para null. Consumidores podem depender de um valor utilizável.`
        : kind === "TypeChanged"
          ? `O tipo observado mudou de ${types[old!.type]} para ${types[updated!.type]}. Consumidores podem depender do tipo anterior.`
          : descriptions[kind];
    const item = Object.freeze({
      id: path,
      path,
      kind,
      risk,
      description,
      before: snapshot(old, request.before),
      after: snapshot(updated, request.after),
    });
    bytes +=
      utf8Length(item.id) +
      utf8Length(path) +
      utf8Length(kind) +
      utf8Length(risk) +
      utf8Length(description) +
      utf8Length(item.before?.text ?? "") +
      utf8Length(item.after?.text ?? "");
    if (bytes > LIMITS.resultBytes)
      throw new OutputLimitError(
        "resultSize",
        "Os textos do resultado ultrapassam 4 MiB.",
      );
    differences.push(item);
  }
  function walk(old: Node, updated: Node, path: string) {
    if (old.type !== updated.type) {
      emit(
        old.type === "null" || updated.type === "null"
          ? "NullChanged"
          : "TypeChanged",
        path,
        old,
        updated,
      );
      return;
    }
    if (old.type === "object") {
      const properties = (node: Node) =>
        new Map(
          (node.children ?? []).map(
            (p) => [p.children![0]!.value as string, p.children![1]!] as const,
          ),
        );
      const a = properties(old),
        b = properties(updated);
      for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
        const pointer = path + "/" + escapePointer(key),
          left = a.get(key),
          right = b.get(key);
        if (!left) emit("PropertyAdded", pointer, undefined, right);
        else if (!right) emit("PropertyRemoved", pointer, left);
        else walk(left, right, pointer);
      }
    } else if (old.type === "array") {
      const a = old.children ?? [],
        b = updated.children ?? [];
      for (let index = 0; index < Math.max(a.length, b.length); index++) {
        const pointer = path + "/" + index;
        if (!a[index]) emit("ArrayItemAdded", pointer, undefined, b[index]);
        else if (!b[index]) emit("ArrayItemRemoved", pointer, a[index]);
        else walk(a[index]!, b[index]!, pointer);
      }
    } else if (request.mode === "content") {
      const equal =
        old.type === "number"
          ? canonicalNumber(
              request.before.slice(old.offset, old.offset + old.length),
            ) ===
            canonicalNumber(
              request.after.slice(
                updated.offset,
                updated.offset + updated.length,
              ),
            )
          : old.value === updated.value;
      if (!equal) emit("ValueChanged", path, old, updated);
    }
  }
  try {
    walk(before.root, after.root, "");
    const potential = differences.filter((d) => d.risk === "potential").length;
    return {
      status: "success",
      result: Object.freeze({
        mode: request.mode,
        differences: Object.freeze(differences),
        counts: Object.freeze({
          total: differences.length,
          potential,
          informative: differences.length - potential,
        }),
      }),
    };
  } catch (error) {
    if (error instanceof OutputLimitError)
      return { status: "limitExceeded", errors: [error.issue] };
    throw error;
  }
}
