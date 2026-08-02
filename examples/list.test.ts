import { describe, expect, test } from 'bun:test'
import { parseList } from './list'

describe('list', () => {
  test('list biasa', () => {
    expect(parseList('[0, 1, 3]')).toEqual([0, 1, 3])
  })

  test('trailing comma dibolehkan', () => {
    expect(parseList('[0, 1, ]')).toEqual([0, 1])
  })

  test('trailing comma tanpa spasi', () => {
    expect(parseList('[0, 1,]')).toEqual([0, 1])
  })

  test('item tunggal', () => {
    expect(parseList('[7]')).toEqual([7])
  })

  test('tanpa isi', () => {
    expect(() => parseList('[]')).toThrow()
  })

  test('hanya koma', () => {
    expect(() => parseList('[,]')).toThrow()
  })

  test('koma ganda di tengah', () => {
    expect(() => parseList('[0, , 1]')).toThrow()
  })

  test('koma ganda setelah trailing', () => {
    expect(() => parseList('[0, 1, ,]')).toThrow()
  })
})
