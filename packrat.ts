type Grammar = { rules: Rule[] }

type Rule = { name: string, expression: Expression }

type Expression =
  | { tag: 'Choice', expressions: Expression[] }
  | { tag: 'Node', expression: Expression, name: string }
  | { tag: 'Sequence', expressions: Expression[] }
  | { tag: 'Field', expression: Expression, name: string }
  | { tag: 'Extract', expression: Expression }
  | { tag: 'Text', expression: Expression }
  | { tag: 'And', expression: Expression }
  | { tag: 'Not', expression: Expression }
  | { tag: 'Optional', expression: Expression }
  | { tag: 'Zero', expression: Expression }
  | { tag: 'One', expression: Expression }
  | { tag: 'Repeat', expression: Expression, min: number, max?: number, separator?: Expression }
  | { tag: 'Reference', name: string }
  | { tag: 'Except', expression: Expression }
  | { tag: 'Indent', expression: Expression }
  | { tag: 'Class', predicates: Predicate[], insensitive?: boolean, negation?: boolean }
  | { tag: 'Literal', value: string, insensitive?: boolean }
  | { tag: 'Any' }

type Predicate =
  | { tag: 'Equal', value: string }
  | { tag: 'Between', min: string, max: string }

type Location = { file: string, line: number, column: number, readonly preview: string, toString(): string }

type Ok = null | string | Ok[] | { tag: string, readonly location: Location, [field: string]: Ok | Location }

type Node = Exclude<Ok, null | string | Ok[]>

type ParseOptions = { file?: string, startRule?: string }

type ResolvedGrammar = { rules: ResolvedRule[] }

type ResolvedRule = { name: string, expression: ResolvedExpression, resultCount: number, isLeftRecursive: boolean }

type ResolvedExpression =
  | { tag: 'Choice', expressions: ResolvedExpression[], result: string, saved: string }
  | { tag: 'Node', expression: ResolvedExpression, name: string, result: string, saved: string }
  | { tag: 'Sequence', expressions: ResolvedExpression[], result: string }
  | { tag: 'Field', expression: ResolvedExpression, name: string, result: string }
  | { tag: 'Extract', expression: ResolvedExpression, result: string }
  | { tag: 'Text', expression: ResolvedExpression, result: string, saved: string }
  | { tag: 'And', expression: ResolvedExpression, result: string, saved: string }
  | { tag: 'Not', expression: ResolvedExpression, result: string, saved: string }
  | { tag: 'Optional', expression: ResolvedExpression, result: string, saved: string }
  | { tag: 'Zero', expression: ResolvedExpression, result: string, saved: string, results: string }
  | { tag: 'One', expression: ResolvedExpression, result: string, saved: string, results: string }
  | { tag: 'Repeat', expression: ResolvedExpression, min: number, max?: number, separator?: ResolvedExpression, result: string, saved1: string, saved2: string, count: string, results: string }
  | { tag: 'Reference', name: string, result: string }
  | { tag: 'Except', expression: ResolvedExpression, result: string, saved: string }
  | { tag: 'Indent', expression: ResolvedExpression, result: string, saved: string, char: string }
  | { tag: 'Class', predicates: Predicate[], insensitive?: boolean, negation?: boolean, result: string }
  | { tag: 'Literal', value: string, insensitive?: boolean, result: string }
  | { tag: 'Any', result: string }

class ParseError extends Error {
  constructor (message: string, public location: Location) {
    super(message)
  }
}

const resolveGrammar = (grammar: Grammar): ResolvedGrammar => {
  const rules = Object.fromEntries(grammar.rules.map(rule => [rule.name, rule.expression]))
  return {
    ...grammar,
    rules: grammar.rules.map(rule => {
      let resultCount = 0
      let savedCount = 0
      let charCount = 0
      let countCount = 0
      let resultsCount = 0
      const nextResult = () => `result${++resultCount}`
      const nextSaved = () => `saved${++savedCount}`
      const nextResults = () => `results${++resultsCount}`
      const nextCount = () => `count${++countCount}`
      const nextChar = () => `char${++charCount}`
      const visited = new Set<string>()
      const isLeftRecursive = (expression: Expression): boolean => {
        switch (expression.tag) {
          case 'Choice':
            return expression.expressions.some(isLeftRecursive)
          case 'Node':
            return isLeftRecursive(expression.expression)
          case 'Sequence':
            return isLeftRecursive(expression.expressions[0]!)
          case 'Field': case 'Extract': case 'Text': case 'And': case 'Not': case 'Optional': case 'Zero': case 'One': case 'Repeat':
            return isLeftRecursive(expression.expression)
          case 'Reference':
            if (expression.name === rule.name) {
              return true
            }
            if (visited.has(expression.name)) {
              return false
            }
            visited.add(expression.name)
            return isLeftRecursive(rules[expression.name]!)
          case 'Except':
            return isLeftRecursive(expression.expression)
          case 'Indent':
            return isLeftRecursive(expression.expression)
          case 'Class': case 'Literal': case 'Any':
            return false
        }
      }
      const resolveExpression = (expression: Expression): ResolvedExpression => {
        switch (expression.tag) {
          case 'Choice':
            return { ...expression, expressions: expression.expressions.map(resolveExpression), result: nextResult(), saved: nextSaved() }
          case 'Node':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved() }
          case 'Sequence':
            return { ...expression, expressions: expression.expressions.map(resolveExpression), result: nextResult() }
          case 'Field':
          case 'Extract':
            const e = resolveExpression(expression.expression)
            return { ...expression, expression: e, result: e.result }
          case 'Text':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved() }
          case 'And':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved() }
          case 'Not':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved() }
          case 'Optional':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved() }
          case 'Zero':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved(), results: nextResults() }
          case 'One':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved(), results: nextResults() }
          case 'Repeat':
            return { ...expression, expression: resolveExpression(expression.expression), separator: expression.separator === undefined ? undefined : resolveExpression(expression.separator), result: nextResult(), saved1: nextSaved(), saved2: nextSaved(), count: nextCount(), results: nextResults() }
          case 'Reference':
            return { ...expression, result: nextResult() }
          case 'Except':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved() }
          case 'Indent':
            return { ...expression, expression: resolveExpression(expression.expression), result: nextResult(), saved: nextSaved(), char: nextChar() }
          case 'Class':
          case 'Literal':
          case 'Any':
            return { ...expression, result: nextResult() }
        }
      }
      return { ...rule, expression: resolveExpression(rule.expression), resultCount, isLeftRecursive: isLeftRecursive(rule.expression) }
    })
  }
}

const getExpressionExpressions = (expression: Expression): Expression[] => {
  switch (expression.tag) {
    case 'Choice': case 'Sequence':
      return [expression, ...expression.expressions.flatMap(getExpressionExpressions)]
    case 'Node': case 'Field': case 'Extract': case 'Text': case 'And': case 'Not': case 'Optional': case 'Zero': case 'One': case 'Except': case 'Indent':
      return [expression, ...getExpressionExpressions(expression.expression)]
    case 'Repeat':
      return [expression, ...getExpressionExpressions(expression.expression), ...(expression.separator ? getExpressionExpressions(expression.separator) : [])]
    case 'Reference': case 'Class': case 'Literal': case 'Any':
      return [expression]
  }
}

const getRuleExpressions = (rule: Rule) => getExpressionExpressions(rule.expression)

const evaluateGrammar = (grammar: ResolvedGrammar, input: string, options: ParseOptions = {}) => {
  const rules = Object.fromEntries(grammar.rules.map(rule => [rule.name, rule]))
  const cache = Object.fromEntries(grammar.rules.map(rule => [rule.name, {} as Record<string, { offset: number, indent: number[], result: Ok | Err, growing: boolean }>]))
  const stack = [] as { key: string, name: string, involved: Set<string> | null }[]
  const err = Symbol('err')
  type Err = typeof err
  let offset = 0
  let indent = [0]
  const getLocation = (offset: number) => {
    let line = 1
    let column = 1
    for (let i = 0; i < offset; i++) {
      const char = input.charCodeAt(i)
      if (char === 13) {
        if (input.charCodeAt(i + 1) === 10) {
          i++
        }
        line++
        column = 1
        continue
      }
      if (char === 10) {
        line++
        column = 1
        continue
      }
      column++
    }
    return {
      file: options.file ?? '<unknown>',
      line,
      column,
      get preview () {
        return `${input.split(/\r\n|\r|\n/)[this.line - 1] ?? ''}\n${' '.repeat(this.column - 1)}^`
      },
      toString () {
        return `${this.file}:${this.line}:${this.column}`
      }
    }
  }
  const evaluateRule = (name: string): Ok | Err => {
    const start = offset
    const key = start + '@' + indent.join(',')
    const memo = cache[name]!
    const entry = memo[key]
    if (entry) {
      if (entry.growing) {
        const index = stack.findIndex(e => e.key === key)
        if (index !== -1) {
          const owner = stack[index]!
          owner.involved ??= new Set()
          for (let i = index + 1; i < stack.length; i++) {
            owner.involved.add(stack[i]!.name)
          }
        }
      }
      offset = entry.offset
      indent = entry.indent.slice()
      return entry.result
    }
    const rule = rules[name]!
    if (!rule.isLeftRecursive) {
      const result = evaluateExpression(rule.expression)
      if (result !== err) {
        memo[key] = { offset, indent: indent.slice(), result, growing: false }
      }
      return result
    }
    const frame = { key, name, involved: null }
    stack.push(frame)
    let result: Ok | Err = err
    let endPos = start
    memo[key] = { offset: start, indent: indent.slice(), result, growing: true }
    while (true) {
      offset = start
      const attempt = evaluateExpression(rule.expression)
      if (attempt === err) {
        break
      }
      const attemptEnd = offset
      if (result !== err && attemptEnd <= endPos) {
        break
      }
      result = attempt
      endPos = attemptEnd
      memo[key] = { offset: endPos, indent: indent.slice(), result, growing: true }
    }
    stack.pop()
    if (stack.some(e => e.involved?.has(name))) {
      delete memo[key]
    } else {
      memo[key] = { offset: endPos, indent: indent.slice(), result, growing: false }
    }
    offset = endPos
    return result
  }
  const evaluateExpression = (expression: Expression): Ok | Err => {
    switch (expression.tag) {
      case 'Choice': {
        const saved = offset
        for (const e of expression.expressions) {
          const result = evaluateExpression(e)
          if (result === err) {
            offset = saved
            continue
          }
          return result
        }
        return err
      }
      case 'Node': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        if (result === err) {
          return err
        }
        const node: Node = {
          tag: expression.name,
          get location () {
            return getLocation(saved)
          }
        }
        switch (expression.expression.tag) {
          case 'Field': {
            node[expression.expression.name] = result
            break
          }
          case 'Sequence': {
            const expressions = expression.expression.expressions
            for (let i = 0; i < expressions.length; i++) {
              const expression = expressions[i]!
              if (expression.tag === 'Field') {
                node[expression.name] = (result as Ok[])[i]!
              }
            }
          }
        }
        return node
      }
      case 'Sequence': {
        const results: Ok[] = []
        const extracted: Ok[] = []
        for (const e of expression.expressions) {
          const result = evaluateExpression(e)
          if (result === err) {
            return err
          }
          if (e.tag === 'Extract') {
            extracted.push(result)
            continue
          }
          results.push(result)
        }
        if (extracted.length === 1) {
          return extracted[0]!
        }
        if (extracted.length > 1) {
          return extracted
        }
        return results
      }
      case 'Field': case 'Extract': {
        return evaluateExpression(expression.expression)
      }
      case 'Text': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        if (result === err) {
          return err
        }
        return input.substring(saved, offset)
      }
      case 'And': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        offset = saved
        if (result === err) {
          return err
        }
        return null
      }
      case 'Not': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        offset = saved
        if (result === err) {
          return null
        }
        return err
      }
      case 'Optional': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        if (result === err) {
          offset = saved
          return null
        }
        return result
      }
      case 'Zero': {
        const results: Ok[] = []
        while (true) {
          const saved = offset
          const result = evaluateExpression(expression.expression)
          if (result === err) {
            offset = saved
            break
          }
          results.push(result)
        }
        return results
      }
      case 'One': {
        const result = evaluateExpression(expression.expression)
        if (result === err) {
          return err
        }
        const results: Ok[] = [result]
        while (true) {
          const saved = offset
          const result = evaluateExpression(expression.expression)
          if (result === err) {
            offset = saved
            break
          }
          results.push(result)
        }
        return results
      }
      case 'Repeat': {
        const results: Ok[] = []
        const saved = offset
        let count = 0
        while (expression.max === undefined || count < expression.max) {
          const saved = offset
          if (count > 0 && expression.separator !== undefined) {
            const result = evaluateExpression(expression.separator)
            if (result === err) {
              offset = saved
              break
            }
          }
          const result = evaluateExpression(expression.expression)
          if (result === err) {
            offset = saved
            break
          }
          results.push(result)
          count++
        }
        if (count < expression.min) {
          offset = saved
          return err
        }
        return results
      }
      case 'Reference': {
        return evaluateRule(expression.name)
      }
      case 'Except': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        offset = saved
        if (result === err && offset < input.length) {
          return input.charAt(offset++)
        }
        return err
      }
      case 'Indent': {
        if (offset >= input.length) {
          return err
        }
        const char = input.charAt(offset)
        if (char !== '\r' && char !== '\n') {
          return err
        }
        offset++
        if (char === '\r' && offset < input.length && input.charAt(offset) === '\n') {
          offset++
        }
        while (offset < input.length) {
          let scan = offset
          while (scan < input.length && input.charAt(scan) === ' ') {
            scan++
          }
          if (scan < input.length && (input.charAt(scan) === '\n' || input.charAt(scan) === '\r')) {
            offset = scan + 1
            if (input.charAt(scan) === '\r' && offset < input.length && input.charAt(offset) === '\n') {
              offset++
            }
            continue
          }
          break
        }
        const saved = offset
        while (offset < input.length && input.charAt(offset) === ' ') {
          offset++
        }
        const next = offset - saved
        if (next <= indent[indent.length - 1]!) {
          return err
        }
        indent.push(next)
        const result = evaluateExpression(expression.expression)
        indent.pop()
        return result
      }
      case 'Class': {
        if (offset >= input.length) {
          return err
        }
        const char = input.charAt(offset)
        const value = expression.insensitive ? char.toUpperCase() : char
        if (
          expression.predicates.some(predicate => {
            switch (predicate.tag) {
              case 'Equal':
                return (expression.insensitive ? predicate.value.toUpperCase() : predicate.value)
                  === value
              case 'Between':
                return value >= (expression.insensitive ? predicate.min.toUpperCase() : predicate.min)
                  && value <= (expression.insensitive ? predicate.max.toUpperCase() : predicate.max)
            }
          }) !== !!expression.negation
        ) {
          offset++
          return char
        }
        return err
      }
      case 'Literal': {
        if (offset + expression.value.length > input.length) {
          return err
        }
        const substring = input.substring(offset, offset + expression.value.length)
        if (
            (expression.insensitive ? substring.toUpperCase() : substring)
              === (expression.insensitive ? expression.value.toUpperCase() : expression.value)
        ) {
          offset += substring.length
          return substring
        }
        return err
      }
      case 'Any': {
        if (offset < input.length) {
          return input.charAt(offset++)
        }
        return err
      }
    }
  }
  const result = evaluateRule(options.startRule ?? grammar.rules[0]!.name)
  if (result === err || offset < input.length) {
    const location = getLocation(offset)
    throw new ParseError(`Unexpected ${offset < input.length ? JSON.stringify(input.charAt(offset)) : 'end of file'} at ${location}\n\n${location.preview}`, location)
  }
  return result
}

const emitJs = (grammar: ResolvedGrammar) => {
  const emitExpression = (expression: ResolvedExpression): string => {
    switch (expression.tag) {
      case 'Choice': {
        let buffer = `${expression.result} = err`
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitExpression(e)}
            if (${e.result} === err) {
              offset = ${expression.saved}
              ${buffer}
            } else {
              ${expression.result} = ${e.result}
            }
          `
        }
        return `
          const ${expression.saved} = offset
          ${buffer}
        `
      }
      case 'Node': {
        const fields = expression.expression.tag === 'Field'
          ? [{ name: expression.expression.name, result: expression.expression.result }]
          : expression.expression.tag === 'Sequence'
            ? expression.expression.expressions
              .map(e => {
                if (e.tag !== 'Field') {
                  return null
                }
                return { name: e.name, result: e.result }
              })
              .filter(field => field !== null)
            : []
        return `
          const ${expression.saved} = offset
          ${emitExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            ${expression.result} = {
              tag: ${JSON.stringify(expression.name)},
              get location () {
                return getLocation(${expression.saved})
              },
              ${fields.map(field => `${field.name}: ${field.result}`).join(', ')}
            }
          }
        `
      }
      case 'Sequence': {
        const extracts = expression.expressions.filter(e => e.tag === 'Extract')
        let buffer
        if (extracts.length === 1) {
          buffer = `${expression.result} = ${extracts[0]!.result}`
        } else if (extracts.length > 1) {
          buffer = `${expression.result} = [${extracts.map(extract => extract.result).join(', ')}]`
        } else {
          buffer = `${expression.result} = [${expression.expressions.map(e => e.result).join(', ')}]`
        }
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitExpression(e)}
            if (${e.result} === err) {
              ${expression.result} = err
            } else {
              ${buffer}
            }
          `
        }
        return buffer
      }
      case 'Field': case 'Extract': {
        return emitExpression(expression.expression)
      }
      case 'Text': {
        return `
          const ${expression.saved} = offset
          ${emitExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            ${expression.result} = input.substring(${expression.saved}, offset)
          }
        `
      }
      case 'And': {
        return `
          const ${expression.saved} = offset
          ${emitExpression(expression.expression)}
          offset = ${expression.saved}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            ${expression.result} = null
          }
        `
      }
      case 'Not': {
        return `
          const ${expression.saved} = offset
          ${emitExpression(expression.expression)}
          offset = ${expression.saved}
          if (${expression.expression.result} === err) {
            ${expression.result} = null
          } else {
            ${expression.result} = err
          }
        `
      }
      case 'Optional': {
        return `
          const ${expression.saved} = offset
          ${emitExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            offset = ${expression.saved}
            ${expression.result} = null
          } else {
            ${expression.result} = ${expression.expression.result}
          }
        `
      }
      case 'Zero': {
        return `
          const ${expression.results} = []
          while (true) {
            const ${expression.saved} = offset
            ${emitExpression(expression.expression)}
            if (${expression.expression.result} === err) {
              offset = ${expression.saved}
              break
            }
            ${expression.results}.push(${expression.expression.result})
          }
          ${expression.result} = ${expression.results}
        `
      }
      case 'One': {
        return `
          ${emitExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            const ${expression.results} = [${expression.expression.result}]
            while (true) {
              const ${expression.saved} = offset
              ${emitExpression(expression.expression)}
              if (${expression.expression.result} === err) {
                offset = ${expression.saved}
                break
              }
              ${expression.results}.push(${expression.expression.result})
            }
            ${expression.result} = ${expression.results}
          }
        `
      }
      case 'Repeat': {
        return `
          const ${expression.results} = []
          const ${expression.saved1} = offset
          let ${expression.count} = 0
          while (${expression.max === undefined ? 'true' : `${expression.count} < ${expression.max}`}) {
            const ${expression.saved2} = offset
            ${expression.separator === undefined ? '' : `
              if (${expression.count} > 0) {
                ${emitExpression(expression.separator)}
                if (${expression.separator.result} === err) {
                  offset = ${expression.saved2}
                  break
                }
              }
            `}
            ${emitExpression(expression.expression)}
            if (${expression.expression.result} === err) {
              offset = ${expression.saved2}
              break
            }
            ${expression.results}.push(${expression.expression.result})
            ${expression.count}++
          }
          if (${expression.count} < ${expression.min}) {
            offset = ${expression.saved1}
            ${expression.result} = err
          } else {
            ${expression.result} = ${expression.results}
          }
        `
      }
      case 'Reference': {
        return `${expression.result} = parse${expression.name}()`
      }
      case 'Except': {
        return `
          const ${expression.saved} = offset
          ${emitExpression(expression.expression)}
          offset = ${expression.saved}
          if (${expression.expression.result} === err && offset < input.length) {
            ${expression.result} = input.charAt(offset++)
          } else {
            ${expression.result} = err
          }
        `
      }
      case 'Indent': {
        return `
          if (offset < input.length) {
            const ${expression.char} = input.charAt(offset)
            if (${expression.char} === '\\r' || ${expression.char} === '\\n') {
              offset++
              if (${expression.char} === '\\r' && offset < input.length && input.charAt(offset) === '\\n') {
                offset++
              }
              while (offset < input.length) {
                let scan = offset
                while (scan < input.length && input.charAt(scan) === ' ') {
                  scan++
                }
                if (scan < input.length && (input.charAt(scan) === '\\n' || input.charAt(scan) === '\\r')) {
                  offset = scan + 1
                  if (input.charAt(scan) === '\\r' && offset < input.length && input.charAt(offset) === '\\n') {
                    offset++
                  }
                  continue
                }
                break
              }
              const ${expression.saved} = offset
              while (offset < input.length && input.charAt(offset) === ' ') {
                offset++
              }
              const next = offset - ${expression.saved}
              if (next > indent[indent.length - 1]) {
                indent.push(next)
                ${emitExpression(expression.expression)}
                indent.pop()
                ${expression.result} = ${expression.expression.result}
              } else {
                ${expression.result} = err
              }
            } else {
              ${expression.result} = err
            }
          } else {
            ${expression.result} = err
          }
        `
      }
      case 'Class': {
        const predicates = expression.predicates.map(predicate => {
          const value = expression.insensitive ? 'uppercased' : 'value'
          switch (predicate.tag) {
            case 'Equal':
              return `${value} === ${JSON.stringify(expression.insensitive ? predicate.value.toUpperCase() : predicate.value)}`
            case 'Between':
              return `(${value} >= ${JSON.stringify(expression.insensitive ? predicate.min.toUpperCase() : predicate.min)} && ${value} <= ${JSON.stringify(expression.insensitive ? predicate.max.toUpperCase() : predicate.max)})`
          }
        }).join(' || ')
        return `
          if (offset < input.length) {
            const value = input.charAt(offset)
            ${expression.insensitive ? 'const uppercased = value.toUpperCase()' : ''}
            if (${expression.negation ? '!' : ''}(${predicates})) {
              offset++
              ${expression.result} = value
            } else {
              ${expression.result} = err
            }
          } else {
            ${expression.result} = err
          }
        `
      }
      case 'Literal': {
        const length = expression.value.length
        if (expression.insensitive) {
          const value = JSON.stringify(expression.value.toUpperCase())
          return `
            if (offset + ${length} <= input.length) {
              const value = input.substring(offset, offset + ${length})
              if (value.toUpperCase() === ${value}) {
                offset += ${length}
                ${expression.result} = value
              } else {
                ${expression.result} = err
              }
            } else {
              ${expression.result} = err
            }
          `
        } else {
          const value = JSON.stringify(expression.value)
          return `
            if (input.startsWith(${value}, offset)) {
              offset += ${length}
              ${expression.result} = ${value}
            } else {
              ${expression.result} = err
            }
          `
        }
      }
      case 'Any': {
        return `
          if (offset < input.length) {
            ${expression.result} = input.charAt(offset++)
          } else {
            ${expression.result} = err
          }
        `
      }
    }
  }
  const emitRule = (rule: ResolvedRule) => {
    const results = [...Array(rule.resultCount).keys()].map(key => `result${key + 1}`).join(', ')
    return `
      const parse${rule.name} = rules[${JSON.stringify(rule.name)}] = () => {
        const key = \`\${offset}@\${indent}\`
        const entry = cache.${rule.name}[key]
        if (entry) {
          offset = entry.offset
          indent = [...entry.indent]
          return entry.result
        }
        let ${results}
        ${emitExpression(rule.expression)}
        cache.${rule.name}[key] = { offset, indent: [...indent], result: ${rule.expression.result} }
        return ${rule.expression.result}
      }
    `
  }
  const rules = grammar.rules.map(emitRule).join('')
  const cache = grammar.rules.map(rule => `${rule.name}: {}`).join(', ')
  return `
    class ParseError extends Error {
      constructor (message, location) {
        super(message)
        this.location = location
      }
    }
    const parse = (input, options = {}) => {
      const err = Symbol()
      const rules = Object.create(null)
      const cache = {${cache}}
      const getLocation = (offset) => {
        let line = 1
        let column = 1
        for (let i = 0; i < offset; i++) {
          const char = input.charCodeAt(i)
          if (char === 13) {
            if (input.charCodeAt(i + 1) === 10) {
              i++
            }
            line++
            column = 1
            continue
          }
          if (char === 10) {
            line++
            column = 1
            continue
          }
          column++
        }
        return {
          file: options.file ?? '<unknown>',
          line,
          column,
          get preview () {
            return \`\${input.split(/\\r\\n|\\r|\\n/)[this.line - 1] ?? ''}\\n\${' '.repeat(this.column - 1)}^\`
          },
          toString () {
            return \`\${this.file}:\${this.line}:\${this.column}\`
          }
        }
      }
      let offset = 0
      let indent = [0]
      ${rules}
      const result = rules[options.startRule ?? ${JSON.stringify(grammar.rules[0]!.name)}]()
      if (result === err || offset < input.length) {
        const location = getLocation(offset)
        throw new ParseError(\`Unexpected \${offset < input.length ? JSON.stringify(input.charAt(offset)) : 'end of file'} at \${location}\\n\\n\${location.preview}\`, location)
      }
      return result
    }
    export { parse }
  `
}

const emitPhp = (grammar: ResolvedGrammar) => {
  const emitExpression = (expression: ResolvedExpression): string => {
    switch (expression.tag) {
      case 'Choice': {
        let buffer = `$${expression.result} = $this->err;`
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitExpression(e)}
            if ($${e.result} === $this->err) {
              $this->offset = $${expression.saved};
              ${buffer}
            } else {
              $${expression.result} = $${e.result};
            }
          `
        }
        return `
          $${expression.saved} = $this->offset;
          ${buffer}
        `
      }
      case 'Node': {
        const fields = expression.expression.tag === 'Field'
          ? [{ name: expression.expression.name, result: expression.expression.result }]
          : expression.expression.tag === 'Sequence'
            ? expression.expression.expressions
              .map(e => {
                if (e.tag !== 'Field') {
                  return null
                }
                return { name: e.name, result: e.result }
              })
              .filter(field => field !== null)
            : []
        return `
          $${expression.saved} = $this->offset;
          ${emitExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = [
              'tag' => ${JSON.stringify(expression.name)},
              'location' => $this->getLocation($${expression.saved}),
              ${fields.map(field => `'${field.name}' => $${field.result}`).join(', ')}
            ];
          }
        `
      }
      case 'Sequence': {
        const extracts = expression.expressions.filter(e => e.tag === 'Extract')
        let buffer
        if (extracts.length === 1) {
          buffer = `$${expression.result} = $${extracts[0]!.result};`
        } else if (extracts.length > 1) {
          buffer = `$${expression.result} = [${extracts.map(extract => `$${extract.result}`).join(', ')}];`
        } else {
          buffer = `$${expression.result} = [${expression.expressions.map(e => `$${e.result}`).join(', ')}];`
        }
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitExpression(e)}
            if ($${e.result} === $this->err) {
              $${expression.result} = $this->err;
            } else {
              ${buffer}
            }
          `
        }
        return buffer
      }
      case 'Field': case 'Extract': {
        return emitExpression(expression.expression)
      }
      case 'Text': {
        return `
          $${expression.saved} = $this->offset;
          ${emitExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = substr($this->input, $${expression.saved}, $this->offset - $${expression.saved});
          }
        `
      }
      case 'And': {
        return `
          $${expression.saved} = $this->offset;
          ${emitExpression(expression.expression)}
          $this->offset = $${expression.saved};
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = null;
          }
        `
      }
      case 'Not': {
        return `
          $${expression.saved} = $this->offset;
          ${emitExpression(expression.expression)}
          $this->offset = $${expression.saved};
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = null;
          } else {
            $${expression.result} = $this->err;
          }
        `
      }
      case 'Optional': {
        return `
          $${expression.saved} = $this->offset;
          ${emitExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $this->offset = $${expression.saved};
            $${expression.result} = null;
          } else {
            $${expression.result} = $${expression.expression.result};
          }
        `
      }
      case 'Zero': {
        return `
          $${expression.results} = [];
          while (true) {
            $${expression.saved} = $this->offset;
            ${emitExpression(expression.expression)}
            if ($${expression.expression.result} === $this->err) {
              $this->offset = $${expression.saved};
              break;
            }
            array_push($${expression.results}, $${expression.expression.result});
          }
          $${expression.result} = $${expression.results};
        `
      }
      case 'One': {
        return `
          ${emitExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.results} = [$${expression.expression.result}];
            while (true) {
              $${expression.saved} = $this->offset;
              ${emitExpression(expression.expression)}
              if ($${expression.expression.result} === $this->err) {
                $this->offset = $${expression.saved};
                break;
              }
              array_push($${expression.results}, $${expression.expression.result});
            }
            $${expression.result} = $${expression.results};
          }
        `
      }
      case 'Repeat': {
        return `
          $${expression.results} = [];
          $${expression.saved1} = $this->offset;
          $${expression.count} = 0;
          while (${expression.max === undefined ? 'true' : `$${expression.count} < ${expression.max}`}) {
            $${expression.saved2} = $this->offset;
            ${expression.separator === undefined ? '' : `
              if ($${expression.count} > 0) {
                ${emitExpression(expression.separator)}
                if ($${expression.separator.result} === $this->err) {
                  $this->offset = $${expression.saved2};
                  break;
                }
              }
            `}
            ${emitExpression(expression.expression)}
            if ($${expression.expression.result} === $this->err) {
              $this->offset = $${expression.saved2};
              break;
            }
            array_push($${expression.results}, $${expression.expression.result});
            $${expression.count}++;
          }
          if ($${expression.count} < ${expression.min}) {
            $this->offset = $${expression.saved1};
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = $${expression.results};
          }
        `
      }
      case 'Reference': {
        return `$${expression.result} = $this->parse${expression.name}();`
      }
      case 'Except': {
        return `
          $${expression.saved} = $this->offset;
          ${emitExpression(expression.expression)}
          $this->offset = $${expression.saved};
          if ($${expression.expression.result} === $this->err && $this->offset < strlen($this->input)) {
            $${expression.result} = $this->input[$this->offset++];
          } else {
            $${expression.result} = $this->err;
          }
        `
      }
      case 'Indent': {
        return `
          if ($this->offset < strlen($this->input)) {
            $${expression.char} = $this->input[$this->offset];
            if ($${expression.char} === "\\r" || $${expression.char} === "\\n") {
              $this->offset++;
              if ($${expression.char} === "\\r" && $this->offset < strlen($this->input) && $this->input[$this->offset] === "\\n") {
                $this->offset++;
              }
              while ($this->offset < strlen($this->input)) {
                $scan = $this->offset;
                while ($scan < strlen($this->input) && $this->input[$scan] === ' ') {
                  $scan++;
                }
                if ($scan < strlen($this->input) && ($this->input[$scan] === "\\n" || $this->input[$scan] === "\\r")) {
                  $this->offset = $scan + 1;
                  if ($this->input[$scan] === "\\r" && $this->offset < strlen($this->input) && $this->input[$this->offset] === "\\n") {
                    $this->offset++;
                  }
                  continue;
                }
                break;
              }
              $${expression.saved} = $this->offset;
              while ($this->offset < strlen($this->input) && $this->input[$this->offset] === ' ') {
                $this->offset++;
              }
              $next = $this->offset - $${expression.saved};
              if ($next > $this->indent[count($this->indent) - 1]) {
                array_push($this->indent, $next);
                ${emitExpression(expression.expression)}
                array_pop($this->indent);
                $${expression.result} = $${expression.expression.result};
              } else {
                $${expression.result} = $this->err;
              }
            } else {
              $${expression.result} = $this->err;
            }
          } else {
            $${expression.result} = $this->err;
          }
        `
      }
      case 'Class': {
        const predicates = expression.predicates.map(predicate => {
          const value = expression.insensitive ? 'uppercased' : 'value'
          switch (predicate.tag) {
            case 'Equal':
              return `$${value} === ${JSON.stringify(expression.insensitive ? predicate.value.toUpperCase() : predicate.value)}`
            case 'Between':
              return `($${value} >= ${JSON.stringify(expression.insensitive ? predicate.min.toUpperCase() : predicate.min)} && $${value} <= ${JSON.stringify(expression.insensitive ? predicate.max.toUpperCase() : predicate.max)})`
          }
        }).join(' || ')
        return `
          if ($this->offset < strlen($this->input)) {
            $value = $this->input[$this->offset];
            ${expression.insensitive ? '$uppercased = strtoupper($value);' : ''}
            if (${expression.negation ? '!' : ''}(${predicates})) {
              $this->offset++;
              $${expression.result} = $value;
            } else {
              $${expression.result} = $this->err;
            }
          } else {
            $${expression.result} = $this->err;
          }
        `
      }
      case 'Literal': {
        const length = expression.value.length
        const value = JSON.stringify(expression.value).replace(/\$/g, '\\$')
        return `
          if (substr_compare($this->input, ${value}, $this->offset, ${length}, ${!!expression.insensitive}) === 0) {
            $${expression.result} = substr($this->input, $this->offset, ${length});
            $this->offset += ${length};
          } else {
            $${expression.result} = $this->err;
          }
        `
      }
      case 'Any': {
        return `
          if ($this->offset < strlen($this->input)) {
            $${expression.result} = $this->input[$this->offset++];
          } else {
            $${expression.result} = $this->err;
          }
        `
      }
    }
  }
  const emitRule = (rule: ResolvedRule) => {
    return `
      private function parse${rule.name}() {
        $key = $this->offset . '@' . implode(',', $this->indent);
        $entry = @$this->cache['${rule.name}'][$key];
        if ($entry) {
          $this->offset = $entry['offset'];
          $this->indent = $entry['indent'];
          return $entry['result'];
        }
        ${emitExpression(rule.expression)}
        $this->cache['${rule.name}'][$key] = ['offset' => $this->offset, 'indent' => $this->indent, 'result' => $${rule.expression.result}];
        return $${rule.expression.result};
      }
    `
  }
  const rules = grammar.rules.map(emitRule).join('')
  return `
    class PackratParseError extends RuntimeException {
      public $location;
      function __construct($message, $location) {
        parent::__construct($message);
        $this->location = $location;
      }
    }
    class Parser {
      private $err;
      private $input;
      private $file;
      private $offset;
      private $indent;
      private $cache;
      function __construct() {
        $this->err = new stdClass();
      }
      private function getLocation($offset) {
        $input = $this->input;
        $file = $this->file;
        $line = 1;
        $column = 1;
        for ($i = 0; $i < $offset; $i++) {
          $char = ord($input[$i]);
          if ($char === 13) {
            if (ord($input[$i + 1]) === 10) {
              $i++;
            }
            $line++;
            $column = 1;
            continue;
          }
          if ($char === 10) {
            $line++;
            $column = 1;
            continue;
          }
          $column++;
        }
        return [
          'file' => $file ?? '<unknown>',
          'line' => $line,
          'column' => $column,
          'preview' => fn () => (explode("\\n", str_replace(["\\r\\n", "\\r"], "\\n", $input))[$line - 1] ?? '') . "\\n" . str_repeat(' ', $column - 1) . '^',
          'toString' => fn () => "$file:$line:$column"
        ];
      }
      ${rules}
      function parse($input, $file = null, $startRule = null) {
        $this->input = $input;
        $this->file = $file;
        $this->offset = 0;
        $this->indent = [0];
        $result = $this->{'parse' . ($startRule ?? '${grammar.rules[0]?.name}')}();
        if ($result === $this->err || $this->offset < strlen($input)) {
          $location = $this->getLocation($this->offset);
          $unexpected = $this->offset < strlen($input) ? json_encode($input[$this->offset], JSON_UNESCAPED_SLASHES) : 'end of file';
          $locationString = ($location['toString'])();
          $locationPreview = ($location['preview'])();
          throw new PackratParseError("Unexpected $unexpected at $locationString\\n\\n$locationPreview", $location);
        }
        return $result;
      }
    }
  `
}

const isNode = (value: unknown): value is Node => {
  return value !== null && typeof value === 'object' && 'tag' in value && typeof value.tag === 'string'
}

const parseGrammar = (value: Ok): Grammar => {
  if (!isNode(value)) {
    throw new Error()
  }
  if (value.tag !== 'Grammar') {
    throw new Error('Invalid value')
  }
  if (!Array.isArray(value.rules)) {
    throw new Error('Invalid value')
  }
  const parseExpression = (value: Ok): Expression => {
    if (!isNode(value)) {
      throw new Error('Invalid value')
    }
    switch (value.tag) {
      case 'Choice': case 'Sequence': {
        if (!Array.isArray(value.expressions)) {
          throw new Error('Invalid value')
        }
        return { tag: value.tag, expressions: value.expressions.map(parseExpression) }
      }
      case 'Node': case 'Field': {
        if (!isNode(value.expression) || typeof value.name !== 'string') {
          throw new Error('Invalid value')
        }
        return { tag: value.tag, name: value.name, expression: parseExpression(value.expression) }
      }
      case 'Extract': case 'Text': case 'And': case 'Not': case 'Optional': case 'Zero': case 'One': case 'Except': case 'Indent': {
        if (!isNode(value.expression)) {
          throw new Error('Invalid value')
        }
        return { tag: value.tag, expression: parseExpression(value.expression) }
      }
      case 'Repeat': {
        if (!isNode(value.expression) || typeof value.min !== 'string' || (typeof value.max !== 'string' && value.max !== null) || (!isNode(value.separator) && value.separator !== null)) {
          throw new Error('Invalid value')
        }
        return {
          tag: 'Repeat',
          expression: parseExpression(value.expression),
          min: parseInt(value.min),
          max: value.max === null ? undefined : parseInt(value.max),
          separator: value.separator === null ? undefined : parseExpression(value.separator)
        }
      }
      case 'Reference': {
        if (typeof value.name !== 'string') {
          throw new Error('Invalid value')
        }
        return { tag: 'Reference', name: value.name }
      }
      case 'Class': {
        if (!Array.isArray(value.predicates)) {
          throw new Error('Invalid value')
        }
        const predicates = value.predicates.map(value => {
          if (!isNode(value)) {
            throw new Error()
          }
          switch (value.tag) {
            case 'Equal':
              if (typeof value.value !== 'string') {
                throw new Error('Invalid value')
              }
              return { tag: 'Equal' as const, value: JSON.parse(`"${value.value}"`) }
            case 'Between':
              if (typeof value.min !== 'string' || typeof value.max !== 'string') {
                throw new Error('Invalid value')
              }
              return { tag: 'Between' as const, min: JSON.parse(`"${value.min}"`), max: JSON.parse(`"${value.max}"`) }
            default:
              throw new Error('Invalid value')
          }
        })
        return { tag: 'Class', predicates, insensitive: value.insensitive === 'i' ? true : undefined, negation: value.negation === '^' ? true : undefined }
      }
      case 'Literal': {
        if (typeof value.value !== 'string') {
          throw new Error('Invalid value')
        }
        return { tag: 'Literal', value: JSON.parse(value.value), insensitive: value.insensitive === 'i' ? true : undefined }
      }
      case 'Any':
        return { tag: 'Any' }
      default:
        throw new Error('Invalid value')
    }
  }
  const rules = value.rules.map(value => {
    if (!isNode(value)) {
      throw new Error()
    }
    if (value.tag !== 'Rule') {
      throw new Error('Invalid value')
    }
    if (typeof value.name !== 'string') {
      throw new Error('Invalid value')
    }
    if (!isNode(value.expression)) {
      throw new Error('Invalid value')
    }
    return { name: value.name, expression: parseExpression(value.expression) }
  })
  for (const [index, rule] of rules.entries()) {
    if (rules.findIndex(r => r.name === rule.name) !== index) {
      throw new Error('Duplicate rule ' + rule.name)
    }
  }
  const ruleNames = new Set(rules.map(rule => rule.name))
  const references = rules.flatMap(getRuleExpressions).filter(expression => expression.tag === 'Reference')
  for (const reference of references) {
    if (!ruleNames.has(reference.name)) {
      throw new Error('Unknown rule ' + reference.name)
    }
  }
  return { rules }
}

const packratGrammar: Grammar = {
  rules: [
    {
      name: 'Grammar',
      expression: {
        tag: 'Node',
        name: 'Grammar',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'rules',
              expression: {
                tag: 'Repeat',
                min: 1,
                expression: { tag: 'Reference', name: 'Rule' },
                separator: { tag: 'Reference', name: '_' }
              }
            },
            { tag: 'Reference', name: '_' },
          ]
        }
      }
    },
    {
      name: 'Rule',
      expression: {
        tag: 'Node',
        name: 'Rule',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'name',
              expression: { tag: 'Reference', name: 'Id' }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '=' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Expression' }
            },
          ]
        }
      }
    },
    {
      name: 'Expression',
      expression: { tag: 'Reference', name: 'Choice' }
    },
    {
      name: 'Choice',
      expression: {
        tag: 'Choice',
        expressions: [
          {
            tag: 'Node',
            name: 'Choice',
            expression: {
              tag: 'Field',
              name: 'expressions',
              expression: {
                tag: 'Repeat',
                expression: { tag: 'Reference', name: 'Node' },
                min: 2,
                separator: {
                  tag: 'Sequence',
                  expressions: [
                    { tag: 'Reference', name: '_' },
                    { tag: 'Literal', value: '/' },
                    { tag: 'Reference', name: '_' },
                  ]
                }
              }
            }
          },
          { tag: 'Reference', name: 'Node' }
        ]
      }
    },
    {
      name: 'Node',
      expression: {
        tag: 'Choice',
        expressions: [
          {
            tag: 'Node',
            name: 'Node',
            expression: {
              tag: 'Sequence',
              expressions: [
                {
                  tag: 'Field',
                  name: 'expression',
                  expression: { tag: 'Reference', name: 'Sequence' }
                },
                { tag: 'Reference', name: '_' },
                { tag: 'Literal', value: '->' },
                { tag: 'Reference', name: '_' },
                {
                  tag: 'Field',
                  name: 'name',
                  expression: { tag: 'Reference', name: 'Id' }
                }
              ]
            }
          },
          { tag: 'Reference', name: 'Sequence' }
        ]
      }
    },
    {
      name: 'Sequence',
      expression: {
        tag: 'Choice',
        expressions: [
          {
            tag: 'Node',
            name: 'Sequence',
            expression: {
              tag: 'Field',
              name: 'expressions',
              expression: {
                tag: 'Repeat',
                expression: { tag: 'Reference', name: 'Select' },
                min: 2,
                separator: { tag: 'Reference', name: '__' }
              }
            }
          },
          { tag: 'Reference', name: 'Select' }
        ]
      }
    },
    {
      name: 'Select',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Field' },
          { tag: 'Reference', name: 'Extract' },
          { tag: 'Reference', name: 'Prefix' },
        ]
      }
    },
    {
      name: 'Field',
      expression: {
        tag: 'Node',
        name: 'Field',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'name',
              expression: { tag: 'Reference', name: 'Id' }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: ':' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Prefix' }
            },
          ]
        }
      }
    },
    {
      name: 'Extract',
      expression: {
        tag: 'Node',
        name: 'Extract',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '^' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Prefix' }
            },
          ]
        }
      }
    },
    {
      name: 'Prefix',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Text' },
          { tag: 'Reference', name: 'And' },
          { tag: 'Reference', name: 'Not' },
          { tag: 'Reference', name: 'Postfix' },
        ]
      }
    },
    {
      name: 'Text',
      expression: {
        tag: 'Node',
        name: 'Text',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '$' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Postfix' }
            }
          ]
        }
      }
    },
    {
      name: 'And',
      expression: {
        tag: 'Node',
        name: 'And',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '&' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Postfix' }
            }
          ]
        }
      }
    },
    {
      name: 'Not',
      expression: {
        tag: 'Node',
        name: 'Not',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '!' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Postfix' }
            }
          ]
        }
      }
    },
    {
      name: 'Postfix',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Optional' },
          { tag: 'Reference', name: 'Zero' },
          { tag: 'Reference', name: 'One' },
          { tag: 'Reference', name: 'Repeat' },
          { tag: 'Reference', name: 'Primary' },
        ]
      }
    },
    {
      name: 'Optional',
      expression: {
        tag: 'Node',
        name: 'Optional',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Primary' }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '?' },
          ]
        }
      }
    },
    {
      name: 'Zero',
      expression: {
        tag: 'Node',
        name: 'Zero',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Primary' }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '*' },
          ]
        }
      }
    },
    {
      name: 'One',
      expression: {
        tag: 'Node',
        name: 'One',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Primary' }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '+' },
          ]
        }
      }
    },
    {
      name: 'Repeat',
      expression: {
        tag: 'Node',
        name: 'Repeat',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Primary' },
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '{' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'min',
              expression: { tag: 'Reference', name: 'Number' }
            },
            {
              tag: 'Field',
              name: 'max',
              expression: {
                tag: 'Optional',
                expression: { tag: 'Reference', name: 'RepeatMax' }
              }
            },
            {
              tag: 'Field',
              name: 'separator',
              expression: {
                tag: 'Optional',
                expression: { tag: 'Reference', name: 'RepeatSeparator' }
              }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '}' },
          ]
        }
      }
    },
    {
      name: 'RepeatMax',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Reference', name: '_' },
          { tag: 'Literal', value: ',' },
          { tag: 'Reference', name: '_' },
          {
            tag: 'Extract',
            expression: { tag: 'Reference', name: 'Number' }
          }
        ]
      }
    },
    {
      name: 'RepeatSeparator',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Reference', name: '_' },
          { tag: 'Literal', value: ';' },
          { tag: 'Reference', name: '_' },
          {
            tag: 'Extract',
            expression: { tag: 'Reference', name: 'Expression' }
          }
        ]
      }
    },
    {
      name: 'Number',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Literal', value: '0' },
          {
            tag: 'Text',
            expression: {
              tag: 'Sequence',
              expressions: [
                {
                  tag: 'Class',
                  predicates: [
                    { tag: 'Between', min: '1', max: '9' }
                  ]
                },
                {
                  tag: 'Zero',
                  expression: {
                  tag: 'Class',
                  predicates: [
                      { tag: 'Between', min: '0', max: '9' }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },
    {
      name: 'Primary',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Reference' },
          { tag: 'Reference', name: 'Except' },
          { tag: 'Reference', name: 'Indent' },
          { tag: 'Reference', name: 'Class' },
          { tag: 'Reference', name: 'Literal' },
          { tag: 'Reference', name: 'Any' },
          { tag: 'Reference', name: 'Group' },
        ]
      }
    },
    {
      name: 'Except',
      expression: {
        tag: 'Node',
        name: 'Except',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '~' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Primary' }
            }
          ]
        }
      }
    },
    {
      name: 'Indent',
      expression: {
        tag: 'Node',
        name: 'Indent',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '>>' },
            { tag: 'Reference', name: '_' },
            {
              tag: 'Field',
              name: 'expression',
              expression: { tag: 'Reference', name: 'Expression' }
            },
            { tag: 'Reference', name: '_' },
            { tag: 'Literal', value: '<<' },
          ]
        }
      }
    },
    {
      name: 'Group',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Literal', value: '(' },
          { tag: 'Reference', name: '_' },
          {
            tag: 'Extract',
            expression: { tag: 'Reference', name: 'Expression' }
          },
          { tag: 'Reference', name: '_' },
          { tag: 'Literal', value: ')' },
        ]
      }
    },
    {
      name: 'Reference',
      expression: {
        tag: 'Node',
        name: 'Reference',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'name',
              expression: { tag: 'Reference', name: 'Id' }
            },
            {
              tag: 'Not',
              expression: {
                tag: 'Sequence',
                expressions: [
                  { tag: 'Reference', name: '_' },
                  { tag: 'Literal', value: '=' },
                ]
              }
            }
          ]
        }
      }
    },
    {
      name: 'Id',
      expression: {
        tag: 'Text',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Class',
              predicates: [
                { tag: 'Between', min: 'a', max: 'z' },
                { tag: 'Equal', value: '_' },
              ],
              insensitive: true
            },
            {
              tag: 'Zero',
              expression: {
              tag: 'Class',
                predicates: [
                  { tag: 'Between', min: 'a', max: 'z' },
                  { tag: 'Between', min: '0', max: '9' },
                  { tag: 'Equal', value: '_' },
                ],
                insensitive: true
              },
            },
          ]
        }
      }
    },
    {
      name: 'Class',
      expression: {
        tag: 'Node',
        name: 'Class',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '[' },
            {
              tag: 'Field',
              name: 'negation',
              expression: {
                tag: 'Optional',
                expression: { tag: 'Literal', value: '^' }
              }
            },
            {
              tag: 'Field',
              name: 'predicates',
              expression: {
                tag: 'Zero',
                expression: { tag: 'Reference', name: 'ClassItem' }
              }
            },
            { tag: 'Literal', value: ']' },
            {
              tag: 'Field',
              name: 'insensitive',
              expression: {
                tag: 'Optional',
                expression: { tag: 'Literal', value: 'i' }
              }
            },
          ]
        }
      }
    },
    {
      name: 'ClassItem',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Between' },
          { tag: 'Reference', name: 'Equal' },
        ]
      }
    },
    {
      name: 'Between',
      expression: {
        tag: 'Node',
        name: 'Between',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'min',
              expression: { tag: 'Reference', name: 'PredicateItem' }
            },
            { tag: 'Literal', value: '-' },
            {
              tag: 'Field',
              name: 'max',
              expression: { tag: 'Reference', name: 'PredicateItem' }
            },
          ]
        }
      }
    },
    {
      name: 'Equal',
      expression: {
        tag: 'Node',
        name: 'Equal',
        expression: {
          tag: 'Field',
          name: 'value',
          expression: { tag: 'Reference', name: 'PredicateItem' }
        }
      }
    },
    {
      name: 'PredicateItem',
      expression: {
        tag: 'Choice',
        expressions: [
          {
            tag: 'Text',
            expression: {
              tag: 'Sequence',
              expressions: [
                { tag: 'Literal', value: '\\' },
                { tag: 'Any' },
              ]
            },
          },
          {
            tag: 'Except',
            expression: { tag: 'Literal', value: ']' }
          }
        ]
      }
    },
    {
      name: 'Literal',
      expression: {
        tag: 'Node',
        name: 'Literal',
        expression: {
          tag: 'Sequence',
          expressions: [
            {
              tag: 'Field',
              name: 'value',
              expression: { tag: 'Reference', name: 'String' }
            },
            {
              tag: 'Field',
              name: 'insensitive',
              expression: {
                tag: 'Optional',
                expression: { tag: 'Literal', value: 'i' }
              }
            },
          ]
        }
      }
    },
    {
      name: 'String',
      expression: {
        tag: 'Text',
        expression: {
          tag: 'Sequence',
          expressions: [
            { tag: 'Literal', value: '"' },
            {
              tag: 'Extract',
              expression: {
                tag: 'Text',
                expression: {
                  tag: 'Zero',
                  expression: { tag: 'Reference', name: 'StringItem' }
                }
              }
            },
            { tag: 'Literal', value: '"' },
          ]
        }
      }
    },
    {
      name: 'StringItem',
      expression: {
        tag: 'Choice',
        expressions: [
          {
            tag: 'Sequence',
            expressions: [
              { tag: 'Literal', value: '\\' },
              { tag: 'Any' }
            ]
          },
          {
            tag: 'Except',
            expression: { tag: 'Literal', value: '"' }
          },
        ]
      }
    },
    {
      name: 'Any',
      expression: {
        tag: 'Node',
        name: 'Any',
        expression: { tag: 'Literal', value: '.' }
      }
    },
    {
      name: '_',
      expression: {
        tag: 'Zero',
        expression: { tag: 'Reference', name: 'Space' }
      }
    },
    {
      name: '__',
      expression: {
        tag: 'One',
        expression: { tag: 'Reference', name: 'Space' }
      }
    },
    {
      name: 'Space',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'WhiteSpace' },
          { tag: 'Reference', name: 'SingleLineComment' },
          { tag: 'Reference', name: 'MultiLineComment' },
        ]
      }
    },
    {
      name: 'WhiteSpace',
      expression: {
        tag: 'One',
        expression: {
          tag: 'Class',
          predicates: [
            { tag: 'Equal', value: ' ' },
            { tag: 'Equal', value: '\t' },
            { tag: 'Equal', value: '\r' },
            { tag: 'Equal', value: '\n' },
          ]
        }
      }
    },
    {
      name: 'SingleLineComment',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Literal', value: '//' },
          {
            tag: 'Zero',
            expression: {
              tag: 'Except',
              expression: {
                tag: 'Class',
                predicates: [
                  { tag: 'Equal', value: '\r' },
                  { tag: 'Equal', value: '\n' },
                ]
              }
            }
          },
        ]
      }
    },
    {
      name: 'MultiLineComment',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Literal', value: '/*' },
          {
            tag: 'Zero',
            expression: {
              tag: 'Except',
              expression: { tag: 'Literal', value: '*/' }
            },
          },
          { tag: 'Literal', value: '*/' },
        ]
      }
    }
  ]
}

const resolvedPackratGrammar = resolveGrammar(packratGrammar)

const packrat = (input: TemplateStringsArray | string): (input: string, options?: ParseOptions) => Ok => {
  const grammarText = typeof input === 'string' ? input : input.join('')
  if (import.meta.env.MODE === 'php') {
    const parser = emitPhp(resolveGrammar(parseGrammar(evaluateGrammar(resolvedPackratGrammar, grammarText))))
    return (input: string, options: ParseOptions = {}) => {
      const php = `<?php
      error_reporting(E_ALL);
      ${parser}
      $parser = new Parser();
      $in = json_decode(<<<'JSON'
${JSON.stringify({ input, startRule: options.startRule, file: options.file })}
JSON
, true);
      try {
        echo json_encode($parser->parse($in['input'], startRule: $in['startRule'] ?? null, file: $in['file'] ?? null));
      } catch (PackratParseError $e) {
        echo json_encode(['__error' => true, 'message' => $e->getMessage(), 'e' => $e]);
      }
      `
      const out = Bun.spawnSync(['php'], { stdin: Buffer.from(php) }).stdout.toString()
      const result = JSON.parse(out)
      if (result?.__error) {
        throw new Error()
      }
      return result
    }
  }
  if (import.meta.env.MODE === 'js') {
    const parser = emitJs(resolveGrammar(parseGrammar(evaluateGrammar(resolvedPackratGrammar, grammarText))))
    return (input: string, options: ParseOptions = {}) => {
      const js = `
        ${parser}
        const options = ${JSON.stringify({input, options})}
        try {
          console.log(JSON.stringify(parse(options.input, options)))
        } catch (e) {
          console.log(JSON.stringify({ __error: true }))
        }
      `
      const out = Bun.spawnSync(['bun', '-'], { stdin: Buffer.from(js) }).stdout.toString()
      const result = JSON.parse(out)
      if (result?.__error) {
        throw new Error()
      }
      return result
    }
  }
  const grammar = resolveGrammar(parseGrammar(evaluateGrammar(resolvedPackratGrammar, grammarText)))
  return (input: string, options: ParseOptions = {}) => {
    return evaluateGrammar(grammar, input, options)
  }
}

export { evaluateGrammar, isNode, packrat, packratGrammar, ParseError, parseGrammar, type Location, type Node, type Ok }
