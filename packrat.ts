// packrat.ts

type Grammar = { rules: Rule[] }

type Rule = { name: string, expression: Expression }

type Expression =
  | { tag: 'Choice', expressions: Expression[] }
  | { tag: 'Node', expression: Expression, name: string }
  | { tag: 'Sequence', expressions: Expression[] }
  | { tag: 'Field', expression: Expression, name: string }
  | { tag: 'Extract', expression: Expression }
  | { tag: 'Text', expression: Expression }
  | { tag: 'Except', expression: Expression }
  | { tag: 'And', expression: Expression }
  | { tag: 'Not', expression: Expression }
  | { tag: 'Optional', expression: Expression }
  | { tag: 'Zero', expression: Expression }
  | { tag: 'One', expression: Expression }
  | { tag: 'Repeat', expression: Expression, min: number, max?: number, separator?: Expression }
  | { tag: 'Reference', name: string }
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

class ParseError extends Error {
  constructor (message: string, public location: Location) {
    super(message)
  }
}

const getExpressionExpressions = (expression: Expression): Expression[] => {
  switch (expression.tag) {
    case 'Choice': case 'Sequence':
      return [expression, ...expression.expressions.flatMap(getExpressionExpressions)]
    case 'Node': case 'Field': case 'Extract': case 'Text': case 'Except': case 'And': case 'Not': case 'Optional': case 'Zero': case 'One': case 'Indent':
      return [expression, ...getExpressionExpressions(expression.expression)]
    case 'Repeat':
      return [expression, ...getExpressionExpressions(expression.expression), ...(expression.separator ? getExpressionExpressions(expression.separator) : [])]
    case 'Reference': case 'Class': case 'Literal': case 'Any':
      return [expression]
  }
}

const getRuleExpressions = (rule: Rule) => getExpressionExpressions(rule.expression)

const evaluateGrammar = (grammar: Grammar, input: string, options: ParseOptions = {}) => {
  const rules = Object.fromEntries(grammar.rules.map(rule => [rule.name, rule.expression]))
  const cache = Object.fromEntries(grammar.rules.map(rule => [rule.name, {} as Record<number, { offset: number, indent: number[], result: Ok | Err }>]))
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
    const key = offset
    const entry = cache[name]![key]
    if (entry) {
      offset = entry.offset
      indent = [...entry.indent]
      return entry.result
    }
    const result = evaluateExpression(rules[name]!)
    cache[name]![key] = { offset, indent: [...indent], result }
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
      case 'Except': {
        const saved = offset
        const result = evaluateExpression(expression.expression)
        offset = saved
        if (result === err) {
          if (offset < input.length) {
            return input.charAt(offset++)
          }
        }
        return err
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
      case 'Extract': case 'Text': case 'Except': case 'And': case 'Not': case 'Optional': case 'Zero': case 'One': case 'Indent': {
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
    // Grammar = _ rules:( ^Rule _ )+ -> Grammar
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
                tag: 'One',
                expression: {
                  tag: 'Sequence',
                  expressions: [
                    {
                      tag: 'Extract',
                      expression: { tag: 'Reference', name: 'Rule' }
                    },
                    { tag: 'Reference', name: '_' },
                  ]
                }
              }
            },
          ]
        }
      }
    },
    // Rule = name:Id _ "=" _ expression:Expression -> Rule
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
    // Expression = Choice
    {
      name: 'Expression',
      expression: { tag: 'Reference', name: 'Choice' }
    },
    // Choice = expressions:Node { 2 ; _ "/" _ } -> Choice / Node
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
    // Node = expression:Sequence _ "->" _ name:Id -> Node / Sequence
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
    // Sequence = expressions:Select { 2 ; __ } -> Sequence / Select
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
    // Select = Field / Extract / Prefix
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
    // Field = name:Id _ ":" _ expression:Prefix -> Field
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
    // Extract = "^" _ expression:Prefix -> Extract
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
    // Prefix = Except / Text / And / Not / Postfix
    {
      name: 'Prefix',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Except' },
          { tag: 'Reference', name: 'Text' },
          { tag: 'Reference', name: 'And' },
          { tag: 'Reference', name: 'Not' },
          { tag: 'Reference', name: 'Postfix' },
        ]
      }
    },
    // Except = "~" _ expression:Postfix -> Except
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
              expression: { tag: 'Reference', name: 'Postfix' }
            }
          ]
        }
      }
    },
    // Text = "$" _ expression:Postfix -> Text
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
    // And = "&" _ expression:Postfix -> And
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
    // Not = "!" _ expression:Postfix -> Not
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
    // Postfix = Optional / Zero / One / Repeat / Primary
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
    // Optional = expression:Primary _ "?" -> Optional
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
    // Zero = expression:Primary _ "*" -> Zero
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
    // One = expression:Primary _ "+" -> One
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
    // Repeat = expression:Primary _ "{" _ min:Number max:RepeatMax? separator:RepeatSeparator? _ "}" -> Repeat
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
    // RepeatMax =  _ "," _ ^Number
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
    // RepeatSeparator =  _ ";" _ ^Expression
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
    // Number = "0" / $( [1-9] [0-9]* )
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
    // Primary = Reference / Class / Literal / Any / Group
    {
      name: 'Primary',
      expression: {
        tag: 'Choice',
        expressions: [
          { tag: 'Reference', name: 'Reference' },
          { tag: 'Reference', name: 'Indent' },
          { tag: 'Reference', name: 'Class' },
          { tag: 'Reference', name: 'Literal' },
          { tag: 'Reference', name: 'Any' },
          { tag: 'Reference', name: 'Group' },
        ]
      }
    },
    // Indent = ">>" _ expression:Expression _ "<<" -> Indent
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
    // Group = "(" _ ^Expression _ ")"
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
    // Reference = name:Id !( _ "=" ) -> Reference
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
    // Id = $( [a-z_]i [a-z0-9_]i* )
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
    // Class = "[" negation:"^"? predicates:ClassItem* "]" insensitive:"i"? -> Class
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
    // ClassItem = Between / Equal
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
    // Between = min:PredicateItem "-" max:PredicateItem -> Between
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
    // Equal = value:PredicateItem -> Equal
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
    // PredicateItem = $( "\\" . ) / ~"]"
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
    // Literal = value:String insensitive:"i"? -> Literal
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
    // String = $( "\"" ^$StringItem* "\"" )
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
    // StringItem = "\\" . / ~"\""
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
    // Any = "." -> Any
    {
      name: 'Any',
      expression: {
        tag: 'Node',
        name: 'Any',
        expression: { tag: 'Literal', value: '.' }
      }
    },
    // _ = Space*
    {
      name: '_',
      expression: {
        tag: 'Zero',
        expression: { tag: 'Reference', name: 'Space' }
      }
    },
    // __ = Space+
    {
      name: '__',
      expression: {
        tag: 'One',
        expression: { tag: 'Reference', name: 'Space' }
      }
    },
    // Space = WhiteSpace / SingleLineComment / MultiLineComment
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
    // WhiteSpace = [ \t\r\n]+
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
    // SingleLineComment = "//" ~[\r\n]*
    {
      name: 'SingleLineComment',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Literal', value: '//' },
          {
            tag: 'Except',
            expression: {
              tag: 'Zero',
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
    // MultiLineComment = "/*" ~"*/"* "*/"
    {
      name: 'MultiLineComment',
      expression: {
        tag: 'Sequence',
        expressions: [
          { tag: 'Literal', value: '/*' },
          {
            tag: 'Except',
            expression: {
              tag: 'Zero',
              expression: { tag: 'Literal', value: '*/' }
            },
          },
          { tag: 'Literal', value: '*/' },
        ]
      }
    }
  ]
}

const packrat = (input: TemplateStringsArray) => {
  const grammar = parseGrammar(evaluateGrammar(packratGrammar, input.join('')))
  return (input: string, options: ParseOptions = {}) => {
    return evaluateGrammar(grammar, input, options)
  }
}

export { evaluateGrammar, isNode, packrat, packratGrammar, ParseError, parseGrammar, type Location, type Node, type Ok }
