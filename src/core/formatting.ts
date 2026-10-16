import { applyEdits, format } from "jsonc-parser";
import { LIMITS, utf8Length } from "./limits";
import { validateJson } from "./validation";
import type { FormatJsonRequest, FormatJsonResponse } from "./models";
export function formatJson(request: FormatJsonRequest): FormatJsonResponse {
  const parsed = validateJson(request.text, request.side);
  if (parsed.status !== "success") return parsed;
  const source = request.text
    .slice(parsed.root.offset, parsed.root.offset + parsed.root.length)
    .replace(/\r\n?/g, "\n");
  const edits = format(source, undefined, {
    tabSize: 2,
    insertSpaces: true,
    eol: "\n",
    keepLines: false,
  });
  let bytes = utf8Length(source);
  for (const edit of edits)
    bytes +=
      utf8Length(edit.content) -
      utf8Length(source.slice(edit.offset, edit.offset + edit.length));
  if (bytes > LIMITS.documentBytes)
    return {
      status: "limitExceeded",
      errors: [
        {
          code: "formattedSize",
          side: request.side,
          message:
            "O JSON formatado ultrapassa 1 MiB. O conteúdo original foi preservado.",
        },
      ],
    };
  return { status: "success", text: applyEdits(source, edits) };
}
