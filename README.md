# packrat

A dependency-free PEG (Parsing Expression Grammar) parser library for TypeScript, built on **packrat parsing** (memoized recursive descent). Write your grammar in an expressive PEG-style DSL using tagged template literals, and get a fully typed parser back — complete with precise, human-friendly error reporting.

Runs on [Bun](https://bun.sh). Zero runtime dependencies.

## Features

- **Grammar as a template literal** — define parsers with a readable PEG DSL, no build step or code generation
- **Packrat parsing** — results are memoized per rule and offset, giving linear-time parsing for PEG grammars
- **Full operator set** — literals, character classes, sequences, ordered choice, predicates, repetitions (with min/max/separator), and more
- **Indentation-sensitive parsing** — first-class `>> ... <<` indent blocks for languages like Python or Pug
- **Tree shaping** — tag nodes (`->`), name fields (`name:`), extract values (`^`), and capture raw text (`$`) directly in the grammar
- **Precise error reporting** — errors include file, line, column, and a source preview with a caret pointing at the failure
- **Self-hosted** — the grammar DSL can describe itself (see the *Self host* test)

## Requirements

- [Bun](https://bun.sh) v1.x
- TypeScript 5+ (peer dependency)

## Installation

```bash
bun install
```

## Quick Start

```ts
import { packrat } from './index'

const parse = packrat`
  List = "[" _ items:Item { 1 ; _ "," _ } _ ","? _ "]" -> List
  Item = value:Int -> Item
  Int = value:Number -> Int
  Number = "0" / $( [1-9] [0-9]* )
  _ = [ \t\r\n]*
`

const ast = parse('[1, 2, 3]')
// { tag: 'List', location: ..., items: [ { tag: 'Item', ... }, ... ] }
```

`packrat` takes a grammar definition and returns a `parse(input, options)` function. The parse result is an `Ok` tree: a mix of strings, arrays, `null`, and tagged nodes.

## API

The public API is exposed from `index.ts`. Everything else (e.g. `packrat.ts`) is private implementation detail and may change without notice.

### `packrat(strings: TemplateStringsArray): (input: string, options?: ParseOptions) => Ok`

A tagged template function that compiles a grammar definition into a parser.

```ts
type ParseOptions = {
  file?: string       // File name used in error messages (default: '<unknown>')
  startRule?: string  // Rule to start parsing from (default: the first rule)
}
```

The returned parser throws a `ParseError` if the input doesn't match, or if there is trailing input after a successful match.

### `ParseError`

An `Error` subclass with an extra `location: Location` property:

```ts
type Location = {
  file: string
  line: number      // 1-based
  column: number    // 1-based
  readonly preview: string  // Source line + caret pointing at the error
  toString(): string        // "file:line:column"
}
```

```ts
import { packrat, ParseError } from './index'

try {
  parse('bad input', { file: 'example.txt' })
} catch (error) {
  if (error instanceof ParseError) {
    console.error(error.message)
    // Unexpected "b" at example.txt:1:1
    //
    // bad input
    // ^
  }
}
```

### `isNode(value: unknown): value is Node`

Type guard that checks whether a value in the result tree is a tagged node.

### Types

```ts
type Ok =
  | null
  | string
  | Ok[]
  | { tag: string, readonly location: Location, [field: string]: Ok | Location }

type Node = Exclude<Ok, null | string | Ok[]>
```

## Grammar Syntax

A grammar is a set of rules. The first rule is the entry point (unless overridden with `startRule`).

```
RuleName = expression
```

Grammar files support `//` single-line and `/* ... */` multi-line comments.

### Terminals

| Syntax | Meaning | Result |
|---|---|---|
| `"abc"` | Match literal text | matched string |
| `"abc"i` | Case-insensitive literal | matched string |
| `[a-z0-9_]` | Character class (ranges and singles) | matched char |
| `[^a-z]` | Negated character class | matched char |
| `[a-z]i` | Case-insensitive class | matched char |
| `.` | Any single character | matched char |
| `RuleName` | Reference to another rule | that rule's result |

### Combinators

| Syntax | Meaning |
|---|---|
| `a b c` | Sequence — results in an array |
| `a / b / c` | Ordered choice — first match wins |
| `( expr )` | Grouping |
| `a?` | Optional — yields result or `null` |
| `a*` | Zero or more — yields an array |
| `a+` | One or more — yields an array |
| `a{2,4}` | Repeat between min and max times |
| `a{2}` | Repeat at least min times |
| `a{1,3;","}` | Repeat with a separator expression |

### Lookahead

| Syntax | Meaning |
|---|---|
| `&expr` | Positive lookahead — succeeds if `expr` matches, consumes nothing, yields `null` |
| `!expr` | Negative lookahead — succeeds if `expr` does *not* match, consumes nothing, yields `null` |
| `~expr` | Except — matches and consumes any single character that `expr` would *not* match |

### Tree shaping

| Syntax | Meaning |
|---|---|
| `expr -> Name` | Tag the result as a `Node` with `tag: 'Name'` and a `location` |
| `name:expr` | Attach the result to the enclosing node under `name` |
| `^expr` | Extract — pull this result out of the sequence's array (single extract yields the value itself; multiple extracts yield an array of just the extracted values) |
| `$expr` | Text — yield the raw matched source text instead of the structured result |

### Indentation

| Syntax | Meaning |
|---|---|
| `>> expr <<` | Match a newline followed by *deeper* indentation than the current level, then parse `expr` at that indentation level |

This makes it straightforward to parse indentation-based languages:

```
Block = statements:>> Statement <<+ -> Block
```

## Examples

The `examples/` directory contains real-world mini parsers (and some interpreters) built with the library:

| Example | Description |
|---|---|
| `list.ts` | Minimal JSON-like integer list parser — good starting point |
| `mini-sql.ts` | `SELECT` query parser with `WHERE`, `ORDER BY`, `LIMIT`, plus a query executor |
| `mini-golang.ts` | Go-like language parser and interpreter (vars, funcs, control flow, slices) |
| `mini-js.ts` | JavaScript subset parser and interpreter |
| `mini-php.ts` | PHP subset parser and interpreter |
| `mini-python.ts` | Python-like language with indentation-based blocks, plus interpreter |
| `mini-pug.ts` | Pug template parser using indentation blocks, rendering to HTML |

## Development

```bash
bun install   # install dev dependencies
bun test      # run the full test suite (library + examples)
```

## Project Structure

```
index.ts           Public entry point — the only supported API surface
packrat.ts         Private implementation (grammar compiler, evaluator, self-hosted grammar)
packrat.test.ts    Library test suite
examples/          Example grammars, parsers, and interpreters with tests
```

## License

Private / unlicensed. All rights reserved.
