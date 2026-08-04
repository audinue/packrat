import { expect, test, describe } from 'bun:test'
import { runGo, parseGo } from './mini-golang'

describe('mini-golang', () => {
  test('parseGo returns AST', () => {
    const ast = parseGo('x := 42') as any
    expect(ast).toMatchObject({ tag: 'Program' })
    expect(ast.statements).toHaveLength(1)
  })

  test('var declaration', () => {
    const logs = runGo(`
      var x int = 10
      println(x)
    `)
    expect(logs).toEqual(['10'])
  })

  test('short var declaration', () => {
    const logs = runGo(`
      x := 42
      println(x)
    `)
    expect(logs).toEqual(['42'])
  })

  test('string variable', () => {
    const logs = runGo(`
      name := "hello"
      println(name)
    `)
    expect(logs).toEqual(['hello'])
  })

  test('bool variable', () => {
    const logs = runGo(`
      ok := true
      println(ok)
    `)
    expect(logs).toEqual(['true'])
  })

  test('addition', () => {
    const logs = runGo(`
      x := 3 + 4
      println(x)
    `)
    expect(logs).toEqual(['7'])
  })

  test('subtraction', () => {
    const logs = runGo(`
      x := 10 - 3
      println(x)
    `)
    expect(logs).toEqual(['7'])
  })

  test('multiplication', () => {
    const logs = runGo(`
      x := 3 * 4
      println(x)
    `)
    expect(logs).toEqual(['12'])
  })

  test('integer division', () => {
    const logs = runGo(`
      x := 10 / 3
      println(x)
    `)
    expect(logs).toEqual(['3'])
  })

  test('modulo', () => {
    const logs = runGo(`
      x := 10 % 3
      println(x)
    `)
    expect(logs).toEqual(['1'])
  })

  test('operator precedence', () => {
    const logs = runGo(`
      x := 2 + 3 * 4
      println(x)
    `)
    expect(logs).toEqual(['14'])
  })

  test('parentheses override precedence', () => {
    const logs = runGo(`
      x := (2 + 3) * 4
      println(x)
    `)
    expect(logs).toEqual(['20'])
  })

  test('operator left associative', () => {
    const logs = runGo(`
      println(10 - 3 - 2)
      println(10 / 2 / 5)
    `)
    expect(logs).toEqual(['5', '1'])
  })

  test('negative number via unary', () => {
    const logs = runGo(`
      x := -5
      println(x)
    `)
    expect(logs).toEqual(['-5'])
  })

  test('equality', () => {
    const logs = runGo(`
      println(3 == 3)
      println(3 == 4)
    `)
    expect(logs).toEqual(['true', 'false'])
  })

  test('inequality', () => {
    const logs = runGo(`
      println(3 != 4)
      println(3 != 3)
    `)
    expect(logs).toEqual(['true', 'false'])
  })

  test('less than', () => {
    const logs = runGo(`
      println(3 < 5)
      println(5 < 3)
    `)
    expect(logs).toEqual(['true', 'false'])
  })

  test('greater than', () => {
    const logs = runGo(`
      println(5 > 3)
      println(3 > 5)
    `)
    expect(logs).toEqual(['true', 'false'])
  })

  test('less than or equal', () => {
    const logs = runGo(`
      println(3 <= 3)
      println(3 <= 5)
      println(5 <= 3)
    `)
    expect(logs).toEqual(['true', 'true', 'false'])
  })

  test('greater than or equal', () => {
    const logs = runGo(`
      println(5 >= 5)
      println(5 >= 3)
      println(3 >= 5)
    `)
    expect(logs).toEqual(['true', 'true', 'false'])
  })

  test('logical and', () => {
    const logs = runGo(`
      println(true && true)
      println(true && false)
    `)
    expect(logs).toEqual(['true', 'false'])
  })

  test('logical or', () => {
    const logs = runGo(`
      println(false || true)
      println(false || false)
    `)
    expect(logs).toEqual(['true', 'false'])
  })

  test('logical not', () => {
    const logs = runGo(`
      println(!true)
      println(!false)
    `)
    expect(logs).toEqual(['false', 'true'])
  })

  test('if true', () => {
    const logs = runGo(`
      if true {
        println("yes")
      }
    `)
    expect(logs).toEqual(['yes'])
  })

  test('if false', () => {
    const logs = runGo(`
      if false {
        println("yes")
      }
    `)
    expect(logs).toEqual([])
  })

  test('if with condition expression', () => {
    const logs = runGo(`
      x := 10
      if x > 5 {
        println("big")
      }
    `)
    expect(logs).toEqual(['big'])
  })

  test('if/else', () => {
    const logs = runGo(`
      x := 3
      if x > 5 {
        println("big")
      } else {
        println("small")
      }
    `)
    expect(logs).toEqual(['small'])
  })

  test('for loop with condition', () => {
    const logs = runGo(`
      i := 0
      for i < 3 {
        println(i)
        i = i + 1
      }
    `)
    expect(logs).toEqual(['0', '1', '2'])
  })

  test('function declaration and call', () => {
    const logs = runGo(`
      func greet() {
        println("hello")
      }
      greet()
    `)
    expect(logs).toEqual(['hello'])
  })

  test('function with parameters', () => {
    const logs = runGo(`
      func add(a: int, b: int) {
        println(a + b)
      }
      add(3, 4)
    `)
    expect(logs).toEqual(['7'])
  })

  test('function with return', () => {
    const logs = runGo(`
      func double(x: int) {
        return x * 2
      }
      result := double(5)
      println(result)
    `)
    expect(logs).toEqual(['10'])
  })

  test('recursive function - fibonacci', () => {
    const logs = runGo(`
      func fib(n: int) {
        if n <= 1 {
          return n
        }
        a := fib(n - 1)
        b := fib(n - 2)
        return a + b
      }
      println(fib(7))
    `)
    expect(logs).toEqual(['13'])
  })

  test('function scope isolation', () => {
    const logs = runGo(`
      x := 10
      func modify() {
        x := 99
        println(x)
      }
      modify()
      println(x)
    `)
    expect(logs).toEqual(['99', '10'])
  })

  test('println multiple args', () => {
    const logs = runGo(`
      println("a", "b", "c")
    `)
    expect(logs).toEqual(['a b c'])
  })

  test('slice creation and indexing', () => {
    const logs = runGo(`
      arr := [1, 2, 3]
      println(arr[0])
      println(arr[1])
      println(arr[2])
    `)
    expect(logs).toEqual(['1', '2', '3'])
  })

  test('expression statement (function call)', () => {
    const logs = runGo(`
      func hi() {
        println("hi")
      }
      hi()
    `)
    expect(logs).toEqual(['hi'])
  })
})
