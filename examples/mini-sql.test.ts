import { describe, expect, test } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-sql.packrat`, 'utf-8')
const parseSql = async (source: string) => (await packrat(grammarText))(source)

describe('mini-sql parser', () => {
  const ast = async (src: string) => (await parseSql(src)) as any

  test('Query root', async () => {
    expect(await ast('SELECT * FROM users')).toMatchObject({
      tag: 'Query', table: 'users', columns: { tag: 'Star' }
    })
  })

  test('SELECT single column', async () => {
    expect(await ast('SELECT name FROM users')).toMatchObject({
      tag: 'Query',
      columns: { tag: 'Columns', columns: [{ expression: { tag: 'UnqualifiedColumn', name: 'name' } }] }
    })
  })

  test('SELECT multiple columns', async () => {
    expect(await ast('SELECT name, age FROM users')).toMatchObject({
      tag: 'Query',
      columns: { tag: 'Columns', columns: [{ expression: { name: 'name' } }, { expression: { name: 'age' } }] }
    })
  })

  test('SELECT with alias', async () => {
    expect(await ast('SELECT name AS n FROM users')).toMatchObject({
      tag: 'Query',
      columns: { tag: 'Columns', columns: [{ expression: { name: 'name' }, alias: { tag: 'ColumnAlias', name: 'n' } }] }
    })
  })

  test('qualified column reference', async () => {
    expect(await ast('SELECT users.name FROM users')).toMatchObject({
      tag: 'Query',
      columns: { tag: 'Columns', columns: [{ expression: { tag: 'QualifiedColumn', table: 'users', column: 'name' } }] }
    })
  })

  test('table name', async () => {
    expect(await ast('SELECT * FROM orders')).toMatchObject({ tag: 'Query', table: 'orders' })
  })

  test('WHERE equality with string', async () => {
    expect(await ast("SELECT * FROM users WHERE city = 'Jakarta'")).toMatchObject({
      tag: 'Query',
      where: { tag: 'WhereClause', condition: { tag: 'Comparison', left: { tag: 'ColumnRef', name: 'city' }, op: '=', right: { tag: 'StringLiteral', value: 'Jakarta' } } }
    })
  })

  test('WHERE equality with number', async () => {
    expect(await ast('SELECT * FROM users WHERE age = 25')).toMatchObject({
      tag: 'Query',
      where: { tag: 'WhereClause', condition: { tag: 'Comparison', right: { tag: 'NumberLiteral', value: '25' } } }
    })
  })

  test('WHERE greater than', async () => {
    expect(await ast('SELECT * FROM users WHERE age > 28')).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'Comparison', op: '>' } }
    })
  })

  test('WHERE less than or equal', async () => {
    expect(await ast('SELECT * FROM users WHERE age <= 25')).toMatchObject({
      tag: 'Query',
      where: { condition: { op: '<=' } }
    })
  })

  test('WHERE not equal !=', async () => {
    expect(await ast("SELECT * FROM users WHERE city != 'Jakarta'")).toMatchObject({
      tag: 'Query',
      where: { condition: { op: '!=' } }
    })
  })

  test('WHERE not equal <>', async () => {
    expect(await ast('SELECT * FROM users WHERE age <> 25')).toMatchObject({
      tag: 'Query',
      where: { condition: { op: '<>' } }
    })
  })

  test('WHERE AND', async () => {
    expect(await ast("SELECT * FROM users WHERE city = 'Jakarta' AND age > 32")).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'AndCondition', conditions: [{ tag: 'Comparison' }, { tag: 'Comparison' }] } }
    })
  })

  test('WHERE OR', async () => {
    expect(await ast("SELECT * FROM users WHERE city = 'Jakarta' OR city = 'Bandung'")).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'OrCondition', conditions: [{}, {}] } }
    })
  })

  test('WHERE AND precedence over OR', async () => {
    const a = await ast("SELECT name FROM users WHERE city = 'Jakarta' AND age > 32 OR age = 25")
    expect(a).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'OrCondition', conditions: [{ tag: 'AndCondition' }, { tag: 'Comparison' }] } }
    })
  })

  test('WHERE parentheses', async () => {
    expect(await ast("SELECT name FROM users WHERE city = 'Jakarta' AND (age = 30 OR age = 35)")).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'AndCondition', conditions: [{}, { tag: 'OrCondition' }] } }
    })
  })

  test('WHERE NOT', async () => {
    expect(await ast("SELECT name FROM users WHERE NOT city = 'Jakarta'")).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'Not', condition: { tag: 'Comparison' } } }
    })
  })

  test('WHERE double NOT', async () => {
    expect(await ast('SELECT name FROM users WHERE NOT NOT age = 30')).toMatchObject({
      tag: 'Query',
      where: { condition: { tag: 'Not', condition: { tag: 'Not', condition: { tag: 'Comparison' } } } }
    })
  })

  test('NULL comparison', async () => {
    expect(await ast('SELECT * FROM items WHERE value = NULL')).toMatchObject({
      tag: 'Query',
      where: { condition: { right: { tag: 'NullLiteral' } } }
    })
  })

  test('negative number', async () => {
    expect(await ast('SELECT * FROM orders WHERE amount > -1')).toMatchObject({
      tag: 'Query',
      where: { condition: { right: { tag: 'NumberLiteral', value: '-1' } } }
    })
  })

  test('decimal number', async () => {
    expect(await ast('SELECT * FROM orders WHERE amount >= 200.5')).toMatchObject({
      tag: 'Query',
      where: { condition: { right: { tag: 'NumberLiteral', value: '200.5' } } }
    })
  })

  test('ORDER BY ascending default', async () => {
    expect(await ast('SELECT name, age FROM users ORDER BY age')).toMatchObject({
      tag: 'Query',
      orderBy: { tag: 'OrderByClause', orderings: [{ column: 'age', direction: null }] }
    })
  })

  test('ORDER BY DESC', async () => {
    expect(await ast('SELECT name, age FROM users ORDER BY age DESC')).toMatchObject({
      tag: 'Query',
      orderBy: { orderings: [{ column: 'age', direction: { tag: 'Desc' } }] }
    })
  })

  test('ORDER BY ASC', async () => {
    expect(await ast('SELECT name, age FROM users ORDER BY age ASC')).toMatchObject({
      tag: 'Query',
      orderBy: { orderings: [{ direction: { tag: 'Asc' } }] }
    })
  })

  test('ORDER BY multiple columns', async () => {
    expect(await ast('SELECT name, age FROM users ORDER BY age ASC, name DESC')).toMatchObject({
      tag: 'Query',
      orderBy: { orderings: [{ column: 'age', direction: { tag: 'Asc' } }, { column: 'name', direction: { tag: 'Desc' } }] }
    })
  })

  test('LIMIT', async () => {
    expect(await ast('SELECT * FROM users LIMIT 3')).toMatchObject({
      tag: 'Query',
      limit: { tag: 'LimitClause', value: { tag: 'NumberLiteral', value: '3' } }
    })
  })

  test('LIMIT 0', async () => {
    expect(await ast('SELECT * FROM users LIMIT 0')).toMatchObject({
      tag: 'Query',
      limit: { value: { value: '0' } }
    })
  })

  test('combined WHERE + ORDER BY', async () => {
    expect(await ast("SELECT name, age FROM users WHERE city = 'Jakarta' ORDER BY age ASC")).toMatchObject({
      tag: 'Query',
      where: {}, orderBy: {}
    })
  })

  test('combined WHERE + ORDER BY + LIMIT', async () => {
    expect(await ast("SELECT name, age FROM users WHERE city = 'Bandung' OR city = 'Jakarta' ORDER BY age DESC LIMIT 2")).toMatchObject({
      tag: 'Query',
      where: {}, orderBy: {}, limit: {}
    })
  })

  test('case insensitive keywords', async () => {
    expect(await ast('select name from users limit 2')).toMatchObject({
      tag: 'Query', table: 'users', limit: { value: { value: '2' } }
    })
  })

  test('mixed case keywords', async () => {
    expect(await ast('Select Name From Users Order By Age Desc Limit 1')).toMatchObject({
      tag: 'Query', table: 'Users', orderBy: { orderings: [{ direction: { tag: 'Desc' } }] }, limit: { value: { value: '1' } }
    })
  })

  test('extra whitespace', async () => {
    expect(await ast('SELECT   name   FROM   users   LIMIT   1')).toMatchObject({ tag: 'Query' })
  })

  test('newlines between tokens', async () => {
    expect(await ast('SELECT\nname\nFROM\nusers\nLIMIT\n1')).toMatchObject({
      tag: 'Query',
      columns: { columns: [{ expression: { name: 'name' } }] }
    })
  })

  test('SQL single-line comment', async () => {
    expect(await ast('SELECT name -- this is a comment\nFROM users LIMIT 1')).toMatchObject({
      tag: 'Query',
      columns: { columns: [{ expression: { name: 'name' } }] }
    })
  })

  test('SQL multi-line comment', async () => {
    expect(await ast('SELECT /* comment */ name FROM users LIMIT 1')).toMatchObject({
      tag: 'Query',
      columns: { columns: [{ expression: { name: 'name' } }] }
    })
  })

  test('syntax error', async () => {
    await expect(ast('SELEC * FROM users')).rejects.toThrow()
  })

  test('incomplete query error', async () => {
    await expect(ast('SELECT name FROM')).rejects.toThrow()
  })
})
