import { describe, expect, test } from 'bun:test'
import { parseJs } from './mini-js'

describe('mini-js parser', () => {
  const ast = (src: string) => parseJs(src) as any

  test('Program root', () => {
    expect(ast('const x = 1')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'VarDecl' }]
    })
  })

  test('VarDecl const', () => {
    const v = ast('const x = 42').statements[0]
    expect(v).toMatchObject({ tag: 'VarDecl', keyword: 'const', name: 'x' })
    expect(v.value).toMatchObject({ tag: 'Chained' })
    expect(v.value.expression).toMatchObject({ tag: 'Int', value: '42' })
  })

  test('VarDecl let', () => {
    const v = ast('let y = "hello"').statements[0]
    expect(v).toMatchObject({ tag: 'VarDecl', keyword: 'let', name: 'y' })
    expect(v.value.expression).toMatchObject({ tag: 'String' })
  })

  test('AssignStmt', () => {
    const v = ast('x = 5').statements[0]
    expect(v).toMatchObject({ tag: 'AssignStmt', name: 'x' })
    expect(v.value.expression).toMatchObject({ tag: 'Int', value: '5' })
  })

  test('IfStmt with Gt condition (binary op, no Chained wrap)', () => {
    const s = ast('if (x > 3) { const y = 1 }').statements[0]
    expect(s).toMatchObject({ tag: 'IfStmt' })
    expect(s.condition).toMatchObject({ tag: 'Gt' })
    expect(s.condition.left).toMatchObject({ tag: 'Chained' })
  })

  test('IfStmt with Bool condition (Primary, Chained wrapped)', () => {
    const s = ast('if (false) { const a = 1 } else { const b = 2 }').statements[0]
    expect(s.condition).toMatchObject({ tag: 'Chained', expression: { tag: 'Bool' } })
    expect(s.else).toMatchObject({ tag: 'Else' })
  })

  test('While loop', () => {
    const s = ast('while (n > 0) { n = n - 1 }').statements[0]
    expect(s.condition).toMatchObject({ tag: 'Gt' })
    expect(s.condition.left).toMatchObject({ tag: 'Chained' })
  })

  test('For loop', () => {
    const s = ast('for (let i = 0; i < 3; i++) { console.log(i) }').statements[0]
    expect(s).toMatchObject({ tag: 'For' })
    expect(s.init).toMatchObject({ tag: 'VarDecl', name: 'i' })
    expect(s.condition).toMatchObject({ tag: 'Lt' })
    expect(s.update).toMatchObject({
      tag: 'Chained',
      expression: { tag: 'Ident', name: 'i' },
      tail: [{ tag: 'Postfix', op: '++' }]
    })
  })

  test('For loop tanpa init', () => {
    const s = ast('for (; i < 2; i++) { console.log(i) }').statements[0]
    expect(s.init).toBeNull()
    expect(s.condition).toMatchObject({ tag: 'Lt' })
  })

  test('FuncDecl basic', () => {
    expect(ast('function greet() { return "hello" }').statements[0]).toMatchObject({
      tag: 'FuncDecl', name: 'greet'
    })
  })

  test('FuncDecl with params', () => {
    const s = ast('function add(a, b) { return a + b }').statements[0]
    expect(s.params).toMatchObject({
      tag: 'ParamList', params: [{ tag: 'Param', name: 'a' }, { tag: 'Param', name: 'b' }]
    })
  })

  test('FuncDecl with rest param', () => {
    const s = ast('function sum(...nums) { return nums }').statements[0]
    expect(s.params.params).toMatchObject({ tag: 'RestParam', name: 'nums' })
  })

  test('Return with value', () => {
    const s = ast('return 42').statements[0]
    expect(s.tag).toBe('Return')
    expect(s.value.expression).toMatchObject({ tag: 'Int', value: '42' })
  })

  test('Return tanpa value', () => {
    const s = ast('return').statements[0]
    expect(s.tag).toBe('Return')
    expect(s.value).toBeNull()
  })

  test('ExprStmt wraps in Chained', () => {
    const s = ast('console.log(1)').statements[0]
    expect(s).toMatchObject({ tag: 'ExprStmt' })
    expect(s.expression).toMatchObject({ tag: 'Chained' })
    expect(s.expression.expression).toMatchObject({ tag: 'CallExpr' })
  })

  test('CallExpr console.log', () => {
    const s = ast('console.log(1, 2, "tiga")').statements[0]
    const call = s.expression.expression
    expect(call).toMatchObject({ tag: 'CallExpr', callee: 'console.log' })
    expect(call.args.args).toHaveLength(3)
  })

  test('CallExpr nama biasa', () => {
    const s = ast('tambah(2, 3)').statements[0]
    expect(s.expression.expression).toMatchObject({ tag: 'CallExpr', name: 'tambah' })
  })

  test('TemplateString dasar', () => {
    const s = ast('console.log(`halo`)').statements[0]
    const call = s.expression.expression
    const tmpl = call.args.args
    expect(tmpl).toMatchObject({ tag: 'Chained' })
    expect(tmpl.expression.parts[0]).toMatchObject({ tag: 'TextPart' })
  })

  test('TemplateString with interpolation', () => {
    const s = ast('console.log(`1 + 2 = ${1 + 2}`)').statements[0]
    const call = s.expression.expression
    const tmpl = call.args.args.expression
    expect(tmpl.parts).toHaveLength(2)
    expect(tmpl.parts[0]).toMatchObject({ tag: 'TextPart' })
    expect(tmpl.parts[1]).toMatchObject({
      tag: 'Interpolation',
      expression: { tag: 'Add' }
    })
  })

  test('TemplateString multi interpolation', () => {
    const s = ast('console.log(`${a} + ${b} = ${a + b}`)').statements[0]
    const call = s.expression.expression
    const tmpl = call.args.args.expression
    expect(tmpl.parts.length).toBeGreaterThanOrEqual(5)
  })

  test('TaggedTemplate', () => {
    const s = ast('greet`halo ${nama}`').statements[0]
    const expr = s.expression.expression
    expect(expr).toMatchObject({ tag: 'TaggedTemplate', name: 'greet' })
    expect(expr.template).toMatchObject({ tag: 'TemplateString' })
  })

  test('Int literal', () => {
    expect(ast('const x = 42').statements[0].value.expression).toMatchObject({ tag: 'Int', value: '42' })
  })

  test('Float literal', () => {
    expect(ast('const x = 3.14').statements[0].value.expression).toMatchObject({ tag: 'Float', value: '3.14' })
  })

  test('String literal', () => {
    expect(ast('const x = "hello"').statements[0].value.expression).toMatchObject({ tag: 'String' })
    expect(ast("const x = 'halo'").statements[0].value.expression).toMatchObject({ tag: 'String' })
  })

  test('Bool literal', () => {
    expect(ast('const x = true').statements[0].value.expression).toMatchObject({ tag: 'Bool', value: 'true' })
  })

  test('Null literal', () => {
    expect(ast('const x = null').statements[0].value.expression).toMatchObject({ tag: 'Null' })
  })

  test('Ident expression', () => {
    expect(ast('const y = x').statements[0].value.expression).toMatchObject({ tag: 'Ident', name: 'x' })
  })

  test('Add expression (binary op, no Chained wrap at top)', () => {
    const v = ast('const x = 3 + 4').statements[0].value
    expect(v).toMatchObject({ tag: 'Add' })
    expect(v.left.expression).toMatchObject({ tag: 'Int', value: '3' })
    expect(v.right.expression).toMatchObject({ tag: 'Int', value: '4' })
  })

  test('Sub expression', () => {
    expect(ast('const x = 10 - 3').statements[0].value).toMatchObject({ tag: 'Sub' })
  })

  test('Mul expression', () => {
    expect(ast('const x = 3 * 4').statements[0].value).toMatchObject({ tag: 'Mul' })
  })

  test('Div expression', () => {
    expect(ast('const x = 10 / 2').statements[0].value).toMatchObject({ tag: 'Div' })
  })

  test('Mod expression', () => {
    expect(ast('const x = 7 % 2').statements[0].value).toMatchObject({ tag: 'Mod' })
  })

  test('left associative subtraction', () => {
    const v = ast('const x = 10 - 3 - 2').statements[0].value
    expect(v).toMatchObject({ tag: 'Sub' })
    expect(v.left).toMatchObject({ tag: 'Sub' })
    expect(v.right.expression).toMatchObject({ tag: 'Int', value: '2' })
  })

  test('unary minus produces Unary node', () => {
    const v = ast('const x = -5').statements[0].value
    expect(v).toMatchObject({ tag: 'Unary', op: '-' })
    expect(v.expression).toMatchObject({ tag: 'Chained' })
    expect(v.expression.expression).toMatchObject({ tag: 'Int', value: '5' })
  })

  test('unary not produces Unary node', () => {
    const v = ast('const x = !true').statements[0].value
    expect(v).toMatchObject({ tag: 'Unary', op: '!' })
    expect(v.expression.expression).toMatchObject({ tag: 'Bool', value: 'true' })
  })

  test('equality', () => {
    const v = ast('const x = 3 === 3').statements[0].value
    expect(v).toMatchObject({ tag: 'StrictEq' })
    expect(v.left.expression).toMatchObject({ tag: 'Int', value: '3' })
    expect(v.right.expression).toMatchObject({ tag: 'Int', value: '3' })
  })

  test('loose equality', () => {
    expect(ast('const x = 3 == 3').statements[0].value).toMatchObject({ tag: 'Eq' })
  })

  test('inequality', () => {
    expect(ast('const x = 3 !== 4').statements[0].value).toMatchObject({ tag: 'StrictNeq' })
  })

  test('comparison operators', () => {
    expect(ast('const x = 3 < 5').statements[0].value).toMatchObject({ tag: 'Lt' })
    expect(ast('const x = 5 > 3').statements[0].value).toMatchObject({ tag: 'Gt' })
  })

  test('logical and', () => {
    const v = ast('const x = true && false').statements[0].value
    expect(v).toMatchObject({ tag: 'And' })
    expect(v.left.expression).toMatchObject({ tag: 'Bool', value: 'true' })
    expect(v.right.expression).toMatchObject({ tag: 'Bool', value: 'false' })
  })

  test('logical or', () => {
    expect(ast('const x = false || true').statements[0].value).toMatchObject({ tag: 'Or' })
  })

  test('ArrayLit', () => {
    const v = ast('const arr = [10, 20, 30]').statements[0].value.expression
    expect(v).toMatchObject({ tag: 'ArrayLit' })
    expect(v.elements.args).toHaveLength(3)
  })

  test('ArrayLit empty', () => {
    const v = ast('const arr = []').statements[0].value.expression
    expect(v).toMatchObject({ tag: 'ArrayLit', elements: null })
  })

  test('Index access via Chained', () => {
    const v = ast('const x = arr[0]').statements[0].value
    expect(v.tail[0]).toMatchObject({ tag: 'Index' })
  })

  test('Member access .length', () => {
    const v = ast('const x = arr.length').statements[0].value
    expect(v.tail[0]).toMatchObject({ tag: 'Member', name: 'length' })
  })

  test('operator precedence (Add + Mul)', () => {
    const v = ast('const x = 2 + 3 * 4').statements[0].value
    expect(v).toMatchObject({ tag: 'Add' })
    expect(v.right).toMatchObject({ tag: 'Mul' })
  })

  test('parentheses override precedence', () => {
    const v = ast('const x = (2 + 3) * 4').statements[0].value
    expect(v).toMatchObject({ tag: 'Mul' })
    expect(v.left).toMatchObject({ tag: 'Chained', expression: { tag: 'Add' } })
    expect(v.right.expression).toMatchObject({ tag: 'Int', value: '4' })
  })

  test('Chained: index + member', () => {
    const v = ast('const x = arr[0].length').statements[0].value
    expect(v.tail).toHaveLength(2)
    expect(v.tail[0]).toMatchObject({ tag: 'Index' })
    expect(v.tail[1]).toMatchObject({ tag: 'Member' })
  })

  test('multiple statements', () => {
    expect(ast('const a = 1\nconst b = 2\nconsole.log(a + b)').statements).toHaveLength(3)
  })

  test('syntax error', () => {
    expect(() => ast('console.log(`halo)')).toThrow()
  })

  test('complex nested expression', () => {
    const v = ast('const x = (a + b) * (c - d)').statements[0].value
    expect(v).toMatchObject({ tag: 'Mul' })
    expect(v.left).toMatchObject({ tag: 'Chained', expression: { tag: 'Add' } })
    expect(v.right).toMatchObject({ tag: 'Chained', expression: { tag: 'Sub' } })
  })
})
