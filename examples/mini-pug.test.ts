import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-pug.packrat`, 'utf-8')
const parsePug = async (source: string) => (await packrat(grammarText))(source)

describe('mini-pug parser', () => {
  const ast = async (src: string) => (await parsePug(src)) as any

  test('Pug root', async () => {
    expect(await ast('p')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element' }] })
  })

  test('tag sederhana', async () => {
    expect(await ast('p')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element', name: 'p' }] })
  })

  test('tag div', async () => {
    expect(await ast('div')).toMatchObject({ tag: 'Pug', elements: [{ tag: 'Element', name: 'div' }] })
  })

  test('tag dengan inline text', async () => {
    expect(await ast('p Hello World')).toMatchObject({
      tag: 'Pug',
      elements: [{ tag: 'Element', name: 'p', text: 'Hello World' }]
    })
  })

  test('nested elements 2 level', async () => {
    expect(await ast('div\n  p Hello')).toMatchObject({
      tag: 'Pug',
      elements: [{ tag: 'Element', name: 'div', children: [{ tag: 'Element', name: 'p', text: 'Hello' }] }]
    })
  })

  test('nested elements 3 level', async () => {
    expect(await ast('div\n  section\n    p Deep')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'div', children: [{ name: 'section', children: [{ name: 'p', text: 'Deep' }] }] }]
    })
  })

  test('sibling elements', async () => {
    expect(await ast('div\n  p First\n  p Second')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'p', text: 'First' }, { name: 'p', text: 'Second' }] }]
    })
  })

  test('class shorthand', async () => {
    expect(await ast('div.container')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div.container' }] })
  })

  test('id shorthand', async () => {
    expect(await ast('div#main')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div#main' }] })
  })

  test('class dan id bareng', async () => {
    expect(await ast('div.container#main')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div.container#main' }] })
  })

  test('multiple classes', async () => {
    expect(await ast('div.foo.bar')).toMatchObject({ tag: 'Pug', elements: [{ name: 'div.foo.bar' }] })
  })

  test('implicit div dengan class', async () => {
    expect(await ast('.container')).toMatchObject({ tag: 'Pug', elements: [{ name: '.container' }] })
  })

  test('implicit div dengan id', async () => {
    expect(await ast('#header')).toMatchObject({ tag: 'Pug', elements: [{ name: '#header' }] })
  })

  test('void elements', async () => {
    for (const tag of ['br', 'hr', 'img', 'input', 'meta', 'link']) {
      expect(await ast(tag)).toMatchObject({ tag: 'Pug', elements: [{ name: tag }] })
    }
  })

  test('void element dengan class', async () => {
    expect(await ast('hr.divider')).toMatchObject({ tag: 'Pug', elements: [{ name: 'hr.divider' }] })
  })

  test('tag dengan text dan children', async () => {
    expect(await ast('div Parent text\n  p Child')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'div', text: 'Parent text', children: [{ name: 'p', text: 'Child' }] }]
    })
  })

  test('dedent ke parent setelah sibling dalam', async () => {
    expect(await ast('ul\n  li Item A\n  li\n    ul\n      li Sub A\n      li Sub B\n  li Item B')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'li', text: 'Item A' }, { name: 'li' }, { name: 'li', text: 'Item B' }] }]
    })
  })

  test('root sibling setelah nested block', async () => {
    expect(await ast('div\n  p Child\nfooter Note')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'div' }, { name: 'footer', text: 'Note' }]
    })
  })

  test('tab indentation didukung', async () => {
    expect(await ast('div\n\tp Tabbed')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'p', text: 'Tabbed' }] }]
    })
  })

  test('blank line di tengah', async () => {
    expect(await ast('div\n\n  p After blank')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ name: 'p', text: 'After blank' }] }]
    })
  })

  test('empty input error', async () => {
    await expect(ast('')).rejects.toThrow()
  })

  test('kombinasi class id dan text', async () => {
    expect(await ast('button.btn.primary#submit Click me')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'button.btn.primary#submit', text: 'Click me' }]
    })
  })

  test('atribut sederhana', async () => {
    expect(await ast('a(href="/link")')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'a', attrs: { tag: 'Attrs', attrs: [{ name: 'href', value: '/link' }] } }]
    })
  })

  test('atribut ganda', async () => {
    expect(await ast('a(href="/link" target="_blank")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'href' }, { name: 'target', value: '_blank' }] } }]
    })
  })

  test('atribut di void element', async () => {
    expect(await ast('input(type="text" name="user")')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'input', attrs: { attrs: [{ name: 'type' }, { name: 'name' }] } }]
    })
  })

  test('boolean attribute (tanpa value)', async () => {
    expect(await ast('input(disabled)')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'disabled', value: null }] } }]
    })
  })

  test('atribut dengan dash di nama', async () => {
    expect(await ast('div(data-id="5")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'data-id', value: '5' }] } }]
    })
  })

  test('atribut dengan spasi di value', async () => {
    expect(await ast('div(class="foo bar")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ value: 'foo bar' }] } }]
    })
  })

  test('atribut dengan text', async () => {
    expect(await ast('a(href="/link") Click me')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'href' }] }, text: 'Click me' }]
    })
  })

  test('shorthand class + atribut', async () => {
    expect(await ast('a.btn(href="/x")')).toMatchObject({
      tag: 'Pug',
      elements: [{ name: 'a.btn', attrs: { attrs: [{ name: 'href' }] } }]
    })
  })

  test('atribut dengan children', async () => {
    expect(await ast('div(data-x="1")\n  p Hi')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ name: 'data-x' }] }, children: [{ name: 'p', text: 'Hi' }] }]
    })
  })

  test('escaping di attribute value', async () => {
    expect(await ast('a(href="/search?q=a&b=1")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ value: '/search?q=a&b=1' }] } }]
    })
  })

  test('attribute value kosong', async () => {
    expect(await ast('input(value="")')).toMatchObject({
      tag: 'Pug',
      elements: [{ attrs: { attrs: [{ value: '' }] } }]
    })
  })

  test('template HTML sederhana', async () => {
    expect(await ast('html\n  head\n    title My Site\n  body\n    div.container\n      h1 Welcome\n      p Hello World')).toMatchObject({
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

  test('deep nesting 5 level', async () => {
    expect(await ast('div\n  section\n    article\n      aside\n        p Deepest')).toMatchObject({
      tag: 'Pug',
      elements: [{ children: [{ children: [{ children: [{ children: [{ name: 'p', text: 'Deepest' }] }] }] }] }]
    })
  })
})
