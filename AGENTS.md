# AGENTS.md

## Project Overview

**packrat** — PEG parser library for TypeScript, zero runtime dependencies, runs on Bun. Grammar ditulis pake tagged template literal DSL, outputnya parser yang fully typed. Support left recursion, indentation-sensitive parsing, error reporting yang manusiawi, dan bisa compile grammar ke JavaScript & PHP (cross-runtime). Self-hosted — grammar DSL bisa nge-parse dirinya sendiri.

## Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install dev dependencies (`@types/bun`) |
| `bun test` | Run all tests (library + examples) |
| `bun test packrat.test.ts` | Run library tests only |
| `bun test recursion.test.ts` | Run recursion tests only |
| `bun test examples/` | Run all example tests |

**Build:** Nggak ada build step. Bun langsung jalanin `.ts` via `noEmit: true` di tsconfig.

**Lint:** Nggak ada linter/formatter. Jangan tambahin.

**Typecheck:** Nggak ada command explicit — Bun auto-typecheck pas run. Strict mode (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`).

## Architecture

Single-file library: `packrat.ts` (~2477 lines) dengan SECTION comment separator:
1. **Types** — `Grammar`, `Rule`, `Expression`, `ResolvedGrammar`, `Ok`, `Node`, `Location`, `ParseError`
2. **resolveGrammar** — resolve grammar AST, detect left recursion, assign temporary variable names
3. **evaluateGrammar** — interpreter/evaluator grammar langsung di TypeScript (memoization + growing-the-seed algorithm buat left recursion)
4. **emitJs** — compiler ke JavaScript
5. **emitPhp** — compiler ke PHP
6. **parseGrammar** — convert parse result (Ok tree) jadi Grammar AST
7. **packratGrammar** — hardcoded Grammar AST (self-hosted, ~800+ baris)
8. **packrat** — main entry, tagged template function dengan 3 mode (TS, PHP, JS)

## Key Files

- `packrat.ts` — seluruh library
- `packrat.test.ts` — test semua operator + self-host test
- `recursion.test.ts` — test left/right/mutual recursion
- `packrat.packrat` — grammar DSL yang nulis dirinya sendiri (self-hosted)
- `examples/` — mini parser + interpreter (SQL, Go, JS, PHP, Python, Pug, list)

## Code Conventions

- **No semicolons** (kecuali beberapa tempat)
- **Double quotes** buat string
- **Functional style** — pure functions, cuma `ParseError` yang class
- **No inline comments** — cuma SECTION separator (`// SECTION: Types`, `// SECTION: evaluateGrammar`, etc.)
- **Verbose where needed** — prefer clarity over terseness, variable names panjang gapapa

## Testing

Framework: Bun built-in (`bun:test`). Style: `describe`/`test`/`expect`.

Self-host test di `packrat.test.ts` mastiin grammar bisa nge-parse dirinya sendiri — hasil parse harus identik dengan `packratGrammar` constant.

## git

Repo: `https://github.com/audinue/packrat`  
Commit style: informal, short messages, no conventional commits.
