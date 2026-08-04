import { describe, expect, test } from 'bun:test'
import { packrat } from './packrat'

describe('Left recursion (direct)', () => {
  test('left-associative binary op — 2 operand', () => {
    const parse = packrat`
      E = left:E "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9-3', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Minus',
      left: { tag: 'Digit', value: '9' },
      right: { tag: 'Digit', value: '3' },
    })
  })

  test('left-associative binary op — chained 3 operand, harus nest ke kiri', () => {
    const parse = packrat`
      E = left:E "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9-3-1', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Minus',
      left: {
        tag: 'Minus',
        left: { tag: 'Digit', value: '9' },
        right: { tag: 'Digit', value: '3' },
      },
      right: { tag: 'Digit', value: '1' },
    })
  })

  test('left-associative binary op — chained 4 operand, mastiin gak ada regresi di growing loop yang lebih dalem', () => {
    const parse = packrat`
      E = left:E "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9-3-1-2', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Minus',
      left: {
        tag: 'Minus',
        left: {
          tag: 'Minus',
          left: { tag: 'Digit', value: '9' },
          right: { tag: 'Digit', value: '3' },
        },
        right: { tag: 'Digit', value: '1' },
      },
      right: { tag: 'Digit', value: '2' },
    })
  })

  test('base case doang (gak ada operator) -> gak boleh ke-wrap Minus', () => {
    const parse = packrat`
      E = left:E "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9', { startRule: 'E' })
    expect(result).toMatchObject({ tag: 'Digit', value: '9' })
  })

  test('left recursion + grouping (Primary -> Group) -> parenthesized nested expr', () => {
    const parse = packrat`
      E = left:E "+" right:D -> Plus / D
      D = value:$[0-9]+ -> Digit / "(" ^E ")"
    `
    const result = parse('(1+2)+3', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Plus',
      left: {
        tag: 'Plus',
        left: { tag: 'Digit', value: '1' },
        right: { tag: 'Digit', value: '2' },
      },
      right: { tag: 'Digit', value: '3' },
    })
  })

  test('left recursion gagal total -> throw', () => {
    const parse = packrat`
      E = left:E "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    expect(() => parse('abc', { startRule: 'E' })).toThrow()
  })
})

describe('Left recursion (indirect / mutual)', () => {
  test('2-rule mutual cycle (L <-> P), dari contoh l-value klasik Medeiros et al.', () => {
    const parse = packrat`
      L = target:P "." "x" -> Access / "x" -> Var
      P = target:P "(" "n" ")" -> Call / L
    `
    const result = parse('x(n)(n).x(n).x', { startRule: 'L' })
    expect(result).toMatchObject({
      tag: 'Access',
      target: {
        tag: 'Call',
        target: {
          tag: 'Access',
          target: {
            tag: 'Call',
            target: { tag: 'Call', target: { tag: 'Var' } },
          },
        },
      },
    })
  })

  test('2-rule mutual cycle, P dipanggil duluan sebagai start rule (bukan L) -> tetep harus bener', () => {
    const parse = packrat`
      L = target:P "." "x" -> Access / "x" -> Var
      P = target:P "(" "n" ")" -> Call / L
    `
    const result = parse('x(n)', { startRule: 'P' })
    expect(result).toMatchObject({
      tag: 'Call',
      target: { tag: 'Var' },
    })
  })

  test('3-level mutual chain A -> B -> C -> A', () => {
    const parse = packrat`
      A = left:B "+" "n" -> APlus / B
      B = left:C "-" "n" -> BMinus / C
      C = left:A "*" "n" -> CTimes / "n" -> CBase
    `
    const result = parse('n*n', { startRule: 'A' })
    expect(result).toMatchObject({
      tag: 'CTimes',
      left: { tag: 'CBase' },
    })
  })

  test('3-level mutual chain, gagal total karena base case gak ketemu', () => {
    const parse = packrat`
      A = left:B "+" "n" -> APlus / B
      B = left:C "-" "n" -> BMinus / C
      C = left:A "*" "n" -> CTimes / "n" -> CBase
    `
    expect(() => parse('xyz', { startRule: 'A' })).toThrow()
  })
})

describe('Right recursion', () => {
  test('right-associative binary op — 2 operand', () => {
    const parse = packrat`
      E = left:D "+" right:E -> Plus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('1+2', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Plus',
      left: { tag: 'Digit', value: '1' },
      right: { tag: 'Digit', value: '2' },
    })
  })

  test('right-associative binary op — chained 3 operand, harus nest ke kanan', () => {
    const parse = packrat`
      E = left:D "+" right:E -> Plus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('1+2+3', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Plus',
      left: { tag: 'Digit', value: '1' },
      right: {
        tag: 'Plus',
        left: { tag: 'Digit', value: '2' },
        right: { tag: 'Digit', value: '3' },
      },
    })
  })

  test('right recursion, base case doang -> gak boleh ke-wrap Plus', () => {
    const parse = packrat`
      E = left:D "+" right:E -> Plus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('1', { startRule: 'E' })
    expect(result).toMatchObject({ tag: 'Digit', value: '1' })
  })

  test('right recursion indirect (E -> F -> E), mutual tapi arahnya kanan semua', () => {
    const parse = packrat`
      E = value:$[0-9]+ ":" next:F -> Cons / value:$[0-9]+ -> Nil
      F = E
    `
    const result = parse('1:2:3', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Cons',
      value: '1',
      next: {
        tag: 'Cons',
        value: '2',
        next: { tag: 'Nil', value: '3' },
      },
    })
  })
})

describe('Mixed left + right recursion', () => {
  test('E (right-assoc +) membungkus M (left-assoc -), dua arah sekaligus', () => {
    const parse = packrat`
      E = left:M "+" right:E -> Plus / M
      M = left:M "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9-3+1', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Plus',
      left: {
        tag: 'Minus',
        left: { tag: 'Digit', value: '9' },
        right: { tag: 'Digit', value: '3' },
      },
      right: { tag: 'Digit', value: '1' },
    })
  })

  test('mixed, chained lebih panjang -> mastiin precedence gak collapse pas di-grow berkali-kali', () => {
    const parse = packrat`
      E = left:M "+" right:E -> Plus / M
      M = left:M "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9-3-1+2+5', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Plus',
      left: {
        tag: 'Minus',
        left: {
          tag: 'Minus',
          left: { tag: 'Digit', value: '9' },
          right: { tag: 'Digit', value: '3' },
        },
        right: { tag: 'Digit', value: '1' },
      },
      right: {
        tag: 'Plus',
        left: { tag: 'Digit', value: '2' },
        right: { tag: 'Digit', value: '5' },
      },
    })
  })

  test('mixed, cuma left-side (M) doang yang ke-trigger, E gak pernah grow', () => {
    const parse = packrat`
      E = left:M "+" right:E -> Plus / M
      M = left:M "-" right:D -> Minus / D
      D = value:$[0-9]+ -> Digit
    `
    const result = parse('9-3-1', { startRule: 'E' })
    expect(result).toMatchObject({
      tag: 'Minus',
      left: {
        tag: 'Minus',
        left: { tag: 'Digit', value: '9' },
        right: { tag: 'Digit', value: '3' },
      },
      right: { tag: 'Digit', value: '1' },
    })
  })

  test('mixed dibungkus indirect cycle: N (left) -> M (right) -> N lagi', () => {
    const parse = packrat`
      N = left:N "-" right:M -> Minus / M
      M = value:$[0-9]+ "*" next:N -> Times / value:$[0-9]+ -> Digit
    `
    const result = parse('2*3-4*1-5', { startRule: 'N' })
    expect(result).toMatchObject({
      tag: 'Times',
      value: '2',
      next: {
        tag: 'Minus',
        left: { tag: 'Digit', value: '3' },
        right: {
          tag: 'Times',
          value: '4',
          next: {
            tag: 'Minus',
            left: { tag: 'Digit', value: '1' },
            right: { tag: 'Digit', value: '5' },
          },
        },
      },
    })
  })
})
