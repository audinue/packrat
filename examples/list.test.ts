import { describe, expect, test } from 'bun:test'
import { parseList } from './list'

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
    expect(ast('[0, 1, ]').items).toHaveLength(2)
    expect(ast('[0, 1, ]')).toMatchObject({
      items: [{ value: { value: '0' } }, { value: { value: '1' } }]
    })
  })

  test('trailing comma tanpa spasi', () => {
    expect(ast('[0, 1,]').items).toHaveLength(2)
  })

  test('item tunggal', () => {
    expect(ast('[7]')).toMatchObject({
      items: [{ value: { value: '7' } }]
    })
  })

  test('angka besar', () => {
    expect(ast('[999]').items[0].value).toMatchObject({ value: '999' })
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
