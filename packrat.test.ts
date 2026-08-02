// packrat.test.ts

import { describe, expect, test } from 'bun:test'
import { evaluateGrammar, packrat, packratGrammar, parseGrammar } from './packrat'

describe('packrat', () => {
  test('Literal', () => {
    const parse = packrat`
      Any = .
    `
    expect(parse('a')).toBe('a')
    expect(parse('0')).toBe('0')
    expect(() => parse('')).toThrow()
    expect(() => parse('aa')).toThrow()
  })

  test('Literal', () => {
    const parse = packrat`
      Literal = "abc"
    `
    expect(parse('abc')).toBe('abc')
    expect(() => parse('abd')).toThrow()
    expect(() => parse('')).toThrow()
  })

  test('Literal insensitive', () => {
    const parse = packrat`
      Literal = "abc"i
    `
    expect(parse('abc')).toBe('abc')
    expect(parse('ABC')).toBe('ABC')
    expect(parse('AbC')).toBe('AbC')
    expect(() => parse('abd')).toThrow()
  })

  test('Class', () => {
    const parse = packrat`
      Class = [a-z]
    `
    expect(parse('a')).toBe('a')
    expect(parse('z')).toBe('z')
    expect(() => parse('A')).toThrow()
    expect(() => parse('0')).toThrow()
  })

  test('Class negation', () => {
    const parse = packrat`
      Class = [^a-z]
    `
    expect(parse('A')).toBe('A')
    expect(parse('0')).toBe('0')
    expect(() => parse('a')).toThrow()
  })

  test('Class equal predicate', () => {
    const parse = packrat`
      Class = [ab_]
    `
    expect(parse('a')).toBe('a')
    expect(parse('b')).toBe('b')
    expect(parse('_')).toBe('_')
    expect(() => parse('c')).toThrow()
  })

  test('Class insensitive', () => {
    const parse = packrat`
      Class = [a-z]i
    `
    expect(parse('a')).toBe('a')
    expect(parse('A')).toBe('A')
    expect(() => parse('0')).toThrow()
  })

  test('Reference', () => {
    const parse = packrat`
      A = B
      B = "x"
    `
    expect(parse('x')).toBe('x')
    expect(() => parse('y')).toThrow()
  })

  test('Choice', () => {
    const parse = packrat`
      Choice = "a" / "b"
    `
    expect(parse('a')).toBe('a')
    expect(parse('b')).toBe('b')
    expect(() => parse('c')).toThrow()
  })

  test('Sequence', () => {
    const parse = packrat`
      Sequence = "a" "b"
    `
    expect(parse('ab')).toEqual(['a', 'b'])
    expect(() => parse('a')).toThrow()
    expect(() => parse('ba')).toThrow()
  })

  test('Node', () => {
    const parse = packrat`
      Node = a:"a" b:"b" -> Node
    `
    const result = parse('ab') as any
    expect(result.tag).toBe('Node')
    expect(result.a).toBe('a')
    expect(result.b).toBe('b')
    expect(result.location.file).toBe('<unknown>')
    expect(result.location.line).toBe(1)
    expect(result.location.column).toBe(1)
  })

  test('Field', () => {
    const parse = packrat`
      Field = value:"a" -> Field
    `
    const result = parse('a') as any
    expect(result.tag).toBe('Field')
    expect(result.value).toBe('a')
  })

  test('Extract single', () => {
    const parse = packrat`
      Extract = "(" ^"a" ")"
    `
    expect(parse('(a)')).toBe('a')
  })

  test('Extract multiple', () => {
    const parse = packrat`
      Extract = ^"a" "b" ^"c"
    `
    expect(parse('abc')).toEqual(['a', 'c'])
  })

  test('Text', () => {
    const parse = packrat`
      Text = $( "a" "b" "c" )
    `
    expect(parse('abc')).toBe('abc')
  })

  test('Except', () => {
    const parse = packrat`
      Except = ~"a"
    `
    expect(parse('b')).toBe('b')
    expect(() => parse('a')).toThrow()
    expect(() => parse('')).toThrow()
  })

  test('And', () => {
    const parse = packrat`
      And = &"a" "a"
    `
    expect(parse('a')).toEqual([null, 'a'])
    expect(() => parse('b')).toThrow()
  })

  test('Not', () => {
    const parse = packrat`
      Not = !"a" .
    `
    expect(parse('b')).toEqual([null, 'b'])
    expect(() => parse('a')).toThrow()
  })

  test('Optional', () => {
    const parse = packrat`
      Optional = "a"?
    `
    expect(parse('a')).toBe('a')
    expect(parse('')).toBe(null)
  })

  test('Zero', () => {
    const parse = packrat`
      Zero = "a"*
    `
    expect(parse('')).toEqual([])
    expect(parse('aaa')).toEqual(['a', 'a', 'a'])
  })

  test('One', () => {
    const parse = packrat`
      One = "a"+
    `
    expect(parse('a')).toEqual(['a'])
    expect(parse('aaa')).toEqual(['a', 'a', 'a'])
    expect(() => parse('')).toThrow()
  })

  test('Repeat min max', () => {
    const parse = packrat`
      Repeat = "a"{2,3}
    `
    expect(parse('aa')).toEqual(['a', 'a'])
    expect(parse('aaa')).toEqual(['a', 'a', 'a'])
    expect(() => parse('a')).toThrow()
    expect(() => parse('aaaa')).toThrow()
  })

  test('Repeat min only', () => {
    const parse = packrat`
      Repeat = "a"{2}
    `
    expect(parse('aa')).toEqual(['a', 'a'])
    expect(parse('aaa')).toEqual(['a', 'a', 'a'])
    expect(() => parse('a')).toThrow()
  })

  test('Repeat separator', () => {
    const parse = packrat`
      Repeat = "a"{2,3;","}
    `
    expect(parse('a,a')).toEqual(['a', 'a'])
    expect(parse('a,a,a')).toEqual(['a', 'a', 'a'])
    expect(() => parse('a')).toThrow()
    expect(() => parse('aa')).toThrow()
  })

  test('Indent', () => {
    const parse = packrat`
      Indent = >> "a" << -> Indent
    `
    expect((parse('\n  a') as any).tag).toBe('Indent')
    expect(() => parse('a')).toThrow()
    expect(() => parse('\na')).toThrow()
  })

  test('Indent nested deeper', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    const result = parse('a\n  b') as any
    expect(result.tag).toBe('Outer')
    expect(result.inner).toBe('b')
  })

  test('Indent nested same or lower fails', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(() => parse('a\nb')).toThrow()
  })

  test('Self host', () => {
    const input = `
      Grammar = _ rules:( ^Rule _ )+ -> Grammar
      Rule = name:Id _ "=" _ expression:Expression -> Rule
      Expression = Choice
      Choice = expressions:Node { 2 ; _ "/" _ } -> Choice / Node
      Node = expression:Sequence _ "->" _ name:Id -> Node / Sequence
      Sequence = expressions:Select { 2 ; __ } -> Sequence / Select
      Select = Field / Extract / Prefix
      Field = name:Id _ ":" _ expression:Prefix -> Field
      Extract = "^" _ expression:Prefix -> Extract
      Prefix = Except / Text / And / Not / Postfix
      Except = "~" _ expression:Postfix -> Except
      Text = "$" _ expression:Postfix -> Text
      And = "&" _ expression:Postfix -> And
      Not = "!" _ expression:Postfix -> Not
      Postfix = Optional / Zero / One / Repeat / Primary
      Optional = expression:Primary _ "?" -> Optional
      Zero = expression:Primary _ "*" -> Zero
      One = expression:Primary _ "+" -> One
      Repeat = expression:Primary _ "{" _ min:Number max:RepeatMax? separator:RepeatSeparator? _ "}" -> Repeat
      RepeatMax =  _ "," _ ^Number
      RepeatSeparator =  _ ";" _ ^Expression
      Number = "0" / $( [1-9] [0-9]* )
      Primary = Reference / Indent / Class / Literal / Any / Group
      Indent = ">>" _ expression:Expression _ "<<" -> Indent
      Group = "(" _ ^Expression _ ")"
      Reference = name:Id !( _ "=" ) -> Reference
      Id = $( [a-z_]i [a-z0-9_]i* )
      Class = "[" negation:"^"? predicates:ClassItem* "]" insensitive:"i"? -> Class
      ClassItem = Between / Equal
      Between = min:PredicateItem "-" max:PredicateItem -> Between
      Equal = value:PredicateItem -> Equal
      PredicateItem = $( "\\\\" . ) / ~"]"
      Literal = value:String insensitive:"i"? -> Literal
      String = $( "\\"" ^$StringItem* "\\"" )
      StringItem = "\\\\" . / ~"\\""
      Any = "." -> Any
      _ = Space*
      __ = Space+
      Space = WhiteSpace / SingleLineComment / MultiLineComment
      WhiteSpace = [ \\t\\r\\n]+
      SingleLineComment = "//" ~[\\r\\n]*
      MultiLineComment = "/*" ~"*/"* "*/"
    `
    expect(parseGrammar(evaluateGrammar(packratGrammar, input))).toEqual(packratGrammar)
  })
})