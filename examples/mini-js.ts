import { packrat, isNode, type Ok, type Node } from '../packrat'

const grammarText = await Bun.file(`${import.meta.dir}/mini-js.packrat`).text()
const parse = packrat(grammarText)

const tag = (node: Ok): string => (node as Node).tag
const field = <T = Ok>(node: Ok, name: string): T => (node as Node)[name] as unknown as T
const isArr = (node: Ok): node is Ok[] => Array.isArray(node)

type Value = number | string | boolean | null | Value[] | FunctionValue

type FunctionValue = {
  tag: 'function'
  name: string
  params: { name: string; rest: boolean }[]
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
  if (v === null) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return '[' + v.map(valToString).join(', ') + ']'
  if (v && typeof v === 'object' && (v as FunctionValue).tag === 'function')
    return `[Function: ${(v as FunctionValue).name}]`
  return String(v)
}

function toNumber (v: Value): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === null) return 0
  if (typeof v === 'string') {
    const n = Number(v.trim())
    if (isNaN(n)) throw new RuntimeError(`cannot convert string to number: ${v}`)
    return n
  }
  throw new RuntimeError(`cannot convert to number`)
}

function processEscapes (s: string): string {
  return s
    .replace(/\\\\/g, '\u0001')
    .replace(/\\`/g, '`')
    .replace(/\\\$/g, '\u0002')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\u0002/g, '$')
    .replace(/\u0001/g, '\\')
}

function collectString (node: Ok): string {
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

function extractArgs (argsNode: Ok | null, env: Env, output: Output): Value[] {
  if (argsNode === null) return []
  const raw = field<Ok>(argsNode, 'args')
  if (isArr(raw)) return raw.map(a => evalExpr(a, env, output))
  return [evalExpr(raw, env, output)]
}

function evalTemplate (node: Ok, env: Env, output: Output): { strings: string[]; values: Value[] } {
  const parts = (field<Ok | null>(node, 'parts') ?? []) as Ok[]
  const strings: string[] = []
  const values: Value[] = []
  let current = ''
  for (const part of parts) {
    if (tag(part) === 'TextPart') {
      current += processEscapes(field<string>(part, 'value'))
    } else {
      strings.push(current)
      current = ''
      values.push(evalExpr(field<Ok>(part, 'expression'), env, output))
    }
  }
  strings.push(current)
  return { strings, values }
}

function evalBinary (op: string, left: Value, right: Value): Value {
  switch (op) {
    case '+': return typeof left === 'string' || typeof right === 'string' ? valToString(left) + valToString(right) : toNumber(left) + toNumber(right)
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
    case '===': return left === right
    case '!==': return left !== right
    case '==': return left === right
    case '!=': return left !== right
    case '<': return toNumber(left) < toNumber(right)
    case '<=': return toNumber(left) <= toNumber(right)
    case '>': return toNumber(left) > toNumber(right)
    case '>=': return toNumber(left) >= toNumber(right)
    case '&&': return isTruthy(left) ? right : left
    case '||': return isTruthy(left) ? left : right
    default: throw new RuntimeError(`unknown operator: ${op}`)
  }
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
      return processEscapes(collectString(node))

    case 'Bool':
      return field<Ok>(node, 'value') === 'true'

    case 'Null':
      return null

    case 'Ident':
      return env.get(field<string>(node, 'name'))

    case 'TemplateString': {
      const { strings, values } = evalTemplate(node, env, output)
      let out = strings[0]!
      for (let i = 0; i < values.length; i++) {
        out += valToString(values[i]!) + strings[i + 1]!
      }
      return out
    }

    case 'TaggedTemplate': {
      const name = field<string>(node, 'name')
      const { strings, values } = evalTemplate(field<Ok>(node, 'template'), env, output)
      const fn = env.get(name)
      if (fn && typeof fn === 'object' && !Array.isArray(fn) && (fn as FunctionValue).tag === 'function') {
        return callFunction(fn as unknown as FunctionValue, [strings as Value, ...values], output)
      }
      throw new RuntimeError(`undefined tag function: ${name}`)
    }

    case 'OrExpr': case 'AndExpr': case 'EqExpr': case 'RelExpr': case 'AddExpr': case 'MulExpr': {
      let result = evalExpr(field<Ok>(node, 'head'), env, output)
      const tail = (field<Ok | null>(node, 'tail') ?? []) as Ok[]
      for (const binary of tail) {
        result = evalBinary(field<string>(binary, 'op'), result, evalExpr(field<Ok>(binary, 'term'), env, output))
      }
      return result
    }

    case 'Unary': {
      const op = field<string>(node, 'op')
      const expr = field<Ok>(node, 'expression')
      if (op === '++' || op === '--') {
        if (tag(expr) !== 'Ident') throw new RuntimeError('++/-- requires a variable')
        const name = field<string>(expr, 'name')
        const current = toNumber(env.get(name))
        const next = op === '++' ? current + 1 : current - 1
        env.set(name, next)
        return next
      }
      const value = evalExpr(expr, env, output)
      switch (op) {
        case '-': return -toNumber(value)
        case '!': return !isTruthy(value)
        default: throw new RuntimeError(`unknown unary operator: ${op}`)
      }
    }

    case 'Chained': {
      const expr = field<Ok>(node, 'expression')
      const tail = field<Ok | null>(node, 'tail')
      let v = evalExpr(expr, env, output)
      if (tail !== null) {
        const list = isArr(tail) ? tail : [tail]
        for (const t of list) {
          const tt = tag(t)
          if (tt === 'Index') {
            const i = toNumber(evalExpr(field<Ok>(t, 'index'), env, output))
            if (!Array.isArray(v)) throw new RuntimeError('cannot index non-array value')
            if (!Number.isInteger(i) || i < 0 || i >= v.length) {
              throw new RuntimeError(`index out of range: ${i}`)
            }
            v = v[i]!
          } else if (tt === 'Member') {
            const name = field<string>(t, 'name')
            if (name === 'length') {
              if (Array.isArray(v)) v = v.length
              else if (typeof v === 'string') v = v.length
              else throw new RuntimeError('cannot access .length')
            } else {
              throw new RuntimeError(`cannot access .${name}`)
            }
          } else {
            if (tag(expr) !== 'Ident') throw new RuntimeError('++/-- requires a variable')
            const name = field<string>(expr, 'name')
            const current = toNumber(env.get(name))
            const op = field<string>(t, 'op')
            env.set(name, op === '++' ? current + 1 : current - 1)
            v = current
          }
        }
      }
      return v
    }

    case 'CallExpr': {
      const callee = field<string | null>(node, 'callee')
      const name = callee ?? field<string>(node, 'name')
      const args = extractArgs(field<Ok | null>(node, 'args'), env, output)

      if (name === 'console.log') {
        output.push(args.map(valToString).join(' '))
        return null
      }

      const fn = env.get(name)
      if (fn && typeof fn === 'object' && !Array.isArray(fn) && (fn as FunctionValue).tag === 'function') {
        return callFunction(fn as unknown as FunctionValue, args, output)
      }

      throw new RuntimeError(`undefined function: ${name}`)
    }

    case 'ArrayLit': {
      const elements = field<Ok | null>(node, 'elements')
      if (elements === null) return []
      const raw = field<Ok>(elements, 'args')
      if (isArr(raw)) return raw.map(e => evalExpr(e, env, output))
      return [evalExpr(raw, env, output)]
    }

  }

  return node as unknown as Value
}

function callFunction (fn: FunctionValue, args: Value[], output: Output): Value {
  const localEnv = new Env(fn.closure)
  const restIndex = fn.params.findIndex(p => p.rest)
  if (restIndex !== -1) {
    if (args.length < restIndex) {
      throw new RuntimeError(`${fn.name}: expected at least ${restIndex} arguments, got ${args.length}`)
    }
    for (let i = 0; i < restIndex; i++) {
      localEnv.define(fn.params[i]!.name, args[i]!)
    }
    localEnv.define(fn.params[restIndex]!.name, args.slice(restIndex))
  } else {
    if (args.length < fn.params.length) {
      throw new RuntimeError(`${fn.name}: expected ${fn.params.length} arguments, got ${args.length}`)
    }
    for (let i = 0; i < fn.params.length; i++) {
      localEnv.define(fn.params[i]!.name, args[i]!)
    }
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
    case 'VarDecl': {
      env.define(field<string>(node, 'name'), evalExpr(field<Ok>(node, 'value'), env, output))
      break
    }
    case 'AssignStmt': {
      env.set(field<string>(node, 'name'), evalExpr(field<Ok>(node, 'value'), env, output))
      break
    }
    case 'IfStmt': {
      if (isTruthy(evalExpr(field<Ok>(node, 'condition'), env, output))) {
        execBlock(field<Ok>(node, 'body'), env, output)
        break
      }
      const elseNode = field<Ok | null>(node, 'else')
      if (elseNode !== null && isNode(elseNode)) {
        execBlock(field<Ok>(elseNode, 'body'), env, output)
      }
      break
    }
    case 'While': {
      while (isTruthy(evalExpr(field<Ok>(node, 'condition'), env, output))) {
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
      while (condition === null || isTruthy(evalExpr(condition, env, output))) {
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
      let params: { name: string; rest: boolean }[] = []
      if (paramsNode !== null) {
        const raw = field<Ok>(paramsNode, 'params')
        if (isArr(raw)) {
          params = raw.map(p => ({ name: field<string>(p, 'name'), rest: tag(p) === 'RestParam' }))
        } else {
          params = [{ name: field<string>(raw, 'name'), rest: tag(raw) === 'RestParam' }]
        }
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
    case 'ExprStmt': {
      evalExpr(field<Ok>(node, 'expression'), env, output)
      break
    }
  }
}

type Output = string[]

export function runJs (source: string): string[] {
  const ast = parse(source.trim() + '\n')
  const output: Output = []
  const globalEnv = new Env()
  try {
    execBlock(field<Ok>(ast as Node, 'statements'), globalEnv, output)
  } catch (e) {
    if (!(e instanceof ReturnSignal)) throw e
  }
  return output
}

export function parseJs (source: string): Ok {
  return parse(source.trim() + '\n')
}
