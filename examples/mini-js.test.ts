import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-js.packrat`, 'utf-8')
const parseJs = (source: string) => packrat(grammarText)(source.trim() + '\n')

describe('mini-js parser', () => {
  const ast = (src: string) => parseJs(src) as any

  test('Program root', () => {
    expect(ast('const x = 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl' }]
    })
  })

  test('VarDecl const', () => {
    expect(ast('const x = 42')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', keyword: 'const', name: 'x', value: { tag: 'Chained', expression: { tag: 'Int', value: '42' } } }]
    })
  })

  test('VarDecl let', () => {
    expect(ast('let y = "hello"')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', keyword: 'let', name: 'y', value: { tag: 'Chained', expression: { tag: 'String' } } }]
    })
  })

  test('AssignStmt', () => {
    expect(ast('x = 5')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'AssignStmt', name: 'x', value: { tag: 'Chained', expression: { tag: 'Int', value: '5' } } }]
    })
  })

  test('IfStmt with Gt condition (binary op, no Chained wrap)', () => {
    expect(ast('if (x > 3) { const y = 1 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'Gt', left: { tag: 'Chained' } }, body: [{ tag: 'VarDecl' }] }]
    })
  })

  test('IfStmt with Bool condition (Primary, Chained wrapped)', () => {
    expect(ast('if (false) { const a = 1 } else { const b = 2 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'Chained', expression: { tag: 'Bool' } }, else: { tag: 'Else' } }]
    })
  })

  test('While loop', () => {
    expect(ast('while (n > 0) { n = n - 1 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'While', condition: { tag: 'Gt', left: { tag: 'Chained' } } }]
    })
  })

  test('For loop', () => {
    expect(ast('for (let i = 0; i < 3; i++) { console.log(i) }')).toMatchObject({
      tag: 'Program',
      statements: [{
        tag: 'For',
        init: { tag: 'VarDecl', name: 'i' },
        condition: { tag: 'Lt' },
        update: { tag: 'Chained', expression: { tag: 'Ident', name: 'i' }, tail: [{ tag: 'Postfix', op: '++' }] }
      }]
    })
  })

  test('For loop tanpa init', () => {
    const a = ast('for (; i < 2; i++) { console.log(i) }')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ condition: { tag: 'Lt' } }]
    })
    expect((a as any).statements[0].init).toBeNull()
  })

  test('FuncDecl basic', () => {
    expect(ast('function greet() { return "hello" }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'greet' }]
    })
  })

  test('FuncDecl with params', () => {
    expect(ast('function add(a, b) { return a + b }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', params: { tag: 'ParamList', params: [{ tag: 'Param', name: 'a' }, { tag: 'Param', name: 'b' }] } }]
    })
  })

  test('FuncDecl with rest param', () => {
    expect(ast('function sum(...nums) { return nums }')).toMatchObject({
      tag: 'Program',
      statements: [{ params: { tag: 'ParamList', params: { tag: 'RestParam', name: 'nums' } } }]
    })
  })

  test('Return with value', () => {
    expect(ast('return 42')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Return', value: { tag: 'Chained', expression: { tag: 'Int', value: '42' } } }]
    })
  })

  test('Return tanpa value', () => {
    const a = ast('return')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Return' }]
    })
    expect((a as any).statements[0].value).toBeNull()
  })

  test('ExprStmt wraps in Chained', () => {
    expect(ast('console.log(1)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'Chained', expression: { tag: 'CallExpr' } } }]
    })
  })

  test('CallExpr console.log', () => {
    expect(ast('console.log(1, 2, "tiga")')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', callee: 'console.log' } } }]
    })
  })

  test('CallExpr nama biasa', () => {
    expect(ast('tambah(2, 3)')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', name: 'tambah' } } }]
    })
  })

  test('TemplateString dasar', () => {
    expect(ast('console.log(`halo`)')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', args: { tag: 'ArgList', args: { tag: 'Chained', expression: { tag: 'TemplateString' } } } } } }]
    })
  })

  test('TemplateString with interpolation', () => {
    expect(ast('console.log(`1 + 2 = ${1 + 2}`)')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', args: { tag: 'ArgList', args: { tag: 'Chained', expression: { tag: 'TemplateString' } } } } } }]
    })
  })

  test('TemplateString multi interpolation', () => {
    const a = ast('console.log(`${a} + ${b} = ${a + b}`)')
    const tmpl = (a as any).statements[0].expression.expression.args.args.expression
    expect(tmpl.parts.length).toBeGreaterThanOrEqual(5)
  })

  test('TaggedTemplate', () => {
    expect(ast('greet`halo ${nama}`')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'TaggedTemplate', name: 'greet', template: { tag: 'TemplateString' } } } }]
    })
  })

  test('Int literal', () => {
    expect(ast('const x = 42')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Int', value: '42' } } }]
    })
  })

  test('Float literal', () => {
    expect(ast('const x = 3.14')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Float', value: '3.14' } } }]
    })
  })

  test('String literal', () => {
    expect(ast('const x = "hello"')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'String' } } }]
    })
    expect(ast("const x = 'halo'")).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'String' } } }]
    })
  })

  test('Bool literal', () => {
    expect(ast('const x = true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Bool', value: 'true' } } }]
    })
  })

  test('Null literal', () => {
    expect(ast('const x = null')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Null' } } }]
    })
  })

  test('Ident expression', () => {
    expect(ast('const y = x')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Ident', name: 'x' } } }]
    })
  })

  test('Add expression (binary op, no Chained wrap at top)', () => {
    expect(ast('const x = 3 + 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { tag: 'Chained', expression: { tag: 'Int', value: '3' } }, right: { tag: 'Chained', expression: { tag: 'Int', value: '4' } } } }]
    })
  })

  test('Sub expression', () => {
    expect(ast('const x = 10 - 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub' } }]
    })
  })

  test('Mul expression', () => {
    expect(ast('const x = 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul' } }]
    })
  })

  test('Div expression', () => {
    expect(ast('const x = 10 / 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Div' } }]
    })
  })

  test('Mod expression', () => {
    expect(ast('const x = 7 % 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mod' } }]
    })
  })

  test('left associative subtraction', () => {
    expect(ast('const x = 10 - 3 - 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { tag: 'Sub' }, right: { tag: 'Chained', expression: { tag: 'Int', value: '2' } } } }]
    })
  })

  test('unary minus produces Unary node', () => {
    expect(ast('const x = -5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Unary', op: '-', expression: { tag: 'Chained', expression: { tag: 'Int', value: '5' } } } }]
    })
  })

  test('unary not produces Unary node', () => {
    expect(ast('const x = !true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Unary', op: '!', expression: { tag: 'Chained', expression: { tag: 'Bool', value: 'true' } } } }]
    })
  })

  test('equality', () => {
    expect(ast('const x = 3 === 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'StrictEq', left: { tag: 'Chained', expression: { tag: 'Int', value: '3' } }, right: { tag: 'Chained', expression: { tag: 'Int', value: '3' } } } }]
    })
  })

  test('loose equality', () => {
    expect(ast('const x = 3 == 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Eq' } }]
    })
  })

  test('inequality', () => {
    expect(ast('const x = 3 !== 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'StrictNeq' } }]
    })
  })

  test('comparison operators', () => {
    expect(ast('const x = 3 < 5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Lt' } }]
    })
    expect(ast('const x = 5 > 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Gt' } }]
    })
  })

  test('logical and', () => {
    expect(ast('const x = true && false')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'And', left: { tag: 'Chained', expression: { tag: 'Bool', value: 'true' } }, right: { tag: 'Chained', expression: { tag: 'Bool', value: 'false' } } } }]
    })
  })

  test('logical or', () => {
    expect(ast('const x = false || true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Or' } }]
    })
  })

  test('ArrayLit', () => {
    expect(ast('const arr = [10, 20, 30]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'ArrayLit' } } }]
    })
  })

  test('ArrayLit empty', () => {
    expect(ast('const arr = []')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'ArrayLit', elements: null } } }]
    })
  })

  test('Index access via Chained', () => {
    expect(ast('const x = arr[0]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', tail: [{ tag: 'Index' }] } }]
    })
  })

  test('Member access .length', () => {
    expect(ast('const x = arr.length')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', tail: [{ tag: 'Member', name: 'length' }] } }]
    })
  })

  test('operator precedence (Add + Mul)', () => {
    expect(ast('const x = 2 + 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', right: { tag: 'Mul' } } }]
    })
  })

  test('parentheses override precedence', () => {
    expect(ast('const x = (2 + 3) * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Chained', expression: { tag: 'Add' } }, right: { tag: 'Chained', expression: { tag: 'Int', value: '4' } } } }]
    })
  })

  test('Chained: index + member', () => {
    expect(ast('const x = arr[0].length')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', tail: [{ tag: 'Index' }, { tag: 'Member' }] } }]
    })
  })

  test('multiple statements', () => {
    expect(ast('const a = 1\nconst b = 2\nconsole.log(a + b)')).toMatchObject({
      tag: 'Program',
      statements: [{}, {}, {}]
    })
  })

  test('syntax error', () => {
    expect(() => ast('console.log(`halo)')).toThrow()
  })

  test('complex nested expression', () => {
    expect(ast('const x = (a + b) * (c - d)')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Chained', expression: { tag: 'Add' } }, right: { tag: 'Chained', expression: { tag: 'Sub' } } } }]
    })
  })
})
