import { describe, expect, test } from 'bun:test'
import { packrat, packratGrammar, parseGrammar } from './packrat'
import { readFileSync } from 'node:fs'

describe('packrat', () => {
  test('Literal', async () => {
    const parse = await packrat`
      Any = .
    `
    expect(await parse('a')).toBe('a')
    expect(await parse('0')).toBe('0')
    await expect(parse('')).rejects.toThrow()
    await expect(parse('aa')).rejects.toThrow()
  })

  test('Literal', async () => {
    const parse = await packrat`
      Literal = "abc"
    `
    expect(await parse('abc')).toBe('abc')
    await expect(parse('abd')).rejects.toThrow()
    await expect(parse('')).rejects.toThrow()
  })

  test('Literal insensitive', async () => {
    const parse = await packrat`
      Literal = "abc"i
    `
    expect(await parse('abc')).toBe('abc')
    expect(await parse('ABC')).toBe('ABC')
    expect(await parse('AbC')).toBe('AbC')
    await expect(parse('abd')).rejects.toThrow()
  })

  test('Class', async () => {
    const parse = await packrat`
      Class = [a-z]
    `
    expect(await parse('a')).toBe('a')
    expect(await parse('z')).toBe('z')
    await expect(parse('A')).rejects.toThrow()
    await expect(parse('0')).rejects.toThrow()
  })

  test('Class negation', async () => {
    const parse = await packrat`
      Class = [^a-z]
    `
    expect(await parse('A')).toBe('A')
    expect(await parse('0')).toBe('0')
    await expect(parse('a')).rejects.toThrow()
  })

  test('Class equal predicate', async () => {
    const parse = await packrat`
      Class = [ab_]
    `
    expect(await parse('a')).toBe('a')
    expect(await parse('b')).toBe('b')
    expect(await parse('_')).toBe('_')
    await expect(parse('c')).rejects.toThrow()
  })

  test('Class insensitive', async () => {
    const parse = await packrat`
      Class = [a-z]i
    `
    expect(await parse('a')).toBe('a')
    expect(await parse('A')).toBe('A')
    await expect(parse('0')).rejects.toThrow()
  })

  test('Reference', async () => {
    const parse = await packrat`
      A = B
      B = "x"
    `
    expect(await parse('x')).toBe('x')
    await expect(parse('y')).rejects.toThrow()
  })

  test('Choice', async () => {
    const parse = await packrat`
      Choice = "a" / "b"
    `
    expect(await parse('a')).toBe('a')
    expect(await parse('b')).toBe('b')
    await expect(parse('c')).rejects.toThrow()
  })

  test('Sequence', async () => {
    const parse = await packrat`
      Sequence = "a" "b"
    `
    expect(await parse('ab')).toEqual(['a', 'b'])
    await expect(parse('a')).rejects.toThrow()
    await expect(parse('ba')).rejects.toThrow()
  })

  test('Node', async () => {
    const parse = await packrat`
      Node = a:"a" b:"b" -> Node
    `
    const result = await parse('ab')
    expect(result).toMatchObject({
      tag: 'Node',
      a: 'a',
      b: 'b',
      location: { file: '<unknown>', line: 1, column: 1 },
    })
  })

  test('Field', async () => {
    const parse = await packrat`
      Field = value:"a" -> Field
    `
    const result = await parse('a')
    expect(result).toMatchObject({ tag: 'Field', value: 'a' })
  })

  test('Extract single', async () => {
    const parse = await packrat`
      Extract = "(" ^"a" ")"
    `
    expect(await parse('(a)')).toBe('a')
  })

  test('Extract multiple', async () => {
    const parse = await packrat`
      Extract = ^"a" "b" ^"c"
    `
    expect(await parse('abc')).toEqual(['a', 'c'])
  })

  test('Text', async () => {
    const parse = await packrat`
      Text = $( "a" "b" "c" )
    `
    expect(await parse('abc')).toBe('abc')
  })

  test('Except', async () => {
    const parse = await packrat`
      Except = ~"a"
    `
    expect(await parse('b')).toBe('b')
    await expect(parse('a')).rejects.toThrow()
    await expect(parse('')).rejects.toThrow()
  })

  test('And', async () => {
    const parse = await packrat`
      And = &"a" "a"
    `
    expect(await parse('a')).toEqual([null, 'a'])
    await expect(parse('b')).rejects.toThrow()
  })

  test('Not', async () => {
    const parse = await packrat`
      Not = !"a" .
    `
    expect(await parse('b')).toEqual([null, 'b'])
    await expect(parse('a')).rejects.toThrow()
  })

  test('Optional', async () => {
    const parse = await packrat`
      Optional = "a"?
    `
    expect(await parse('a')).toBe('a')
    expect(await parse('')).toBe(null)
  })

  test('Zero', async () => {
    const parse = await packrat`
      Zero = "a"*
    `
    expect(await parse('')).toEqual([])
    expect(await parse('aaa')).toEqual(['a', 'a', 'a'])
  })

  test('One', async () => {
    const parse = await packrat`
      One = "a"+
    `
    expect(await parse('a')).toEqual(['a'])
    expect(await parse('aaa')).toEqual(['a', 'a', 'a'])
    await expect(parse('')).rejects.toThrow()
  })

  test('Repeat min max', async () => {
    const parse = await packrat`
      Repeat = "a"{2,3}
    `
    expect(await parse('aa')).toEqual(['a', 'a'])
    expect(await parse('aaa')).toEqual(['a', 'a', 'a'])
    await expect(parse('a')).rejects.toThrow()
    await expect(parse('aaaa')).rejects.toThrow()
  })

  test('Repeat min only', async () => {
    const parse = await packrat`
      Repeat = "a"{2}
    `
    expect(await parse('aa')).toEqual(['a', 'a'])
    expect(await parse('aaa')).toEqual(['a', 'a', 'a'])
    await expect(parse('a')).rejects.toThrow()
  })

  test('Repeat separator', async () => {
    const parse = await packrat`
      Repeat = "a"{2,3;","}
    `
    expect(await parse('a,a')).toEqual(['a', 'a'])
    expect(await parse('a,a,a')).toEqual(['a', 'a', 'a'])
    await expect(parse('a')).rejects.toThrow()
    await expect(parse('aa')).rejects.toThrow()
  })

  test('Indent', async () => {
    const parse = await packrat`
      Indent = >> "a" << -> Indent
    `
    expect(await parse('\n  a')).toMatchObject({ tag: 'Indent' })
    await expect(parse('a')).rejects.toThrow()
    await expect(parse('\na')).rejects.toThrow()
  })

  test('Indent nested deeper', async () => {
    const parse = await packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    const result = await parse('a\n  b')
    expect(result).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent nested same or lower fails', async () => {
    const parse = await packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    await expect(parse('a\nb')).rejects.toThrow()
  })

  test('Indent auto detect 2 spaces', async () => {
    const parse = await packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(await parse('a\n  b')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent auto detect 4 spaces', async () => {
    const parse = await packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(await parse('a\n    b')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent auto detect tab', async () => {
    const parse = await packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(await parse('a\n\tb')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Indent nested 2 levels with 2 spaces unit', async () => {
    const parse = await packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    const result = await parse('a\n  b\n    c')
    expect(result).toMatchObject({ tag: 'Block' })
  })

  test('Indent nested 2 levels with 4 spaces unit', async () => {
    const parse = await packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    const result = await parse('a\n    b\n        c')
    expect(result).toMatchObject({ tag: 'Block' })
  })

  test('Indent nested 2 levels with tab unit', async () => {
    const parse = await packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    const result = await parse('a\n\tb\n\t\tc')
    expect(result).toMatchObject({ tag: 'Block' })
  })

  test('Indent fails on non multiple', async () => {
    const parse = await packrat`
      Block = "a" >> "b" >> "c" << << -> Block
    `
    await expect(parse('a\n  b\n     c')).rejects.toThrow()
    expect(await parse('a\n  b\n    c')).toMatchObject({ tag: 'Block' })
  })

  test('Indent with blank lines', async () => {
    const parse = await packrat`
      Outer = "a" inner:>> "b" << -> Outer
    `
    expect(await parse('a\n\n  b')).toMatchObject({ tag: 'Outer', inner: 'b' })
  })

  test('Self host', async () => {
    const input = readFileSync(`${import.meta.dir}/packrat.packrat`, 'utf-8')
    const parse = await packrat(input)
    expect(parseGrammar(await parse(input))).toEqual(packratGrammar)
  })
})
