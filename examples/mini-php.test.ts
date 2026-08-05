import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-php.packrat`, 'utf-8')
const parse = await packrat(grammarText)

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

const parsePhp = async (source: string) => await parse(templateToPhp(source))

describe('mini-php parser', () => {
  const ast = async (src: string) => (await parsePhp(src)) as any

  test('Program root dengan tag <?php', async () => {
    expect(await ast('<?php $x = 1; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign' }]
    })
  })

  test('Echo single arg', async () => {
    expect(await ast('<?php echo 42; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: [{ tag: 'Int', value: '42' }] } }]
    })
  })

  test('Echo multiple args', async () => {
    expect(await ast('<?php echo 1, 2, 3; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: [{}, {}, {}] } }]
    })
  })

  test('Echo string single arg', async () => {
    expect(await ast('<?php echo "hello"; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: [{ tag: 'String' }] } }]
    })
  })

  test('Echo tanpa tag penutup', async () => {
    expect(await ast('<?php echo "open";')).toMatchObject({ tag: 'Program' })
  })

  test('Echo shorthand <?=', async () => {
    expect(await ast('<?= 1 + 2 ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: [{ tag: 'Add' }] } }]
    })
  })

  test('Echo shorthand string', async () => {
    expect(await ast('<?= "halo" ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Echo', args: { tag: 'ArgList', args: [{ tag: 'String' }] } }]
    })
  })

  test('Int literal', async () => {
    expect(await ast('<?php $x = 5; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Assign', name: 'x', value: { tag: 'Int', value: '5' } }]
    })
  })

  test('Float literal', async () => {
    expect(await ast('<?php $x = 3.14; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Float', value: '3.14' } }]
    })
  })

  test('String double quote', async () => {
    expect(await ast('<?php $nama = "Budi"; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'String' } }]
    })
  })

  test('String single quote', async () => {
    expect(await ast("<?php $x = 'hello'; ?>")).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'SqString' } }]
    })
  })

  test('True literal', async () => {
    expect(await ast('<?php $ok = true; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'True' } }]
    })
  })

  test('False literal', async () => {
    expect(await ast('<?php $ok = false; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'False' } }]
    })
  })

  test('Null literal', async () => {
    expect(await ast('<?php $x = null; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Null' } }]
    })
  })

  test('Var reference', async () => {
    expect(await ast('<?php $y = $x; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Var', name: 'x' } }]
    })
  })

  test('Add expression', async () => {
    expect(await ast('<?php $x = 1 + 2; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', left: { value: '1' }, right: { value: '2' } } }]
    })
  })

  test('Arithmetic operators', async () => {
    expect(await ast('<?php $x = 5 - 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Sub' } }] })
    expect(await ast('<?php $x = 3 * 4; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Mul' } }] })
    expect(await ast('<?php $x = 10 / 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Div' } }] })
    expect(await ast('<?php $x = 7 % 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Mod' } }] })
  })

  test('operator precedence', async () => {
    expect(await ast('<?php $x = 1 + 2 * 3; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Add', right: { tag: 'Mul' } } }]
    })
  })

  test('parentheses override precedence', async () => {
    expect(await ast('<?php $x = (1 + 2) * 3; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' } } }]
    })
  })

  test('Concat with dot', async () => {
    expect(await ast('<?php $x = "foo" . "bar"; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Concat', left: { tag: 'String' }, right: { tag: 'String' } } }]
    })
  })

  test('unary minus', async () => {
    expect(await ast('<?php $x = -5; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '-', expression: { value: '5' } } }]
    })
  })

  test('unary not', async () => {
    expect(await ast('<?php $x = !false; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'UnaryExpr', op: '!' } }]
    })
  })

  test('equality operators', async () => {
    expect(await ast('<?php $x = 1 == 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Eq' } }] })
    expect(await ast('<?php $x = 1 != 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Neq' } }] })
    expect(await ast('<?php $x = 1 === 1; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'StrictEq' } }] })
    expect(await ast('<?php $x = 1 !== 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'StrictNeq' } }] })
  })

  test('comparison operators', async () => {
    expect(await ast('<?php $x = 1 < 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Lt' } }] })
    expect(await ast('<?php $x = 1 > 2; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Gt' } }] })
    expect(await ast('<?php $x = 3 <= 3; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Lte' } }] })
    expect(await ast('<?php $x = 3 >= 4; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Gte' } }] })
  })

  test('logical and/or', async () => {
    expect(await ast('<?php $x = true && false; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'And' } }] })
    expect(await ast('<?php $x = true || false; ?>')).toMatchObject({ tag: 'Program', statements: [{ value: { tag: 'Or' } }] })
  })

  test('left associative subtraction', async () => {
    expect(await ast('<?php $x = 10 - 3 - 2; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Sub', left: { tag: 'Sub' }, right: { value: '2' } } }]
    })
  })

  test('IfStmt with braces', async () => {
    expect(await ast('<?php if (true) { echo "ya"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', condition: { tag: 'True' }, body: [{ tag: 'Echo' }] }]
    })
  })

  test('IfStmt with Else', async () => {
    expect(await ast('<?php if (false) { echo "ya"; } else { echo "tidak"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', else: { tag: 'Else', body: [{ tag: 'Echo' }] } }]
    })
  })

  test('IfStmt with ElseIf', async () => {
    expect(await ast('<?php if ($x == 1) { echo "satu"; } elseif ($x == 2) { echo "dua"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'IfStmt', elseif: [{ tag: 'ElseIf', condition: { tag: 'Eq' } }] }]
    })
  })

  test('While loop', async () => {
    expect(await ast('<?php while ($i < 3) { echo $i; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'While', condition: { tag: 'Lt' } }]
    })
  })

  test('For loop', async () => {
    expect(await ast('<?php for ($i = 0; $i < 3; $i++) { echo $i; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'For', init: { tag: 'Assign', name: 'i' }, condition: { tag: 'Lt' }, update: { tag: 'PostfixExpr', op: '++' } }]
    })
  })

  test('For loop tanpa init', async () => {
    expect(await ast('<?php for (; $i < 2; $i++) { echo $i; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'For', init: null }]
    })
  })

  test('FuncDecl', async () => {
    expect(await ast('<?php function sapa() { echo "halo"; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', name: 'sapa' }]
    })
  })

  test('FuncDecl with params', async () => {
    expect(await ast('<?php function tambah($a, $b) { return $a + $b; }')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'FuncDecl', params: { params: [{ tag: 'Param', name: 'a' }, { tag: 'Param', name: 'b' }] } }]
    })
  })

  test('Return with value', async () => {
    expect(await ast('<?php function f() { return 42; }')).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'Return', value: { tag: 'Int', value: '42' } }] }]
    })
  })

  test('Return tanpa value', async () => {
    const a = await ast('<?php function f() { return; }')
    expect(a).toMatchObject({
      tag: 'Program',
      statements: [{ body: [{ tag: 'Return' }] }]
    })
    expect((a as any).statements[0].body[0].value).toBeNull()
  })

  test('CallExpr', async () => {
    expect(await ast('<?php strlen("halo"); ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'CallExpr', name: 'strlen' } }]
    })
  })

  test('ArrayLit', async () => {
    expect(await ast('<?php $a = [10, 20, 30]; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'ArrayLit', elements: { args: [{ value: '10' }, { value: '20' }, { value: '30' }] } } }]
    })
  })

  test('ArrayLit empty', async () => {
    expect(await ast('<?php $a = []; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'ArrayLit', elements: null } }]
    })
  })

  test('Index access', async () => {
    expect(await ast('<?php $x = $a[0]; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'IndexExpr', expression: { tag: 'Var', name: 'a' }, index: { value: '0' } } }]
    })
  })

  test('Postfix increment', async () => {
    expect(await ast('<?php $i++; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'PostfixExpr', expression: { tag: 'Var' }, op: '++' } }]
    })
  })

  test('Prefix increment', async () => {
    expect(await ast('<?php ++$i; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'ExprStmt', expression: { tag: 'UnaryExpr', op: '++' } }]
    })
  })

  test('Empty statement', async () => {
    expect(await ast('<?php ; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ tag: 'Empty' }]
    })
  })

  test('multiple statements', async () => {
    expect(await ast('<?php $a = 1; $b = 2; echo $a + $b; ?>')).toMatchObject({
      tag: 'Program',
      statements: [{}, {}, {}]
    })
  })

  test('teks campur PHP dan HTML di-wrap jadi echo', async () => {
    expect(await ast('Hello <?= "John" ?>!')).toMatchObject({ tag: 'Program' })
  })

  test('syntax error', async () => {
    await expect(ast('<?php $x = ; ?>')).rejects.toThrow()
  })

  test('complex nested expression', async () => {
    expect(await ast('<?php $x = ($a + $b) * ($c - $d); ?>')).toMatchObject({
      tag: 'Program',
      statements: [{ value: { tag: 'Mul', left: { tag: 'Add' }, right: { tag: 'Sub' } } }]
    })
  })
})
