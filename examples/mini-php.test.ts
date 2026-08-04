import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-php.packrat`, 'utf-8')
const parse = packrat(grammarText)

const quote = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')

const templateToPhp = (source: string): string => {
  let out = ''
  let i = 0
  while (i < source.length) {
    const open = source.indexOf('<?', i)
    if (open === -1) {
      out += `echo "${quote(source.slice(i))}"; `
      break
    }
    if (open > i) out += `echo "${quote(source.slice(i, open))}"; `
    if (source.startsWith('<?=', open)) {
      const close = source.indexOf('?>', open + 3)
      if (close === -1) throw new Error('unterminated <?= tag')
      out += `echo ${source.slice(open + 3, close).trim()}; `
      i = close + 2
    } else if (source.startsWith('<?php', open)) {
      const close = source.indexOf('?>', open + 5)
      if (close === -1) {
        out += source.slice(open + 5)
        i = source.length
      } else {
        out += source.slice(open + 5, close)
        i = close + 2
      }
    } else {
      out += 'echo "<?"; '
      i = open + 2
    }
  }
  return `<?php ${out}`
}

const parsePhp = (source: string) => parse(templateToPhp(source))

describe('mini-php parser', () => {
  const ast = (src: string) => parsePhp(src) as any

  test('Program root dengan tag <?php', () => {
    expect(ast('<?php $x = 1; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign' }]
    })
  })

  test('Echo single arg', () => {
    expect(ast('<?php echo 42; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: { tag: 'Int', value: '42' } } }]
    })
  })

  test('Echo multiple args', () => {
    expect(ast('<?php echo 1, 2, 3; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: [{}, {}, {}] } }]
    })
  })

  test('Echo string single arg', () => {
    expect(ast('<?php echo "hello"; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: { tag: 'String' } } }]
    })
  })

  test('Echo tanpa tag penutup', () => {
    expect(ast('<?php echo "open";')).toMatchObject({ tag: 'Program' })
  })

  test('Echo shorthand <?=', () => {
    expect(ast('<?= 1 + 2 ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: { tag: 'Add' } } }]
    })
  })

  test('Echo shorthand string', () => {
    expect(ast('<?= "halo" ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: { tag: 'String' } } }]
    })
  })

  test('Int literal', () => {
    expect(ast('<?php $x = 5; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign', name: 'x', value: { tag: 'Int', value: '5' } }]
    })
  })

  test('Float literal', () => {
    expect(ast('<?php $x = 3.14; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Float', value: '3.14' } }]
    })
  })

  test('String double quote', () => {
    expect(ast('<?php $nama = "Budi"; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'String' } }]
    })
  })

  test('String single quote', () => {
    expect(ast("<?php $x = 'hello'; ?>")).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'SqString' } }]
    })
  })

  test('True literal', () => {
    expect(ast('<?php $ok = true; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'True' } }]
    })
  })

  test('False literal', () => {
    expect(ast('<?php $ok = false; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'False' } }]
    })
  })

  test('Null literal', () => {
    expect(ast('<?php $x = null; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Null' } }]
    })
  })

  test('Var reference', () => {
    expect(ast('<?php $y = $x; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Var', name: 'x' } }]
    })
  })

  test('Add expression', () => {
    expect(ast('<?php $x = 1 + 2; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { value: '1' }, right: { value: '2' } } }]
    })
  })

  test('Arithmetic operators', () => {
    expect(ast('<?php $x = 5 - 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Sub' } }] })
    expect(ast('<?php $x = 3 * 4; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Mul' } }] })
    expect(ast('<?php $x = 10 / 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Div' } }] })
    expect(ast('<?php $x = 7 % 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Mod' } }] })
  })

  test('operator precedence', () => {
    expect(ast('<?php $x = 1 + 2 * 3; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', right: { tag: 'Mul' } } }]
    })
  })

  test('parentheses override precedence', () => {
    expect(ast('<?php $x = (1 + 2) * 3; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' } } }]
    })
  })

  test('Concat with dot', () => {
    expect(ast('<?php $x = "foo" . "bar"; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Concat', left: { tag: 'String' }, right: { tag: 'String' } } }]
    })
  })

  test('unary minus', () => {
    expect(ast('<?php $x = -5; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '-', expression: { value: '5' } } }]
    })
  })

  test('unary not', () => {
    expect(ast('<?php $x = !false; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '!' } }]
    })
  })

  test('equality operators', () => {
    expect(ast('<?php $x = 1 == 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Eq' } }] })
    expect(ast('<?php $x = 1 != 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Neq' } }] })
    expect(ast('<?php $x = 1 === 1; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'StrictEq' } }] })
    expect(ast('<?php $x = 1 !== 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'StrictNeq' } }] })
  })

  test('comparison operators', () => {
    expect(ast('<?php $x = 1 < 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Lt' } }] })
    expect(ast('<?php $x = 1 > 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Gt' } }] })
    expect(ast('<?php $x = 3 <= 3; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Lte' } }] })
    expect(ast('<?php $x = 3 >= 4; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Gte' } }] })
  })

  test('logical and/or', () => {
    expect(ast('<?php $x = true && false; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'And' } }] })
    expect(ast('<?php $x = true || false; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Or' } }] })
  })

  test('left associative subtraction', () => {
    expect(ast('<?php $x = 10 - 3 - 2; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { tag: 'Sub' }, right: { value: '2' } } }]
    })
  })

  test('IfStmt with braces', () => {
    expect(ast('<?php if (true) { echo "ya"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'True' }, body: [{ tag: 'Echo' }] }]
    })
  })

  test('IfStmt with Else', () => {
    expect(ast('<?php if (false) { echo "ya"; } else { echo "tidak"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', else: { tag: 'Else', body: [{ tag: 'Echo' }] } }]
    })
  })

  test('IfStmt with ElseIf', () => {
    expect(ast('<?php if ($x == 1) { echo "satu"; } elseif ($x == 2) { echo "dua"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', elseif: [{ tag: 'ElseIf', condition: { tag: 'Eq' } }] }]
    })
  })

  test('While loop', () => {
    expect(ast('<?php while ($i < 3) { echo $i; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'While', condition: { tag: 'Lt' } }]
    })
  })

  test('For loop', () => {
    expect(ast('<?php for ($i = 0; $i < 3; $i++) { echo $i; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'For', init: { tag: 'Assign', name: 'i' }, condition: { tag: 'Lt' }, update: { tag: 'PostfixExpr', op: '++' } }]
    })
  })

  test('For loop tanpa init', () => {
    expect(ast('<?php for (; $i < 2; $i++) { echo $i; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'For', init: null }]
    })
  })

  test('FuncDecl', () => {
    expect(ast('<?php function sapa() { echo "halo"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'sapa' }]
    })
  })

  test('FuncDecl with params', () => {
    expect(ast('<?php function tambah($a, $b) { return $a + $b; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', params: { params: [{ tag: 'Param', name: 'a' }, { tag: 'Param', name: 'b' }] } }]
    })
  })

  test('Return with value', () => {
    expect(ast('<?php function f() { return 42; }')).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'Return', value: { tag: 'Int', value: '42' } }] }]
    })
  })

  test('Return tanpa value', () => {
    const a = ast('<?php function f() { return; }')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'Return' }] }]
    })
    expect((a as any).statements[0].body[0].value).toBeNull()
  })

  test('CallExpr', () => {
    expect(ast('<?php strlen("halo"); ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'CallExpr', name: 'strlen' } }]
    })
  })

  test('ArrayLit', () => {
    expect(ast('<?php $a = [10, 20, 30]; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'ArrayLit', elements: { args: [{ value: '10' }, { value: '20' }, { value: '30' }] } } }]
    })
  })

  test('ArrayLit empty', () => {
    expect(ast('<?php $a = []; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'ArrayLit', elements: null } }]
    })
  })

  test('Index access', () => {
    expect(ast('<?php $x = $a[0]; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'IndexExpr', expression: { tag: 'Var', name: 'a' }, index: { value: '0' } } }]
    })
  })

  test('Postfix increment', () => {
    expect(ast('<?php $i++; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'PostfixExpr', expression: { tag: 'Var' }, op: '++' } }]
    })
  })

  test('Prefix increment', () => {
    expect(ast('<?php ++$i; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'UnaryExpr', op: '++' } }]
    })
  })

  test('Empty statement', () => {
    expect(ast('<?php ; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Empty' }]
    })
  })

  test('multiple statements', () => {
    expect(ast('<?php $a = 1; $b = 2; echo $a + $b; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{}, {}, {}]
    })
  })

  test('teks campur PHP dan HTML di-wrap jadi echo', () => {
    expect(ast('Hello <?= "John" ?>!')).toMatchObject({ tag: 'Program' })
  })

  test('syntax error', () => {
    expect(() => ast('<?php $x = ; ?>')).toThrow()
  })

  test('complex nested expression', () => {
    expect(ast('<?php $x = ($a + $b) * ($c - $d); ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' }, right: { tag: 'Sub' } } }]
    })
  })
})
