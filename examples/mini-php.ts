import { packrat, isNode, type Ok, type Node } from '../packrat'

// ─── AST Node Helpers ────────────────────────────────────────────────

const tag = (node: Ok): string => (node as Node).tag
const field = <T = Ok>(node: Ok, name: string): T => (node as Node)[name] as unknown as T
const isArr = (node: Ok): node is Ok[] => Array.isArray(node)

// ─── PHP Grammar (PEG) ───────────────────────────────────────────────

const parse = packrat`
  Program = PhpProgram / EchoProgram
  PhpProgram = "<?php" _ statements:Statement { 0 ; _ } _ "?>"? _ -> Program
  EchoProgram = "<?=" _ statements:( ^( expression:Expression -> Echo ) ) _ ";"? _ "?>" _ -> Program
  Statement = Echo / AssignStmt / IfStmt / WhileStmt / ForStmt / FuncDecl / ReturnStmt / EmptyStmt / ExprStmt
  Echo = "echo" _ args:ArgList _ ";" -> Echo
  AssignStmt = "$" name:Id _ "=" _ value:Expression _ ";" -> Assign
  IfStmt = "if" _ "(" _ condition:Expression _ ")" _ "{" _ body:Statement { 0 ; _ } _ "}" _ elseif:ElseIf { 0 ; _ } _ else:Else? -> IfStmt / "if" _ "(" _ condition:Expression _ ")" _ body:Statement _ else:Else? -> IfStmt
  ElseIf = "elseif" _ "(" _ condition:Expression _ ")" _ "{" _ body:Statement { 0 ; _ } _ "}" -> ElseIf / "elseif" _ "(" _ condition:Expression _ ")" _ body:Statement -> ElseIf
  Else = "else" _ "{" _ body:Statement { 0 ; _ } _ "}" -> Else / "else" _ body:Statement -> Else
  WhileStmt = "while" _ "(" _ condition:Expression _ ")" _ "{" _ body:Statement { 0 ; _ } _ "}" -> While / "while" _ "(" _ condition:Expression _ ")" _ body:Statement -> While
  ForStmt = "for" _ "(" _ init:ForInit? _ ";" _ condition:Expression? _ ";" _ update:ForUpdate? _ ")" _ "{" _ body:Statement { 0 ; _ } _ "}" -> For
  ForInit = "$" name:Id _ "=" _ value:Expression -> Assign
  ForUpdate = "$" name:Id _ "=" _ value:Expression -> Assign / Expression
  FuncDecl = "function" __ name:Id _ "(" _ params:ParamList? _ ")" _ "{" _ body:Statement { 0 ; _ } _ "}" -> FuncDecl
  ReturnStmt = "return" _ value:Expression? _ ";" -> Return
  EmptyStmt = ";" -> Empty
  ExprStmt = expression:Expression _ ";" -> ExprStmt
  ParamList = params:Param { 2 ; _ "," _ } -> ParamList / params:Param -> ParamList
  Param = "$" name:Id -> Param
  ArgList = args:Expression { 2 ; _ "," _ } -> ArgList / args:Expression -> ArgList
  Expression = OrExpr
  OrExpr = first:AndExpr rest:(_ op:"||" _ term:AndExpr -> Binary)* -> OrExpr
  AndExpr = first:Comparison rest:(_ op:"&&" _ term:Comparison -> Binary)* -> AndExpr
  Comparison = first:Concat rest:(_ op:CompareOp _ term:Concat -> Binary)* -> Comparison
  Concat = first:Additive rest:(_ op:"." _ term:Additive -> Binary)* -> Concat
  Additive = first:Multiplicative rest:(_ op:AddOp _ term:Multiplicative -> Binary)* -> Additive
  Multiplicative = first:Unary rest:(_ op:MulOp _ term:Unary -> Binary)* -> Multiplicative
  Unary = op:UnaryOp _ expression:Unary -> UnaryExpr / PostfixExpr
  UnaryOp = "++" / "--" / "!" / "-"
  PostfixExpr = expression:Var _ "[" _ index:Expression _ "]" -> IndexExpr / expression:Var _ op:PostfixOp -> PostfixExpr / Primary
  PostfixOp = "++" / "--"
  Primary = Float / Int / String / SingleString / True / False / Null / CallExpr / Var / ArrayLit / Group
  Int = value:NumberText -> Int
  Float = value:$( NumberText "." NumberText ) -> Float
  NumberText = "0" / $( [1-9] [0-9]* )
  String = value:("\\"" ^StringItem* "\\"") -> String
  StringItem = "\\\\" . / ~"\\""
  SingleString = value:("'" ^SingleItem* "'") -> SqString
  SingleItem = "\\\\" . / ~"'"
  True = "true"i -> True
  False = "false"i -> False
  Null = "null"i -> Null
  CallExpr = name:Id _ "(" _ args:ArgList? _ ")" -> CallExpr
  Var = "$" name:Id -> Var
  ArrayLit = "[" _ elements:ArgList? _ "]" -> ArrayLit
  Group = "(" _ ^Expression _ ")"
  Id = $( [a-z_]i [a-z0-9_]i* )
  CompareOp = "===" / "!==" / "==" / "!=" / "<=" / ">=" / "<" / ">"
  AddOp = "+" / "-"
  MulOp = "*" / "/" / "%"
  _ = Space*
  __ = Space+
  Space = WhiteSpace / SingleLineComment / HashComment / MultiLineComment
  WhiteSpace = [ \\t\\r\\n]+
  SingleLineComment = "//" (~[\\r\\n])*
  HashComment = "#" (~[\\r\\n])*
  MultiLineComment = "/*" (~"*/")* "*/"
`

// ─── Values & Environment ────────────────────────────────────────────

type Value = number | string | boolean | null | Value[] | FunctionValue

type FunctionValue = {
  tag: 'function'
  name: string
  params: string[]
  body: Ok
  closure: Env
}

type Output = { text: string }

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
    throw new RuntimeError(`undefined variable: $${name}`)
  }

  set (name: string, value: Value) {
    if (this.vars.has(name)) { this.vars.set(name, value); return }
    if (this.parent && this.parent.has(name)) { this.parent.set(name, value); return }
    throw new RuntimeError(`undefined variable: $${name}`)
  }

  has (name: string): boolean {
    if (this.vars.has(name)) return true
    if (this.parent) return this.parent.has(name)
    return false
  }

  define (name: string, value: Value) { this.vars.set(name, value) }
}

// ─── Value Coercion (PHP semantics) ──────────────────────────────────

const isNumeric = (v: Value): boolean => {
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return true
  if (typeof v === 'string') return v.trim() !== '' && !isNaN(Number(v.trim()))
  return false
}

const toNumber = (v: Value): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === null) return 0
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (trimmed === '') return 0
    const n = Number(trimmed)
    if (isNaN(n)) throw new RuntimeError(`cannot convert string to number: ${v}`)
    return n
  }
  throw new RuntimeError('cannot convert to number')
}

const truthy = (v: Value): boolean => {
  if (v === null || v === false) return false
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== '' && v !== '0'
  if (Array.isArray(v)) return v.length > 0
  return true
}

const phpStr = (v: Value): string => {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? '1' : ''
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return 'Array'
  if (v && typeof v === 'object' && v.tag === 'function') return 'Closure'
  return String(v)
}

const phpEquals = (a: Value, b: Value): boolean => {
  if (isNumeric(a) && isNumeric(b)) return toNumber(a) === toNumber(b)
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b)
  return phpStr(a) === phpStr(b)
}

const compareValues = (a: Value, b: Value): number => {
  if (isNumeric(a) && isNumeric(b)) return toNumber(a) - toNumber(b)
  const sa = phpStr(a)
  const sb = phpStr(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

const evalBinary = (op: string, left: Value, right: Value): Value => {
  switch (op) {
    case '+': return toNumber(left) + toNumber(right)
    case '-': return toNumber(left) - toNumber(right)
    case '*': return toNumber(left) * toNumber(right)
    case '/': {
      const r = toNumber(right)
      if (r === 0) throw new RuntimeError('division by zero')
      return toNumber(left) / r
    }
    case '%': {
      const r = toNumber(right)
      if (r === 0) throw new RuntimeError('division by zero')
      return toNumber(left) % r
    }
    case '.': return phpStr(left) + phpStr(right)
    case '==': return phpEquals(left, right)
    case '!=': return !phpEquals(left, right)
    case '===': return left === right
    case '!==': return left !== right
    case '<': return compareValues(left, right) < 0
    case '<=': return compareValues(left, right) <= 0
    case '>': return compareValues(left, right) > 0
    case '>=': return compareValues(left, right) >= 0
    case '&&': return truthy(left) && truthy(right)
    case '||': return truthy(left) || truthy(right)
    default: throw new RuntimeError(`unknown operator: ${op}`)
  }
}

const processDoubleEscapes = (s: string): string =>
  s
    .replace(/\\\\/g, '\u0001')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\$/g, '\u0002')
    .replace(/\u0001/g, '\\')

const processSingleEscapes = (s: string): string =>
  s
    .replace(/\\\\/g, '\u0001')
    .replace(/\\'/g, "'")
    .replace(/\u0001/g, '\\')

const interpolate = (s: string, env: Env): string =>
  s
    .replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name: string) => env.has(name) ? phpStr(env.get(name)) : '')
    .replace(/\u0002/g, '$')

const collectString = (node: Ok): string => {
  const raw = field<Ok>(node, 'value')
  let s = ''
  if (typeof raw === 'string') s = raw
  else if (isArr(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') s += item
      else if (isArr(item)) s += item.map(c => typeof c === 'string' ? c : '').join('')
    }
  }
  return s
}

// ─── Evaluator ──────────────────────────────────────────────────────

const extractArgs = (argsNode: Ok | null, env: Env, output: Output): Value[] => {
  if (argsNode === null || argsNode === undefined) return []
  const raw = field<Ok>(argsNode, 'args')
  if (isArr(raw)) return raw.map(a => evalExpr(a, env, output))
  return [evalExpr(raw, env, output)]
}

function evalExpr (node: Ok, env: Env, output: Output): Value {
  if (typeof node === 'string' || node === null || isArr(node)) return node as Value

  const t = tag(node)

  switch (t) {
    case 'Int':
      return parseInt(field<string>(node, 'value'))

    case 'Float':
      return parseFloat(field<string>(node, 'value'))

    case 'String':
      return interpolate(processDoubleEscapes(collectString(node)), env)

    case 'SqString':
      return processSingleEscapes(collectString(node))

    case 'True':
      return true

    case 'False':
      return false

    case 'Null':
      return null

    case 'Var':
      return env.get(field<string>(node, 'name'))

    case 'ArrayLit': {
      const elements = field<Ok | null>(node, 'elements')
      if (elements === null) return []
      const raw = field<Ok>(elements, 'args')
      if (isArr(raw)) return raw.map(e => evalExpr(e, env, output))
      return [evalExpr(raw, env, output)]
    }

    case 'IndexExpr': {
      const value = evalExpr(field<Ok>(node, 'expression'), env, output)
      const index = toNumber(evalExpr(field<Ok>(node, 'index'), env, output))
      if (!Number.isInteger(index)) throw new RuntimeError(`invalid index: ${index}`)
      if (Array.isArray(value)) {
        if (index < 0 || index >= value.length) throw new RuntimeError(`index out of range: ${index}`)
        return value[index]!
      }
      if (typeof value === 'string') {
        if (index < 0 || index >= value.length) throw new RuntimeError(`index out of range: ${index}`)
        return value.charAt(index)
      }
      throw new RuntimeError('cannot index non-array value')
    }

    case 'PostfixExpr': {
      const expr = field<Ok>(node, 'expression')
      if (tag(expr) !== 'Var') throw new RuntimeError('++/-- requires a variable')
      const name = field<string>(expr, 'name')
      const op = field<string>(node, 'op')
      const current = toNumber(env.get(name))
      const next = op === '++' ? current + 1 : current - 1
      env.set(name, next)
      return current
    }

    case 'UnaryExpr': {
      const op = field<string>(node, 'op')
      const expr = field<Ok>(node, 'expression')
      if (op === '++' || op === '--') {
        if (tag(expr) !== 'Var') throw new RuntimeError('++/-- requires a variable')
        const name = field<string>(expr, 'name')
        const current = toNumber(env.get(name))
        const next = op === '++' ? current + 1 : current - 1
        env.set(name, next)
        return next
      }
      const value = evalExpr(expr, env, output)
      switch (op) {
        case '-': return -toNumber(value)
        case '!': return !truthy(value)
        default: throw new RuntimeError(`unknown unary operator: ${op}`)
      }
    }

    case 'OrExpr': case 'AndExpr': case 'Comparison': case 'Concat': case 'Additive': case 'Multiplicative': {
      let result = evalExpr(field<Ok>(node, 'first'), env, output)
      const rest = (field<Ok | null>(node, 'rest') ?? []) as Ok[]
      for (const binary of rest) {
        result = evalBinary(field<string>(binary, 'op'), result, evalExpr(field<Ok>(binary, 'term'), env, output))
      }
      return result
    }

    case 'CallExpr': {
      const name = field<string>(node, 'name')
      const args = extractArgs(field<Ok | null>(node, 'args'), env, output)

      switch (name) {
        case 'strlen': {
          if (args.length !== 1) throw new RuntimeError('strlen: expected 1 argument')
          const v = args[0]!
          if (typeof v !== 'string') throw new RuntimeError('strlen: argument must be string')
          return v.length
        }
        case 'strtoupper': {
          if (args.length !== 1) throw new RuntimeError('strtoupper: expected 1 argument')
          return phpStr(args[0]!).toUpperCase()
        }
        case 'strtolower': {
          if (args.length !== 1) throw new RuntimeError('strtolower: expected 1 argument')
          return phpStr(args[0]!).toLowerCase()
        }
        case 'count': {
          if (args.length !== 1) throw new RuntimeError('count: expected 1 argument')
          const v = args[0]!
          if (!Array.isArray(v)) throw new RuntimeError('count: argument must be array')
          return v.length
        }
        case 'str_repeat': {
          if (args.length !== 2) throw new RuntimeError('str_repeat: expected 2 arguments')
          const s = phpStr(args[0]!)
          const n = toNumber(args[1]!)
          if (n < 0 || !Number.isInteger(n)) throw new RuntimeError('str_repeat: invalid repeat count')
          return s.repeat(n)
        }
      }

      const fn = env.get(name)
      if (fn && typeof fn === 'object' && !Array.isArray(fn) && (fn as FunctionValue).tag === 'function') {
        return callFunction(fn as unknown as FunctionValue, args, output)
      }

      throw new RuntimeError(`undefined function: ${name}`)
    }
  }

  return node as unknown as Value
}

function callFunction (fn: FunctionValue, args: Value[], output: Output): Value {
  const localEnv = new Env(fn.closure)
  if (args.length !== fn.params.length) {
    throw new RuntimeError(`${fn.name}: expected ${fn.params.length} arguments, got ${args.length}`)
  }
  for (let i = 0; i < fn.params.length; i++) {
    localEnv.define(fn.params[i]!, args[i]!)
  }
  try {
    execBlock(fn.body, localEnv, output)
  } catch (e) {
    if (e instanceof ReturnSignal) return e.value
    throw e
  }
  return null
}

function execBlock (body: Ok, env: Env, output: Output): void {
  const stmts = isArr(body) ? body : [body]
  for (const stmt of stmts) execStmt(stmt, env, output)
}

function execStmt (node: Ok, env: Env, output: Output): void {
  if (typeof node === 'string' || node === null || isArr(node)) return

  const t = tag(node)

  switch (t) {
    case 'Echo': {
      const argsNode = field<Ok | null>(node, 'args')
      if (argsNode !== undefined && argsNode !== null) {
        const values = extractArgs(argsNode, env, output).map(phpStr).join('')
        output.text += values
      } else {
        const value = phpStr(evalExpr(field<Ok>(node, 'expression'), env, output))
        output.text += value
      }
      break
    }
    case 'Assign': {
      env.define(field<string>(node, 'name'), evalExpr(field<Ok>(node, 'value'), env, output))
      break
    }
    case 'IfStmt': {
      if (truthy(evalExpr(field<Ok>(node, 'condition'), env, output))) {
        execBlock(field<Ok>(node, 'body'), env, output)
        break
      }
      const elifs = (field<Ok | null>(node, 'elseif') ?? []) as Ok[]
      for (const elif of elifs) {
        if (truthy(evalExpr(field<Ok>(elif, 'condition'), env, output))) {
          execBlock(field<Ok>(elif, 'body'), env, output)
          return
        }
      }
      const elseNode = field<Ok | null>(node, 'else')
      if (elseNode !== null && isNode(elseNode)) {
        execBlock(field<Ok>(elseNode, 'body'), env, output)
      }
      break
    }
    case 'While': {
      while (truthy(evalExpr(field<Ok>(node, 'condition'), env, output))) {
        execBlock(field<Ok>(node, 'body'), env, output)
      }
      break
    }
    case 'For': {
      const init = field<Ok | null>(node, 'init')
      if (init !== null) execStmt(init, env, output)
      const condition = field<Ok | null>(node, 'condition')
      const update = field<Ok | null>(node, 'update')
      const body = field<Ok>(node, 'body')
      while (condition === null || truthy(evalExpr(condition, env, output))) {
        execBlock(body, env, output)
        if (update !== null) {
          if (tag(update) === 'Assign') execStmt(update, env, output)
          else evalExpr(update, env, output)
        }
      }
      break
    }
    case 'FuncDecl': {
      const name = field<string>(node, 'name')
      const paramsNode = field<Ok | null>(node, 'params')
      let params: string[] = []
      if (paramsNode !== null) {
        const raw = field<Ok>(paramsNode, 'params')
        if (isArr(raw)) params = raw.map(p => field<string>(p, 'name'))
        else params = [field<string>(raw, 'name')]
      }
      env.define(name, {
        tag: 'function' as const, name, params,
        body: field<Ok>(node, 'body'), closure: env
      } as unknown as Value)
      break
    }
    case 'Return': {
      const valueNode = field<Ok | null>(node, 'value')
      throw new ReturnSignal(valueNode === null ? null : evalExpr(valueNode, env, output))
    }
    case 'Empty':
      break
    case 'ExprStmt': {
      evalExpr(field<Ok>(node, 'expression'), env, output)
      break
    }
  }
}

// ─── Template → PHP (phase 1) ────────────────────────────────────────

const quote = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')

/**
 * Rewrite a PHP template (`foo<?php bar ?>baz`) into plain PHP
 * (`<?php echo "foo"; bar; echo "baz"; ?>`) by wrapping literal text
 * in echo and stripping the original tags.
 */
const templateToPhp = (source: string): string => {
  let out = ''
  let i = 0
  while (i < source.length) {
    const open = source.indexOf('<?', i)
    if (open === -1) {
      out += `echo "${quote(source.slice(i))}"; `
      break
    }
    if (open > i) out += `echo "${quote(source.slice(i, open))}"; `
    if (source.startsWith('<?=', open)) {
      const close = source.indexOf('?>', open + 3)
      if (close === -1) throw new Error('unterminated <?= tag')
      out += `echo ${source.slice(open + 3, close).trim()}; `
      i = close + 2
    } else if (source.startsWith('<?php', open)) {
      const close = source.indexOf('?>', open + 5)
      if (close === -1) {
        out += source.slice(open + 5)
        i = source.length
      } else {
        out += source.slice(open + 5, close)
        i = close + 2
      }
    } else {
      out += 'echo "<?"; '
      i = open + 2
    }
  }
  return `<?php ${out}`
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Run a mini-PHP program and return the echoed output string.
 */
export function runPhp (source: string): string {
  const ast = parse(templateToPhp(source))
  const output: Output = { text: '' }
  const globalEnv = new Env()
  try {
    execBlock(field<Ok>(ast as Node, 'statements'), globalEnv, output)
  } catch (e) {
    if (!(e instanceof ReturnSignal)) throw e
  }
  return output.text
}

/**
 * Parse a mini-PHP source string and return the AST (for inspection).
 */
export function parsePhp (source: string): Ok {
  return parse(templateToPhp(source))
}
