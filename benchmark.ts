import { buildGrammar, emitJs, evaluateGrammar, packratGrammar, parseGrammar, resolveGrammar } from './packrat'
import { performance } from 'node:perf_hooks'
import { readFileSync } from 'node:fs'

const packratText = readFileSync(`${import.meta.dir}/packrat.packrat`, 'utf-8')
const packratTsText = readFileSync(`${import.meta.dir}/packrat.ts`, 'utf-8')
const miniJsText = readFileSync(`${import.meta.dir}/examples/mini-js.packrat`, 'utf-8')
const miniGoText = readFileSync(`${import.meta.dir}/examples/mini-golang.packrat`, 'utf-8')
const miniSqlText = readFileSync(`${import.meta.dir}/examples/mini-sql.packrat`, 'utf-8')
const miniTsText = readFileSync(`${import.meta.dir}/examples/typescript.packrat`, 'utf-8')

const packratRepeat = Number(process.argv[2] ?? '10')

const grammars = {
  selfhost: packratGrammar,
  miniJs: parseGrammar(buildGrammar(packratGrammar).parse(miniJsText)),
  miniGo: parseGrammar(buildGrammar(packratGrammar).parse(miniGoText)),
  miniSql: parseGrammar(buildGrammar(packratGrammar).parse(miniSqlText)),
  miniTs: parseGrammar(buildGrammar(packratGrammar).parse(miniTsText)),
}

const generateJs = (count: number): string => {
  const lines = ['function fib(n) {', '  let a = 0;', '  let b = 1;']
  for (let i = 0; i < count; i++) {
    lines.push(`  let x${i} = (a + b * ${i}) - (n / 2);`)
  }
  lines.push('  return a;', '}')
  return lines.join('\n') + '\n'
}

const generateGo = (count: number): string => {
  const lines: string[] = []
  for (let i = 0; i < count; i++) {
    lines.push(`  x${i} := (a + b * ${i}) - (n / 2)`)
  }
  return 'func fib(n : int) {\n  a := 0\n  b := 1\n' + lines.join('\n') + '\n  return a\n}\n'
}

const generateSql = (count: number): string => {
  const cols = Array.from({ length: count }, (_, i) => `c${i}`).join(', ')
  const conds = Array.from({ length: count }, (_, i) => `c${i} > ${i}`).join(' AND ')
  return `SELECT ${cols} FROM t WHERE ${conds}\n`
}

const generateTs = (count: number): string => {
  const lines: string[] = []
  for (let i = 0; i < count; i++) {
    lines.push(`  let x${i}: number = (a + b * ${i}) - (n / 2)`)
  }
  return 'function fib(n: number): number {\n  let a: number = 0\n  let b: number = 1\n' + lines.join('\n') + '\n  return a\n}\n'
}

const workloads = [
  { name: 'packrat.ts (self-parse)', grammar: grammars.miniTs, input: packratTsText, iterations: 20 },
  { name: `packrat.packrat ${(packratText.length / 1024).toFixed(1)}KB`, grammar: grammars.selfhost, input: packratText, iterations: 200 },
  { name: `packrat.packrat x${packratRepeat}`, grammar: grammars.selfhost, input: packratText.repeat(packratRepeat), iterations: Math.max(20, Math.floor(200 / packratRepeat)) },
  { name: 'mini-js 50 stmts', grammar: grammars.miniJs, input: generateJs(50), iterations: 100 },
  { name: 'mini-js 500 stmts', grammar: grammars.miniJs, input: generateJs(500), iterations: 30 },
  // { name: 'mini-js 5000 stmts', grammar: grammars.miniJs, input: generateJs(5000), iterations: 5 },
  { name: 'mini-go 50 stmts', grammar: grammars.miniGo, input: generateGo(50), iterations: 100 },
  { name: 'mini-go 500 stmts', grammar: grammars.miniGo, input: generateGo(500), iterations: 30 },
  { name: 'mini-sql 50 cols', grammar: grammars.miniSql, input: generateSql(50), iterations: 100 },
  { name: 'mini-sql 500 cols', grammar: grammars.miniSql, input: generateSql(500), iterations: 30 },
  { name: 'mini-ts 50 stmts', grammar: grammars.miniTs, input: generateTs(50), iterations: 100 },
  { name: 'mini-ts 500 stmts', grammar: grammars.miniTs, input: generateTs(500), iterations: 30 },
]

const workloadName = (name: string, input: string) => `${name} (${(input.length / 1024).toFixed(1)}KB)`

const measure = (fn: () => unknown, iterations: number) => {
  fn()
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  return (performance.now() - start) / iterations
}

const assertEqual = (left: unknown, right: unknown) => {
  const leftJson = JSON.stringify(left)
  const rightJson = JSON.stringify(right)
  if (leftJson !== rightJson) {
    throw new Error(`result mismatch:\n${leftJson}\n${rightJson}`)
  }
}

const row = (cells: (string | number)[]) => cells.map(cell => String(cell).padEnd(28)).join("")
const ms = (value: number) => value.toFixed(2) + ' ms'

const buildRuns = 10
console.log('build time (lower is better)')
console.log(row(['workload', 'resolveGrammar', 'buildGrammar', 'emitJs']))
for (const workload of workloads) {
  const resolved = resolveGrammar(workload.grammar)
  const resolve = measure(() => resolveGrammar(workload.grammar), buildRuns)
  const build = measure(() => buildGrammar(workload.grammar), buildRuns)
  const emit = measure(() => emitJs(resolved), buildRuns)
  console.log(row([workload.name, ms(resolve), ms(build), ms(emit)]))
}

console.log()
console.log('parse time per call, batched (lower is better)')
console.log(row(['workload', 'iters', 'evaluateGrammar', 'buildGrammar', 'emitJs', 'emit/no-inline', 'build/eval', 'emit/eval', 'inline/uninlined']))
for (const workload of workloads) {
  const resolved = resolveGrammar(workload.grammar)
  const built = buildGrammar(workload.grammar)
  const parseJs = new Function(`${emitJs(resolved).replace('export { parse }', '')}\n; return parse`)()
  const resolvedNoInline = { ...resolved, rules: resolved.rules.map(r => ({ ...r, inlineable: false })) }
  const parseJsNoInline = new Function(`${emitJs(resolvedNoInline).replace('export { parse }', '')}\n; return parse`)()
  assertEqual(evaluateGrammar(resolved, workload.input), built.parse(workload.input))
  assertEqual(evaluateGrammar(resolved, workload.input), parseJs(workload.input))
  const evaluate = measure(() => evaluateGrammar(resolved, workload.input), workload.iterations)
  const polymorphic = measure(() => built.parse(workload.input), workload.iterations)
  const compiled = measure(() => parseJs(workload.input), workload.iterations)
  const compiledNoInline = measure(() => parseJsNoInline(workload.input), workload.iterations)
  console.log(row([
    workloadName(workload.name, workload.input),
    workload.iterations,
    ms(evaluate),
    ms(polymorphic),
    ms(compiled),
    ms(compiledNoInline),
    (polymorphic / evaluate).toFixed(2) + 'x',
    (compiled / evaluate).toFixed(2) + 'x',
    (compiled / compiledNoInline).toFixed(2) + 'x',
  ]))
}

/** buildGrammar only — uncomment when needed
console.log()
console.log('buildGrammar parse time (lower is better)')
console.log(row(['workload', 'iters', 'ms/call', 'KB/s', 'MB/s']))
for (const workload of workloads) {
  const built = buildGrammar(workload.grammar)
  const ms = measure(() => built.parse(workload.input), workload.iterations)
  const kbps = (workload.input.length / 1024) / (ms / 1000)
  const mbps = kbps / 1024
  console.log(row([
    workloadName(workload.name, workload.input),
    workload.iterations,
    ms.toFixed(2) + ' ms',
    kbps.toFixed(0),
    mbps.toFixed(2)
  ]))
}
*/

console.log()
console.log('packrat.ts emitJs non-recursive cache mode (lower is better)')
console.log(row(['mode', 'iters', 'ms/call', 'vs auto', 'code size']))

const tsResolved = resolveGrammar(grammars.miniTs)
const tsAuto = new Function(`${emitJs(tsResolved).replace('export { parse }', '')}\n; return parse`)()
tsAuto(packratTsText)

const tsFull = resolveGrammar(grammars.miniTs)
tsFull.rules = tsFull.rules.map(r => r.isLeftRecursive ? r : { ...r, memoize: true })
const tsFullJs = new Function(`${emitJs(tsFull).replace('export { parse }', '')}\n; return parse`)()
tsFullJs(packratTsText)

const tsIterations = 10
const tsAutoTime = measure(() => tsAuto(packratTsText), tsIterations)
const tsFullTime = measure(() => tsFullJs(packratTsText), tsIterations)
console.log(row(['auto', tsIterations, ms(tsAutoTime), '1.00x', (emitJs(tsResolved).length / 1024).toFixed(0) + 'KB']))
console.log(row(['full', tsIterations, ms(tsFullTime), (tsFullTime / tsAutoTime).toFixed(2) + 'x', (emitJs(tsFull).length / 1024).toFixed(0) + 'KB']))
