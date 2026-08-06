import { describe, expect, test } from 'bun:test'
import { buildGrammar, createPhpWorker, packrat, packratGrammar, ParseError, parseGrammar, type Ok } from './packrat'
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

describe('buildGrammar', () => {
  test('polymorphic — tiap rule/expression punya parse(context)', () => {
    const grammar = buildGrammar({
      rules: [
        { name: 'A', expression: { tag: 'Literal', value: 'a' } },
      ],
    })
    const rule = grammar.rules.A!
    expect(typeof rule.expression.parse).toBe('function')
    expect(typeof rule.expression.parse).toBe('function')
    expect(rule.expression.parse.length).toBe(1)
  })

  test('Literal, Any, Class, Reference', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Sequence',
            expressions: [
              { tag: 'Literal', value: 'ab' },
              { tag: 'Reference', name: 'Digit' },
              { tag: 'Class', predicates: [{ tag: 'Equal', value: '_' }, { tag: 'Between', min: 'a', max: 'z' }] },
              { tag: 'Any' },
            ],
          },
        },
        {
          name: 'Digit',
          expression: { tag: 'Class', predicates: [{ tag: 'Between', min: '0', max: '9' }] },
        },
      ],
    })
    expect(grammar.parse('ab7c!')).toEqual(['ab', '7', 'c', '!'])
    expect(() => grammar.parse('ab7c!x')).toThrow(ParseError)
    expect(() => grammar.parse('abXc!')).toThrow(ParseError)
  })

  test('Node, Field, Sequence, Choice', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Node',
            name: 'Pair',
            expression: {
              tag: 'Sequence',
              expressions: [
                { tag: 'Field', name: 'left', expression: { tag: 'Literal', value: 'a' } },
                { tag: 'Literal', value: ',' },
                { tag: 'Field', name: 'right', expression: { tag: 'Literal', value: 'b' } },
              ],
            },
          },
        },
        {
          name: 'Alt',
          expression: {
            tag: 'Choice',
            expressions: [
              { tag: 'Literal', value: 'x' },
              { tag: 'Literal', value: 'y' },
            ],
          },
        },
      ],
    })
    expect(grammar.parse('a,b')).toMatchObject({ tag: 'Pair', left: 'a', right: 'b' })
    expect(() => grammar.parse('a,x')).toThrow(ParseError)
    expect(grammar.parse('y', { startRule: 'Alt' })).toBe('y')
    expect(() => grammar.parse('z', { startRule: 'Alt' })).toThrow(ParseError)
  })

  test('Text, Extract, Optional, Zero, One', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Node',
            name: 'Line',
            expression: {
              tag: 'Sequence',
              expressions: [
                { tag: 'Field', name: 'text', expression: { tag: 'Text', expression: { tag: 'Zero', expression: { tag: 'Class', predicates: [{ tag: 'Between', min: 'a', max: 'z' }] } } } },
                { tag: 'Field', name: 'bang', expression: { tag: 'Optional', expression: { tag: 'Literal', value: '!' } } },
              ],
            },
          },
        },
        {
          name: 'Extracted',
          expression: {
            tag: 'Sequence',
            expressions: [
              { tag: 'Literal', value: '(' },
              { tag: 'Extract', expression: { tag: 'One', expression: { tag: 'Literal', value: 'x' } } },
              { tag: 'Literal', value: ')' },
            ],
          },
        },
      ],
    })
    expect(grammar.parse('hello!')).toMatchObject({ tag: 'Line', text: 'hello', bang: '!' })
    expect(grammar.parse('hello')).toMatchObject({ tag: 'Line', text: 'hello', bang: null })
    expect(() => grammar.parse('hello!x')).toThrow(ParseError)
    expect(grammar.parse('(xxx)', { startRule: 'Extracted' })).toEqual(['x', 'x', 'x'])
    expect(grammar.parse('(x)', { startRule: 'Extracted' })).toEqual(['x'])
    expect(() => grammar.parse('()', { startRule: 'Extracted' })).toThrow(ParseError)
  })

  test('Repeat dengan min, max, separator', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Repeat',
            expression: { tag: 'Class', predicates: [{ tag: 'Between', min: '0', max: '9' }] },
            min: 1,
            max: 3,
            separator: { tag: 'Literal', value: '-' },
          },
        },
      ],
    })
    expect(grammar.parse('7')).toEqual(['7'])
    expect(grammar.parse('1-2-3')).toEqual(['1', '2', '3'])
    expect(() => grammar.parse('1-2-3-4')).toThrow(ParseError)
    expect(() => grammar.parse('')).toThrow(ParseError)
  })

  test('Sequence dengan 2 Extract', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Sequence',
            expressions: [
              { tag: 'Literal', value: '(' },
              { tag: 'Extract', expression: { tag: 'Literal', value: 'a' } },
              { tag: 'Literal', value: '|' },
              { tag: 'Extract', expression: { tag: 'Literal', value: 'b' } },
              { tag: 'Literal', value: ')' },
            ],
          },
        },
      ],
    })
    const result = grammar.parse('(a|b)') as Ok[]
    expect(result).toEqual(['a', 'b'])
    expect(result.length).toBe(2)
  })

  test('And, Not, Except', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Sequence',
            expressions: [
              { tag: 'And', expression: { tag: 'Literal', value: 'a' } },
              { tag: 'Not', expression: { tag: 'Literal', value: 'b' } },
              { tag: 'Any' },
            ],
          },
        },
        {
          name: 'Except',
          expression: { tag: 'Except', expression: { tag: 'Literal', value: 'x' } },
        },
      ],
    })
    expect(grammar.parse('a')).toEqual([null, null, 'a'])
    expect(() => grammar.parse('ab')).toThrow(ParseError)
    expect(() => grammar.parse('b')).toThrow(ParseError)
    expect(grammar.parse('q', { startRule: 'Except' })).toBe('q')
    expect(() => grammar.parse('x', { startRule: 'Except' })).toThrow(ParseError)
  })

  test('Indent', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'Start',
          expression: {
            tag: 'Node',
            name: 'Block',
            expression: {
              tag: 'Sequence',
              expressions: [
                { tag: 'Literal', value: 'a' },
                {
                  tag: 'Indent',
                  expression: {
                    tag: 'Sequence',
                    expressions: [
                      { tag: 'Literal', value: 'b' },
                      {
                        tag: 'Indent',
                        expression: { tag: 'Literal', value: 'c' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      ],
    })
    expect(grammar.parse('a\n  b\n    c')).toMatchObject({ tag: 'Block' })
    expect(grammar.parse('a\n\tb\n\t\tc')).toMatchObject({ tag: 'Block' })
    expect(() => grammar.parse('a\nb\n    c')).toThrow(ParseError)
    expect(() => grammar.parse('a\n  b\n     c')).toThrow(ParseError)
  })

  test('Left recursion (growing the seed)', () => {
    const grammar = buildGrammar({
      rules: [
        {
          name: 'E',
          expression: {
            tag: 'Choice',
            expressions: [
              {
                tag: 'Node',
                name: 'Minus',
                expression: {
                  tag: 'Sequence',
                  expressions: [
                    { tag: 'Field', name: 'left', expression: { tag: 'Reference', name: 'E' } },
                    { tag: 'Literal', value: '-' },
                    { tag: 'Field', name: 'right', expression: { tag: 'Reference', name: 'D' } },
                  ],
                },
              },
              { tag: 'Reference', name: 'D' },
            ],
          },
        },
        {
          name: 'D',
          expression: {
            tag: 'Node',
            name: 'Digit',
            expression: {
              tag: 'Field',
              name: 'value',
              expression: {
                tag: 'Text',
                expression: {
                  tag: 'One',
                  expression: { tag: 'Class', predicates: [{ tag: 'Between', min: '0', max: '9' }] },
                },
              },
            },
          },
        },
      ],
    })
    expect(grammar.parse('9-3-1-2', { startRule: 'E' })).toMatchObject({
      tag: 'Minus',
      left: {
        tag: 'Minus',
        left: {
          tag: 'Minus',
          left: { tag: 'Digit', value: '9' },
          right: { tag: 'Digit', value: '3' },
        },
        right: { tag: 'Digit', value: '1' },
      },
      right: { tag: 'Digit', value: '2' },
    })
    expect(grammar.parse('9', { startRule: 'E' })).toMatchObject({ tag: 'Digit', value: '9' })
  })

  test('Error punya lokasi yang bener', () => {
    const grammar = buildGrammar({
      rules: [
        { name: 'Start', expression: { tag: 'Literal', value: 'a' } },
      ],
    })
    try {
      grammar.parse('bb')
      throw new Error('should not reach')
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError)
      if (error instanceof ParseError) {
        expect(error.message).toContain('Unexpected "b"')
        expect(error.location).toMatchObject({ line: 1, column: 1, file: '<unknown>' })
      }
    }
    try {
      grammar.parse('a\nb')
      throw new Error('should not reach')
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError)
      if (error instanceof ParseError) {
        expect(error.location).toMatchObject({ line: 1, column: 2 })
      }
    }
  })

  test('Self host', () => {
    const input = readFileSync(`${import.meta.dir}/packrat.packrat`, 'utf-8')
    const grammar = buildGrammar(packratGrammar)
    expect(parseGrammar(grammar.parse(input))).toEqual(packratGrammar)
  })
})

describe('createPhpWorker', () => {
  test('eval mengembalikan hasil echo', async () => {
    const worker = createPhpWorker()
    const result = await worker.eval(`<?php echo json_encode([1, 2, 3]);`)
    expect(JSON.parse(result)).toEqual([1, 2, 3])
    worker.close()
  })

  test('eval bisa dipanggil berkali-kali', async () => {
    const worker = createPhpWorker()
    expect(await worker.eval(`<?php echo 'a';`)).toBe('a')
    expect(await worker.eval(`<?php echo 'b';`)).toBe('b')
    worker.close()
  })

  test('eval reject pas error', async () => {
    const worker = createPhpWorker()
    await expect(worker.eval(`<?php throw new RuntimeException('boom');`)).rejects.toThrow('boom')
    expect(await worker.eval(`<?php echo 'still alive';`)).toBe('still alive')
    worker.close()
  })
})
