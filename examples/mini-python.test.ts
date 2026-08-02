import { describe, expect, test } from 'bun:test'
import { py } from './mini-python'

describe('mini-python', () => {
  test('print angka', () => {
    expect(py('print(1)')).toBe('1')
  })

  test('print string', () => {
    expect(py('print("hello")')).toBe('hello')
  })

  test('print string dengan spasi', () => {
    expect(py('print("hello world")')).toBe('hello world')
  })

  test('aritmatika dasar', () => {
    expect(py('print(1 + 2)')).toBe('3')
    expect(py('print(5 - 2)')).toBe('3')
    expect(py('print(3 * 4)')).toBe('12')
    expect(py('print(10 / 2)')).toBe('5')
    expect(py('print(7 % 2)')).toBe('1')
  })

  test('division menghasilkan float', () => {
    expect(py('print(7 / 2)')).toBe('3.5')
  })

  test('precedence operator', () => {
    expect(py('print(1 + 2 * 3)')).toBe('7')
    expect(py('print((1 + 2) * 3)')).toBe('9')
    expect(py('print(2 * 3 + 1)')).toBe('7')
  })

  test('left associative', () => {
    expect(py('print(10 - 3 - 2)')).toBe('5')
  })

  test('unary minus', () => {
    expect(py('print(-5)')).toBe('-5')
    expect(py('print(-5 + 2)')).toBe('-3')
    expect(py('print(2 * -3)')).toBe('-6')
  })

  test('variabel', () => {
    const code = `x = 5
print(x)`
    expect(py(code)).toBe('5')
  })

  test('assignment ganda', () => {
    const code = `x = 2
y = x * 3
print(y)`
    expect(py(code)).toBe('6')
  })

  test('variabel di dalam block', () => {
    const code = `if True:
  x = 7
print(x)`
    expect(py(code)).toBe('7')
  })

  test('string concatenation', () => {
    expect(py('print("foo" + "bar")')).toBe('foobar')
    expect(py('print("Hello " + name)'.replace('name', '"World"'))).toBe('Hello World')
  })

  test('comparison', () => {
    expect(py('print(1 < 2)')).toBe('True')
    expect(py('print(1 > 2)')).toBe('False')
    expect(py('print(2 == 2)')).toBe('True')
    expect(py('print(2 != 2)')).toBe('False')
    expect(py('print(3 <= 3)')).toBe('True')
    expect(py('print(3 >= 4)')).toBe('False')
  })

  test('boolean literal', () => {
    expect(py('print(True)')).toBe('True')
    expect(py('print(False)')).toBe('False')
  })

  test('if else', () => {
    const code = `x = 5
if x > 3:
  print("big")
else:
  print("small")`
    expect(py(code)).toBe('big')
  })

  test('if elif else', () => {
    const code = `x = 2
if x == 1:
  print("one")
elif x == 2:
  print("two")
else:
  print("other")`
    expect(py(code)).toBe('two')
  })

  test('if else branch tidak dieksekusi', () => {
    const code = `x = 1
if x > 3:
  print("big")
else:
  print("small")`
    expect(py(code)).toBe('small')
  })

  test('elif pertama yang match', () => {
    const code = `x = 1
if x == 1:
  print("one")
elif x == 2:
  print("two")
else:
  print("other")`
    expect(py(code)).toBe('one')
  })

  test('tidak ada branch yang match', () => {
    const code = `x = 9
if x == 1:
  print("one")
elif x == 2:
  print("two")
else:
  print("other")`
    expect(py(code)).toBe('other')
  })

  test('while loop', () => {
    const code = `i = 0
while i < 3:
  print(i)
  i = i + 1`
    expect(py(code)).toBe('0\n1\n2')
  })

  test('nested if else', () => {
    const code = `x = 10
if x > 5:
  if x > 8:
    print("big")
  else:
    print("medium")
else:
  print("small")`
    expect(py(code)).toBe('big')
  })

  test('nested if else branch medium', () => {
    const code = `x = 6
if x > 5:
  if x > 8:
    print("big")
  else:
    print("medium")
else:
  print("small")`
    expect(py(code)).toBe('medium')
  })

  test('nested if else branch small', () => {
    const code = `x = 3
if x > 5:
  if x > 8:
    print("big")
  else:
    print("medium")
else:
  print("small")`
    expect(py(code)).toBe('small')
  })

  test('print tanpa argument', () => {
    expect(py('print()')).toBe('')
  })

  test('multiple print', () => {
    expect(py('print(1)\nprint(2)')).toBe('1\n2')
  })

  test('blank line di dalam block', () => {
    const code = `if True:

  print(1)

  print(2)`
    expect(py(code)).toBe('1\n2')
  })

  test('fizzbuzz', () => {
    const code = `i = 1
while i <= 15:
  if i % 15 == 0:
    print("FizzBuzz")
  elif i % 3 == 0:
    print("Fizz")
  elif i % 5 == 0:
    print("Buzz")
  else:
    print(i)
  i = i + 1`
    expect(py(code)).toBe('1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz')
  })

  test('variable tidak terdefinisi', () => {
    expect(() => py('print(x)')).toThrow()
  })

  test('empty input', () => {
    expect(() => py('')).toThrow()
  })

  test('syntax error', () => {
    expect(() => py('x =')).toThrow()
  })
})
