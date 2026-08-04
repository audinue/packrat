import { describe, expect, test } from 'bun:test'
import { parsePy } from './mini-python'

describe('mini-python parser', () => {
  const ast = (src: string) => parsePy(src) as any

  test('Program root', () => {
    expect(ast('print(1)')).toMatchObject({ tag: 'Program' })
  })

  test('Print with number', () => {
    expect(ast('print(1)').statements[0]).toMatchObject({
      tag: 'Print', argument: { tag: 'Number', value: '1' }
    })
  })

  test('Print with string', () => {
    expect(ast('print("hello")').statements[0]).toMatchObject({
      tag: 'Print', argument: { tag: 'String', value: 'hello' }
    })
  })

  test('Print tanpa argument', () => {
    const s = ast('print()').statements[0]
    expect(s.tag).toBe('Print')
    expect(s.argument).toBeNull()
  })

  test('Assignment', () => {
    expect(ast('x = 5').statements[0]).toMatchObject({
      tag: 'Assign', name: { value: 'x' }, expression: { tag: 'Number', value: '5' }
    })
  })

  test('Id expression', () => {
    expect(ast('y = x').statements[0]).toMatchObject({
      expression: { tag: 'Id', value: 'x' }
    })
  })

  test('Add expression', () => {
    expect(ast('x = 1 + 2').statements[0].expression).toMatchObject({
      tag: 'Add', left: { value: '1' }, right: { value: '2' }
    })
  })

  test('Arithmetic operators', () => {
    expect(ast('x = 5 - 2').statements[0].expression).toMatchObject({ tag: 'Sub' })
    expect(ast('x = 3 * 4').statements[0].expression).toMatchObject({ tag: 'Mul' })
    expect(ast('x = 10 / 2').statements[0].expression).toMatchObject({ tag: 'Div' })
    expect(ast('x = 7 % 2').statements[0].expression).toMatchObject({ tag: 'Mod' })
  })

  test('operator precedence', () => {
    expect(ast('x = 1 + 2 * 3').statements[0].expression).toMatchObject({
      tag: 'Add', right: { tag: 'Mul' }
    })
  })

  test('parentheses override precedence', () => {
    expect(ast('x = (1 + 2) * 3').statements[0].expression).toMatchObject({
      tag: 'Mul', left: { tag: 'Add' }
    })
  })

  test('left associative subtraction', () => {
    expect(ast('x = 10 - 3 - 2').statements[0].expression).toMatchObject({
      tag: 'Sub', left: { tag: 'Sub' }, right: { value: '2' }
    })
  })

  test('unary minus', () => {
    expect(ast('x = -5').statements[0].expression).toMatchObject({
      tag: 'Negate', expression: { tag: 'Number', value: '5' }
    })
  })

  test('true literal', () => {
    expect(ast('x = True').statements[0].expression).toMatchObject({ tag: 'True' })
  })

  test('false literal', () => {
    expect(ast('x = False').statements[0].expression).toMatchObject({ tag: 'False' })
  })

  test('comparison operators', () => {
    expect(ast('x = 1 == 2').statements[0].expression).toMatchObject({ tag: 'Eq' })
    expect(ast('x = 1 != 2').statements[0].expression).toMatchObject({ tag: 'Neq' })
    expect(ast('x = 1 < 2').statements[0].expression).toMatchObject({ tag: 'Lt' })
    expect(ast('x = 1 > 2').statements[0].expression).toMatchObject({ tag: 'Gt' })
    expect(ast('x = 3 <= 3').statements[0].expression).toMatchObject({ tag: 'Lte' })
    expect(ast('x = 3 >= 4').statements[0].expression).toMatchObject({ tag: 'Gte' })
  })

  test('IfStmt', () => {
    expect(ast('if True:\n  x = 1').statements[0]).toMatchObject({
      tag: 'If', expression: { tag: 'True' }, block: { statements: [{ tag: 'Assign' }] }
    })
  })

  test('IfStmt with Else', () => {
    expect(ast('if True:\n  x = 1\nelse:\n  x = 2').statements[0]).toMatchObject({
      tag: 'If', else: { tag: 'Else', block: { statements: [{ tag: 'Assign' }] } }
    })
  })

  test('IfStmt with Elif', () => {
    expect(ast('if x == 1:\n  print("one")\nelif x == 2:\n  print("two")\nelse:\n  print("other")').statements[0]).toMatchObject({
      tag: 'If',
      elifs: [{ tag: 'Elif', expression: { tag: 'Eq' } }],
      else: { tag: 'Else' }
    })
  })

  test('IfStmt multiple elifs', () => {
    const s = ast('if x == 1:\n  print("one")\nelif x == 2:\n  print("two")\nelif x == 3:\n  print("three")').statements[0]
    expect(s.elifs).toHaveLength(2)
  })

  test('IfStmt tanpa Else', () => {
    const s = ast('if x > 3:\n  print("big")').statements[0]
    expect(s.tag).toBe('If')
    expect(s.else).toBeNull()
  })

  test('While loop', () => {
    expect(ast('while i < 3:\n  print(i)\n  i = i + 1').statements[0]).toMatchObject({
      tag: 'While', expression: { tag: 'Lt' }, block: { statements: [{ tag: 'Print' }, { tag: 'Assign' }] }
    })
  })

  test('nested if', () => {
    const s = ast('if x > 5:\n  if x > 8:\n    print("big")\n  else:\n    print("medium")\nelse:\n  print("small")').statements[0]
    expect(s.tag).toBe('If')
    expect(s.else).toBeDefined()
    expect(s.block.statements[0].tag).toBe('If')
  })

  test('multiple statements', () => {
    expect(ast('x = 1\ny = 2\nprint(x + y)').statements).toHaveLength(3)
  })

  test('string concatenation via Add', () => {
    expect(ast('x = "foo" + "bar"').statements[0].expression).toMatchObject({ tag: 'Add' })
  })

  test('syntax error', () => {
    expect(() => ast('x =')).toThrow()
  })

  test('empty input error', () => {
    expect(() => ast('')).toThrow()
  })
})
