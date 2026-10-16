import { LIMITS, OutputLimitError, utf8Length } from "./limits";
import type {
  ChangeKind,
  GenerateMarkdownResponse,
  JsonComparisonResult,
  Snapshot,
} from "./models";
const labels: Record<ChangeKind, string> = {
  PropertyAdded: "Propriedade adicionada",
  PropertyRemoved: "Propriedade removida",
  TypeChanged: "Tipo alterado",
  NullChanged: "Mudança envolvendo null",
  ArrayItemAdded: "Elemento adicionado ao array",
  ArrayItemRemoved: "Elemento removido do array",
  ValueChanged: "Valor alterado",
};
export function generateMarkdown(
  result: JsonComparisonResult,
): GenerateMarkdownResponse {
  const parts: string[] = [];
  let bytes = 0;
  function append(text: string) {
    bytes += utf8Length(text);
    if (bytes > LIMITS.reportBytes)
      throw new OutputLimitError(
        "reportSize",
        "O relatório ultrapassa 8 MiB. A comparação foi preservada.",
      );
    parts.push(text);
  }
  function block(text: string, language = "") {
    let run = 2;
    for (const match of text.matchAll(/`+/g))
      run = Math.max(run, match[0].length);
    const fence = "`".repeat(run + 1);
    append(fence + language + "\n");
    append(text);
    append("\n" + fence + "\n\n");
  }
  function value(label: string, snapshot: Snapshot | null) {
    append(
      `**${label}:**${snapshot?.truncated ? " prévia truncada (limite de 512 caracteres)" : ""}\n\n`,
    );
    block(snapshot?.text ?? "(ausente)", snapshot ? "json" : "");
  }
  try {
    append(
      `# Paralelo — relatório de comparação\n\nModo: **${result.mode === "structural" ? "Estrutural" : "Conteúdo"}**  \nPolítica de arrays: comparação por índice. Reordenações podem gerar diferenças.\n\n`,
    );
    append(
      `Diferenças: **${result.counts.total}**  \nPotenciais incompatibilidades: **${result.counts.potential}**  \nInformativas: **${result.counts.informative}**\n\n`,
    );
    append(
      "> A análise de amostras não comprova compatibilidade ou quebra de contrato. A classificação informativa não garante compatibilidade. Ausência de propriedade é diferente de JSON null.\n\n",
    );
    if (!result.differences.length)
      append(
        result.mode === "structural"
          ? "Nenhuma diferença estrutural encontrada.\n"
          : "Nenhuma diferença encontrada.\n",
      );
    for (const risk of ["potential", "informative"] as const) {
      const items = result.differences.filter((d) => d.risk === risk);
      if (!items.length) continue;
      append(
        `## ${risk === "potential" ? "Potenciais incompatibilidades" : "Informativas"} (${items.length})\n\n`,
      );
      for (const [index, difference] of items.entries()) {
        append(
          `### ${index + 1}. ${labels[difference.kind]}\n\n**Caminho (JSON Pointer):**\n\n`,
        );
        block(difference.path || "(raiz)");
        append("**Descrição da evidência:**\n\n");
        block(difference.description);
        value("Original", difference.before);
        value("Atualizado", difference.after);
      }
    }
    return { status: "success", markdown: parts.join("") };
  } catch (error) {
    if (error instanceof OutputLimitError)
      return { status: "limitExceeded", errors: [error.issue] };
    throw error;
  }
}
