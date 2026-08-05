import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-python.packrat`, 'utf-8')
const parsePy = async (source: string) => (await packrat(grammarText))(source)

describe('mini-python parser', () => {
  const ast = async (src: string) => (await parsePy(src)) as any

  test('Program root', async () => {
    expect(await ast('print(1)')).toMatchObject({ tag: 'Program' })
  })

  test('Print with number', async () => {
    expect(await ast('print(1)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Print', argument: { tag: 'Number', value: '1' } }]
    })
  })

  test('Print with string', async () => {
    expect(await ast('print("hello")')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Print', argument: { tag: 'String', value: 'hello' } }]
    })
  })

  test('Print tanpa argument', async () => {
    const a = await ast('print()')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Print' }]
    })
    expect((a as any).statements[0].argument).toBeNull()
  })

  test('Assignment', async () => {
    expect(await ast('x = 5')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign', name: { value: 'x' }, expression: { tag: 'Number', value: '5' } }]
    })
  })

  test('Id expression', async () => {
    expect(await ast('y = x')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Id', value: 'x' } }]
    })
  })

  test('Add expression', async () => {
    expect(await ast('x = 1 + 2')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Add', left: { value: '1' }, right: { value: '2' } } }]
    })
  })

  test('Arithmetic operators', async () => {
    expect(await ast('x = 5 - 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Sub' } }] })
    expect(await ast('x = 3 * 4')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Mul' } }] })
    expect(await ast('x = 10 / 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Div' } }] })
    expect(await ast('x = 7 % 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Mod' } }] })
  })

  test('operator precedence', async () => {
    expect(await ast('x = 1 + 2 * 3')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Add', right: { tag: 'Mul' } } }]
    })
  })

  test('parentheses override precedence', async () => {
    expect(await ast('x = (1 + 2) * 3')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Mul', left: { tag: 'Add' } } }]
    })
  })

  test('left associative subtraction', async () => {
    expect(await ast('x = 10 - 3 - 2')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Sub', left: { tag: 'Sub' }, right: { value: '2' } } }]
    })
  })

  test('unary minus', async () => {
    expect(await ast('x = -5')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Negate', expression: { tag: 'Number', value: '5' } } }]
    })
  })

  test('true literal', async () => {
    expect(await ast('x = True')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'True' } }]
    })
  })

  test('false literal', async () => {
    expect(await ast('x = False')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'False' } }]
    })
  })

  test('comparison operators', async () => {
    expect(await ast('x = 1 == 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Eq' } }] })
    expect(await ast('x = 1 != 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Neq' } }] })
    expect(await ast('x = 1 < 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Lt' } }] })
    expect(await ast('x = 1 > 2')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Gt' } }] })
    expect(await ast('x = 3 <= 3')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Lte' } }] })
    expect(await ast('x = 3 >= 4')).toMatchObject({ tag: 'Program', statements: [{ expression: { tag: 'Gte' } }] })
  })

  test('IfStmt', async () => {
    expect(await ast('if True:\n  x = 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', expression: { tag: 'True' }, block: { statements: [{ tag: 'Assign' }] } }]
    })
  })

  test('IfStmt with Else', async () => {
    expect(await ast('if True:\n  x = 1\nelse:\n  x = 2')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', else: { tag: 'Else', block: { statements: [{ tag: 'Assign' }] } } }]
    })
  })

  test('IfStmt with Elif', async () => {
    expect(await ast('if x == 1:\n  print("one")\nelif x == 2:\n  print("two")\nelse:\n  print("other")')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', elifs: [{ tag: 'Elif', expression: { tag: 'Eq' } }], else: { tag: 'Else' } }]
    })
  })

  test('IfStmt multiple elifs', async () => {
    const a = await ast('if x == 1:\n  print("one")\nelif x == 2:\n  print("two")\nelif x == 3:\n  print("three")')
    expect((a as any).statements[0].elifs).toHaveLength(2)
  })

  test('IfStmt tanpa Else', async () => {
    const a = await ast('if x > 3:\n  print("big")')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If' }]
    })
    expect((a as any).statements[0].else).toBeNull()
  })

  test('While loop', async () => {
    expect(await ast('while i < 3:\n  print(i)\n  i = i + 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'While', expression: { tag: 'Lt' }, block: { statements: [{ tag: 'Print' }, { tag: 'Assign' }] } }]
    })
  })

  test('nested if', async () => {
    const a = await ast('if x > 5:\n  if x > 8:\n    print("big")\n  else:\n    print("medium")\nelse:\n  print("small")')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'If', else: {} }]
    })
  })

  test('multiple statements', async () => {
    expect(await ast('x = 1\ny = 2\nprint(x + y)')).toMatchObject({
      tag: 'Program',
      statements: [{}, {}, {}]
    })
  })

  test('string concatenation via Add', async () => {
    expect(await ast('x = "foo" + "bar"')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Add' } }]
    })
  })

  test('syntax error', async () => {
    await expect(ast('x =')).rejects.toThrow()
  })

  test('empty input error', async () => {
    await expect(ast('')).rejects.toThrow()
  })
})
