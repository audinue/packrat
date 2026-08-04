import { describe, expect, test } from 'bun:test'
import { parseSql } from './mini-sql'

describe('mini-sql parser', () => {
  const ast = (src: string) => parseSql(src) as any

  test('Query root', () => {
    expect(ast('SELECT * FROM users')).toMatchObject({
      tag: 'Query', table: 'users', columns: { tag: 'Star' }
    })
  })

  test('SELECT *', () => {
    expect(ast('SELECT * FROM users').columns).toMatchObject({ tag: 'Star' })
  })

  test('SELECT single column', () => {
    expect(ast('SELECT name FROM users').columns).toMatchObject({
      tag: 'Columns', columns: [{ expression: { tag: 'UnqualifiedColumn', name: 'name' } }]
    })
  })

  test('SELECT multiple columns', () => {
    expect(ast('SELECT name, age FROM users').columns).toMatchObject({
      columns: [{ expression: { name: 'name' } }, { expression: { name: 'age' } }]
    })
  })

  test('SELECT with alias', () => {
    expect(ast('SELECT name AS n FROM users').columns.columns[0]).toMatchObject({
      expression: { name: 'name' }, alias: { tag: 'ColumnAlias', name: 'n' }
    })
  })

  test('qualified column reference', () => {
    expect(ast('SELECT users.name FROM users').columns.columns[0]).toMatchObject({
      expression: { tag: 'QualifiedColumn', table: 'users', column: 'name' }
    })
  })

  test('table name', () => {
    expect(ast('SELECT * FROM orders')).toMatchObject({ table: 'orders' })
  })

  test('WHERE equality with string', () => {
    expect(ast("SELECT * FROM users WHERE city = 'Jakarta'").where).toMatchObject({
      tag: 'WhereClause',
      condition: { tag: 'Comparison', left: { tag: 'ColumnRef', name: 'city' }, op: '=', right: { tag: 'StringLiteral', value: 'Jakarta' } }
    })
  })

  test('WHERE equality with number', () => {
    expect(ast('SELECT * FROM users WHERE age = 25').where.condition).toMatchObject({
      tag: 'Comparison', right: { tag: 'NumberLiteral', value: '25' }
    })
  })

  test('WHERE greater than', () => {
    expect(ast('SELECT * FROM users WHERE age > 28').where.condition).toMatchObject({
      tag: 'Comparison', op: '>'
    })
  })

  test('WHERE less than or equal', () => {
    expect(ast('SELECT * FROM users WHERE age <= 25').where.condition).toMatchObject({ op: '<=' })
  })

  test('WHERE not equal !=', () => {
    expect(ast("SELECT * FROM users WHERE city != 'Jakarta'").where.condition).toMatchObject({ op: '!=' })
  })

  test('WHERE not equal <>', () => {
    expect(ast('SELECT * FROM users WHERE age <> 25').where.condition).toMatchObject({ op: '<>' })
  })

  test('WHERE comparison >=', () => {
    expect(ast('SELECT * FROM users WHERE age >= 28').where.condition).toMatchObject({ op: '>=' })
  })

  test('WHERE comparison <', () => {
    expect(ast('SELECT * FROM users WHERE age < 30').where.condition).toMatchObject({ op: '<' })
  })

  test('WHERE AND', () => {
    expect(ast("SELECT * FROM users WHERE city = 'Jakarta' AND age > 32").where.condition).toMatchObject({
      tag: 'AndCondition', conditions: [{ tag: 'Comparison' }, { tag: 'Comparison' }]
    })
  })

  test('WHERE OR', () => {
    expect(ast("SELECT * FROM users WHERE city = 'Jakarta' OR city = 'Bandung'").where.condition).toMatchObject({
      tag: 'OrCondition', conditions: [{}, {}]
    })
  })

  test('WHERE AND precedence over OR', () => {
    const cond = ast("SELECT name FROM users WHERE city = 'Jakarta' AND age > 32 OR age = 25").where.condition
    expect(cond.tag).toBe('OrCondition')
    expect(cond.conditions[0]).toMatchObject({ tag: 'AndCondition' })
    expect(cond.conditions[1]).toMatchObject({ tag: 'Comparison' })
  })

  test('WHERE parentheses', () => {
    expect(ast("SELECT name FROM users WHERE city = 'Jakarta' AND (age = 30 OR age = 35)").where.condition).toMatchObject({
      tag: 'AndCondition', conditions: [{}, { tag: 'OrCondition' }]
    })
  })

  test('WHERE NOT', () => {
    expect(ast("SELECT name FROM users WHERE NOT city = 'Jakarta'").where.condition).toMatchObject({
      tag: 'Not', condition: { tag: 'Comparison' }
    })
  })

  test('WHERE double NOT', () => {
    expect(ast('SELECT name FROM users WHERE NOT NOT age = 30').where.condition).toMatchObject({
      tag: 'Not', condition: { tag: 'Not', condition: { tag: 'Comparison' } }
    })
  })

  test('NULL comparison', () => {
    expect(ast('SELECT * FROM items WHERE value = NULL').where.condition.right).toMatchObject({
      tag: 'NullLiteral'
    })
  })

  test('negative number', () => {
    expect(ast('SELECT * FROM orders WHERE amount > -1').where.condition.right).toMatchObject({
      tag: 'NumberLiteral', value: '-1'
    })
  })

  test('decimal number', () => {
    expect(ast('SELECT * FROM orders WHERE amount >= 200.5').where.condition.right).toMatchObject({
      tag: 'NumberLiteral', value: '200.5'
    })
  })

  test('ORDER BY ascending default', () => {
    expect(ast('SELECT name, age FROM users ORDER BY age').orderBy).toMatchObject({
      tag: 'OrderByClause', orderings: [{ column: 'age', direction: null }]
    })
  })

  test('ORDER BY DESC', () => {
    expect(ast('SELECT name, age FROM users ORDER BY age DESC').orderBy.orderings[0]).toMatchObject({
      column: 'age', direction: { tag: 'Desc' }
    })
  })

  test('ORDER BY ASC', () => {
    expect(ast('SELECT name, age FROM users ORDER BY age ASC').orderBy.orderings[0]).toMatchObject({
      direction: { tag: 'Asc' }
    })
  })

  test('ORDER BY multiple columns', () => {
    const ords = ast('SELECT name, age FROM users ORDER BY age ASC, name DESC').orderBy.orderings
    expect(ords).toHaveLength(2)
    expect(ords[0]).toMatchObject({ column: 'age', direction: { tag: 'Asc' } })
    expect(ords[1]).toMatchObject({ column: 'name', direction: { tag: 'Desc' } })
  })

  test('LIMIT', () => {
    expect(ast('SELECT * FROM users LIMIT 3').limit).toMatchObject({
      tag: 'LimitClause', value: { tag: 'NumberLiteral', value: '3' }
    })
  })

  test('LIMIT 0', () => {
    expect(ast('SELECT * FROM users LIMIT 0').limit.value).toMatchObject({ value: '0' })
  })

  test('LIMIT number besar', () => {
    expect(ast('SELECT * FROM users LIMIT 100').limit.value).toMatchObject({ value: '100' })
  })

  test('combined WHERE + ORDER BY', () => {
    expect(ast("SELECT name, age FROM users WHERE city = 'Jakarta' ORDER BY age ASC")).toMatchObject({
      where: {}, orderBy: { orderings: [{ column: 'age' }] }
    })
  })

  test('combined WHERE + ORDER BY + LIMIT', () => {
    expect(ast("SELECT name, age FROM users WHERE city = 'Bandung' OR city = 'Jakarta' ORDER BY age DESC LIMIT 2")).toMatchObject({
      where: {}, orderBy: {}, limit: { value: { value: '2' } }
    })
  })

  test('case insensitive keywords', () => {
    expect(ast('select name from users limit 2')).toMatchObject({
      tag: 'Query', table: 'users', limit: { value: { value: '2' } }
    })
  })

  test('mixed case keywords', () => {
    expect(ast('Select Name From Users Order By Age Desc Limit 1')).toMatchObject({
      tag: 'Query', table: 'Users', orderBy: { orderings: [{ direction: { tag: 'Desc' } }] }, limit: { value: { value: '1' } }
    })
  })

  test('extra whitespace', () => {
    expect(ast('SELECT   name   FROM   users   LIMIT   1')).toMatchObject({
      limit: { value: { value: '1' } }
    })
  })

  test('newlines between tokens', () => {
    expect(ast('SELECT\nname\nFROM\nusers\nLIMIT\n1')).toMatchObject({
      columns: { columns: [{ expression: { name: 'name' } }] }
    })
  })

  test('SQL single-line comment', () => {
    expect(ast('SELECT name -- this is a comment\nFROM users LIMIT 1').columns.columns[0].expression).toMatchObject({
      name: 'name'
    })
  })

  test('SQL multi-line comment', () => {
    expect(ast('SELECT /* comment */ name FROM users LIMIT 1').columns.columns[0].expression).toMatchObject({
      name: 'name'
    })
  })

  test('syntax error', () => {
    expect(() => ast('SELEC * FROM users')).toThrow()
  })

  test('incomplete query error', () => {
    expect(() => ast('SELECT name FROM')).toThrow()
  })
})
