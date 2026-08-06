# buildGrammar — Interpreter Mode

`buildGrammar` compiles a `Grammar` AST menjadi polymorphic parser object yang bisa langsung dipanggil `.parse(input)` tanpa perlu evaluasi ulang grammar. Lebih cepet dari `evaluateGrammar` karena gak ada switch-case dispatch overhead.

## Arsitektur

```
Grammar (AST)
  → resolveGrammar() → ResolvedGrammar (types assigned, left-recursion detected)
    → buildGrammar() → _GrammarParser { parse(input) }
```

`_GrammarParser.parse()` bikin `_ParseContext` baru tiap call, lalu delegate ke `parseRule(root)`.

## Tipe Data Internal

| Type | Purpose |
|------|---------|
| `_err` | Symbol unik — sentinel value buat parse failure |
| `_ParseContext` | Mutable state: offset, indent, memo, stack |
| `_Parser` | Interface `{ parse(context): Value \| _Err }` |
| `_RuleParser` | Rule dengan metadata + compiled parser |
| `_GrammarParser` | Entry point `.parse(input, options?)` |
| `_PredicateParser` | Class token checker `{ match(char): boolean }` |
| `_FieldExtractor` | Assign hasil parse ke Node `{ assign(node, result) }` |

## Pipeline

### 1. Resolve Grammar (resolveGrammar)

```
resolveGrammar(grammar) → ResolvedGrammar
  ├─ assign temporary variable names (result, saved, count, results)
  ├─ detect left-recursion (isLeftRecursive)
  ├─ compute memoize flag:
  │   ├─ wajib: semua left-recursive rules
  │   ├─ transitive: semua rule yang direferensi left-recursive rules (BFS)
  │   └─ multi-use: rules yang dipanggil >1x
  └─ compute inlineable flag:
      └─ rule non-recursive yg dipanggil 1x + bukan root
```

### 2. Build Parsers (buildParser)

Rekursif ngebangun compiled parser per-expression. Setiap expression jadi closure `{ parse(context) }`.

**Unrolling (Choice & Sequence):** Buat 2-5 elements, code di-unroll manual (no loop) — eliminasi overhead array + iterator.

```
Choice dengan 3 alternatif:
  → const saved = context.offset
  → if (p0.parse(context) !== _err) return ...
  → context.offset = saved
  → if (p1.parse(context) !== _err) return ...
  → context.offset = saved
  → if (p2.parse(context) !== _err) return ...
  → context.offset = saved
  → return _err
```

**Node:** Bungkus hasil parse jadi tagged Node + attach location via getter (lazy).

**Field extraction di Sequence:** Precompute index mana yang tagged Field. Di runtime, extract by index dari result array.

**Extract:** Buat Sequence, kalau cuma 1 element + tagged Extract → langsung return inner result (unwrap array).

**Indent:** Track indent level via `context.indent` stack. Push/pop indent level, cek `>`, `>=`, `=`.

**Class token:** Compile predicates jadi closure `match(char)`. Urutan: check literal start → check multi-char predicates → insensitive check → negation.

### 3. Assign Parse Functions (per rule)

Setelah semua expression parser ter-build, assign `rule.parse` closure per rule. Ada 3 varian:

#### a. Left-Recursive (growing-the-seed)

```
rule.parse = (context) => {
  const key = start + "@" + context.indentKey
  const entry = cache[key]
  if (entry) { restore state; return entry.result }  // cache hit

  // growing-the-seed loop
  memo[key] = { offset: start, growing: true }
  while (true) {
    context.offset = start
    const attempt = expression.parse(context)
    if (attempt === _err) break
    if (attemptEnd <= endPos) break          // gak lebih panjang
    result = attempt; endPos = attemptEnd
    memo[key] = { offset: endPos, growing: true }
  }

  // involved check: kalau rule ini terlibat mutual recursion → hapus cache
  if (involved) delete memo[key]
  else memo[key] = { growing: false }

  context.offset = endPos
  return result
}
```

#### b. Non-memoized (single-use, non-left-recursive)

```
rule.parse = (context) => expression.parse(context)
```

Gak ada cache lookup, gak ada key generation. Langsung evaluasi. Dipake buat rule yg cuma dipanggil 1x.

#### c. Memoized (multi-use, non-left-recursive)

```
rule.parse = (context) => {
  const key = start + "@" + context.indentKey
  const entry = cache[key]
  if (entry) { restore state; return entry.result }

  const result = expression.parse(context)
  cache[key] = { offset, indent, indentKey, indentSize, result }
  return result
}
```

Cache key: `offset + "@" + indentKey` (string concat).

## Perbandingan evaluateGrammar vs buildGrammar

| | evaluateGrammar | buildGrammar |
|---|---|---|
| **Dispatch** | `evaluateExpression(expr)` switch case | closure `.parse(context)` direct |
| **State** | closure over mutable `let` vars | `context.offset` mutable obj |
| **Unrolling** | dynamic (loop over array) | static (hardcoded 2-5 unrolled) |
| **Overhead** | switch jump + type check | function call only |
| **Speed** | baseline (1.0x) | ~0.98x (comparable) |

## Optimasi Kunci

1. **Choice/Sequence unrolling (2-5):** Ngehindarin loop + array allocation. Di packrat.ts, 90%+ Choice/Sequence ≤5 elements.

2. **Skip memo for single-use rules:** ~134 dari 261 non-left rules gak dicache. Hemat key generation + object allocation + lookup.

3. **Field precomputation:** Index Field entries di Sequence dibuild sekali (build time), bukan setiap parse.

4. **Extract unwrapping:** Sequence 1-element tagged Extract → return langsung tanpa array wrapper.

5. **Lazy Node location:** `get location()` pake getter, cuma dieksekusi kalo diakses (biasanya cuma saat error).

6. **Context reuse avoidance:** Tiap `.parse()` bikin fresh `_ParseContext` — gak sharing mutable state antar parse call.

## Benchmark (packrat.ts 132.7KB self-parse)

| Phase | Time |
|-------|------|
| resolveGrammar | 285ms |
| buildGrammar (build parsers) | 288ms |
| emitJs | 0.72ms |
| evaluateGrammar ×20 | 248ms/call |
| buildGrammar parse ×20 | 242ms/call |
| build/eval ratio | 0.97x |
