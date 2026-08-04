import { packrat } from "./packrat"
import testData from "./test.json" with { type: "json" }

type TestCase = {
  name: string
  input: string
  expected: unknown
  startRule?: string
}

type TestGroup = {
  name: string
  grammar: string
  tests: TestCase[]
}

function deepMatch(actual: unknown, expected: unknown): boolean {
  if (expected === "err") return true
  if (expected === null) return actual === null
  if (expected === actual) return true
  if (actual === undefined || actual === null) return expected === actual

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false
    if (actual.length < expected.length) return false
    for (let i = 0; i < expected.length; i++) {
      if (!deepMatch(actual[i], expected[i])) return false
    }
    return true
  }

  if (typeof expected === "object") {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) return false
    for (const key of Object.keys(expected as Record<string, unknown>)) {
      if (!(key in (actual as Record<string, unknown>))) return false
      if (!deepMatch((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key])) return false
    }
    return true
  }

  return false
}

function bold(s: string) { return `\x1b[1m${s}\x1b[0m` }
function red(s: string) { return `\x1b[31m${s}\x1b[0m` }
function green(s: string) { return `\x1b[32m${s}\x1b[0m` }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m` }
function gray(s: string) { return `\x1b[90m${s}\x1b[0m` }

const filter = process.argv[2]?.toLowerCase() ?? ""

let pass = 0
let fail = 0
const start = performance.now()
const failures: string[] = []

const allNames: string[] = []
for (const group of (testData as unknown as TestGroup[])) {
  for (const tc of group.tests) {
    allNames.push(tc.name)
  }
}

const seen = new Map<string, number>()
const dupes = new Set<string>()
for (const name of allNames) {
  const count = (seen.get(name) ?? 0) + 1
  seen.set(name, count)
  if (count === 2) dupes.add(name)
}

if (dupes.size > 0) {
  console.log(red(`duplicate test names (${dupes.size}):`))
  for (const name of dupes) {
    const groups = (testData as unknown as TestGroup[]).filter(g => g.tests.some(t => t.name === name))
    console.log(dim(`  ${name}`) + gray(` (${seen.get(name)}× in [${groups.map(g => g.name).join(", ")}])`))
  }
  process.exit(1)
}

for (const group of (testData as unknown as TestGroup[])) {
  if (group.name === "Self host") continue
  if (filter && !group.tests.some(t => t.name.toLowerCase() === filter)) continue

  const parse = packrat(group.grammar)

  for (const tc of group.tests) {
    if (filter && tc.name.toLowerCase() !== filter) continue
    if (tc.expected === "err") {
      const t0 = performance.now()
      const options = tc.startRule ? { startRule: tc.startRule } : {}
      try {
        parse(tc.input, options)
        fail++
        const ms = (performance.now() - t0).toFixed(2)
        console.log(`${gray("(fail)")} [${group.name}] ${dim(">")} ${tc.name} ${gray(`[${ms}ms]`)}`)
        failures.push(`${red("✗")} [${group.name}] ${tc.name} — "${tc.input}"\n  expected error but got success`)
      } catch {
        pass++
      }
    } else {
      const t0 = performance.now()
      try {
        const options = tc.startRule ? { startRule: tc.startRule } : {}
        const result = parse(tc.input, options)
        if (deepMatch(result, tc.expected)) {
          pass++
        } else {
          fail++
          const ms = (performance.now() - t0).toFixed(2)
          console.log(`${gray("(fail)")} [${group.name}] ${dim(">")} ${tc.name} ${gray(`[${ms}ms]`)}`)
          failures.push(`${red("✗")} [${group.name}] ${tc.name} — "${tc.input}"\n  expected: ${JSON.stringify(tc.expected)}\n  actual:   ${JSON.stringify(result)}`)
        }
      } catch (e: any) {
        fail++
        const ms = (performance.now() - t0).toFixed(2)
        console.log(`${gray("(fail)")} [${group.name}] ${dim(">")} ${tc.name} ${gray(`[${ms}ms]`)}`)
        failures.push(`${red("✗")} [${group.name}] ${tc.name} — "${tc.input}"\n  ${red(e.message?.split("\n")[0] ?? String(e))}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.log()
  for (const f of failures) console.log(f)
}

const elapsed = ((performance.now() - start) / 1000).toFixed(2)
const total = pass + fail
const summary = fail > 0
  ? `${red(`${fail} fail`)}  ${green(`${pass} pass`)}`
  : `${green(`${pass} pass`)}`

console.log()
console.log(`${summary}  ${dim(`${elapsed}s`)}`)
if (fail === 0) console.log(green(`\n ${total} tests passed in test.ts!`))
else console.log(red(`\n ${fail} of ${total} tests failed in test.ts`))

if (fail > 0) process.exit(1)
