import { expect, test, describe } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-golang.packrat`, 'utf-8')
const parseGo = async (source: string) => (await packrat(grammarText))(source.trim() + '\n')

describe('mini-golang parser', () => {
  const ast = async (src: string) => (await parseGo(src)) as any

  test('Program root', async () => {
    expect(await ast('x := 42')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ShortVarDecl', name: 'x', value: { tag: 'IntLit', value: '42' } }]
    })
  })

  test('VarDecl dengan type int', async () => {
    expect(await ast('var x int = 10')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', name: 'x', type: 'int', value: { tag: 'IntLit', value: '10' } }]
    })
  })

  test('VarDecl dengan type string', async () => {
    expect(await ast('var name string = "hello"')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', type: 'string' }]
    })
  })

  test('BoolLit true', async () => {
    expect(await ast('ok := true')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ShortVarDecl', value: { tag: 'BoolLit', value: 'true' } }]
    })
  })

  test('BoolLit false', async () => {
    expect(await ast('ok := false')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'BoolLit', value: 'false' } }]
    })
  })

  test('Add expression', async () => {
    expect(await ast('x := 3 + 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { tag: 'IntLit', value: '3' }, right: { tag: 'IntLit', value: '4' } } }]
    })
  })

  test('Sub expression', async () => {
    expect(await ast('x := 10 - 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { value: '10' }, right: { value: '3' } } }]
    })
  })

  test('Mul expression', async () => {
    expect(await ast('x := 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { value: '3' }, right: { value: '4' } } }]
    })
  })

  test('Div expression', async () => {
    expect(await ast('x := 10 / 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Div', left: { value: '10' }, right: { value: '3' } } }]
    })
  })

  test('Mod expression', async () => {
    expect(await ast('x := 10 % 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mod' } }]
    })
  })

  test('operator precedence (Add + Mul)', async () => {
    expect(await ast('x := 2 + 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { value: '2' }, right: { tag: 'Mul', left: { value: '3' }, right: { value: '4' } } } }]
    })
  })

  test('parentheses override precedence', async () => {
    expect(await ast('x := (2 + 3) * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' }, right: { value: '4' } } }]
    })
  })

  test('left associative subtraction', async () => {
    expect(await ast('x := 10 - 3 - 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { tag: 'Sub', left: { value: '10' }, right: { value: '3' } }, right: { value: '2' } } }]
    })
  })

  test('unary minus', async () => {
    expect(await ast('x := -5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '-', expr: { tag: 'IntLit', value: '5' } } }]
    })
  })

  test('equality expression', async () => {
    expect(await ast('x := 3 == 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Eq', left: { value: '3' }, right: { value: '3' } } }]
    })
  })

  test('inequality expression', async () => {
    expect(await ast('x := 3 != 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Neq' } }]
    })
  })

  test('less than', async () => {
    expect(await ast('x := 3 < 5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Lt' } }]
    })
  })

  test('greater than', async () => {
    expect(await ast('x := 5 > 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Gt' } }]
    })
  })

  test('less than or equal', async () => {
    expect(await ast('x := 3 <= 5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Lte' } }]
    })
  })

  test('greater than or equal', async () => {
    expect(await ast('x := 5 >= 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Gte' } }]
    })
  })

  test('logical and', async () => {
    expect(await ast('x := true && false')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'And', left: { value: 'true' }, right: { value: 'false' } } }]
    })
  })

  test('logical or', async () => {
    expect(await ast('x := false || true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Or' } }]
    })
  })

  test('logical not', async () => {
    expect(await ast('x := !true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '!', expr: { value: 'true' } } }]
    })
  })

  test('IfStmt', async () => {
    expect(await ast('if true { x := 1 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'BoolLit' }, body: [{ tag: 'ShortVarDecl' }] }]
    })
  })

  test('IfStmt/ElseClause', async () => {
    expect(await ast('if false { x := 1 } else { x := 2 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', else: { tag: 'ElseClause', body: [{ value: { value: '2' } }] } }]
    })
  })

  test('ForStmt with condition', async () => {
    expect(await ast('for i < 3 { println(i) }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ForStmt', condition: { tag: 'Lt' } }]
    })
  })

  test('ForStmt without condition (infinite loop)', async () => {
    expect(await ast('for { println("forever") }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ForStmt', condition: null }]
    })
  })

  test('FuncDecl basic', async () => {
    expect(await ast('func greet() { println("hello") }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'greet' }]
    })
  })

  test('FuncDecl with params', async () => {
    expect(await ast('func add(a: int, b: int) { return a + b }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'add', params: { tag: 'ParamList', params: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }] } }]
    })
  })

  test('FuncDecl single param', async () => {
    expect(await ast('func double(x: int) { return x * 2 }')).toMatchObject({
      tag: 'Program',
      statements: [{ params: { tag: 'ParamList', params: [{ name: 'x' }] } }]
    })
  })

  test('ReturnStmt', async () => {
    expect(await ast('func f() { return 42 }')).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'ReturnStmt', value: { tag: 'IntLit', value: '42' } }] }]
    })
  })

  test('ReturnStmt tanpa value', async () => {
    const a = await ast('func f() { return }')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'ReturnStmt' }] }]
    })
    expect((a as any).statements[0].body[0].value).toBeNull()
  })

  test('CallExpr', async () => {
    expect(await ast('greet()')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expr: { tag: 'CallExpr', name: 'greet' } }]
    })
  })

  test('CallExpr with args', async () => {
    expect(await ast('add(3, 4)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expr: { tag: 'CallExpr', name: 'add', args: { tag: 'ArgList', args: [{ value: '3' }, { value: '4' }] } } }]
    })
  })

  test('CallExpr single arg', async () => {
    expect(await ast('println(x)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expr: { tag: 'CallExpr', name: 'println', args: { tag: 'ArgList', args: [{ tag: 'Ident', name: 'x' }] } } }]
    })
  })

  test('Ident expression', async () => {
    expect(await ast('x := y')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Ident', name: 'y' } }]
    })
  })

  test('SliceLit', async () => {
    expect(await ast('arr := [1, 2, 3]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'SliceLit', elements: { tag: 'ArgList', args: [{ value: '1' }, { value: '2' }, { value: '3' }] } } }]
    })
  })

  test('SliceLit empty', async () => {
    expect(await ast('arr := []')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'SliceLit', elements: null } }]
    })
  })

  test('IndexExpr', async () => {
    expect(await ast('x := arr[0]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'IndexExpr', expr: { tag: 'Ident', name: 'arr' }, index: { tag: 'IntLit', value: '0' } } }]
    })
  })

  test('AssignStmt', async () => {
    expect(await ast('i = i + 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'AssignStmt', name: 'i', value: { tag: 'Add' } }]
    })
  })

  test('multiple statements', async () => {
    expect(await ast('x := 1\ny := 2\nz := x + y')).toMatchObject({
      tag: 'Program',
      statements: [{ name: 'x' }, { name: 'y' }, { name: 'z' }]
    })
  })

  test('complex nested expression', async () => {
    expect(await ast('x := (a + b) * (c - d)')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' }, right: { tag: 'Sub' } } }]
    })
  })

  test('syntax error', async () => {
    await expect(ast('x :=')).rejects.toThrow()
  })
})
