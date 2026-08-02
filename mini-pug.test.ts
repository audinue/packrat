import { describe, expect, test } from 'bun:test'
import { pug } from './mini-pug'

describe('mini-pug', () => {
  test('tag kosong', () => {
    expect(pug('p')).toBe('<p></p>')
    expect(pug('div')).toBe('<div></div>')
  })

  test('tag dengan inline text', () => {
    expect(pug('p Hello World')).toBe('<p>Hello World</p>')
  })

  test('nested elements', () => {
    const result = pug('div\n  p Hello')
    expect(result).toBe('<div><p>Hello</p></div>')
  })

  test('nested 3 level', () => {
    const result = pug('div\n  section\n    p Deep')
    expect(result).toBe('<div><section><p>Deep</p></section></div>')
  })

  test('sibling elements', () => {
    const result = pug('div\n  p First\n  p Second')
    expect(result).toBe('<div><p>First</p><p>Second</p></div>')
  })

  test('class shorthand', () => {
    expect(pug('div.container')).toBe('<div class="container"></div>')
    expect(pug('p.highlight')).toBe('<p class="highlight"></p>')
  })

  test('id shorthand', () => {
    expect(pug('div#main')).toBe('<div id="main"></div>')
  })

  test('class dan id bareng', () => {
    expect(pug('div.container#main')).toBe('<div class="container" id="main"></div>')
  })

  test('multiple classes', () => {
    expect(pug('div.foo.bar')).toBe('<div class="foo bar"></div>')
  })

  test('implicit div dengan class', () => {
    expect(pug('.container')).toBe('<div class="container"></div>')
  })

  test('implicit div dengan id', () => {
    expect(pug('#header')).toBe('<div id="header"></div>')
  })

  test('implicit div dengan class dan id', () => {
    expect(pug('.box#hero')).toBe('<div class="box" id="hero"></div>')
  })

  test('void elements (self-closing)', () => {
    expect(pug('br')).toBe('<br />')
    expect(pug('hr')).toBe('<hr />')
    expect(pug('img')).toBe('<img />')
    expect(pug('input')).toBe('<input />')
    expect(pug('meta')).toBe('<meta />')
    expect(pug('link')).toBe('<link />')
  })

  test('void element dengan class dan id', () => {
    expect(pug('hr.divider')).toBe('<hr class="divider" />')
    expect(pug('img#logo')).toBe('<img id="logo" />')
  })

  test('tag dengan text dan children', () => {
    const result = pug('div Parent text\n  p Child')
    expect(result).toBe('<div>Parent text<p>Child</p></div>')
  })

  test('HTML escaping di text', () => {
    expect(pug('p <script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  test('template HTML sederhana', () => {
    const input = `html
  head
    title My Site
  body
    div.container
      h1 Welcome
      p Hello World`
    const result = pug(input)
    expect(result).toBe('<html><head><title>My Site</title></head><body><div class="container"><h1>Welcome</h1><p>Hello World</p></div></body></html>')
  })

  test('ampere escaping (&amp;)', () => {
    expect(pug('p AT&T & T-Mobile')).toBe('<p>AT&amp;T &amp; T-Mobile</p>')
  })

  test('deep nesting 5 level', () => {
    const input = `div
  section
    article
      aside
        p Deepest`
    const result = pug(input)
    expect(result).toBe('<div><section><article><aside><p>Deepest</p></aside></article></section></div>')
  })

  test('dedent ke parent setelah sibling dalam', () => {
    const input = `ul
  li Item A
  li
    ul
      li Sub A
      li Sub B
  li Item B`
    const result = pug(input)
    expect(result).toBe('<ul><li>Item A</li><li><ul><li>Sub A</li><li>Sub B</li></ul></li><li>Item B</li></ul>')
  })

  test('root sibling setelah nested block', () => {
    const input = `div
  p Child
footer Note`
    const result = pug(input)
    expect(result).toBe('<div><p>Child</p></div><footer>Note</footer>')
  })

  test('tab indentation tidak didukung (hanya spasi)', () => {
    expect(() => pug('div\n\tp Tabbed')).toThrow()
  })

  test('blank line di tengah tidak didukung', () => {
    expect(() => pug('div\n\n  p After blank')).toThrow()
  })

  test('empty input tidak didukung', () => {
    expect(() => pug('')).toThrow()
  })

  test('kombinasi class id dan text', () => {
    expect(pug('button.btn.primary#submit Click me')).toBe('<button class="btn primary" id="submit">Click me</button>')
  })

  test('atribut sederhana', () => {
    expect(pug('a(href="/link")')).toBe('<a href="/link"></a>')
  })

  test('atribut ganda', () => {
    expect(pug('a(href="/link" target="_blank")')).toBe('<a href="/link" target="_blank"></a>')
  })

  test('atribut di void element', () => {
    expect(pug('input(type="text" name="user")')).toBe('<input type="text" name="user" />')
  })

  test('atribut dengan spasi di value', () => {
    expect(pug('div(class="foo bar")')).toBe('<div class="foo bar"></div>')
  })

  test('boolean attribute', () => {
    expect(pug('input(disabled)')).toBe('<input disabled />')
  })

  test('atribut dengan dash di nama', () => {
    expect(pug('div(data-id="5")')).toBe('<div data-id="5"></div>')
  })

  test('atribut dengan text', () => {
    expect(pug('a(href="/link") Click me')).toBe('<a href="/link">Click me</a>')
  })

  test('shorthand class + atribut', () => {
    expect(pug('a.btn(href="/x")')).toBe('<a class="btn" href="/x"></a>')
  })

  test('atribut dengan children', () => {
    const result = pug('div(data-x="1")\n  p Hi')
    expect(result).toBe('<div data-x="1"><p>Hi</p></div>')
  })

  test('escaping di attribute value', () => {
    expect(pug('a(href="/search?q=a&b=1")')).toBe('<a href="/search?q=a&amp;b=1"></a>')
  })

  test('attribute value kosong', () => {
    expect(pug('input(value="")')).toBe('<input value="" />')
  })
})
