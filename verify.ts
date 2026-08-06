import { packrat } from "./packrat"
import { readFileSync, readdirSync } from "node:fs"

const grammar = await readFileSync("examples/typescript.packrat", "utf-8")
const parser = await packrat(grammar)

const progressDir = "progress"
const files = readdirSync(progressDir)
  .filter((f) => f.startsWith("progress-") || f.startsWith("section-") || f.startsWith("resolve-"))
  .sort()

let ok = 0
let fail = 0

for (const f of files) {
  const src = readFileSync(`${progressDir}/${f}`, "utf-8")
  const start = Date.now()
  try {
    const r = (await parser(src)) as any
    const stmts = r.statements?.length ?? "?"
    console.log(`✅ ${f} (${stmts} stmts, ${Date.now() - start}ms)`)
    ok++
  } catch (e: any) {
    const msg = e.message?.slice(0, 120) ?? String(e)
    console.log(`❌ ${f} — ${msg}`)
    if (e.rightmostOffset !== undefined) {
      console.log(`   rightmost: ${e.rightmostOffset}`)
    }
    fail++
  }
}

console.log(`\n${ok} ok, ${fail} fail`)
