import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-pug.packrat`, 'utf-8')
const parsePug = (source: string) => packrat(grammarText)(source)

describe('mini-pug parser', () => {
  const ast = (src: string) => parsePug(src) as any

  test('Pug root', () => {
    expect(ast('p')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element' }] })
  })

  test('tag sederhana', () => {
    expect(ast('p')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element', name: 'p' }] })
  })

  test('tag div', () => {
    expect(ast('div')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element', name: 'div' }] })
  })

  test('tag dengan inline text', () => {
    expect(ast('p Hello World')).toMatchObject({
      tag: 'Pug',
      elements: [{ tag: 'Element', name: 'p', text: 'Hello World' }]
    })
  })

  test('nested elements 2 level', () => {
    expect(ast('div\n  p Hello')).toMatchObject({
      tag: 'Pug',
      elements: [{ tag: 'Element', name: 'div', children: [{ tag: 'Element', name: 'p', text: 'Hello' }] }]
    })
  })

  test('nested elements 3 level', () => {
    expect(ast('div\n  section\n    p Deep')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'div', children: [{ name: 'section', children: [{ name: 'p', text: 'Deep' }] }] }]
    })
  })

  test('sibling elements', () => {
    expect(ast('div\n  p First\n  p Second')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'p', text: 'First' }, { name: 'p', text: 'Second' }] }]
    })
  })

  test('class shorthand', () => {
    expect(ast('div.container')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div.container' }] })
  })

  test('id shorthand', () => {
    expect(ast('div#main')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div#main' }] })
  })

  test('class dan id bareng', () => {
    expect(ast('div.container#main')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div.container#main' }] })
  })

  test('multiple classes', () => {
    expect(ast('div.foo.bar')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div.foo.bar' }] })
  })

  test('implicit div dengan class', () => {
    expect(ast('.container')).toMatchObject({ tag: 'Pug', elements: [{ name: '.container' }] })
  })

  test('implicit div dengan id', () => {
    expect(ast('#header')).toMatchObject({ tag: 'Pug', elements: [{ name: '#header' }] })
  })

  test('void elements', () => {
    for (const tag of ['br', 'hr', 'img', 'input', 'meta', 'link']) {
      expect(ast(tag)).toMatchObject({ tag: 'Pug', elements: [{ name: tag }] })
    }
  })

  test('void element dengan class', () => {
    expect(ast('hr.divider')).toMatchObject({ tag: 'Pug', elements: [{ name: 'hr.divider' }] })
  })

  test('tag dengan text dan children', () => {
    expect(ast('div Parent text\n  p Child')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'div', text: 'Parent text', children: [{ name: 'p', text: 'Child' }] }]
    })
  })

  test('dedent ke parent setelah sibling dalam', () => {
    expect(ast('ul\n  li Item A\n  li\n    ul\n      li Sub A\n      li Sub B\n  li Item B')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'li', text: 'Item A' }, { name: 'li' }, { name: 'li', text: 'Item B' }] }]
    })
  })

  test('root sibling setelah nested block', () => {
    expect(ast('div\n  p Child\nfooter Note')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'div' }, { name: 'footer', text: 'Note' }]
    })
  })

  test('tab indentation didukung', () => {
    expect(ast('div\n\tp Tabbed')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'p', text: 'Tabbed' }] }]
    })
  })

  test('blank line di tengah', () => {
    expect(ast('div\n\n  p After blank')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'p', text: 'After blank' }] }]
    })
  })

  test('empty input error', () => {
    expect(() => ast('')).toThrow()
  })

  test('kombinasi class id dan text', () => {
    expect(ast('button.btn.primary#submit Click me')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'button.btn.primary#submit', text: 'Click me' }]
    })
  })

  test('atribut sederhana', () => {
    expect(ast('a(href="/link")')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'a', attrs: { tag: 'Attrs', attrs: [{ name: 'href', value: '/link' }] } }]
    })
  })

  test('atribut ganda', () => {
    expect(ast('a(href="/link" target="_blank")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'href' }, { name: 'target', value: '_blank' }] } }]
    })
  })

  test('atribut di void element', () => {
    expect(ast('input(type="text" name="user")')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'input', attrs: { attrs: [{ name: 'type' }, { name: 'name' }] } }]
    })
  })

  test('boolean attribute (tanpa value)', () => {
    expect(ast('input(disabled)')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'disabled', value: null }] } }]
    })
  })

  test('atribut dengan dash di nama', () => {
    expect(ast('div(data-id="5")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'data-id', value: '5' }] } }]
    })
  })

  test('atribut dengan spasi di value', () => {
    expect(ast('div(class="foo bar")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ value: 'foo bar' }] } }]
    })
  })

  test('atribut dengan text', () => {
    expect(ast('a(href="/link") Click me')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'href' }] }, text: 'Click me' }]
    })
  })

  test('shorthand class + atribut', () => {
    expect(ast('a.btn(href="/x")')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'a.btn', attrs: { attrs: [{ name: 'href' }] } }]
    })
  })

  test('atribut dengan children', () => {
    expect(ast('div(data-x="1")\n  p Hi')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'data-x' }] }, children: [{ name: 'p', text: 'Hi' }] }]
    })
  })

  test('escaping di attribute value', () => {
    expect(ast('a(href="/search?q=a&b=1")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ value: '/search?q=a&b=1' }] } }]
    })
  })

  test('attribute value kosong', () => {
    expect(ast('input(value="")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ value: '' }] } }]
    })
  })

  test('template HTML sederhana', () => {
    expect(ast('html\n  head\n    title My Site\n  body\n    div.container\n      h1 Welcome\n      p Hello World')).toMatchObject({
      tag: 'Pug',
      elements: [{
        name: 'html',
        children: [
          { name: 'head', children: [{ name: 'title', text: 'My Site' }] },
          { name: 'body', children: [{ name: 'div.container', children: [{ name: 'h1' }, { name: 'p' }] }] }
        ]
      }]
    })
  })

  test('deep nesting 5 level', () => {
    expect(ast('div\n  section\n    article\n      aside\n        p Deepest')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ children: [{ children: [{ children: [{ name: 'p', text: 'Deepest' }] }] }] }] }]
    })
  })
})
