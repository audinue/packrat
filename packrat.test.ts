import { describe, expect, test } from 'bun:test'
import { packrat, packratGrammar, parseGrammar } from './packrat'
import { readFileSync } from 'node:fs'

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
    const result = parse('ab')
    expect(result).toMatchObject({
      tag: 'Node',
      a: 'a',
      b: 'b',
      location: { file: '<unknown>', line: 1, column: 1 },
    })
  })

  test('Field', () => {
    const parse = packrat`
      Field = value:"a" -> Field
    `
    const result = parse('a')
    expect(result).toMatchObject({ tag: 'Field', value: 'a' })
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
    expect(parse('\n  a')).toMatchObject({ tag: 'Indent' })
    expect(() => parse('a')).toThrow()
    expect(() => parse('\na')).toThrow()
  })

  test('Indent nested deeper', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    const result = parse('a\n  b')
    expect(result).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent nested same or lower fails', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(() => parse('a\nb')).toThrow()
  })

  test('Indent auto detect 2 spaces', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(parse('a\n  b')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent auto detect 4 spaces', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(parse('a\n    b')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent auto detect tab', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(parse('a\n\tb')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent nested 2 levels with 2 spaces unit', () => {
    const parse = packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    const result = parse('a\n  b\n    c')
    expect(result).toMatchObject({ tag: 'Block' })
  })

  test('Indent nested 2 levels with 4 spaces unit', () => {
    const parse = packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    const result = parse('a\n    b\n        c')
    expect(result).toMatchObject({ tag: 'Block' })
  })

  test('Indent nested 2 levels with tab unit', () => {
    const parse = packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    const result = parse('a\n\tb\n\t\tc')
    expect(result).toMatchObject({ tag: 'Block' })
  })

  test('Indent fails on non multiple', () => {
    const parse = packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    expect(() => parse('a\n  b\n     c')).toThrow()
    expect(parse('a\n  b\n    c')).toMatchObject({ tag: 'Block' })
  })

  test('Indent with blank lines', () => {
    const parse = packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(parse('a\n\n  b')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Self host', () => {
    const input = readFileSync(`${import.meta.dir}/packrat.packrat`, 'utf-8')
    const parse = packrat(input)
    expect(parseGrammar(parse(input))).toEqual(packratGrammar)
  })
})
