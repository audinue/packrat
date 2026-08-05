import { expect, test, describe } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-golang.packrat`, 'utf-8')
const parseGo = (source: string) => packrat(grammarText)(source.trim() + '\n')

describe('mini-golang parser', () => {
  const ast = (src: string) => parseGo(src) as any

  test('Program root', () => {
    expect(ast('x := 42')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ShortVarDecl', name: 'x', value: { tag: 'IntLit', value: '42' } }]
    })
  })

  test('VarDecl dengan type int', () => {
    expect(ast('var x int = 10')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', name: 'x', type: 'int', value: { tag: 'IntLit', value: '10' } }]
    })
  })

  test('VarDecl dengan type string', () => {
    expect(ast('var name string = "hello"')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', type: 'string' }]
    })
  })

  test('BoolLit true', () => {
    expect(ast('ok := true')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ShortVarDecl', value: { tag: 'BoolLit', value: 'true' } }]
    })
  })

  test('BoolLit false', () => {
    expect(ast('ok := false')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'BoolLit', value: 'false' } }]
    })
  })

  test('Add expression', () => {
    expect(ast('x := 3 + 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { tag: 'IntLit', value: '3' }, right: { tag: 'IntLit', value: '4' } } }]
    })
  })

  test('Sub expression', () => {
    expect(ast('x := 10 - 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { value: '10' }, right: { value: '3' } } }]
    })
  })

  test('Mul expression', () => {
    expect(ast('x := 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { value: '3' }, right: { value: '4' } } }]
    })
  })

  test('Div expression', () => {
    expect(ast('x := 10 / 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Div', left: { value: '10' }, right: { value: '3' } } }]
    })
  })

  test('Mod expression', () => {
    expect(ast('x := 10 % 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mod' } }]
    })
  })

  test('operator precedence (Add + Mul)', () => {
    expect(ast('x := 2 + 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { value: '2' }, right: { tag: 'Mul', left: { value: '3' }, right: { value: '4' } } } }]
    })
  })

  test('parentheses override precedence', () => {
    expect(ast('x := (2 + 3) * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' }, right: { value: '4' } } }]
    })
  })

  test('left associative subtraction', () => {
    expect(ast('x := 10 - 3 - 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { tag: 'Sub', left: { value: '10' }, right: { value: '3' } }, right: { value: '2' } } }]
    })
  })

  test('unary minus', () => {
    expect(ast('x := -5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '-', expr: { tag: 'IntLit', value: '5' } } }]
    })
  })

  test('equality expression', () => {
    expect(ast('x := 3 == 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Eq', left: { value: '3' }, right: { value: '3' } } }]
    })
  })

  test('inequality expression', () => {
    expect(ast('x := 3 != 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Neq' } }]
    })
  })

  test('less than', () => {
    expect(ast('x := 3 < 5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Lt' } }]
    })
  })

  test('greater than', () => {
    expect(ast('x := 5 > 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Gt' } }]
    })
  })

  test('less than or equal', () => {
    expect(ast('x := 3 <= 5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Lte' } }]
    })
  })

  test('greater than or equal', () => {
    expect(ast('x := 5 >= 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Gte' } }]
    })
  })

  test('logical and', () => {
    expect(ast('x := true && false')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'And', left: { value: 'true' }, right: { value: 'false' } } }]
    })
  })

  test('logical or', () => {
    expect(ast('x := false || true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Or' } }]
    })
  })

  test('logical not', () => {
    expect(ast('x := !true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '!', expr: { value: 'true' } } }]
    })
  })

  test('IfStmt', () => {
    expect(ast('if true { x := 1 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'BoolLit' }, body: [{ tag: 'ShortVarDecl' }] }]
    })
  })

  test('IfStmt/ElseClause', () => {
    expect(ast('if false { x := 1 } else { x := 2 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', else: { tag: 'ElseClause', body: [{ value: { value: '2' } }] } }]
    })
  })

  test('ForStmt with condition', () => {
    expect(ast('for i < 3 { println(i) }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ForStmt', condition: { tag: 'Lt' } }]
    })
  })

  test('ForStmt without condition (infinite loop)', () => {
    expect(ast('for { println("forever") }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ForStmt', condition: null }]
    })
  })

  test('FuncDecl basic', () => {
    expect(ast('func greet() { println("hello") }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'greet' }]
    })
  })

  test('FuncDecl with params', () => {
    expect(ast('func add(a: int, b: int) { return a + b }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'add', params: { tag: 'ParamList', params: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }] } }]
    })
  })

  test('FuncDecl single param', () => {
    expect(ast('func double(x: int) { return x * 2 }')).toMatchObject({
      tag: 'Program',
      statements: [{ params: { tag: 'ParamList', params: [{ name: 'x' }] } }]
    })
  })

  test('ReturnStmt', () => {
    expect(ast('func f() { return 42 }')).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'ReturnStmt', value: { tag: 'IntLit', value: '42' } }] }]
    })
  })

  test('ReturnStmt tanpa value', () => {
    const a = ast('func f() { return }')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'ReturnStmt' }] }]
    })
    expect((a as any).statements[0].body[0].value).toBeNull()
  })

  test('CallExpr', () => {
    expect(ast('greet()')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expr: { tag: 'CallExpr', name: 'greet' } }]
    })
  })

  test('CallExpr with args', () => {
    expect(ast('add(3, 4)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expr: { tag: 'CallExpr', name: 'add', args: { tag: 'ArgList', args: [{ value: '3' }, { value: '4' }] } } }]
    })
  })

  test('CallExpr single arg', () => {
    expect(ast('println(x)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expr: { tag: 'CallExpr', name: 'println', args: { tag: 'ArgList', args: [{ tag: 'Ident', name: 'x' }] } } }]
    })
  })

  test('Ident expression', () => {
    expect(ast('x := y')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Ident', name: 'y' } }]
    })
  })

  test('SliceLit', () => {
    expect(ast('arr := [1, 2, 3]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'SliceLit', elements: { tag: 'ArgList', args: [{ value: '1' }, { value: '2' }, { value: '3' }] } } }]
    })
  })

  test('SliceLit empty', () => {
    expect(ast('arr := []')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'SliceLit', elements: null } }]
    })
  })

  test('IndexExpr', () => {
    expect(ast('x := arr[0]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'IndexExpr', expr: { tag: 'Ident', name: 'arr' }, index: { tag: 'IntLit', value: '0' } } }]
    })
  })

  test('AssignStmt', () => {
    expect(ast('i = i + 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'AssignStmt', name: 'i', value: { tag: 'Add' } }]
    })
  })

  test('multiple statements', () => {
    expect(ast('x := 1\ny := 2\nz := x + y')).toMatchObject({
      tag: 'Program',
      statements: [{ name: 'x' }, { name: 'y' }, { name: 'z' }]
    })
  })

  test('complex nested expression', () => {
    expect(ast('x := (a + b) * (c - d)')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' }, right: { tag: 'Sub' } } }]
    })
  })

  test('syntax error', () => {
    expect(() => ast('x :=')).toThrow()
  })
})
