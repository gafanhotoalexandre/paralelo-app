import { describe, expect, it } from 'vitest'
import { createScanner } from 'jsonc-parser'
import { compareJson } from './comparison'
import { formatJson } from './formatting'
import { generateMarkdown } from './markdown'
import { LIMITS, utf8Length } from './limits'
import type { JsonComparisonResult } from './models'
function formatted(text: string) {
 const response=formatJson({text,side:'before'}); expect(response.status).toBe('success')
 if(response.status!=='success') throw new Error('Expected formatted JSON')
 return response.text
}
function report(before: string, after: string) {
 const response=compareJson({before,after,mode:'content'})
 if(response.status!=='success') throw new Error('Expected comparison')
 return generateMarkdown(response.result)
}
function significantTokens(text: string) {
 const scanner=createScanner(text,false), tokens:string[]=[]
 for(let type=scanner.scan(); type!==17; type=scanner.scan()) if(type!==14&&type!==15) tokens.push(text.slice(scanner.getTokenOffset(),scanner.getTokenOffset()+scanner.getTokenLength()))
 return tokens
}
describe('formatting preserves source values and property order', () => {
 it.each(['null','1.000e99999999999999999999','-0e-10000',String.raw`"\ud83e\uddea"`, '[]', '{}'])('formats any root and remains idempotent: %s', text => expect(formatted(formatted(text))).toBe(formatted(text)))
 it('preserves every non-whitespace token, including huge numbers, numeric keys, escapes and Unicode', () => {
  const source=String.raw` {"20":9007199254740993,"3":1.2300e+99999,"__proto__":{"a\/b":"\u0061"},"emoji":"🧪","nested":[true,null,-0.00]} `
  const output=formatted(source)
  expect(significantTokens(output)).toEqual(significantTokens(source))
  expect(output.indexOf('"20"')).toBeLessThan(output.indexOf('"3"'))
  expect(output).toContain('\n  "20": 9007199254740993,')
  expect(output).toBe(formatted(output))
  const comparison=compareJson({before:source,after:output,mode:'content'})
  expect(comparison.status==='success'&&comparison.result.counts.total).toBe(0)
 })
 it('normalizes external whitespace and CRLF to two spaces and LF', () => {
  expect(formatted(' \r\n{\r\n"a": [ 1,2 ]\r\n} \r\n')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}')
 })
 it.each(['{"x":0,"x":0}', '[1,]', String.raw`"\ud800"`, '/*x*/{}'])('rejects invalid formatting input without returning replacement text', text => {
  const response=formatJson({text,side:'after'})
  expect(response.status).toBe('invalidInput'); expect('text' in response).toBe(false)
  if(response.status!=='success') expect(response.errors[0]?.side).toBe('after')
 })
 it('rejects oversized formatted output before replacing the document', () => {
  const source=JSON.stringify(Array(220000).fill(0)); expect(utf8Length(source)).toBeLessThan(LIMITS.documentBytes)
  const response=formatJson({text:source,side:'before'})
  expect(response.status).toBe('limitExceeded'); expect('text' in response).toBe(false)
  if(response.status!=='success') expect(response.errors[0]?.code).toBe('formattedSize')
 })
 it('allows formatted output at the byte limit', () => {
  const source='"'+'a'.repeat(LIMITS.documentBytes-2)+'"'
  expect(utf8Length(formatted(source))).toBe(LIMITS.documentBytes)
 })
})
describe('Markdown report is complete, bounded and safe for arbitrary content', () => {
 it('includes all changes, classifications, arrays, mode and absence/null distinction', () => {
  const response=report('{"gone":null,"x":true}','{"added":null,"x":null}')
  expect(response.status).toBe('success')
  if(response.status==='success') {
   expect(response.markdown).toContain('Paralelo');expect(response.markdown).toContain('Conteúdo')
   expect(response.markdown).toContain('por índice');expect(response.markdown).toContain('Potenciais incompatibilidades (2)')
   for(const path of ['/gone','/added','/x']) expect(response.markdown).toContain(path)
   expect(response.markdown).toContain('(ausente)');expect(response.markdown).toContain('null')
   expect(response.markdown).toContain('não comprova')
  }
 })
 it('protects malicious paths, values, descriptions and fence sequences inside longer code fences', () => {
  const path='\n```\n<img src=x onerror=alert(1)>\n# injected'
  const response=report('{}',JSON.stringify({[path]:'````\n<script>alert(1)</script>'}))
  expect(response.status).toBe('success')
  if(response.status==='success') {
   const text=response.markdown
   expect(text).toContain('````\n/'+path+'\n````')
   expect(text).toContain('`````json\n')
   // Every line with HTML belongs to a fenced block; no input becomes raw HTML outside one.
   let fence=0
   for(const line of text.split('\n')) {
    const match=/^(`{3,})(?:json)?$/.exec(line)
    if(match) { if(!fence) fence=match[1]!.length;else if(match[1]!.length===fence) fence=0 }
    if(line.includes('<img')||line.includes('<script')) expect(fence).toBeGreaterThan(0)
   }
   expect(fence).toBe(0)
  }
 })
 it('identifies truncated previews without shortening the source range', () => {
  const response=report('null',JSON.stringify('x'.repeat(600)))
  expect(response.status==='success'&&response.markdown).toContain('prévia truncada')
 })
 it('reports equivalence explicitly', () => {
  const response=report('1','1.0')
  expect(response.status==='success'&&response.markdown).toContain('Nenhuma diferença encontrada')
 })
 it('enforces the exact Markdown byte budget without partial output', () => {
  const base: JsonComparisonResult={mode:'content',counts:{total:1,potential:0,informative:1},differences:[{id:'',path:'',kind:'ValueChanged',risk:'informative',description:'',before:null,after:null}]}
  const small=generateMarkdown(base); if(small.status!=='success') throw new Error('Expected report')
  const padding=LIMITS.reportBytes-utf8Length(small.markdown)
  const make=(count:number):JsonComparisonResult=>({...base,differences:[{...base.differences[0]!,description:'x'.repeat(count)}]})
  const exact=generateMarkdown(make(padding));expect(exact.status).toBe('success')
  if(exact.status==='success') expect(utf8Length(exact.markdown)).toBe(LIMITS.reportBytes)
  const over=generateMarkdown(make(padding+1));expect(over.status).toBe('limitExceeded');expect('markdown' in over).toBe(false)
 })
})
