import { buildGrammar, emitJs, evaluateGrammar, packratGrammar, parseGrammar, resolveGrammar } from './packrat'
import { readFileSync } from 'node:fs'

const miniJsText = readFileSync(`${import.meta.dir}/examples/mini-js.packrat`, 'utf-8')
const grammar = parseGrammar(buildGrammar(packratGrammar).parse(miniJsText))

const lines = ['function fib(n) {', '  let a = 0;', '  let b = 1;']
for (let i = 0; i < 5000; i++) {
  lines.push(`  let x${i} = (a + b * ${i}) - (n / 2);`)
}
lines.push('  return a;', '}')
const input = lines.join('\n') + '\n'

const built = buildGrammar(grammar)
for (let i = 0; i < 3; i++) {
  built.parse(input)
}

const resolved = resolveGrammar(grammar)
for (let i = 0; i < 3; i++) {
  evaluateGrammar(resolved, input)
}

const parseJs = new Function(`${emitJs(resolved).replace('export { parse }', '')}\n; return parse`)()
for (let i = 0; i < 3; i++) {
  parseJs(input)
}
