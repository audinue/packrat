import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/list.packrat`, 'utf-8')
const parseList = async (source: string) => (await packrat(grammarText))(source)

describe('list parser', () => {
  const ast = async (src: string) => (await parseList(src)) as any

  test('List root', async () => {
    expect(await ast('[0, 1, 3]')).toMatchObject({
      tag: 'List',
      items: [
        { tag: 'Item', value: { tag: 'Int', value: '0' } },
        { tag: 'Item', value: { tag: 'Int', value: '1' } },
        { tag: 'Item', value: { tag: 'Int', value: '3' } },
      ]
    })
  })

  test('trailing comma dibolehkan', async () => {
    expect(await ast('[0, 1, ]')).toMatchObject({
      tag: 'List',
      items: [{ value: { value: '0' } }, { value: { value: '1' } }]
    })
  })

  test('trailing comma tanpa spasi', async () => {
    expect(await ast('[0, 1,]')).toMatchObject({
      tag: 'List',
      items: [{}, {}]
    })
  })

  test('item tunggal', async () => {
    expect(await ast('[7]')).toMatchObject({
      tag: 'List',
      items: [{ value: { value: '7' } }]
    })
  })

  test('angka besar', async () => {
    expect(await ast('[999]')).toMatchObject({
      tag: 'List',
      items: [{ value: { value: '999' } }]
    })
  })

  test('tanpa isi', async () => {
    await expect(ast('[]')).rejects.toThrow()
  })

  test('hanya koma', async () => {
    await expect(ast('[,]')).rejects.toThrow()
  })

  test('koma ganda di tengah', async () => {
    await expect(ast('[0, , 1]')).rejects.toThrow()
  })

  test('koma ganda setelah trailing', async () => {
    await expect(ast('[0, 1, ,]')).rejects.toThrow()
  })
})
