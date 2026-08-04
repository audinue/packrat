import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/list.packrat`, 'utf-8')
const parseList = (source: string) => packrat(grammarText)(source)

describe('list parser', () => {
  const ast = (src: string) => parseList(src) as any

  test('List root', () => {
    expect(ast('[0, 1, 3]')).toMatchObject({
      tag: 'List',
      items: [
        { tag: 'Item', value: { tag: 'Int', value: '0' } },
        { tag: 'Item', value: { tag: 'Int', value: '1' } },
        { tag: 'Item', value: { tag: 'Int', value: '3' } },
      ]
    })
  })

  test('trailing comma dibolehkan', () => {
    expect(ast('[0, 1, ]')).toMatchObject({
      tag: 'List',
      items: [{ value: { value: '0' } }, { value: { value: '1' } }]
    })
  })

  test('trailing comma tanpa spasi', () => {
    expect(ast('[0, 1,]')).toMatchObject({
      tag: 'List',
      items: [{}, {}]
    })
  })

  test('item tunggal', () => {
    expect(ast('[7]')).toMatchObject({
      tag: 'List',
      items: [{ value: { value: '7' } }]
    })
  })

  test('angka besar', () => {
    expect(ast('[999]')).toMatchObject({
      tag: 'List',
      items: [{ value: { value: '999' } }]
    })
  })

  test('tanpa isi', () => {
    expect(() => ast('[]')).toThrow()
  })

  test('hanya koma', () => {
    expect(() => ast('[,]')).toThrow()
  })

  test('koma ganda di tengah', () => {
    expect(() => ast('[0, , 1]')).toThrow()
  })

  test('koma ganda setelah trailing', () => {
    expect(() => ast('[0, 1, ,]')).toThrow()
  })
})
