import { describe, expect, test } from 'bun:test'
import { runJs, parseJs } from './mini-js'

describe('mini-js', () => {
  test('parseJs returns AST', () => {
    const ast = parseJs('console.log(`halo`)') as any
    expect(ast.tag).toBe('Program')
    expect(ast.statements.length).toBe(1)
  })

  test('template literal dasar', () => {
    expect(runJs('console.log(`halo`)')).toEqual(['halo'])
    expect(runJs("console.log(`halo dunia!`)")).toEqual(['halo dunia!'])
  })

  test('template literal interpolasi ekspresi', () => {
    expect(runJs('console.log(`1 + 2 = ${1 + 2}`)')).toEqual(['1 + 2 = 3'])
    expect(runJs('console.log(`7 * 6 = ${7 * 6}`)')).toEqual(['7 * 6 = 42'])
  })

  test('template literal interpolasi variabel', () => {
    expect(runJs('const nama = "budi"; console.log(`halo ${nama}`)')).toEqual(['halo budi'])
  })

  test('template literal multi interpolasi', () => {
    expect(runJs('const a = 1; const b = 2; console.log(`${a} + ${b} = ${a + b}`)')).toEqual(['1 + 2 = 3'])
  })

  test('interpolasi string & boolean', () => {
    expect(runJs('const s = "x"; console.log(`s=${s} ok=${true}`)')).toEqual(['s=x ok=true'])
  })

  test('operator left associative', () => {
    expect(runJs('console.log(10 - 3 - 2);')).toEqual(['5'])
    expect(runJs('console.log(10 / 2 / 5);')).toEqual(['1'])
  })

  test('escape backtick dan dollar di template', () => {
    expect(runJs('console.log(`a\\`b`)')).toEqual(['a`b'])
    expect(runJs('console.log(`harga \\$5`)')).toEqual(['harga $5'])
  })

  test('escape newline di template', () => {
    expect(runJs('console.log(`baris 1\\nbaris 2`)')).toEqual(['baris 1\nbaris 2'])
  })

  test('template multi baris (newline asli)', () => {
    expect(runJs('console.log(`baris 1\nbaris 2`)')).toEqual(['baris 1\nbaris 2'])
  })

  test('template literal nested', () => {
    expect(runJs('const x = "dalam"; console.log(`luar ${`dalam ${x}`}`)')).toEqual(['luar dalam dalam'])
  })

  test('tagged template dasar', () => {
    const code = `
function greet(strs, name) {
  return strs[0] + name + strs[1];
}
const nama = "budi";
console.log(greet\`halo ${'${nama}'}, apa kabar?\`)
`
    expect(runJs(code)).toEqual(['halo budi, apa kabar?'])
  })

  test('tag menerima strings array', () => {
    const code = `
function tag(strs) {
  return strs;
}
console.log(tag\`a${'${1}'}b${'${2}'}c\`)
`
    expect(runJs(code)).toEqual(['[a, b, c]'])
  })

  test('tag dengan rest param (demo esc)', () => {
    const code = `
function esc(strs, ...vals) {
  let out = strs[0];
  for (let i = 0; i < vals.length; i++) {
    out = out + vals[i] + strs[i + 1];
  }
  return out;
}
const nama = "budi";
const umur = 25;
console.log(esc\`halo ${'${nama}'}, umurmu ${'${umur}'} tahun\`)
`
    expect(runJs(code)).toEqual(['halo budi, umurmu 25 tahun'])
  })

  test('tag tanpa interpolasi', () => {
    const code = `
function upper(strs) {
  return strs[0].length;
}
console.log(upper\`abc\`)
`
    expect(runJs(code)).toEqual(['3'])
  })

  test('tag dengan interpolasi ekspresi', () => {
    const code = `
function join(strs, ...vals) {
  let out = strs[0];
  for (let i = 0; i < vals.length; i++) {
    out = out + "[" + vals[i] + "]" + strs[i + 1];
  }
  return out;
}
console.log(join\`x${'${1 + 1}'}y${'${2 * 3}'}z\`)
`
    expect(runJs(code)).toEqual(['x[2]y[6]z'])
  })

  test('tag berantai nested', () => {
    const code = `
function wrap(strs, ...vals) {
  return "<" + vals[0] + ">";
}
const hasil = wrap\`a${'${"dalam"}'}b\`;
console.log(hasil)
`
    expect(runJs(code)).toEqual(['<dalam>'])
  })

  test('tag tidak terdefinisi error', () => {
    expect(() => runJs('gakada`halo`')).toThrow()
  })

  test('template tidak ditutup error', () => {
    expect(() => runJs('console.log(`halo)')).toThrow()
  })

  test('console.log multi argumen', () => {
    expect(runJs('console.log(1, 2, "tiga")')).toEqual(['1 2 tiga'])
  })

  test('fungsi biasa + return', () => {
    expect(runJs('function tambah(a, b) { return a + b; } console.log(tambah(2, 3))')).toEqual(['5'])
  })

  test('closure lihat variabel luar', () => {
    expect(runJs('const nama = "budi"; function sapa() { return "halo " + nama; } console.log(sapa())')).toEqual(['halo budi'])
  })

  test('rest param fungsi biasa', () => {
    expect(runJs('function jumlah(...nums) { let total = 0; for (let i = 0; i < nums.length; i++) { total = total + nums[i]; } return total; } console.log(jumlah(1, 2, 3, 4))')).toEqual(['10'])
  })

  test('let + while + postfix', () => {
    expect(runJs('let n = 3; while (n > 0) { console.log(n); n--; }')).toEqual(['3', '2', '1'])
  })

  test('for loop gaya js', () => {
    expect(runJs('for (let i = 0; i < 3; i++) { console.log(i); }')).toEqual(['0', '1', '2'])
  })

  test('if else', () => {
    expect(runJs('const x = 5; if (x > 3) { console.log("besar"); } else { console.log("kecil"); }')).toEqual(['besar'])
  })

  test('array + index + length', () => {
    expect(runJs('const arr = [10, 20, 30]; console.log(arr[1], arr.length)')).toEqual(['20 3'])
  })

  test('operator js: && dan || balikin operand', () => {
    expect(runJs('console.log(0 || "fallback", 1 && "ya")')).toEqual(['fallback ya'])
  })

  test('komentar single dan multi line', () => {
    const code = `
// komentar single line
console.log(\`halo\`); /* komentar
multi line */ console.log(\`dunia\`)
`
    expect(runJs(code)).toEqual(['halo', 'dunia'])
  })

  test('tagged template dengan string single quote', () => {
    const code = `
function label(strs, v) {
  return strs[0] + v;
}
console.log(label\`nilai: ${'${'}\'5\'${'}'}\`)
`
    expect(runJs(code)).toEqual(['nilai: 5'])
  })
})
