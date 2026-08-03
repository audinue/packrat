import { describe, expect, test } from 'bun:test'
import { miniSql } from './mini-sql'

type Row = Record<string, any>

const users: Row[] = [
  { id: 1, name: 'Alice', age: 30, city: 'Jakarta' },
  { id: 2, name: 'Bob', age: 25, city: 'Bandung' },
  { id: 3, name: 'Charlie', age: 35, city: 'Jakarta' },
  { id: 4, name: 'Diana', age: 28, city: 'Surabaya' },
  { id: 5, name: 'Eve', age: 25, city: 'Bandung' },
]

const orders: Row[] = [
  { id: 1, userId: 1, amount: 100.5 },
  { id: 2, userId: 1, amount: 200 },
  { id: 3, userId: 2, amount: 50 },
  { id: 4, userId: 3, amount: 300.75 },
]

const db = { users, orders }

describe('miniSql', () => {
  describe('SELECT *', () => {
    test('returns all rows and columns', () => {
      const result = miniSql('SELECT * FROM users', db)
      expect(result).toHaveLength(5)
      expect(result[0]).toEqual({ id: 1, name: 'Alice', age: 30, city: 'Jakarta' })
      expect(result[4]).toEqual({ id: 5, name: 'Eve', age: 25, city: 'Bandung' })
    })

    test('returns empty array for empty table', () => {
      const result = miniSql('SELECT * FROM users WHERE age > 100', db)
      expect(result).toEqual([])
    })

    test('returns shallow copies (does not mutate original)', () => {
      const result = miniSql('SELECT * FROM users LIMIT 1', db)
      result[0]!.name = 'HACKED'
      expect(db.users[0]!.name).toBe('Alice')
    })
  })

  describe('SELECT columns', () => {
    test('selects specific columns', () => {
      const result = miniSql('SELECT name, age FROM users', db)
      expect(result).toHaveLength(5)
      expect(result[0]).toEqual({ name: 'Alice', age: 30 })
      expect(result[0]).not.toHaveProperty('id')
      expect(result[0]).not.toHaveProperty('city')
    })

    test('selects single column', () => {
      const result = miniSql('SELECT name FROM users', db)
      expect(result).toEqual([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' },
        { name: 'Diana' },
        { name: 'Eve' },
      ])
    })

    test('selects columns with alias', () => {
      const result = miniSql('SELECT name AS n, age AS a FROM users LIMIT 2', db)
      expect(result).toEqual([
        { n: 'Alice', a: 30 },
        { n: 'Bob', a: 25 },
      ])
    })

    test('qualified column reference', () => {
      const result = miniSql('SELECT users.name FROM users LIMIT 1', db)
      expect(result).toEqual([{ name: 'Alice' }])
    })
  })

  describe('WHERE', () => {
    test('equality with string', () => {
      const result = miniSql("SELECT * FROM users WHERE city = 'Jakarta'", db)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie'])
    })

    test('equality with number', () => {
      const result = miniSql('SELECT * FROM users WHERE age = 25', db)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.name)).toEqual(['Bob', 'Eve'])
    })

    test('greater than', () => {
      const result = miniSql('SELECT * FROM users WHERE age > 28', db)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie'])
    })

    test('less than or equal', () => {
      const result = miniSql('SELECT * FROM users WHERE age <= 25', db)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.name)).toEqual(['Bob', 'Eve'])
    })

    test('not equal', () => {
      const result = miniSql('SELECT * FROM users WHERE city != \'Jakarta\'', db)
      expect(result).toHaveLength(3)
      expect(result.map(r => r.name)).toEqual(['Bob', 'Diana', 'Eve'])
    })

    test('not equal with <>', () => {
      const result = miniSql('SELECT * FROM users WHERE age <> 25', db)
      expect(result).toHaveLength(3)
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie', 'Diana'])
    })

    test('AND', () => {
      const result = miniSql("SELECT * FROM users WHERE city = 'Jakarta' AND age > 32", db)
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('Charlie')
    })

    test('OR', () => {
      const result = miniSql("SELECT * FROM users WHERE city = 'Jakarta' OR city = 'Bandung'", db)
      expect(result).toHaveLength(4)
      expect(result.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie', 'Eve'])
    })

    test('AND has higher precedence than OR', () => {
      const result = miniSql(
        "SELECT name FROM users WHERE city = 'Jakarta' AND age > 32 OR age = 25",
        db,
      )
      // (Jakarta AND >32) OR (=25) => Charlie OR Bob,Eve
      expect(result.map(r => r.name)).toEqual(['Bob', 'Charlie', 'Eve'])
    })

    test('parentheses override precedence', () => {
      const result = miniSql(
        "SELECT name FROM users WHERE city = 'Jakarta' AND (age = 30 OR age = 35)",
        db,
      )
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie'])
    })

    test('NOT', () => {
      const result = miniSql("SELECT name FROM users WHERE NOT city = 'Jakarta'", db)
      expect(result).toHaveLength(3)
      expect(result.map(r => r.name)).toEqual(['Bob', 'Diana', 'Eve'])
    })

    test('double NOT cancels out', () => {
      const result = miniSql("SELECT name FROM users WHERE NOT NOT age = 30", db)
      expect(result).toEqual([{ name: 'Alice' }])
    })

    test('comparison with decimal number', () => {
      const result = miniSql('SELECT * FROM orders WHERE amount >= 200', db)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.id)).toEqual([2, 4])
    })

    test('comparison with negative number', () => {
      const result = miniSql('SELECT * FROM orders WHERE amount > -1', db)
      expect(result).toHaveLength(4)
    })

    test('NULL comparison', () => {
      const nullableDb = {
        items: [
          { id: 1, value: 'hello' },
          { id: 2, value: null },
          { id: 3, value: 'world' },
        ],
      }
      const result = miniSql('SELECT * FROM items WHERE value = NULL', nullableDb)
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe(2)
    })
  })

  describe('ORDER BY', () => {
    test('ascending (default)', () => {
      const result = miniSql('SELECT name, age FROM users ORDER BY age', db)
      expect(result.map(r => r.age)).toEqual([25, 25, 28, 30, 35])
    })

    test('descending', () => {
      const result = miniSql('SELECT name, age FROM users ORDER BY age DESC', db)
      expect(result.map(r => r.age)).toEqual([35, 30, 28, 25, 25])
    })

    test('explicit ASC', () => {
      const result = miniSql('SELECT name, age FROM users ORDER BY age ASC', db)
      expect(result.map(r => r.age)).toEqual([25, 25, 28, 30, 35])
    })

    test('multiple columns', () => {
      const result = miniSql('SELECT name, age, city FROM users ORDER BY age ASC, name DESC', db)
      expect(result.map(r => ({ age: r.age, name: r.name }))).toEqual([
        { age: 25, name: 'Eve' },
        { age: 25, name: 'Bob' },
        { age: 28, name: 'Diana' },
        { age: 30, name: 'Alice' },
        { age: 35, name: 'Charlie' },
      ])
    })
  })

  describe('LIMIT', () => {
    test('limits result count', () => {
      const result = miniSql('SELECT * FROM users LIMIT 3', db)
      expect(result).toHaveLength(3)
      expect(result.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    test('limit larger than table returns all rows', () => {
      const result = miniSql('SELECT * FROM users LIMIT 100', db)
      expect(result).toHaveLength(5)
    })

    test('limit 0 returns empty', () => {
      const result = miniSql('SELECT * FROM users LIMIT 0', db)
      expect(result).toEqual([])
    })
  })

  describe('combined clauses', () => {
    test('WHERE + ORDER BY', () => {
      const result = miniSql(
        "SELECT name, age FROM users WHERE city = 'Jakarta' ORDER BY age ASC",
        db,
      )
      expect(result).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Charlie', age: 35 },
      ])
    })

    test('WHERE + ORDER BY + LIMIT', () => {
      const result = miniSql(
        "SELECT name, age FROM users WHERE city = 'Bandung' OR city = 'Jakarta' ORDER BY age DESC LIMIT 2",
        db,
      )
      expect(result).toEqual([
        { name: 'Charlie', age: 35 },
        { name: 'Alice', age: 30 },
      ])
    })

    test('SELECT columns + WHERE + ORDER BY + LIMIT', () => {
      const result = miniSql(
        "SELECT name AS user_name, city FROM users WHERE age >= 28 ORDER BY age ASC LIMIT 2",
        db,
      )
      expect(result).toEqual([
        { user_name: 'Diana', city: 'Surabaya' },
        { user_name: 'Alice', city: 'Jakarta' },
      ])
    })
  })

  describe('case insensitivity', () => {
    test('lowercase keywords', () => {
      const result = miniSql('select name from users limit 2', db)
      expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }])
    })

    test('mixed case keywords', () => {
      const result = miniSql('Select Name From Users Order By Age Desc Limit 1', db)
      expect(result).toEqual([{ name: 'Charlie' }])
    })
  })

  describe('whitespace', () => {
    test('extra spaces between tokens', () => {
      const result = miniSql('SELECT   name   FROM   users   LIMIT   1', db)
      expect(result).toEqual([{ name: 'Alice' }])
    })

    test('newlines between tokens', () => {
      const result = miniSql('SELECT\nname\nFROM\nusers\nLIMIT\n1', db)
      expect(result).toEqual([{ name: 'Alice' }])
    })

    test('SQL single-line comment', () => {
      const result = miniSql('SELECT name -- this is a comment\nFROM users LIMIT 1', db)
      expect(result).toEqual([{ name: 'Alice' }])
    })

    test('SQL multi-line comment', () => {
      const result = miniSql('SELECT /* comment */ name FROM users LIMIT 1', db)
      expect(result).toEqual([{ name: 'Alice' }])
    })
  })

  describe('errors', () => {
    test('table not found', () => {
      expect(() => miniSql('SELECT * FROM nonexistent', db))
        .toThrow('Table not found: nonexistent')
    })

    test('syntax error produces readable message', () => {
      expect(() => miniSql('SELEC * FROM users', db))
        .toThrow()
    })

    test('incomplete query throws syntax error', () => {
      expect(() => miniSql('SELECT name FROM', db))
        .toThrow()
    })

    test('query from different table', () => {
      const result = miniSql('SELECT * FROM orders WHERE userId = 1', db)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.id)).toEqual([1, 2])
    })
  })
})
