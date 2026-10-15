import { describe, expect, it } from 'vitest'
import { compareJson } from './comparison'
import { LIMITS, preview, utf8Length } from './limits'
import type { Mode } from './models'
function compare(before: string, after: string, mode: Mode = 'content') { return compareJson({ before, after, mode }) }
function result(before: string, after: string, mode: Mode = 'content') {
  const response = compare(before, after, mode)
  expect(response.status).toBe('success')
  if (response.status !== 'success') throw new Error('Expected success')
  return response.result
}
describe('exact JSON numbers (raw tokens, never JavaScript numeric values)', () => {
  it.each([
    ['1', '1.0'], ['10e-3', '0.01'], ['-0', '0e999999999999999999999999'],
    ['123000e-3', '123'], ['-12.50e+2', '-1250'],
    ['9007199254740993', '9007199254740993.000'],
    ['1e10000000000000000000000000000', '10e9999999999999999999999999999'],
    ['1e-99999999999999999999', '0.1e-99999999999999999998'],
  ])('recognizes exact equivalence: %s / %s', (a,b) => expect(result(a,b).counts.total).toBe(0))
  it.each([
    ['9007199254740992', '9007199254740993'], ['9007199254740993', '9007199254740994'],
    ['0.1000000000000000000000000000000001', '0.1000000000000000000000000000000002'],
    ['1e10000', '2e10000'], ['1e-10000', '0'], ['-1e10000', '1e10000'],
    ['1e100000000000000000000', '1e100000000000000000001'],
  ])('distinguishes values Number would round, overflow or underflow: %s / %s', (a,b) => {
    const change = result(a,b).differences[0]!
    expect(change.kind).toBe('ValueChanged'); expect(change.before?.text).toBe(a); expect(change.after?.text).toBe(b)
  })
})
describe('strict complete-document validation', () => {
  it.each(['', ' ', '{', 'true false', 'undefined', 'NaN', 'Infinity', '01', '-01', '+1', '1.', '.1', '1e', '1e+', '[1,]', '{"x":1,}', '//x\n1', '/*x*/1', '{x:1}', '"a\n"', '"\\x00"', '\u00a0{}', '{}\u2028'])('rejects malformed input %j', text => {
    const response = compare(text, '{}'); expect(response.status).toBe('invalidInput')
    expect('result' in response).toBe(false)
  })
  it.each([
    '{"x":1,"x":1}', '{"x":1,"x":2}', '{"a":1,"\\u0061":1}',
    '{"nested":[{"x":0,"x":0}]}', '{"":null,"":null}', '{"__proto__":1,"__proto__":1}',
  ])('rejects all duplicate decoded keys, including equal values: %s', text => {
    const response=compare('{}',text,'structural'); expect(response.status).toBe('invalidInput')
    if(response.status!=='success') expect(response.errors[0]?.code).toBe('duplicateProperty')
  })
  it.each([String.raw`"\ud800"`, String.raw`"\udc00"`, String.raw`"\ud800x"`, String.raw`{"\ud800":0}`, '"\ud800"', '"\udc00"', String.raw`{"x":"\ud800"}`])('rejects unpaired literal or escaped UTF-16 surrogates', text => {
    const response=compare(text,text,'structural'); expect(response.status).toBe('invalidInput')
  })
  it('accepts valid Unicode, equivalent escapes, distinct case and identical names in different objects', () => {
    expect(result(String.raw`{"\ud83e\uddea":"\ud83e\uddea"}`, '{"🧪":"🧪"}').counts.total).toBe(0)
    expect(result('{"a":1,"A":2,"nested":{"a":1}}','{"nested":{"a":1},"A":2,"a":1}').counts.total).toBe(0)
    expect(result('"é"', '"é"').counts.total).toBe(1)
  })
  it('reports both documents without including secret keys or snippets in errors', () => {
    const response=compare('{"SECRET_NAME":','{"PRIVATE":')
    expect(response.status).toBe('invalidInput')
    if(response.status!=='success') {
      expect(response.errors.map(e=>e.side)).toEqual(['before','after'])
      expect(JSON.stringify(response.errors)).not.toMatch(/SECRET_NAME|PRIVATE/)
      expect(response.errors[0]?.line).toBe(1)
    }
  })
  it('accepts precisely 64 container levels and rejects 65 before recursive parsing', () => {
    expect(compare('['.repeat(64)+'0'+']'.repeat(64),'null').status).toBe('success')
    const response=compare('['.repeat(65)+'0'+']'.repeat(65),'null')
    expect(response.status).toBe('limitExceeded')
    if(response.status!=='success') expect(response.errors[0]?.code).toBe('depth')
  })
  it('enforces UTF-8 byte size including multibyte characters at the exact input boundary', () => {
    const text='"'+'a'.repeat(LIMITS.documentBytes-2)+'"'
    expect(compare(text,text,'structural').status).toBe('success')
    expect(compare(text+' ',text,'structural').status).toBe('limitExceeded')
    const unicode='"'+'🧪'.repeat(262144)+'"'
    expect(unicode.length).toBeLessThan(LIMITS.documentBytes)
    expect(compare(unicode,'null').status).toBe('limitExceeded')
  })
})
describe('comparison policy, deterministic ordering and exact source ranges', () => {
  it.each(['null','true','false','0','"text"','[]','{}'])('accepts any JSON root: %s', value => expect(result(value,value).counts.total).toBe(0))
  it('ignores whitespace, property order, decoded string spelling and scalar values in structural mode', () => {
    expect(result('{"b":1,"a":"x"}','{ "a": "y", "b":2.5 }','structural').counts.total).toBe(0)
    expect(result('"a"',String.raw`"\u0061"`).counts.total).toBe(0)
    expect(result('true','false','structural').counts.total).toBe(0)
  })
  it('emits one difference for a complete added/removed subtree or type replacement', () => {
    const changes=result('{"remove":{"a":[1]},"type":{"x":true}}','{"add":{"b":[2]},"type":[false]}').differences
    expect(changes.map(d=>[d.path,d.kind])).toEqual([['/add','PropertyAdded'],['/remove','PropertyRemoved'],['/type','TypeChanged']])
  })
  it('keeps null directional, and absence distinct from null', () => {
    const changes=result('{"a":true,"b":null,"d":null,"same":null}','{"a":null,"b":{},"c":null,"same":null}').differences
    expect(changes.map(d=>[d.path,d.kind,d.risk])).toEqual([['/a','NullChanged','potential'],['/b','NullChanged','informative'],['/c','PropertyAdded','informative'],['/d','PropertyRemoved','potential']])
    expect(changes[2]?.before).toBeNull(); expect(changes[2]?.after?.text).toBe('null')
  })
  it('compares heterogeneous, nested and reordered arrays by numeric index without move inference', () => {
    expect(result('[]','[]').counts.total).toBe(0)
    expect(result('[1,{"x":2},[true]]','["1",{"x":3},[false],null]','structural').differences.map(d=>[d.path,d.kind])).toEqual([['/0','TypeChanged'],['/3','ArrayItemAdded']])
    expect(result('[1,2]','[2,1]').differences.map(d=>d.path)).toEqual(['/0','/1'])
    expect(result('[1,2]','[2,1]','structural').counts.total).toBe(0)
    expect(result('[null]','[]').differences[0]?.risk).toBe('informative')
    expect(result('[]','['+Array(12).fill('0').join(',')+']').differences.map(d=>d.path)).toEqual(Array.from({length:12},(_,i)=>'/'+i))
  })
  it('uses ordinal paths with JSON Pointer escaping, including empty property names and prototype-like keys', () => {
    const changes=result('{}','{"~a/b":0,"":null,"__proto__":{"polluted":true},"A":1,"a":1}').differences
    expect(changes.map(d=>d.path)).toEqual(['/','/A','/__proto__','/a','/~0a~1b'])
    expect(({} as {polluted?:boolean}).polluted).toBeUndefined()
  })
  it('returns exact UTF-16 value ranges for homonyms, arrays, CRLF, emoji, objects and the root', () => {
    const text=' {\r\n "emoji":"🧪", "a":{"x":1}, "b":{"x":[true, null]}\r\n} '
    const changes=result('{}',text).differences
    for(const d of changes) expect(JSON.parse(text.slice(d.after!.range.from,d.after!.range.to))).toEqual(JSON.parse(d.after!.text))
    expect(changes.find(d=>d.path==='/b')?.after?.text).toBe('{"x":[true, null]}')
    const root=result('null',text).differences[0]!
    expect(root.path).toBe(''); expect(root.after?.range).toEqual({from:1,to:text.length-1})
    const nested=result(text,text.replace('[true, null]','[false, null]')).differences[0]!
    expect(nested.path).toBe('/b/x/0'); expect(text.slice(nested.before!.range.from,nested.before!.range.to)).toBe('true')
  })
  it('returns detached frozen results and deterministic output', () => {
    const a=compare('{"b":0,"a":0}','{"b":1,"a":1}'), b=compare('{"b":0,"a":0}','{"b":1,"a":1}')
    expect(a).toEqual(b)
    if(a.status==='success') { expect(Object.isFrozen(a.result.differences)).toBe(true); expect(JSON.stringify(a.result)).not.toContain('parent') }
  })
  it('allows exactly 1,000 differences, with no partial result when exceeded', () => {
    expect(result('[]',JSON.stringify(Array(1000).fill(0))).counts.total).toBe(1000)
    const response=compare('[]',JSON.stringify(Array(1001).fill(0)))
    expect(response.status).toBe('limitExceeded'); expect('result' in response).toBe(false)
  })
  it('checks accumulated UTF-8 text budget while constructing results', () => {
    const key='🧪'.repeat(800)
    const response=compare(JSON.stringify({[key]:[]}),JSON.stringify({[key]:Array(1000).fill(0)}))
    expect(response.status).toBe('limitExceeded')
    if(response.status!=='success') expect(response.errors[0]?.code).toBe('resultSize')
    expect('result' in response).toBe(false)
  })
  it('limits previews without cutting a surrogate pair, keeping the complete source range', () => {
    const text=JSON.stringify('a'.repeat(510)+'🧪'.repeat(30))
    const d=result('null',text).differences[0]!
    expect(d.after?.truncated).toBe(true); expect(d.after!.text.length).toBeLessThanOrEqual(512)
    expect(d.after!.range.to).toBe(text.length)
    expect(utf8Length(d.after!.text)).toBe(d.after!.text.length)
    expect(preview('a'.repeat(512)).truncated).toBe(false)
  })
})
