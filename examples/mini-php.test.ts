import { describe, expect, test } from 'bun:test'
import { parsePhp } from './mini-php'

describe('mini-php parser', () => {
  const ast = (src: string) => parsePhp(src) as any

  test('Program root dengan tag <?php', () => {
    expect(ast('<?php $x = 1; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign' }]
    })
  })

  test('Echo single arg', () => {
    const s = ast('<?php echo 42; ?>').statements[0]
    expect(s.tag).toBe('Echo')
    expect(s.args.args).toMatchObject({ tag: 'Int', value: '42' })
  })

  test('Echo multiple args', () => {
    const s = ast('<?php echo 1, 2, 3; ?>').statements[0]
    expect(s.args.args).toHaveLength(3)
  })

  test('Echo string single arg', () => {
    expect(ast('<?php echo "hello"; ?>').statements[0].args.args).toMatchObject({ tag: 'String' })
  })

  test('Echo tanpa tag penutup', () => {
    expect(ast('<?php echo "open";')).toMatchObject({ tag: 'Program' })
  })

  test('Echo shorthand <?=', () => {
    const s = ast('<?= 1 + 2 ?>').statements[0]
    expect(s.tag).toBe('Echo')
    expect(s.args.args).toMatchObject({ tag: 'Add' })
  })

  test('Echo shorthand string', () => {
    expect(ast('<?= "halo" ?>').statements[0].args.args).toMatchObject({ tag: 'String' })
  })

  test('Int literal', () => {
    expect(ast('<?php $x = 5; ?>').statements[0]).toMatchObject({
      tag: 'Assign', name: 'x', value: { tag: 'Int', value: '5' }
    })
  })

  test('Float literal', () => {
    expect(ast('<?php $x = 3.14; ?>').statements[0].value).toMatchObject({ tag: 'Float', value: '3.14' })
  })

  test('String double quote', () => {
    expect(ast('<?php $nama = "Budi"; ?>').statements[0].value).toMatchObject({ tag: 'String' })
  })

  test('String single quote', () => {
    expect(ast("<?php $x = 'hello'; ?>").statements[0].value).toMatchObject({ tag: 'SqString' })
  })

  test('True literal', () => {
    expect(ast('<?php $ok = true; ?>').statements[0].value).toMatchObject({ tag: 'True' })
  })

  test('False literal', () => {
    expect(ast('<?php $ok = false; ?>').statements[0].value).toMatchObject({ tag: 'False' })
  })

  test('Null literal', () => {
    expect(ast('<?php $x = null; ?>').statements[0].value).toMatchObject({ tag: 'Null' })
  })

  test('Var reference', () => {
    expect(ast('<?php $y = $x; ?>').statements[0].value).toMatchObject({ tag: 'Var', name: 'x' })
  })

  test('Add expression', () => {
    expect(ast('<?php $x = 1 + 2; ?>').statements[0].value).toMatchObject({
      tag: 'Add', left: { value: '1' }, right: { value: '2' }
    })
  })

  test('Arithmetic operators', () => {
    expect(ast('<?php $x = 5 - 2; ?>').statements[0].value).toMatchObject({ tag: 'Sub' })
    expect(ast('<?php $x = 3 * 4; ?>').statements[0].value).toMatchObject({ tag: 'Mul' })
    expect(ast('<?php $x = 10 / 2; ?>').statements[0].value).toMatchObject({ tag: 'Div' })
    expect(ast('<?php $x = 7 % 2; ?>').statements[0].value).toMatchObject({ tag: 'Mod' })
  })

  test('operator precedence', () => {
    expect(ast('<?php $x = 1 + 2 * 3; ?>').statements[0].value).toMatchObject({
      tag: 'Add', right: { tag: 'Mul' }
    })
  })

  test('parentheses override precedence', () => {
    expect(ast('<?php $x = (1 + 2) * 3; ?>').statements[0].value).toMatchObject({
      tag: 'Mul', left: { tag: 'Add' }
    })
  })

  test('Concat with dot', () => {
    expect(ast('<?php $x = "foo" . "bar"; ?>').statements[0].value).toMatchObject({
      tag: 'Concat', left: { tag: 'String' }, right: { tag: 'String' }
    })
  })

  test('unary minus', () => {
    expect(ast('<?php $x = -5; ?>').statements[0].value).toMatchObject({
      tag: 'UnaryExpr', op: '-', expression: { value: '5' }
    })
  })

  test('unary not', () => {
    expect(ast('<?php $x = !false; ?>').statements[0].value).toMatchObject({
      tag: 'UnaryExpr', op: '!'
    })
  })

  test('equality operators', () => {
    expect(ast('<?php $x = 1 == 2; ?>').statements[0].value).toMatchObject({ tag: 'Eq' })
    expect(ast('<?php $x = 1 != 2; ?>').statements[0].value).toMatchObject({ tag: 'Neq' })
    expect(ast('<?php $x = 1 === 1; ?>').statements[0].value).toMatchObject({ tag: 'StrictEq' })
    expect(ast('<?php $x = 1 !== 2; ?>').statements[0].value).toMatchObject({ tag: 'StrictNeq' })
  })

  test('comparison operators', () => {
    expect(ast('<?php $x = 1 < 2; ?>').statements[0].value).toMatchObject({ tag: 'Lt' })
    expect(ast('<?php $x = 1 > 2; ?>').statements[0].value).toMatchObject({ tag: 'Gt' })
    expect(ast('<?php $x = 3 <= 3; ?>').statements[0].value).toMatchObject({ tag: 'Lte' })
    expect(ast('<?php $x = 3 >= 4; ?>').statements[0].value).toMatchObject({ tag: 'Gte' })
  })

  test('logical and/or', () => {
    expect(ast('<?php $x = true && false; ?>').statements[0].value).toMatchObject({ tag: 'And' })
    expect(ast('<?php $x = true || false; ?>').statements[0].value).toMatchObject({ tag: 'Or' })
  })

  test('left associative subtraction', () => {
    expect(ast('<?php $x = 10 - 3 - 2; ?>').statements[0].value).toMatchObject({
      tag: 'Sub', left: { tag: 'Sub' }, right: { value: '2' }
    })
  })

  test('IfStmt with braces', () => {
    expect(ast('<?php if (true) { echo "ya"; }').statements[0]).toMatchObject({
      tag: 'IfStmt', condition: { tag: 'True' }, body: [{ tag: 'Echo' }]
    })
  })

  test('IfStmt with Else', () => {
    expect(ast('<?php if (false) { echo "ya"; } else { echo "tidak"; }').statements[0]).toMatchObject({
      tag: 'IfStmt', else: { tag: 'Else', body: [{ tag: 'Echo' }] }
    })
  })

  test('IfStmt with ElseIf', () => {
    expect(ast('<?php if ($x == 1) { echo "satu"; } elseif ($x == 2) { echo "dua"; }').statements[0]).toMatchObject({
      tag: 'IfStmt', elseif: [{ tag: 'ElseIf', condition: { tag: 'Eq' } }]
    })
  })

  test('While loop', () => {
    expect(ast('<?php while ($i < 3) { echo $i; }').statements[0]).toMatchObject({
      tag: 'While', condition: { tag: 'Lt' }
    })
  })

  test('For loop', () => {
    expect(ast('<?php for ($i = 0; $i < 3; $i++) { echo $i; }').statements[0]).toMatchObject({
      tag: 'For', init: { tag: 'Assign', name: 'i' }, condition: { tag: 'Lt' }, update: { tag: 'PostfixExpr', op: '++' }
    })
  })

  test('For loop tanpa init', () => {
    expect(ast('<?php for (; $i < 2; $i++) { echo $i; }').statements[0]).toMatchObject({
      tag: 'For', init: null
    })
  })

  test('FuncDecl', () => {
    expect(ast('<?php function sapa() { echo "halo"; }').statements[0]).toMatchObject({
      tag: 'FuncDecl', name: 'sapa'
    })
  })

  test('FuncDecl with params', () => {
    expect(ast('<?php function tambah($a, $b) { return $a + $b; }').statements[0]).toMatchObject({
      tag: 'FuncDecl', params: { params: [{ tag: 'Param', name: 'a' }, { tag: 'Param', name: 'b' }] }
    })
  })

  test('Return with value', () => {
    expect(ast('<?php function f() { return 42; }').statements[0].body[0]).toMatchObject({
      tag: 'Return', value: { tag: 'Int', value: '42' }
    })
  })

  test('Return tanpa value', () => {
    const s = ast('<?php function f() { return; }').statements[0].body[0]
    expect(s.tag).toBe('Return')
    expect(s.value).toBeNull()
  })

  test('CallExpr', () => {
    expect(ast('<?php strlen("halo"); ?>').statements[0]).toMatchObject({
      tag: 'ExprStmt', expression: { tag: 'CallExpr', name: 'strlen' }
    })
    expect(ast('<?php tambah(3, 4); ?>').statements[0].expression).toMatchObject({
      tag: 'CallExpr', name: 'tambah'
    })
  })

  test('ArrayLit', () => {
    expect(ast('<?php $a = [10, 20, 30]; ?>').statements[0].value).toMatchObject({
      tag: 'ArrayLit', elements: { args: [{ value: '10' }, { value: '20' }, { value: '30' }] }
    })
  })

  test('ArrayLit empty', () => {
    expect(ast('<?php $a = []; ?>').statements[0].value).toMatchObject({
      tag: 'ArrayLit', elements: null
    })
  })

  test('Index access', () => {
    expect(ast('<?php $x = $a[0]; ?>').statements[0].value).toMatchObject({
      tag: 'IndexExpr', expression: { tag: 'Var', name: 'a' }, index: { value: '0' }
    })
  })

  test('Postfix increment', () => {
    expect(ast('<?php $i++; ?>').statements[0].expression).toMatchObject({
      tag: 'PostfixExpr', expression: { tag: 'Var' }, op: '++'
    })
  })

  test('Prefix increment', () => {
    expect(ast('<?php ++$i; ?>').statements[0].expression).toMatchObject({
      tag: 'UnaryExpr', op: '++'
    })
  })

  test('Empty statement', () => {
    expect(ast('<?php ; ?>').statements[0]).toMatchObject({ tag: 'Empty' })
  })

  test('multiple statements', () => {
    expect(ast('<?php $a = 1; $b = 2; echo $a + $b; ?>').statements).toHaveLength(3)
  })

  test('teks campur PHP dan HTML di-wrap jadi echo', () => {
    expect(ast('Hello <?= "John" ?>!')).toMatchObject({ tag: 'Program' })
  })

  test('syntax error', () => {
    expect(() => ast('<?php $x = ; ?>')).toThrow()
  })

  test('complex nested expression', () => {
    expect(ast('<?php $x = ($a + $b) * ($c - $d); ?>').statements[0].value).toMatchObject({
      tag: 'Mul', left: { tag: 'Add' }, right: { tag: 'Sub' }
    })
  })
})
