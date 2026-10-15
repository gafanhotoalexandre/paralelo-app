import { createScanner, parseTree, type Node, type ParseError } from 'jsonc-parser'
import { LIMITS, utf8Length } from './limits'
import type { OperationFailure, ProcessingIssue, Side } from './models'

// jsonc-parser exposes ambient const enums, incompatible with isolated transforms.
// These token codes follow the pinned 3.3.1 public scanner API.
const Token = { OpenBraceToken: 1, CloseBraceToken: 2, OpenBracketToken: 3, CloseBracketToken: 4, StringLiteral: 10, NumericLiteral: 11, LineCommentTrivia: 12, BlockCommentTrivia: 13, LineBreakTrivia: 14, Trivia: 15, Unknown: 16, EOF: 17 } as const
type ParsedDocument = { status: 'success'; root: Node } | OperationFailure
function invalidSurrogate(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return i - 1
    } else if (code >= 0xdc00 && code <= 0xdfff) return i
  }
  return -1
}
function problem(text: string, side: Side, code: ProcessingIssue['code'], message: string, offset = 0): OperationFailure {
  const lines = text.slice(0, offset).split(/\r\n|\r|\n/)
  const line = lines.length, column = lines[lines.length - 1]!.length + 1
  return { status: code === 'documentSize' || code === 'depth' ? 'limitExceeded' : 'invalidInput', errors: [{ code, message: `${message} Linha ${line}, coluna ${column}.`, side, line, column }] }
}
export function validateJson(text: string, side: Side): ParsedDocument {
  if (text.length > LIMITS.documentBytes) return problem(text, side, 'documentSize', 'O documento ultrapassa 1 MiB em UTF-8.')
  const bad = invalidSurrogate(text)
  if (bad >= 0) return problem(text, side, 'unicode', 'O documento contém uma sequência Unicode inválida.', bad)
  if (utf8Length(text) > LIMITS.documentBytes) return problem(text, side, 'documentSize', 'O documento ultrapassa 1 MiB em UTF-8.')
  if (/^[ \t\r\n]*$/.test(text)) return problem(text, side, 'syntax', 'Informe um documento JSON.')
  // Scan before recursive parsing: the scanner itself is iterative and preserves source offsets.
  const scanner = createScanner(text, false)
  let depth = 0
  for (let token = scanner.scan(); token !== Token.EOF; token = scanner.scan()) {
    const offset = scanner.getTokenOffset()
    const raw = () => text.slice(offset, offset + scanner.getTokenLength())
    if (scanner.getTokenError() !== 0) return problem(text, side, 'syntax', 'JSON inválido.', offset)
    if (token === Token.StringLiteral && invalidSurrogate(scanner.getTokenValue()) >= 0) return problem(text, side, 'unicode', 'O documento contém uma sequência Unicode inválida.', offset)
    if (token === Token.OpenBraceToken || token === Token.OpenBracketToken) {
      if (++depth > LIMITS.depth) return problem(text, side, 'depth', 'O documento ultrapassa 64 níveis.', offset)
    } else if (token === Token.CloseBraceToken || token === Token.CloseBracketToken) depth--
    if (token === Token.NumericLiteral && !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw())) return problem(text, side, 'syntax', 'Número JSON inválido.', offset)
    if (token === Token.LineCommentTrivia || token === Token.BlockCommentTrivia || token === Token.Unknown || (token === Token.Trivia && !/^[ \t]+$/.test(raw())) || (token === Token.LineBreakTrivia && !/^[\r\n]+$/.test(raw()))) return problem(text, side, 'syntax', 'JSON inválido. Comentários e espaços não JSON não são aceitos.', offset)
  }
  const errors: ParseError[] = []
  const root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false })
  if (!root || errors.length) return problem(text, side, 'syntax', 'JSON inválido.', errors[0]?.offset ?? 0)
  function duplicate(node: Node): Node | undefined {
    if (node.type === 'object') {
      const names = new Set<string>()
      for (const property of node.children ?? []) {
        const key = property.children![0]!
        const name = key.value as string
        if (names.has(name)) return key
        names.add(name)
        const found = duplicate(property.children![1]!)
        if (found) return found
      }
    } else if (node.type === 'array') {
      for (const item of node.children ?? []) { const found = duplicate(item); if (found) return found }
    }
    return undefined
  }
  const repeated = duplicate(root)
  if (repeated) return problem(text, side, 'duplicateProperty', 'O documento contém propriedades duplicadas.', repeated.offset)
  return { status: 'success', root }
}
