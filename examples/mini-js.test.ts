import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-js.packrat`, 'utf-8')
const parseJs = async (source: string) => (await packrat(grammarText))(source.trim() + '\n')

describe('mini-js parser', () => {
  const ast = async (src: string) => (await parseJs(src)) as any

  test('Program root', async () => {
    expect(await ast('const x = 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl' }]
    })
  })

  test('VarDecl const', async () => {
    expect(await ast('const x = 42')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', keyword: 'const', name: 'x', value: { tag: 'Chained', expression: { tag: 'Int', value: '42' } } }]
    })
  })

  test('VarDecl let', async () => {
    expect(await ast('let y = "hello"')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl', keyword: 'let', name: 'y', value: { tag: 'Chained', expression: { tag: 'String' } } }]
    })
  })

  test('AssignStmt', async () => {
    expect(await ast('x = 5')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'AssignStmt', name: 'x', value: { tag: 'Chained', expression: { tag: 'Int', value: '5' } } }]
    })
  })

  test('IfStmt with Gt condition (binary op, no Chained wrap)', async () => {
    expect(await ast('if (x > 3) { const y = 1 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'Gt', left: { tag: 'Chained' } }, body: [{ tag: 'VarDecl' }] }]
    })
  })

  test('IfStmt with Bool condition (Primary, Chained wrapped)', async () => {
    expect(await ast('if (false) { const a = 1 } else { const b = 2 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'Chained', expression: { tag: 'Bool' } }, else: { tag: 'Else' } }]
    })
  })

  test('While loop', async () => {
    expect(await ast('while (n > 0) { n = n - 1 }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'While', condition: { tag: 'Gt', left: { tag: 'Chained' } } }]
    })
  })

  test('For loop', async () => {
    expect(await ast('for (let i = 0; i < 3; i++) { console.log(i) }')).toMatchObject({
      tag: 'Program',
      statements: [{
        tag: 'For',
        init: { tag: 'VarDecl', name: 'i' },
        condition: { tag: 'Lt' },
        update: { tag: 'Chained', expression: { tag: 'Ident', name: 'i' }, tail: [{ tag: 'Postfix', op: '++' }] }
      }]
    })
  })

  test('For loop tanpa init', async () => {
    const a = await ast('for (; i < 2; i++) { console.log(i) }')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ condition: { tag: 'Lt' } }]
    })
    expect((a as any).statements[0].init).toBeNull()
  })

  test('FuncDecl basic', async () => {
    expect(await ast('function greet() { return "hello" }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'greet' }]
    })
  })

  test('FuncDecl with params', async () => {
    expect(await ast('function add(a, b) { return a + b }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', params: { tag: 'ParamList', params: [{ tag: 'Param', name: 'a' }, { tag: 'Param', name: 'b' }] } }]
    })
  })

  test('FuncDecl with rest param', async () => {
    expect(await ast('function sum(...nums) { return nums }')).toMatchObject({
      tag: 'Program',
      statements: [{ params: { tag: 'ParamList', params: [{ tag: 'RestParam', name: 'nums' }] } }]
    })
  })

  test('Return with value', async () => {
    expect(await ast('return 42')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Return', value: { tag: 'Chained', expression: { tag: 'Int', value: '42' } } }]
    })
  })

  test('Return tanpa value', async () => {
    const a = await ast('return')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Return' }]
    })
    expect((a as any).statements[0].value).toBeNull()
  })

  test('ExprStmt wraps in Chained', async () => {
    expect(await ast('console.log(1)')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'Chained', expression: { tag: 'CallExpr' } } }]
    })
  })

  test('CallExpr console.log', async () => {
    expect(await ast('console.log(1, 2, "tiga")')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', callee: 'console.log' } } }]
    })
  })

  test('CallExpr nama biasa', async () => {
    expect(await ast('tambah(2, 3)')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', name: 'tambah' } } }]
    })
  })

  test('TemplateString dasar', async () => {
    expect(await ast('console.log(`halo`)')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', args: { tag: 'ArgList', args: [{ tag: 'Chained', expression: { tag: 'TemplateString' } }] } } } }]
    })
  })

  test('TemplateString with interpolation', async () => {
    expect(await ast('console.log(`1 + 2 = ${1 + 2}`)')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'CallExpr', args: { tag: 'ArgList', args: [{ tag: 'Chained', expression: { tag: 'TemplateString' } }] } } } }]
    })
  })

  test('TemplateString multi interpolation', async () => {
    const a = await ast('console.log(`${a} + ${b} = ${a + b}`)')
    const tmpl = (a as any).statements[0].expression.expression.args.args[0].expression
    expect(tmpl.parts.length).toBeGreaterThanOrEqual(5)
  })

  test('TaggedTemplate', async () => {
    expect(await ast('greet`halo ${nama}`')).toMatchObject({
      tag: 'Program',
      statements: [{ expression: { tag: 'Chained', expression: { tag: 'TaggedTemplate', name: 'greet', template: { tag: 'TemplateString' } } } }]
    })
  })

  test('Int literal', async () => {
    expect(await ast('const x = 42')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Int', value: '42' } } }]
    })
  })

  test('Float literal', async () => {
    expect(await ast('const x = 3.14')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Float', value: '3.14' } } }]
    })
  })

  test('String literal', async () => {
    expect(await ast('const x = "hello"')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'String' } } }]
    })
    expect(await ast("const x = 'halo'")).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'String' } } }]
    })
  })

  test('Bool literal', async () => {
    expect(await ast('const x = true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Bool', value: 'true' } } }]
    })
  })

  test('Null literal', async () => {
    expect(await ast('const x = null')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Null' } } }]
    })
  })

  test('Ident expression', async () => {
    expect(await ast('const y = x')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'Ident', name: 'x' } } }]
    })
  })

  test('Add expression (binary op, no Chained wrap at top)', async () => {
    expect(await ast('const x = 3 + 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { tag: 'Chained', expression: { tag: 'Int', value: '3' } }, right: { tag: 'Chained', expression: { tag: 'Int', value: '4' } } } }]
    })
  })

  test('Sub expression', async () => {
    expect(await ast('const x = 10 - 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub' } }]
    })
  })

  test('Mul expression', async () => {
    expect(await ast('const x = 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul' } }]
    })
  })

  test('Div expression', async () => {
    expect(await ast('const x = 10 / 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Div' } }]
    })
  })

  test('Mod expression', async () => {
    expect(await ast('const x = 7 % 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mod' } }]
    })
  })

  test('left associative subtraction', async () => {
    expect(await ast('const x = 10 - 3 - 2')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { tag: 'Sub' }, right: { tag: 'Chained', expression: { tag: 'Int', value: '2' } } } }]
    })
  })

  test('unary minus produces Unary node', async () => {
    expect(await ast('const x = -5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Unary', op: '-', expression: { tag: 'Chained', expression: { tag: 'Int', value: '5' } } } }]
    })
  })

  test('unary not produces Unary node', async () => {
    expect(await ast('const x = !true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Unary', op: '!', expression: { tag: 'Chained', expression: { tag: 'Bool', value: 'true' } } } }]
    })
  })

  test('equality', async () => {
    expect(await ast('const x = 3 === 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'StrictEq', left: { tag: 'Chained', expression: { tag: 'Int', value: '3' } }, right: { tag: 'Chained', expression: { tag: 'Int', value: '3' } } } }]
    })
  })

  test('loose equality', async () => {
    expect(await ast('const x = 3 == 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Eq' } }]
    })
  })

  test('inequality', async () => {
    expect(await ast('const x = 3 !== 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'StrictNeq' } }]
    })
  })

  test('comparison operators', async () => {
    expect(await ast('const x = 3 < 5')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Lt' } }]
    })
    expect(await ast('const x = 5 > 3')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Gt' } }]
    })
  })

  test('logical and', async () => {
    expect(await ast('const x = true && false')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'And', left: { tag: 'Chained', expression: { tag: 'Bool', value: 'true' } }, right: { tag: 'Chained', expression: { tag: 'Bool', value: 'false' } } } }]
    })
  })

  test('logical or', async () => {
    expect(await ast('const x = false || true')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Or' } }]
    })
  })

  test('ArrayLit', async () => {
    expect(await ast('const arr = [10, 20, 30]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'ArrayLit' } } }]
    })
  })

  test('ArrayLit empty', async () => {
    expect(await ast('const arr = []')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', expression: { tag: 'ArrayLit', elements: null } } }]
    })
  })

  test('Index access via Chained', async () => {
    expect(await ast('const x = arr[0]')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', tail: [{ tag: 'Index' }] } }]
    })
  })

  test('Member access .length', async () => {
    expect(await ast('const x = arr.length')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', tail: [{ tag: 'Member', name: 'length' }] } }]
    })
  })

  test('operator precedence (Add + Mul)', async () => {
    expect(await ast('const x = 2 + 3 * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', right: { tag: 'Mul' } } }]
    })
  })

  test('parentheses override precedence', async () => {
    expect(await ast('const x = (2 + 3) * 4')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Chained', expression: { tag: 'Add' } }, right: { tag: 'Chained', expression: { tag: 'Int', value: '4' } } } }]
    })
  })

  test('Chained: index + member', async () => {
    expect(await ast('const x = arr[0].length')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Chained', tail: [{ tag: 'Index' }, { tag: 'Member' }] } }]
    })
  })

  test('multiple statements', async () => {
    expect(await ast('const a = 1\nconst b = 2\nconsole.log(a + b)')).toMatchObject({
      tag: 'Program',
      statements: [{}, {}, {}]
    })
  })

  test('syntax error', async () => {
    await expect(ast('console.log(`halo)')).rejects.toThrow()
  })

  test('complex nested expression', async () => {
    expect(await ast('const x = (a + b) * (c - d)')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Chained', expression: { tag: 'Add' } }, right: { tag: 'Chained', expression: { tag: 'Sub' } } } }]
    })
  })
})
