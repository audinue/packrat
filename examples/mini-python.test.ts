import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-python.packrat`, 'utf-8')
const parsePy = (source: string) => packrat(grammarText)(source)

describe('mini-python parser', () => {
  const ast = (src: string) => parsePy(src) as any

  test('Program root', () => {
    expect(ast('print(1)')).toMatchObject({ tag: 'Program' })
  })

  test('Print with number', () => {
    expect(ast('print(1)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Print', argument: { tag: 'Number', value: '1' } }]
    })
  })

  test('Print with string', () => {
    expect(ast('print("hello")')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Print', argument: { tag: 'String', value: 'hello' } }]
    })
  })

  test('Print tanpa argument', () => {
    const a = ast('print()')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Print' }]
    })
    expect((a as any).statements[0].argument).toBeNull()
  })

  test('Assignment', () => {
    expect(ast('x = 5')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign', name: { value: 'x' }, expression: { tag: 'Number', value: '5' } }]
    })
  })

  test('Id expression', () => {
    expect(ast('y = x')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Id', value: 'x' } }]
    })
  })

  test('Add expression', () => {
    expect(ast('x = 1 + 2')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Add', left: { value: '1' }, right: { value: '2' } } }]
    })
  })

  test('Arithmetic operators', () => {
    expect(ast('x = 5 - 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Sub' } }] })
    expect(ast('x = 3 * 4')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Mul' } }] })
    expect(ast('x = 10 / 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Div' } }] })
    expect(ast('x = 7 % 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Mod' } }] })
  })

  test('operator precedence', () => {
    expect(ast('x = 1 + 2 * 3')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Add', right: { tag: 'Mul' } } }]
    })
  })

  test('parentheses override precedence', () => {
    expect(ast('x = (1 + 2) * 3')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Mul', left: { tag: 'Add' } } }]
    })
  })

  test('left associative subtraction', () => {
    expect(ast('x = 10 - 3 - 2')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Sub', left: { tag: 'Sub' }, right: { value: '2' } } }]
    })
  })

  test('unary minus', () => {
    expect(ast('x = -5')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Negate', expression: { tag: 'Number', value: '5' } } }]
    })
  })

  test('true literal', () => {
    expect(ast('x = True')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'True' } }]
    })
  })

  test('false literal', () => {
    expect(ast('x = False')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'False' } }]
    })
  })

  test('comparison operators', () => {
    expect(ast('x = 1 == 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Eq' } }] })
    expect(ast('x = 1 != 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Neq' } }] })
    expect(ast('x = 1 < 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Lt' } }] })
    expect(ast('x = 1 > 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Gt' } }] })
    expect(ast('x = 3 <= 3')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Lte' } }] })
    expect(ast('x = 3 >= 4')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Gte' } }] })
  })

  test('IfStmt', () => {
    expect(ast('if True:\n  x = 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', expression: { tag: 'True' }, block: { statements: [{ tag: 'Assign' }] } }]
    })
  })

  test('IfStmt with Else', () => {
    expect(ast('if True:\n  x = 1\nelse:\n  x = 2')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', else: { tag: 'Else', block: { statements: [{ tag: 'Assign' }] } } }]
    })
  })

  test('IfStmt with Elif', () => {
    expect(ast('if x == 1:\n  print("one")\nelif x == 2:\n  print("two")\nelse:\n  print("other")')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', elifs: [{ tag: 'Elif', expression: { tag: 'Eq' } }], else: { tag: 'Else' } }]
    })
  })

  test('IfStmt multiple elifs', () => {
    const a = ast('if x == 1:\n  print("one")\nelif x == 2:\n  print("two")\nelif x == 3:\n  print("three")')
    expect((a as any).statements[0].elifs).toHaveLength(2)
  })

  test('IfStmt tanpa Else', () => {
    const a = ast('if x > 3:\n  print("big")')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If' }]
    })
    expect((a as any).statements[0].else).toBeNull()
  })

  test('While loop', () => {
    expect(ast('while i < 3:\n  print(i)\n  i = i + 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'While', expression: { tag: 'Lt' }, block: { statements: [{ tag: 'Print' }, { tag: 'Assign' }] } }]
    })
  })

  test('nested if', () => {
    const a = ast('if x > 5:\n  if x > 8:\n    print("big")\n  else:\n    print("medium")\nelse:\n  print("small")')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', else: {} }]
    })
  })

  test('multiple statements', () => {
    expect(ast('x = 1\ny = 2\nprint(x + y)')).toMatchObject({
      tag: 'Program',
      statements: [{}, {}, {}]
    })
  })

  test('string concatenation via Add', () => {
    expect(ast('x = "foo" + "bar"')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Add' } }]
    })
  })

  test('syntax error', () => {
    expect(() => ast('x =')).toThrow()
  })

  test('empty input error', () => {
    expect(() => ast('')).toThrow()
  })
})
