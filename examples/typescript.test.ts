import { expect, test, describe } from 'bun:test'
import { packrat } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/typescript.packrat`, 'utf-8')
const parseTs = async (source: string) => (await packrat(grammarText))(source)

const toChained = (value: any) => ({ tag: 'Chained', expression: value })

describe('typescript parser', () => {
  const ast = async (src: string) => (await parseTs(src)) as any

  test('let with type annotation', async () => {
    const r = await ast('let x: number = 42')
    expect(r.statements[0].value.value).toMatchObject(
      toChained({ tag: 'Int', value: '42' })
    )
  })

  test('const with string type', async () => {
    const r = await ast('const name: string = "hello"')
    expect(r.statements[0]).toMatchObject({
      tag: 'VarDecl', keyword: 'const', name: 'name',
      typeAnnotation: { tag: 'TypeAnnotation', type: { tag: 'TypeRef', name: 'string' } }
    })
  })

  test('let without type', async () => {
    const r = await ast('let x = 42')
    expect(r.statements[0]).toMatchObject({
      tag: 'VarDecl', keyword: 'let', name: 'x',
      typeAnnotation: null,
      value: { tag: 'VarValue' }
    })
  })

  test('union type', async () => {
    const r = await ast('let x: string | number = 42')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({
      tag: 'UnionType', head: { tag: 'TypeRef', name: 'string' }
    })
  })

  test('union with 3 types', async () => {
    const r = await ast('let x: string | number | boolean = 42')
    expect(r.statements[0].typeAnnotation.type.tag).toBe('UnionType')
  })

  test('intersection type', async () => {
    const r = await ast('let x: A & B = 1')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({
      tag: 'IntersectionType', head: { tag: 'TypeRef', name: 'A' }
    })
  })

  test('array type', async () => {
    const r = await ast('let arr: number[] = []')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({
      tag: 'ArrayType', elementType: { tag: 'TypeRef', name: 'number' }
    })
  })

  test('array of union', async () => {
    const r = await ast('let arr: number[] = [1, 2]')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({ tag: 'ArrayType' })
  })

  test('generic type', async () => {
    const r = await ast('let map: Map<string, number> = {}')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({
      tag: 'TypeRef', name: 'Map', typeArgs: { types: [{}, {}] }
    })
  })

  test('generic with extends constraint', async () => {
    const r = await ast('function identity<T extends string>(x: T): T { return x }')
    expect(r.statements[0]).toMatchObject({
      tag: 'FuncDecl', name: 'identity',
      typeParams: { params: [{ name: 'T', constraint: { tag: 'TypeConstraint', type: { tag: 'TypeRef', name: 'string' } } }] },
      returnType: { tag: 'ReturnType', type: { tag: 'TypeRef', name: 'T' } }
    })
  })

  test('function with param types', async () => {
    const r = await ast('function add(a: number, b: number): number { return a + b }')
    expect(r.statements[0]).toMatchObject({
      tag: 'FuncDecl', name: 'add',
      returnType: { tag: 'ReturnType', type: { tag: 'TypeRef', name: 'number' } }
    })
    expect(r.statements[0].params.params[0]).toMatchObject({
      tag: 'Param', name: 'a', typeAnnotation: { tag: 'TypeAnnotation', type: { tag: 'TypeRef', name: 'number' } }
    })
  })

  test('function with optional param', async () => {
    const r = await ast('function greet(name: string, title?: string): string { return name }')
    const p = r.statements[0].params.params
    expect(p[0]).toMatchObject({ tag: 'Param', name: 'name' })
    expect(p[1]).toMatchObject({ tag: 'Param', name: 'title', optional: { tag: 'ParamOptional' } })
  })

  test('function with default value', async () => {
    const r = await ast('function incr(x: number = 1): number { return x + 1 }')
    expect(r.statements[0].params.params[0]).toMatchObject({
      tag: 'Param', name: 'x', default: { tag: 'DefaultValue' }
    })
  })

  test('function with rest param', async () => {
    const r = await ast('function sum(...nums: number[]): number { return 0 }')
    expect(r.statements[0].params.params[0]).toMatchObject({
      tag: 'RestParam', name: 'nums', typeAnnotation: { tag: 'TypeAnnotation', type: { tag: 'ArrayType' } }
    })
  })

  test('arrow function basic', async () => {
    const r = await ast('const add = (a: number, b: number): number => a + b')
    const v = r.statements[0].value.value.expression
    expect(v).toMatchObject({ tag: 'ArrowFunc' })
    expect(v.returnType).toMatchObject({ tag: 'ReturnType', type: { tag: 'TypeRef' } })
  })

  test('arrow function with block body', async () => {
    const r = await ast('const fn = () => { return 42 }')
    const v = r.statements[0].value.value.expression
    expect(v).toMatchObject({ tag: 'ArrowFunc', body: { tag: 'ArrowBlock' } })
  })

  test('arrow function single param no parens', async () => {
    const r = await ast('const double = x => x * 2')
    const v = r.statements[0].value.value.expression
    expect(v).toMatchObject({ tag: 'ArrowFunc', body: { tag: 'ArrowExpr' } })
  })

  test('object type literal', async () => {
    const r = await ast('let user: { name: string; age: number } = { name: "budi", age: 25 }')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({ tag: 'ObjectType' })
  })

  test('optional property in type', async () => {
    const r = await ast('let opts: { debug?: boolean } = {}')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({ tag: 'ObjectType' })
  })

  test('interface basic', async () => {
    const r = await ast('interface User { name: string; age: number }')
    expect(r.statements[0]).toMatchObject({ tag: 'InterfaceDecl', name: 'User' })
  })

  test('interface with extends', async () => {
    const r = await ast('interface Admin extends User { role: string }')
    expect(r.statements[0]).toMatchObject({
      tag: 'InterfaceDecl', name: 'Admin',
      extends: { types: [{ tag: 'TypeRef', name: 'User' }] }
    })
  })

  test('interface with generic', async () => {
    const r = await ast('interface Box<T> { value: T }')
    expect(r.statements[0]).toMatchObject({
      tag: 'InterfaceDecl', name: 'Box',
      typeParams: { params: [{ name: 'T' }] }
    })
  })

  test('type alias', async () => {
    const r = await ast('type ID = string | number')
    expect(r.statements[0]).toMatchObject({
      tag: 'TypeAlias', name: 'ID', type: { tag: 'UnionType' }
    })
  })

  test('type alias with generic', async () => {
    const r = await ast('type Pair<T, U> = [T, U]')
    expect(r.statements[0]).toMatchObject({
      tag: 'TypeAlias', name: 'Pair',
      typeParams: { params: [{ name: 'T' }, { name: 'U' }] }
    })
  })

  test('tuple type', async () => {
    const r = await ast('let pair: [string, number] = ["hello", 42]')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({ tag: 'TupleType' })
  })

  test('class basic', async () => {
    const r = await ast('class Animal { name: string }')
    expect(r.statements[0]).toMatchObject({ tag: 'ClassDecl', name: 'Animal' })
  })

  test('class with extends', async () => {
    const r = await ast('class Dog extends Animal { bark() { return 1 } }')
    expect(r.statements[0]).toMatchObject({
      tag: 'ClassDecl', name: 'Dog',
      extends: { tag: 'ClassExtends', name: { tag: 'TypeRef', name: 'Animal' } }
    })
  })

  test('class with access modifiers', async () => {
    const r = await ast('class User { private id: number; public name: string }')
    expect(r.statements[0]).toMatchObject({ tag: 'ClassDecl', name: 'User' })
  })

  test('import named', async () => {
    const r = await ast('import { ref, computed } from "vue"')
    expect(r.statements[0]).toMatchObject({ tag: 'ImportDecl', specifier: { tag: 'ImportNamed' } })
  })

  test('import default', async () => {
    const r = await ast('import React from "react"')
    expect(r.statements[0]).toMatchObject({ tag: 'ImportDecl', specifier: { tag: 'ImportDefault' } })
  })

  test('import namespace', async () => {
    const r = await ast('import * as Utils from "./utils"')
    expect(r.statements[0]).toMatchObject({ tag: 'ImportDecl', specifier: { tag: 'ImportNamespace' } })
  })

  test('export statement', async () => {
    const r = await ast('export const API_URL = "https://api.com"')
    expect(r.statements[0]).toMatchObject({ tag: 'ExportDecl' })
  })

  test('export default', async () => {
    const r = await ast('export default main')
    expect(r.statements[0]).toMatchObject({ tag: 'ExportDefault' })
  })

  test('as type assertion', async () => {
    const r = await ast('const x = 42 as number')
    expect(r.statements[0].value.value).toMatchObject({ tag: 'As', expression: { tag: 'Chained', expression: { tag: 'Int' } } })
  })

  test('non-null assertion', async () => {
    const r = await ast('const x = y!')
    expect(r.statements[0].value.value).toMatchObject({ tag: 'Chained', tail: [{ tag: 'NonNull' }] })
  })

  test('ternary expression', async () => {
    const r = await ast('const x = a > 0 ? 1 : 0')
    expect(r.statements[0].value.value).toMatchObject({ tag: 'Ternary' })
  })

  test('new expression', async () => {
    const r = await ast('const d = new Date()')
    expect(r.statements[0].value.value.expression).toMatchObject({ tag: 'New' })
  })

  test('object literal', async () => {
    const r = await ast('const obj = { name: "budi", age: 25 }')
    const lit = r.statements[0].value.value.expression
    expect(lit).toMatchObject({ tag: 'ObjectLit' })
  })

  test('spread property', async () => {
    const r = await ast('const obj = { ...base, extra: 1 }')
    const lit = r.statements[0].value.value.expression
    expect(lit).toMatchObject({ tag: 'ObjectLit', properties: { properties: [{}, {}] } })
  })

  test('enum basic', async () => {
    const r = await ast('enum Color { Red, Green, Blue }')
    expect(r.statements[0]).toMatchObject({ tag: 'EnumDecl', name: 'Color' })
  })

  test('enum with values', async () => {
    const r = await ast('enum Status { Active = 1, Inactive = 0 }')
    expect(r.statements[0]).toMatchObject({ tag: 'EnumDecl', name: 'Status' })
  })

  test('async function pattern', async () => {
    const r = await ast('function fetchData(url: string): string { const res = url; return res }')
    expect(r.statements[0]).toMatchObject({ tag: 'FuncDecl', name: 'fetchData' })
  })

  test('complex generics', async () => {
    const r = await ast('const map: Record<string, User> = {}')
    expect(r.statements[0]).toMatchObject({ tag: 'VarDecl' })
  })

  test('function type expression', async () => {
    const r = await ast('let fn: (x: number) => string = (x) => String(x)')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({ tag: 'FunctionType' })
  })

  test('nested object type', async () => {
    const r = await ast('let config: { server: { port: number; host: string }; debug: boolean } = {}')
    expect(r.statements[0].typeAnnotation.type).toMatchObject({ tag: 'ObjectType' })
  })

  test('if statement with block', async () => {
    const r = await ast('if (x > 0) { return 1 }')
    expect(r.statements[0]).toMatchObject({ tag: 'IfStmt' })
  })

  test('if else if else', async () => {
    const r = await ast('if (x > 0) { return 1 } else if (x < 0) { return -1 } else { return 0 }')
    expect(r.statements[0]).toMatchObject({ tag: 'IfStmt' })
  })

  test('typeof type', async () => {
    const r = await ast('type T = typeof x')
    expect(r.statements[0]).toMatchObject({ tag: 'TypeAlias', type: { tag: 'TypeofType' } })
  })

  test('readonly property', async () => {
    const r = await ast('class Foo { readonly id: number }')
    expect(r.statements[0]).toMatchObject({ tag: 'ClassDecl' })
  })

  test('protected method', async () => {
    const r = await ast('class Base { protected init(): void { } }')
    expect(r.statements[0]).toMatchObject({ tag: 'ClassDecl' })
  })

  test('chained member access', async () => {
    const r = await ast('const x = a.b.c.d')
    const chained = r.statements[0].value.value
    expect(chained).toMatchObject({
      tag: 'Chained',
      tail: [{ name: 'b' }, { name: 'c' }, { name: 'd' }]
    })
  })

  test('arithmetic with all operators', async () => {
    const r = await ast('const x = 2 + 3 * 4')
    expect(r.statements[0].value.value).toMatchObject({ tag: 'Add' })
  })

  test('for-of loop', async () => {
    const r = await ast('for (const x of items) { }')
    expect(r.statements[0]).toMatchObject({ tag: 'ForOf', keyword: 'const', name: 'x', value: { tag: 'Chained' } })
  })

  test('generator function', async () => {
    const r = await ast('function* gen(): Generator<number> { yield 1 }')
    expect(r.statements[0]).toMatchObject({ tag: 'FuncDecl', star: { tag: 'GeneratorStar' }, name: 'gen' })
  })

  test('yield statement', async () => {
    const r = await ast('function* gen() { yield 42 }')
    expect(r.statements[0].body.body[0]).toMatchObject({ tag: 'YieldStmt' })
  })

  test('yield expression', async () => {
    const r = await ast('function* gen() { const x = yield 42 }')
    const value = r.statements[0].body.body[0].value.value
    expect(value).toMatchObject({ tag: 'YieldExpr' })
  })

  test('instanceof operator', async () => {
    const r = await ast('const ok = x instanceof Date')
    const chained = r.statements[0].value.value
    expect(chained.tag).toBe('Rel')
    expect(chained.tail[0].op).toBe('instanceof')
  })

  test('decorator on class', async () => {
    const r = await ast('@Component class App { }')
    expect(r.statements[0]).toMatchObject({
      tag: 'DecoratedStmt',
      decorators: [{ tag: 'Decorator', name: 'Component' }],
      statement: { tag: 'ClassDecl', name: 'App' }
    })
  })

  test('decorator with args', async () => {
    const r = await ast('@Injectable() class Service { }')
    expect(r.statements[0].decorators[0]).toMatchObject({
      tag: 'Decorator', name: 'Injectable', args: { tag: 'DecoratorArgs' }
    })
  })
})

describe('typescript stress test', () => {
  const ast = async (src: string) => (await parseTs(src)) as any

  test('many let declarations', async () => {
    const lines = []
    for (let i = 0; i < 50; i++) {
      lines.push(`let x${i}: number = ${i}`)
    }
    const src = lines.join('\n')
    expect(await ast(src)).toMatchObject({
      tag: 'Program',
      statements: Array(50).fill({ tag: 'VarDecl' })
    })
  })

  test('many functions in a module', async () => {
    const lines = ["interface User { id: number; name: string }"]
    for (let i = 0; i < 10; i++) {
      lines.push(`function fn${i}(x: number): string { return String(x) }`)
    }
    lines.push('export default User')
    const src = lines.join('\n')
    const r = await ast(src)
    expect(r.statements.length).toBe(12)
  })
})
