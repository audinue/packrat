import { isNode, packrat } from '../packrat'

const grammarText = await Bun.file(`${import.meta.dir}/mini-python.packrat`).text()
const parsePy = packrat(grammarText)

type Scope = Map<string, unknown>

const truthy = (value: unknown): boolean => {
  return value !== null && value !== undefined && value !== false && value !== 0 && value !== ''
}

const format = (value: unknown): string => {
  if (value === true) return 'True'
  if (value === false) return 'False'
  return String(value)
}

const evalExpr = (node: unknown, scope: Scope): unknown => {
  if (!isNode(node)) throw new Error('Invalid expression')
  switch (node.tag) {
    case 'Number':
      return parseInt(node.value as string, 10)
    case 'String':
      return node.value
    case 'True':
      return true
    case 'False':
      return false
    case 'Id': {
      const name = node.value as string
      if (!scope.has(name)) throw new Error(`NameError: ${name} is not defined`)
      return scope.get(name)
    }
    case 'Negate':
      return -(evalExpr(node.expression, scope) as number)
    case 'Add': {
      const left = evalExpr(node.left!, scope)
      const right = evalExpr(node.right!, scope)
      if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right)
      return (left as number) + (right as number)
    }
    case 'Sub': return (evalExpr(node.left!, scope) as number) - (evalExpr(node.right!, scope) as number)
    case 'Mul': return (evalExpr(node.left!, scope) as number) * (evalExpr(node.right!, scope) as number)
    case 'Div': return (evalExpr(node.left!, scope) as number) / (evalExpr(node.right!, scope) as number)
    case 'Mod': return (evalExpr(node.left!, scope) as number) % (evalExpr(node.right!, scope) as number)
    case 'Eq': return evalExpr(node.left!, scope) === evalExpr(node.right!, scope)
    case 'Neq': return evalExpr(node.left!, scope) !== evalExpr(node.right!, scope)
    case 'Lt': return (evalExpr(node.left!, scope) as number) < (evalExpr(node.right!, scope) as number)
    case 'Gt': return (evalExpr(node.left!, scope) as number) > (evalExpr(node.right!, scope) as number)
    case 'Lte': return (evalExpr(node.left!, scope) as number) <= (evalExpr(node.right!, scope) as number)
    case 'Gte': return (evalExpr(node.left!, scope) as number) >= (evalExpr(node.right!, scope) as number)
    default:
      throw new Error(`Unknown expression: ${node.tag}`)
  }
}

const blockStatements = (block: unknown): unknown[] => {
  const node = block as { statements: unknown[] }
  return node.statements
}

const runStatements = (statements: unknown[], scope: Scope, output: string[]): void => {
  for (const statement of statements) {
    runStatement(statement, scope, output)
  }
}

const runBlock = (block: unknown, scope: Scope, output: string[]): void => {
  runStatements(blockStatements(block), scope, output)
}

const runStatement = (node: unknown, scope: Scope, output: string[]): void => {
  if (!isNode(node)) throw new Error('Invalid statement')
  switch (node.tag) {
    case 'Assign': {
      const name = (node.name as unknown as { value: string }).value
      scope.set(name, evalExpr(node.expression, scope))
      break
    }
    case 'Print': {
      const argument = node.argument
      output.push(argument === null || argument === undefined ? '' : format(evalExpr(argument, scope)))
      break
    }
    case 'If': {
      if (truthy(evalExpr(node.expression, scope))) {
        runBlock(node.block, scope, output)
        return
      }
      for (const elif of ((node.elifs as unknown[] | null) ?? [])) {
        const item = elif as { expression: unknown, block: unknown }
        if (truthy(evalExpr(item.expression, scope))) {
          runBlock(item.block, scope, output)
          return
        }
      }
      const elseNode = node.else
      if (elseNode !== null && elseNode !== undefined) {
        runBlock(((elseNode as unknown) as { block: unknown }).block, scope, output)
      }
      break
    }
    case 'While': {
      while (truthy(evalExpr(node.expression, scope))) {
        runBlock(node.block, scope, output)
      }
      break
    }
    default:
      throw new Error(`Unknown statement: ${node.tag}`)
  }
}

const runProgram = (node: unknown, scope: Scope, output: string[]): void => {
  if (!isNode(node) || node.tag !== 'Program') throw new Error('Invalid program')
  runStatements((node as unknown as { statements: unknown[] }).statements, scope, output)
}

const py = (input: string): string => {
  const output: string[] = []
  runProgram(parsePy(input), new Map<string, unknown>(), output)
  return output.join('\n')
}

export { py }
