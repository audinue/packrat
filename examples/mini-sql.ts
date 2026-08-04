import { packrat, isNode, type Ok, ParseError } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-sql.packrat`, 'utf-8')
const parseSql = packrat(grammarText)

type Db = Record<string, Record<string, any>[]>

function evaluateCondition (node: any, row: Record<string, any>): boolean {
  if (!isNode(node)) throw new Error('Invalid condition node')
  switch (node.tag) {
    case 'OrCondition':
      return (node.conditions as Ok[]).filter(isNode).some(c => evaluateCondition(c, row))
    case 'AndCondition':
      return (node.conditions as Ok[]).filter(isNode).every(c => evaluateCondition(c, row))
    case 'Not':
      return !evaluateCondition(node.condition, row)
    case 'Comparison': {
      const left = evaluateValue(node.left, row)
      const right = evaluateValue(node.right, row)
      return compare(left, node.op as string, right)
    }
    default:
      throw new Error(`Unknown condition tag: ${node.tag}`)
  }
}

function evaluateValue (node: any, row: Record<string, any>): any {
  if (!isNode(node)) throw new Error('Invalid value expression')
  switch (node.tag) {
    case 'ColumnRef':
      return getCellValue(row, node.name as string)
    case 'StringLiteral':
      return node.value as string
    case 'NumberLiteral':
      return parseFloat(node.value as string)
    case 'NullLiteral':
      return null
    default:
      throw new Error(`Unknown value expression tag: ${node.tag}`)
  }
}

function compare (left: any, op: string, right: any): boolean {
 if (left == null || right == null) {
    switch (op) {
      case '=': return left === right
      case '!=': case '<>': return left !== right
      default: return false
    }
  }
  switch (op) {
    case '=':  return left === right
    case '!=': case '<>': return left !== right
    case '>':  return left > right
    case '<':  return left < right
    case '>=': return left >= right
    case '<=': return left <= right
    default: throw new Error(`Unknown operator: ${op}`)
  }
}

function resolveColumnName (expr: any): string {
  if (expr.tag === 'UnqualifiedColumn') return expr.name as string
  if (expr.tag === 'QualifiedColumn') return expr.column as string
  throw new Error(`Unknown column expression tag: ${expr.tag}`)
}

function getCellValue (row: Record<string, any>, columnName: string): any {
  if (columnName in row) return row[columnName]
  const key = Object.keys(row).find(k => k.toLowerCase() === columnName.toLowerCase())
  return key !== undefined ? row[key] : undefined
}

/** Resolve the canonical key from a row, case-insensitively. */
function resolveRowKey (row: Record<string, any>, columnName: string): string {
  if (columnName in row) return columnName
  const key = Object.keys(row).find(k => k.toLowerCase() === columnName.toLowerCase())
  return key ?? columnName
}

export function miniSql (sql: string, db: Db): Record<string, any>[] {
  let ast: Ok
  ast = parseSql(sql)
  if (!isNode(ast) || ast.tag !== 'Query') {
    throw new Error('Invalid SQL query')
  }
  const query = ast as any
  const tableName = query.table as string
  const tableKey = Object.keys(db).find(k => k.toLowerCase() === tableName.toLowerCase())
  const table = tableKey !== undefined ? db[tableKey] : undefined
  if (table === undefined) {
    throw new Error(`Table not found: ${tableName}`)
  }
  let rows = [...table]
  if (query.where && isNode(query.where)) {
    const condition = (query.where as any).condition
    rows = rows.filter(row => evaluateCondition(condition, row))
  }
  if (query.orderBy && isNode(query.orderBy)) {
    const orderings = ((query.orderBy as any).orderings as Ok[]).filter(isNode) as any[]
    for (let i = orderings.length - 1; i >= 0; i--) {
      const ordering = orderings[i]!
      const column = ordering.column as string
      const desc = ordering.direction != null && (ordering.direction as any).tag === 'Desc'
      rows.sort((a, b) => {
        const aVal = getCellValue(a, column)
        const bVal = getCellValue(b, column)
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        if (aVal < bVal) return desc ? 1 : -1
        if (aVal > bVal) return desc ? -1 : 1
        return 0
      })
    }
  }
  if (query.limit && isNode(query.limit)) {
    const limitNode = (query.limit as any).value
    if (isNode(limitNode) && limitNode.tag === 'NumberLiteral') {
      const limit = parseFloat(limitNode.value as string)
      rows = rows.slice(0, limit)
    }
  }
  const columns = query.columns as any
  if (!isNode(columns)) {
    throw new Error('Invalid columns in query')
  }
  if (columns.tag === 'Star') {
    return rows.map(row => ({ ...row }))
  }
  if (columns.tag === 'Columns') {
    const selectColumns = (columns.columns as Ok[]).filter(isNode) as any[]
    return rows.map(row => {
      const result: Record<string, any> = {}
      for (const col of selectColumns) {
        const expr = col.expression
        if (!isNode(expr)) continue
        const parsedName = resolveColumnName(expr)
        const alias = (col.alias && isNode(col.alias))
          ? (col.alias as any).name as string
          : resolveRowKey(row, parsedName)
        result[alias] = getCellValue(row, parsedName)
      }
      return result
    })
  }
  throw new Error(`Invalid columns type: ${columns.tag}`)
}
