// mini-golang.ts

import { packrat, isNode, type Ok, type Node } from './packrat'

// ─── AST Node Helpers ────────────────────────────────────────────────

const tag = (node: Ok): string => (node as Node).tag
const field = <T = Ok>(node: Ok, name: string): T => (node as Node)[name] as unknown as T
const isArr = (node: Ok): node is Ok[] => Array.isArray(node)

// ─── Go Grammar (PEG) ───────────────────────────────────────────────

const parse = packrat`
  Program = _ statements:Statement { 0 ; _ } _ -> Program
  Statement = VarDecl / ShortVarDecl / AssignStmt / IfStmt / ForStmt / FuncDecl / ReturnStmt / ExprStmt

  VarDecl = "var" __ name:Id _ type:Type _ "=" _ value:Expr -> VarDecl
  ShortVarDecl = name:Id _ ":=" _ value:Expr -> ShortVarDecl
  AssignStmt = name:Id _ "=" _ value:Expr -> AssignStmt
  IfStmt = "if" _ condition:Expr _ "{" _ body:Statement { 0 ; _ } _ "}" _ else:ElseClause? -> IfStmt
  ElseClause = "else" _ "{" _ body:Statement { 0 ; _ } _ "}" -> ElseClause
  ForStmt = "for" _ condition:Expr? _ "{" _ body:Statement { 0 ; _ } _ "}" -> ForStmt
  FuncDecl = "func" __ name:Id _ "(" _ params:ParamList? _ ")" _ "{" _ body:Statement { 0 ; _ } _ "}" -> FuncDecl
  ReturnStmt = "return" _ value:Expr? -> ReturnStmt
  ExprStmt = expr:Expr -> ExprStmt

  ParamList = params:Param { 2 ; _ "," _ } -> ParamList / params:Param -> ParamList
  Param = name:Id _ ":" _ type:Type -> Param
  Type = "int" / "float64" / "string" / "bool" / "[]" _ type:Type -> SliceType

  Expr = OrExpr
  OrExpr = left:AndExpr _ op:"||" _ right:OrExpr -> BinaryExpr / AndExpr
  AndExpr = left:EqExpr _ op:"&&" _ right:AndExpr -> BinaryExpr / EqExpr
  EqExpr = left:RelExpr _ op:EqOp _ right:RelExpr -> BinaryExpr / RelExpr
  RelExpr = left:AddExpr _ op:RelOp _ right:AddExpr -> BinaryExpr / AddExpr
  AddExpr = left:MulExpr _ op:AddOp _ right:AddExpr -> BinaryExpr / MulExpr
  MulExpr = left:UnaryExpr _ op:MulOp _ right:UnaryExpr -> BinaryExpr / UnaryExpr
  UnaryExpr = op:UnaryOp _ expr:UnaryExpr -> UnaryExpr / PostfixExpr
  UnaryOp = "!" / "-"
  PostfixExpr = expr:Primary _ "[" _ index:Expr _ "]" -> IndexExpr / Primary

  Primary = IntLit / FloatLit / StringLit / BoolLit / SliceLit / CallExpr / GroupExpr / Ident
  IntLit = value:Number -> IntLit
  FloatLit = value:$( Number "." Number ) -> FloatLit
  StringLit = value:GoString -> StringLit
  GoString = "\\"" ^GoChar* "\\""
  GoChar = "\\\\" . / ~"\\""
  BoolLit = value:("true" / "false") -> BoolLit
  SliceLit = "[" _ elements:ArgList? _ "]" -> SliceLit
  CallExpr = name:Id _ "(" _ args:ArgList? _ ")" -> CallExpr
  GroupExpr = "(" _ ^Expr _ ")"
  Ident = name:Id -> Ident
  ArgList = args:Expr { 2 ; _ "," _ } -> ArgList / args:Expr -> ArgList

  EqOp = "==" / "!="
  RelOp = "<=" / ">=" / "<" / ">"
  AddOp = "+" / "-"
  MulOp = "*" / "/" / "%"

  Number = "0" / $( [1-9] [0-9]* )
  Id = $( [a-z_]i [a-z0-9_]i* )

  _ = Space*
  __ = Space+
  Space = WhiteSpace / SingleLineComment / MultiLineComment
  WhiteSpace = [ \\t\\r\\n]+
  SingleLineComment = "//" ~[\\r\\n]*
  MultiLineComment = "/*" ~"*/"* "*/"
`

// ─── Interpreter ─────────────────────────────────────────────────────

type Value = number | string | boolean | Value[] | null | FunctionValue

type FunctionValue = {
  tag: 'function'
  name: string
  params: { name: string; type: string }[]
  body: Ok
  closure: Env
}

class ReturnSignal {
  constructor (public value: Value) {}
}

class RuntimeError extends Error {
  constructor (message: string) { super(message) }
}

class Env {
  private vars = new Map<string, Value>()
  private parent: Env | null

  constructor (parent: Env | null = null) {
    this.parent = parent
  }

  get (name: string): Value {
    if (this.vars.has(name)) return this.vars.get(name)!
    if (this.parent) return this.parent.get(name)
    throw new RuntimeError(`undefined variable: ${name}`)
  }

  set (name: string, value: Value) {
    if (this.vars.has(name)) { this.vars.set(name, value); return }
    if (this.parent && this.parent.has(name)) { this.parent.set(name, value); return }
    throw new RuntimeError(`undefined variable: ${name}`)
  }

  has (name: string): boolean {
    if (this.vars.has(name)) return true
    if (this.parent) return this.parent.has(name)
    return false
  }

  define (name: string, value: Value) { this.vars.set(name, value) }
}

function isTruthy (v: Value): boolean {
  if (v === null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.length > 0
  return true
}

function valToString (v: Value): string {
  if (v === null) return '<nil>'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return '[' + v.map(valToString).join(' ') + ']'
  if (v && typeof v === 'object' && v.tag === 'function')
    return '<func ' + (v as FunctionValue).name + '>'
  return String(v)
}

function toNumber (v: Value): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const n = Number(v)
    if (isNaN(n)) throw new RuntimeError(`cannot convert string to number`)
    return n
  }
  throw new RuntimeError(`cannot convert to number`)
}

function processEscapes (s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\').replace(/\\"/g, '"')
}

/** Extract raw argument values from an ArgList node or single expr */
function extractCallArgs (argsNode: Ok | null, env: Env): Value[] {
  if (argsNode === null) return []
  // ArgList node: { tag: 'ArgList', args: [...] }
  const raw = field<Ok>(argsNode, 'args')
  if (isArr(raw)) return raw.map(a => evalExpr(a, env))
  return [evalExpr(raw, env)]
}

// ─── Evaluator ──────────────────────────────────────────────────────

function evalExpr (node: Ok, env: Env): Value {
  if (typeof node === 'string' || node === null || isArr(node)) return node as Value

  const t = tag(node)

  switch (t) {
    case 'IntLit':
      return parseInt(field<string>(node, 'value'))

    case 'FloatLit':
      return parseFloat(field<string>(node, 'value'))

    case 'StringLit': {
      const raw = field<Ok>(node, 'value')
      // GoString uses ^GoChar* extraction -> array of char matches
      let s = ''
      if (typeof raw === 'string') { s = raw }
      else if (isArr(raw)) {
        for (const item of raw) {
          if (typeof item === 'string') s += item
          else if (isArr(item)) s += item.map(c => typeof c === 'string' ? c : '').join('')
        }
      }
      return processEscapes(s)
    }

    case 'BoolLit': {
      const v = field<Ok>(node, 'value')
      return v === 'true' || (typeof v === 'boolean' && v)
    }

    case 'Ident':
      return env.get(field<string>(node, 'name'))

    case 'BinaryExpr': {
      const op = field<Ok>(node, 'op')
      const opStr = typeof op === 'string' ? op : String(op)
      const left = evalExpr(field<Ok>(node, 'left'), env)
      const right = evalExpr(field<Ok>(node, 'right'), env)

      switch (opStr) {
        case '+': return toNumber(left) + toNumber(right)
        case '-': return toNumber(left) - toNumber(right)
        case '*': return toNumber(left) * toNumber(right)
        case '/': {
          const r = toNumber(right)
          if (r === 0) throw new RuntimeError('division by zero')
          const l = toNumber(left)
          if (Number.isInteger(l) && Number.isInteger(r)) return Math.trunc(l / r)
          return l / r
        }
        case '%': return toNumber(left) % toNumber(right)
        case '==': return left === right
        case '!=': return left !== right
        case '<': return toNumber(left) < toNumber(right)
        case '>': return toNumber(left) > toNumber(right)
        case '<=': return toNumber(left) <= toNumber(right)
        case '>=': return toNumber(left) >= toNumber(right)
        case '&&': return isTruthy(left) && isTruthy(right)
        case '||': return isTruthy(left) || isTruthy(right)
        default: throw new RuntimeError(`unknown operator: ${opStr}`)
      }
    }

    case 'UnaryExpr': {
      const op = field<Ok>(node, 'op')
      const opStr = typeof op === 'string' ? op : String(op)
      const expr = evalExpr(field<Ok>(node, 'expr'), env)
      switch (opStr) {
        case '-': return -toNumber(expr)
        case '!': return !isTruthy(expr)
        default: throw new RuntimeError(`unknown unary operator: ${opStr}`)
      }
    }

    case 'IndexExpr': {
      const arr = evalExpr(field<Ok>(node, 'expr'), env)
      const idx = evalExpr(field<Ok>(node, 'index'), env)
      if (!Array.isArray(arr)) throw new RuntimeError('cannot index non-array')
      const i = toNumber(idx)
      if (i < 0 || i >= arr.length || !Number.isInteger(i))
        throw new RuntimeError(`index out of range: ${i}`)
      return arr[i]!
    }

    case 'CallExpr': {
      const name = field<string>(node, 'name')
      const args = extractCallArgs(field<Ok | null>(node, 'args'), env)

      // Built-in: println
      if (name === 'println') {
        console.log(args.map(valToString).join(' '))
        return null
      }

      // Built-in: len
      if (name === 'len') {
        if (args.length !== 1) throw new RuntimeError('len: expected 1 argument')
        const val = args[0]!
        if (Array.isArray(val)) return val.length
        if (typeof val === 'string') return val.length
        throw new RuntimeError('len: argument must be array or string')
      }

      // Built-in: append
      if (name === 'append') {
        if (args.length !== 2) throw new RuntimeError('append: expected 2 arguments')
        const slice = args[0]!
        const value = args[1]!
        if (!Array.isArray(slice)) throw new RuntimeError('append: first argument must be slice')
        return [...slice, value]
      }

      // User-defined function
      const fn = env.get(name)
      if (fn && typeof fn === 'object' && tag(fn as Ok) === 'function') {
        return callFunction(fn as unknown as FunctionValue, args)
      }

      throw new RuntimeError(`undefined function: ${name}`)
    }

    case 'SliceLit': {
      const elements = field<Ok | null>(node, 'elements')
      if (elements === null) return []
      // elements is an ArgList node with 'args' field
      const raw = field<Ok>(elements, 'args')
      if (isArr(raw)) return raw.map(e => evalExpr(e, env))
      return [evalExpr(raw, env)]
    }
  }

  return node as unknown as Value
}

function callFunction (fn: FunctionValue, args: Value[]): Value {
  const localEnv = new Env(fn.closure)
  if (args.length !== fn.params.length) {
    throw new RuntimeError(`${fn.name}: expected ${fn.params.length} arguments, got ${args.length}`)
  }
  for (let i = 0; i < fn.params.length; i++) {
    localEnv.define(fn.params[i]!.name, args[i]!)
  }
  try {
    execBlock(fn.body, localEnv)
  } catch (e) {
    if (e instanceof ReturnSignal) return e.value
    throw e
  }
  return null
}

function execBlock (body: Ok, env: Env): void {
  const stmts = isArr(body) ? body : [body]
  for (const stmt of stmts) execStmt(stmt, env)
}

function execStmt (node: Ok, env: Env): void {
  if (typeof node === 'string' || node === null || isArr(node)) return

  const t = tag(node)

  switch (t) {
    case 'VarDecl': {
      env.define(field<string>(node, 'name'), evalExpr(field<Ok>(node, 'value'), env))
      break
    }
    case 'ShortVarDecl': {
      env.define(field<string>(node, 'name'), evalExpr(field<Ok>(node, 'value'), env))
      break
    }
    case 'AssignStmt': {
      env.set(field<string>(node, 'name'), evalExpr(field<Ok>(node, 'value'), env))
      break
    }
    case 'IfStmt': {
      const condition = evalExpr(field<Ok>(node, 'condition'), env)
      if (isTruthy(condition)) {
        execBlock(field<Ok>(node, 'body'), new Env(env))
      } else {
        const elseNode = field<Ok | null>(node, 'else')
        if (elseNode !== null && isNode(elseNode)) {
          execBlock(field<Ok>(elseNode, 'body'), new Env(env))
        }
      }
      break
    }
    case 'ForStmt': {
      const condNode = field<Ok | null>(node, 'condition')
      const body = field<Ok>(node, 'body')
      if (condNode === null) {
        while (true) {
          try { execBlock(body, new Env(env)) }
          catch (e) { if (e instanceof ReturnSignal) throw e }
        }
      } else {
        while (isTruthy(evalExpr(condNode, env))) {
          try { execBlock(body, new Env(env)) }
          catch (e) { if (e instanceof ReturnSignal) throw e }
        }
      }
      break
    }
    case 'FuncDecl': {
      const name = field<string>(node, 'name')
      const paramsNode = field<Ok | null>(node, 'params')
      let params: { name: string; type: string }[] = []
      if (paramsNode !== null) {
        const raw = field<Ok>(paramsNode, 'params')
        if (isArr(raw)) {
          params = raw.map(p => ({ name: field<string>(p, 'name'), type: fieldType(field<Ok>(p, 'type')) }))
        } else {
          params = [{ name: field<string>(raw, 'name'), type: fieldType(field<Ok>(raw, 'type')) }]
        }
      }
      env.define(name, {
        tag: 'function' as const, name, params,
        body: field<Ok>(node, 'body'), closure: env
      } as unknown as Value)
      break
    }
    case 'ReturnStmt': {
      const valueNode = field<Ok | null>(node, 'value')
      throw new ReturnSignal(valueNode === null ? null : evalExpr(valueNode, env))
    }
    case 'ExprStmt': {
      evalExpr(field<Ok>(node, 'expr'), env)
      break
    }
  }
}

function fieldType (typeNode: Ok): string {
  if (typeof typeNode === 'string') return typeNode
  if (isNode(typeNode)) {
    if (tag(typeNode) === 'SliceType') return '[]' + fieldType(field<Ok>(typeNode, 'type'))
    return tag(typeNode)
  }
  return String(typeNode)
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Run a mini-Go program and return captured stdout lines.
 */
export function runGo (source: string): string[] {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }

  try {
    const ast = parse(source.trim() + '\n')
    const globalEnv = new Env()
    execBlock(field<Ok>(ast as Node, 'statements'), globalEnv)
  } catch (e) {
    if (!(e instanceof ReturnSignal)) throw e
  } finally {
    console.log = originalLog
  }

  return logs
}

/**
 * Parse a mini-Go source string and return the AST (for inspection).
 */
export function parseGo (source: string): Ok {
  return parse(source.trim() + '\n')
}