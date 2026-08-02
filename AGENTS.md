# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## Project Overview

**packrat** is a dependency-free PEG (Parsing Expression Grammar) parser library for TypeScript, built on packrat parsing (memoized recursive descent). Users write grammars in a PEG-style DSL via tagged template literals and get back a parser function with precise error reporting.

- Runtime: [Bun](https://bun.sh) v1.x
- Language: TypeScript 5+ (strict mode)
- Dependencies: none at runtime (`@types/bun` is the only dev dependency)

## Project Structure

```
index.ts           Public entry point — re-exports the supported API
packrat.ts         Private implementation (evaluator, grammar compiler, self-hosted grammar)
packrat.test.ts    Library test suite
examples/          Example parsers/interpreters (list, mini-sql, mini-golang, mini-js,
                   mini-php, mini-python, mini-pug), each with its own *.test.ts
README.md          User-facing documentation (grammar syntax reference)
```

## Public API Boundary (important)

- `index.ts` is the **only** public surface. It exports exactly:
  `packrat`, `isNode`, `ParseError`, and the types `Location`, `Node`, `Ok`.
- `packrat.ts` is **private**. It additionally exports `evaluateGrammar`, `packratGrammar`,
  and `parseGrammar` — these exist for internal use and tests only. Never treat them as
  public API, never document them as such, and feel free to change them as long as the
  public API and tests stay green.
- Note: files in `examples/` currently import from `../packrat` directly. That's acceptable
  for in-repo examples, but library consumers must only use `index.ts`.

## Commands

```bash
bun install                          # install dev dependencies
bun test                             # run the full test suite (library + examples)
bun test packrat.test.ts             # run only the library tests
bun test examples/mini-sql.test.ts   # run one example's tests
```

All 294 tests must pass before considering any change complete.

## Architecture (how it works)

1. `packrat` (template tag) → parses the DSL text with `evaluateGrammar(packratGrammar, input)`
   producing a raw AST, then `parseGrammar` validates and converts it into an internal
   `Grammar` (discriminated-union `Expression` tree keyed by `tag`).
2. The returned parser calls `evaluateGrammar(grammar, input, options)` — a recursive-descent
   evaluator over the `Expression` tree with a per-rule memo cache keyed by
   `offset@indent` (that's the "packrat" part).
3. Parse results use the `Ok` union: `null | string | Ok[] | Node`. A `Node` always has
   `tag: string` and a lazy `location: Location`, plus any `name:expr` fields.
4. The DSL is **self-hosted**: `packratGrammar` is the grammar of the grammar DSL itself,
   and the *Self host* test in `packrat.test.ts` proves the DSL can describe itself.
   If you change the DSL syntax, you must update `packratGrammar` **and** the *Self host*
   test input (they are mirrors of each other).

### Key invariants

- `parseGrammar` rejects duplicate rule names and references to unknown rules.
- The parser fails on any trailing unconsumed input (`offset < input.length`).
- `ParseError` carries a `Location` with `file`, `line`, `column`, and a `preview`
  getter (source line + caret). Keep error output format stable — tests assert on it.
- Indentation state (`indent` stack) is part of the memoization key; the `Indent`
  expression requires strictly deeper indentation than the current level.

## Code Style

Follow the existing style exactly — there is no linter/formatter config, so match by eye:

- **No semicolons**
- **Single quotes**
- 2-space indentation
- Space before function/method parentheses: `toString () {`, `function parseList (source: string) {`
- Arrow functions preferred for module-level helpers: `const isNode = (value: unknown): value is Node => {`
- Discriminated unions with a `tag` field for AST/expression types (see `Expression`, `Predicate`)
- `switch` on `tag` with exhaustive cases (no `default`) where the union allows it
- `??` / `!` used idiomatically; strict-mode flags like `noUncheckedIndexedAccess` are on —
  expect `arr[i]!` non-null assertions where the index is provably valid
- Types and functions live in the same file; no barrel files beyond `index.ts`

## Testing Conventions

- Framework: `bun:test` (`import { describe, expect, test } from 'bun:test'`)
- One `describe` block per feature/example; test names are short and descriptive
- Parser tests assert on the `Ok` tree directly (`toBe` for strings, `toEqual` for
  arrays/nodes) and use `expect(() => parse(...)).toThrow()` for negative cases
- Cast to `any` when poking at node fields in tests (see `packrat.test.ts`)
- Every example in `examples/` ships with its own `*.test.ts` — add tests when adding
  or changing an example

## Adding / Changing Grammar Features

1. Extend the `Expression` union and `evaluateExpression` in `packrat.ts`.
2. Extend `packratGrammar` (the self-hosted DSL grammar) so the new syntax parses.
3. Extend `parseGrammar` validation for the new node shape.
4. Update the *Self host* test input in `packrat.test.ts` to mirror `packratGrammar`.
5. Add focused tests, then update `README.md`'s grammar syntax tables.
6. Run `bun test` — everything must be green.

## Documentation

- `README.md` documents only the public API from `index.ts` plus the full DSL syntax.
  Keep its grammar tables in sync with any DSL change.
- This `AGENTS.md` must be updated whenever structure, commands, style, or the
  public/private boundary changes.
