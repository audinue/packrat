import { describe, expect, test } from 'bun:test'
import { parsePug } from './mini-pug'

describe('mini-pug parser', () => {
  const ast = (src: string) => parsePug(src) as any

  test('Pug root', () => {
    expect(ast('p')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element' }] })
  })

  test('tag sederhana', () => {
    expect(ast('p').elements[0]).toMatchObject({ tag: 'Element', name: 'p' })
  })

  test('tag div', () => {
    expect(ast('div').elements[0]).toMatchObject({ tag: 'Element', name: 'div' })
  })

  test('tag dengan inline text', () => {
    expect(ast('p Hello World').elements[0]).toMatchObject({
      tag: 'Element', name: 'p', text: 'Hello World'
    })
  })

  test('nested elements 2 level', () => {
    expect(ast('div\n  p Hello').elements[0]).toMatchObject({
      tag: 'Element', name: 'div',
      children: [{ tag: 'Element', name: 'p', text: 'Hello' }]
    })
  })

  test('nested elements 3 level', () => {
    expect(ast('div\n  section\n    p Deep').elements[0]).toMatchObject({
      name: 'div',
      children: [{ name: 'section', children: [{ name: 'p', text: 'Deep' }] }]
    })
  })

  test('sibling elements', () => {
    const children = ast('div\n  p First\n  p Second').elements[0].children
    expect(children).toHaveLength(2)
    expect(children[0]).toMatchObject({ name: 'p', text: 'First' })
    expect(children[1]).toMatchObject({ name: 'p', text: 'Second' })
  })

  test('class shorthand', () => {
    expect(ast('div.container').elements[0]).toMatchObject({ name: 'div.container' })
  })

  test('id shorthand', () => {
    expect(ast('div#main').elements[0]).toMatchObject({ name: 'div#main' })
  })

  test('class dan id bareng', () => {
    expect(ast('div.container#main').elements[0]).toMatchObject({ name: 'div.container#main' })
  })

  test('multiple classes', () => {
    expect(ast('div.foo.bar').elements[0]).toMatchObject({ name: 'div.foo.bar' })
  })

  test('implicit div dengan class', () => {
    expect(ast('.container').elements[0]).toMatchObject({ name: '.container' })
  })

  test('implicit div dengan id', () => {
    expect(ast('#header').elements[0]).toMatchObject({ name: '#header' })
  })

  test('void elements', () => {
    for (const tag of ['br', 'hr', 'img', 'input', 'meta', 'link']) {
      expect(ast(tag).elements[0]).toMatchObject({ name: tag })
    }
  })

  test('void element dengan class', () => {
    expect(ast('hr.divider').elements[0]).toMatchObject({ name: 'hr.divider' })
  })

  test('tag dengan text dan children', () => {
    expect(ast('div Parent text\n  p Child').elements[0]).toMatchObject({
      name: 'div', text: 'Parent text', children: [{ name: 'p', text: 'Child' }]
    })
  })

  test('dedent ke parent setelah sibling dalam', () => {
    const children = ast('ul\n  li Item A\n  li\n    ul\n      li Sub A\n      li Sub B\n  li Item B').elements[0].children
    expect(children).toHaveLength(3)
    expect(children[0]).toMatchObject({ name: 'li', text: 'Item A' })
    expect(children[1]).toMatchObject({ name: 'li' })
    expect(children[2]).toMatchObject({ name: 'li', text: 'Item B' })
  })

  test('root sibling setelah nested block', () => {
    const a = ast('div\n  p Child\nfooter Note')
    expect(a.elements).toHaveLength(2)
    expect(a.elements[0]).toMatchObject({ name: 'div' })
    expect(a.elements[1]).toMatchObject({ name: 'footer', text: 'Note' })
  })

  test('tab indentation didukung', () => {
    expect(ast('div\n\tp Tabbed').elements[0].children[0]).toMatchObject({
      name: 'p', text: 'Tabbed'
    })
  })

  test('blank line di tengah', () => {
    expect(ast('div\n\n  p After blank').elements[0].children[0]).toMatchObject({
      name: 'p', text: 'After blank'
    })
  })

  test('empty input error', () => {
    expect(() => ast('')).toThrow()
  })

  test('kombinasi class id dan text', () => {
    expect(ast('button.btn.primary#submit Click me').elements[0]).toMatchObject({
      name: 'button.btn.primary#submit', text: 'Click me'
    })
  })

  test('atribut sederhana', () => {
    expect(ast('a(href="/link")').elements[0]).toMatchObject({
      name: 'a',
      attrs: { tag: 'Attrs', attrs: [{ name: 'href', value: '/link' }] }
    })
  })

  test('atribut ganda', () => {
    expect(ast('a(href="/link" target="_blank")').elements[0]).toMatchObject({
      attrs: { attrs: [{ name: 'href' }, { name: 'target', value: '_blank' }] }
    })
  })

  test('atribut di void element', () => {
    expect(ast('input(type="text" name="user")').elements[0]).toMatchObject({
      name: 'input',
      attrs: { attrs: [{ name: 'type' }, { name: 'name' }] }
    })
  })

  test('boolean attribute (tanpa value)', () => {
    expect(ast('input(disabled)').elements[0]).toMatchObject({
      attrs: { attrs: [{ name: 'disabled', value: null }] }
    })
  })

  test('atribut dengan dash di nama', () => {
    expect(ast('div(data-id="5")').elements[0]).toMatchObject({
      attrs: { attrs: [{ name: 'data-id', value: '5' }] }
    })
  })

  test('atribut dengan spasi di value', () => {
    expect(ast('div(class="foo bar")').elements[0].attrs.attrs[0]).toMatchObject({
      value: 'foo bar'
    })
  })

  test('atribut dengan text', () => {
    expect(ast('a(href="/link") Click me').elements[0]).toMatchObject({
      attrs: { attrs: [{ name: 'href' }] }, text: 'Click me'
    })
  })

  test('shorthand class + atribut', () => {
    expect(ast('a.btn(href="/x")').elements[0]).toMatchObject({
      name: 'a.btn', attrs: { attrs: [{ name: 'href' }] }
    })
  })

  test('atribut dengan children', () => {
    expect(ast('div(data-x="1")\n  p Hi').elements[0]).toMatchObject({
      attrs: { attrs: [{ name: 'data-x' }] },
      children: [{ name: 'p', text: 'Hi' }]
    })
  })

  test('escaping di attribute value', () => {
    expect(ast('a(href="/search?q=a&b=1")').elements[0].attrs.attrs[0]).toMatchObject({
      value: '/search?q=a&b=1'
    })
  })

  test('attribute value kosong', () => {
    expect(ast('input(value="")').elements[0].attrs.attrs[0]).toMatchObject({
      value: ''
    })
  })

  test('template HTML sederhana', () => {
    expect(ast('html\n  head\n    title My Site\n  body\n    div.container\n      h1 Welcome\n      p Hello World').elements[0]).toMatchObject({
      name: 'html',
      children: [
        { name: 'head', children: [{ name: 'title', text: 'My Site' }] },
        { name: 'body', children: [{ name: 'div.container', children: [{ name: 'h1' }, { name: 'p' }] }] }
      ]
    })
  })

  test('deep nesting 5 level', () => {
    const a = ast('div\n  section\n    article\n      aside\n        p Deepest')
    const el = a.elements[0]
    expect(el.children[0].children[0].children[0].children[0]).toMatchObject({
      name: 'p', text: 'Deepest'
    })
  })
})
