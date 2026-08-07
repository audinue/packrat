// SECTION: Types
type Grammar = { rules: Rule[] };

type Rule = { name: string; expression: Expression };

type Expression =
  | { tag: "Choice"; expressions: Expression[] }
  | { tag: "Node"; expression: Expression; name: string }
  | { tag: "Sequence"; expressions: Expression[] }
  | { tag: "Field"; expression: Expression; name: string }
  | { tag: "Extract"; expression: Expression }
  | { tag: "Text"; expression: Expression }
  | { tag: "And"; expression: Expression }
  | { tag: "Not"; expression: Expression }
  | { tag: "Optional"; expression: Expression }
  | { tag: "Zero"; expression: Expression }
  | { tag: "One"; expression: Expression }
  | {
      tag: "Repeat";
      expression: Expression;
      min: number;
      max?: number;
      separator?: Expression;
    }
  | { tag: "Reference"; name: string }
  | { tag: "Except"; expression: Expression }
  | { tag: "Indent"; expression: Expression }
  | {
      tag: "Class";
      predicates: Predicate[];
      insensitive?: boolean;
      negation?: boolean;
    }
  | { tag: "Literal"; value: string; insensitive?: boolean }
  | { tag: "Any" };

type Predicate = { tag: "Equal"; value: string } | { tag: "Between"; min: string; max: string };

type Location = {
  file: string;
  line: number;
  column: number;
  readonly preview: string;
  toString(): string;
};

type Value =
  | null
  | string
  | Value[]
  | {
      tag: string;
      readonly location: Location;
      [field: string]: Value | Location;
    };

type Type = { tag: "Recursion" } | { tag: "Null" } | { tag: "String" } | { tag: "Array"; element: Type } | { tag: "Node"; name: string; fields: { name: string; type: Type }[] } | { tag: "Union"; types: Type[] };

type Node = Exclude<Value, null | string | Value[]>;

type ParseOptions = { file?: string; startRule?: string };

type ResolvedGrammar = { rules: ResolvedRule[] };

type ResolvedRule = {
  name: string;
  type: Type;
  expression: ResolvedExpression;
  resultCount: number;
  resultStart: number;
  isLeftRecursive: boolean;
  memoize: boolean;
  inlineable: boolean;
};

type ResolvedExpression =
  | {
      tag: "Choice";
      type: Type;
      expressions: ResolvedExpression[];
      result: string;
      saved: string;
    }
  | {
      tag: "Node";
      type: Type;
      expression: ResolvedExpression;
      name: string;
      result: string;
      saved: string;
    }
  | {
      tag: "Sequence";
      type: Type;
      expressions: ResolvedExpression[];
      result: string;
    }
  | {
      tag: "Field";
      type: Type;
      expression: ResolvedExpression;
      name: string;
      result: string;
    }
  | {
      tag: "Extract";
      type: Type;
      expression: ResolvedExpression;
      result: string;
    }
  | {
      tag: "Text";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
    }
  | {
      tag: "And";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
    }
  | {
      tag: "Not";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
    }
  | {
      tag: "Optional";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
    }
  | {
      tag: "Zero";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
      results: string;
    }
  | {
      tag: "One";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
      results: string;
    }
  | {
      tag: "Repeat";
      type: Type;
      expression: ResolvedExpression;
      min: number;
      max?: number;
      separator?: ResolvedExpression;
      result: string;
      saved1: string;
      saved2: string;
      count: string;
      results: string;
    }
  | { tag: "Reference"; type: Type; name: string; result: string }
  | {
      tag: "Except";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
    }
  | {
      tag: "Indent";
      type: Type;
      expression: ResolvedExpression;
      result: string;
      saved: string;
      char: string;
    }
  | {
      tag: "Class";
      type: Type;
      predicates: Predicate[];
      insensitive?: boolean;
      negation?: boolean;
      result: string;
    }
  | {
      tag: "Literal";
      type: Type;
      value: string;
      insensitive?: boolean;
      result: string;
    }
  | { tag: "Any"; type: Type; result: string };

class ParseError extends Error {
  constructor(
    message: string,
    public location: Location,
    public rightmostOffset: number,
  ) {
    super(message);
  }
}

// SECTION: resolveGrammar
const resolveGrammar = (grammar: Grammar): ResolvedGrammar => {
  const rules = Object.fromEntries(grammar.rules.map((rule) => [rule.name, rule.expression]));
  const rootName = grammar.rules[0]!.name;
  const referencesOf = new Map(
    grammar.rules.map((rule) => {
      const refs = getRuleExpressions(rule)
        .filter((e) => e.tag === "Reference")
        .map((e) => e.name);
      return [rule.name, refs];
    }),
  );
  const referenceCounts = new Map<string, number>();
  for (const refs of referencesOf.values()) {
    for (const name of refs) {
      referenceCounts.set(name, (referenceCounts.get(name) ?? 0) + 1);
    }
  }
  const isLeftRecursive = (name: string, expression: Expression, visiting: Set<string> = new Set()): boolean => {
    switch (expression.tag) {
      case "Choice":
        return expression.expressions.some((e) => isLeftRecursive(name, e, visiting));
      case "Node":
        return isLeftRecursive(name, expression.expression, visiting);
      case "Sequence":
        return isLeftRecursive(name, expression.expressions[0]!, visiting);
      case "Field":
      case "Extract":
      case "Text":
      case "And":
      case "Not":
      case "Optional":
      case "Zero":
      case "One":
      case "Repeat":
        return isLeftRecursive(name, expression.expression, visiting);
      case "Reference":
        if (expression.name === name) return true;
        if (visiting.has(expression.name)) return false;
        visiting.add(expression.name);
        const result = isLeftRecursive(name, rules[expression.name]!, visiting);
        visiting.delete(expression.name);
        return result;
      case "Except":
      case "Indent":
        return isLeftRecursive(name, expression.expression, visiting);
      case "Class":
      case "Literal":
      case "Any":
        return false;
    }
  };
  const memoizeRequired = new Set<string>();
  for (const rule of grammar.rules) {
    if (isLeftRecursive(rule.name, rule.expression)) {
      memoizeRequired.add(rule.name);
    }
  }
  const bfs = new Set(memoizeRequired);
  for (const name of bfs) {
    for (const ref of referencesOf.get(name) ?? []) {
      if (!bfs.has(ref)) {
        bfs.add(ref);
      }
    }
  }
  for (const rule of grammar.rules) {
    if ((referenceCounts.get(rule.name) ?? 0) > 1) {
      bfs.add(rule.name);
    }
  }
  for (const name of bfs) {
    memoizeRequired.add(name);
  }
  const reaches = (from: string, target: string, visiting: Set<string> = new Set()): boolean => {
    if (from === target) return true;
    if (visiting.has(from)) return false;
    visiting.add(from);
    for (const ref of referencesOf.get(from) ?? []) {
      if (reaches(ref, target, visiting)) return true;
    }
    visiting.delete(from);
    return false;
  };
  const inlineable = (name: string) => {
    if (name === rootName) return false;
    if ((referenceCounts.get(name) ?? 0) !== 1) return false;
    if (reaches(name, name, new Set())) return false;
    return true;
  };
  let resultCounter = 0;
  return {
    rules: grammar.rules.map((rule) => {
      let savedCount = 0;
      let resultsCount = 0;
      let countCount = 0;
      let charCount = 0;
      const resultStart = resultCounter + 1;
      const nextResult = () => `result${++resultCounter}`;
      const nextSaved = () => `saved${++savedCount}`;
      const nextResults = () => `results${++resultsCount}`;
      const nextCount = () => `count${++countCount}`;
      const nextChar = () => `char${++charCount}`;
      const uniqueTypes = (types: Type[]) => {
        return types
          .flatMap((type) => {
            if (type.tag === "Union") {
              return type.types;
            }
            return type;
          })
          .filter((type, index, types) => {
            return (
              types.findIndex((t) => {
                if (t.tag !== type.tag) {
                  return false;
                }
                if (t.tag === "Node" && type.tag === "Node") {
                  return t.name === type.name;
                }
                return true;
              }) === index
            );
          });
      };
      const getExpressionType = (expression: Expression, cache: Map<string, Type> = new Map(), visiting: Set<string> = new Set()): Type => {
        switch (expression.tag) {
          case "Choice": {
            const types = uniqueTypes(expression.expressions.map((e) => getExpressionType(e, cache, visiting)));
            if (types.length === 1) {
              return types[0]!;
            }
            return { tag: "Union", types };
          }
          case "Node": {
            const fields: { name: string; type: Type }[] = [];
            if (expression.expression.tag === "Field") {
              fields.push({
                name: expression.expression.name,
                type: getExpressionType(expression.expression, cache, visiting),
              });
            } else if (expression.expression.tag === "Sequence") {
              for (const e of expression.expression.expressions) {
                if (e.tag === "Field") {
                  fields.push({
                    name: e.name,
                    type: getExpressionType(e.expression, cache, visiting),
                  });
                }
              }
            }
            return { tag: "Node", name: expression.name, fields };
          }
          case "Sequence": {
            const extracts = expression.expressions.filter((e) => e.tag === "Extract");
            if (extracts.length === 1) {
              return getExpressionType(extracts[0]!, cache, visiting);
            }
            if (extracts.length > 1) {
              const types = uniqueTypes(extracts.map((e) => getExpressionType(e, cache, visiting)));
              if (types.length === 1) {
                return { tag: "Array", element: types[0]! };
              }
              return { tag: "Array", element: { tag: "Union", types } };
            }
            const types = uniqueTypes(expression.expressions.map((e) => getExpressionType(e, cache, visiting)));
            if (types.length === 1) {
              return { tag: "Array", element: types[0]! };
            }
            return { tag: "Array", element: { tag: "Union", types } };
          }
          case "Field":
          case "Extract":
            return getExpressionType(expression.expression, cache, visiting);
          case "Text":
            return { tag: "String" };
          case "And":
          case "Not":
            return { tag: "Null" };
          case "Optional":
            return {
              tag: "Union",
              types: [{ tag: "Null" }, getExpressionType(expression.expression, cache, visiting)],
            };
          case "Zero":
          case "One":
          case "Repeat":
            return {
              tag: "Array",
              element: getExpressionType(expression.expression, cache, visiting),
            };
          case "Reference":
            if (cache.has(expression.name)) {
              return cache.get(expression.name)!;
            }
            if (visiting.has(expression.name)) {
              return { tag: "Recursion" };
            }
            visiting.add(expression.name);
            const type = getExpressionType(rules[expression.name]!, cache, visiting);
            visiting.delete(expression.name);
            if (type.tag !== "Recursion") {
              cache.set(expression.name, type);
            }
            return type;
          case "Except":
            return { tag: "String" };
          case "Indent":
            return getExpressionType(expression.expression, cache, visiting);
          case "Class":
          case "Literal":
          case "Any":
            return { tag: "String" };
        }
      };
      const typeCache = new Map<string, Type>();
      const resolveExpression = (expression: Expression): ResolvedExpression => {
        const type = getExpressionType(expression, typeCache);
        switch (expression.tag) {
          case "Choice":
            return {
              ...expression,
              type,
              expressions: expression.expressions.map(resolveExpression),
              result: nextResult(),
              saved: nextSaved(),
            };
          case "Node":
            return {
              ...expression,
              type,
              expression: resolveExpression(expression.expression),
              result: nextResult(),
              saved: nextSaved(),
            };
          case "Sequence":
            return {
              ...expression,
              type,
              expressions: expression.expressions.map(resolveExpression),
              result: nextResult(),
            };
          case "Field":
          case "Extract":
            const e = resolveExpression(expression.expression);
            return { ...expression, type, expression: e, result: e.result };
          case "Text":
          case "And":
          case "Not":
          case "Optional":
            return {
              ...expression,
              type,
              expression: resolveExpression(expression.expression),
              result: nextResult(),
              saved: nextSaved(),
            };
          case "Zero":
          case "One":
            return {
              ...expression,
              type,
              expression: resolveExpression(expression.expression),
              result: nextResult(),
              saved: nextSaved(),
              results: nextResults(),
            };
          case "Repeat":
            return {
              ...expression,
              type,
              expression: resolveExpression(expression.expression),
              separator: expression.separator === undefined ? undefined : resolveExpression(expression.separator),
              result: nextResult(),
              saved1: nextSaved(),
              saved2: nextSaved(),
              count: nextCount(),
              results: nextResults(),
            };
          case "Reference":
            return { ...expression, type, result: nextResult() };
          case "Except":
            return {
              ...expression,
              type,
              expression: resolveExpression(expression.expression),
              result: nextResult(),
              saved: nextSaved(),
            };
          case "Indent":
            return {
              ...expression,
              type,
              expression: resolveExpression(expression.expression),
              result: nextResult(),
              saved: nextSaved(),
              char: nextChar(),
            };
          case "Class":
          case "Literal":
          case "Any":
            return { ...expression, type, result: nextResult() };
        }
      };
      const expression = resolveExpression(rule.expression);
      return {
        ...rule,
        type: expression.type,
        expression,
        resultCount: resultCounter - resultStart + 1,
        resultStart,
        isLeftRecursive: isLeftRecursive(rule.name, rule.expression),
        memoize: memoizeRequired.has(rule.name),
        inlineable: inlineable(rule.name),
      };
    }),
  };
};

const getExpressionExpressions = (expression: Expression): Expression[] => {
  switch (expression.tag) {
    case "Choice":
    case "Sequence":
      return [expression, ...expression.expressions.flatMap(getExpressionExpressions)];
    case "Node":
    case "Field":
    case "Extract":
    case "Text":
    case "And":
    case "Not":
    case "Optional":
    case "Zero":
    case "One":
    case "Except":
    case "Indent":
      return [expression, ...getExpressionExpressions(expression.expression)];
    case "Repeat":
      return [expression, ...getExpressionExpressions(expression.expression), ...(expression.separator ? getExpressionExpressions(expression.separator) : [])];
    case "Reference":
    case "Class":
    case "Literal":
    case "Any":
      return [expression];
  }
};

const getRuleExpressions = (rule: Rule) => getExpressionExpressions(rule.expression);

const isNode = (value: unknown): value is Node => {
  return value !== null && typeof value === "object" && "tag" in value && typeof value.tag === "string";
};

// SECTION: parseGrammar
const parseGrammar = (value: Value): Grammar => {
  if (!isNode(value)) {
    throw new Error();
  }
  if (value.tag !== "Grammar") {
    throw new Error("Invalid value");
  }
  if (!Array.isArray(value.rules)) {
    throw new Error("Invalid value");
  }
  const parseExpression = (value: Value): Expression => {
    if (!isNode(value)) {
      throw new Error("Invalid value");
    }
    switch (value.tag) {
      case "Choice":
      case "Sequence": {
        if (!Array.isArray(value.expressions)) {
          throw new Error("Invalid value");
        }
        return {
          tag: value.tag,
          expressions: value.expressions.map(parseExpression),
        };
      }
      case "Node":
      case "Field": {
        if (!isNode(value.expression) || typeof value.name !== "string") {
          throw new Error("Invalid value");
        }
        return {
          tag: value.tag,
          name: value.name,
          expression: parseExpression(value.expression),
        };
      }
      case "Extract":
      case "Text":
      case "And":
      case "Not":
      case "Optional":
      case "Zero":
      case "One":
      case "Except":
      case "Indent": {
        if (!isNode(value.expression)) {
          throw new Error("Invalid value");
        }
        return {
          tag: value.tag,
          expression: parseExpression(value.expression),
        };
      }
      case "Repeat": {
        if (!isNode(value.expression) || typeof value.min !== "string" || (typeof value.max !== "string" && value.max !== null) || (!isNode(value.separator) && value.separator !== null)) {
          throw new Error("Invalid value");
        }
        return {
          tag: "Repeat",
          expression: parseExpression(value.expression),
          min: parseInt(value.min),
          max: value.max === null ? undefined : parseInt(value.max),
          separator: value.separator === null ? undefined : parseExpression(value.separator),
        };
      }
      case "Reference": {
        if (typeof value.name !== "string") {
          throw new Error("Invalid value");
        }
        return { tag: "Reference", name: value.name };
      }
      case "Class": {
        if (!Array.isArray(value.predicates)) {
          throw new Error("Invalid value");
        }
        const predicates = value.predicates.map((value) => {
          if (!isNode(value)) {
            throw new Error();
          }
          switch (value.tag) {
            case "Equal":
              if (typeof value.value !== "string") {
                throw new Error("Invalid value");
              }
              return {
                tag: "Equal" as const,
                value: JSON.parse(`"${value.value}"`),
              };
            case "Between":
              if (typeof value.min !== "string" || typeof value.max !== "string") {
                throw new Error("Invalid value");
              }
              return {
                tag: "Between" as const,
                min: JSON.parse(`"${value.min}"`),
                max: JSON.parse(`"${value.max}"`),
              };
            default:
              throw new Error("Invalid value");
          }
        });
        return {
          tag: "Class",
          predicates,
          insensitive: value.insensitive === "i" ? true : undefined,
          negation: value.negation === "^" ? true : undefined,
        };
      }
      case "Literal": {
        if (typeof value.value !== "string") {
          throw new Error("Invalid value");
        }
        return {
          tag: "Literal",
          value: JSON.parse(value.value),
          insensitive: value.insensitive === "i" ? true : undefined,
        };
      }
      case "Any":
        return { tag: "Any" };
      default:
        throw new Error("Invalid value");
    }
  };
  const rules = value.rules.map((value) => {
    if (!isNode(value)) {
      throw new Error();
    }
    if (value.tag !== "Rule") {
      throw new Error("Invalid value");
    }
    if (typeof value.name !== "string") {
      throw new Error("Invalid value");
    }
    if (!isNode(value.expression)) {
      throw new Error("Invalid value");
    }
    return { name: value.name, expression: parseExpression(value.expression) };
  });
  for (const [index, rule] of rules.entries()) {
    if (rules.findIndex((r) => r.name === rule.name) !== index) {
      throw new Error("Duplicate rule " + rule.name);
    }
  }
  const ruleNames = new Set(rules.map((rule) => rule.name));
  const references = rules.flatMap(getRuleExpressions).filter((expression) => expression.tag === "Reference");
  for (const reference of references) {
    if (!ruleNames.has(reference.name)) {
      throw new Error("Unknown rule " + reference.name);
    }
  }
  return { rules };
};

// SECTION: evaluateGrammar
const evaluateGrammar = (grammar: ResolvedGrammar, input: string, options: ParseOptions = {}) => {
  const rules = Object.fromEntries(grammar.rules.map((rule) => [rule.name, rule]));
  const cache = Object.fromEntries(
    grammar.rules.map((rule) => [
      rule.name,
      {} as Record<
        number,
        Record<
          string,
          {
            offset: number;
            indent: number[];
            indentKey: string;
            indentSize: number | undefined;
            result: Value | Err;
            growing: boolean;
          }
        >
      >,
    ]),
  );
  const stack = [] as {
    start: number;
    indentKey: string;
    name: string;
    involved: Set<string> | null;
  }[];
  const err = Symbol("err");
  type Err = typeof err;
  let offset = 0;
  let rightmostOffset = 0;
  let indent = [0];
  let indentKey = "0";
  let indentSize: number | undefined;
  const getLocation = (offset: number) => {
    let line = 1;
    let column = 1;
    for (let i = 0; i < offset; i++) {
      const char = input.charCodeAt(i);
      if (char === 13) {
        if (input.charCodeAt(i + 1) === 10) {
          i++;
        }
        line++;
        column = 1;
        continue;
      }
      if (char === 10) {
        line++;
        column = 1;
        continue;
      }
      column++;
    }
    return {
      file: options.file ?? "<unknown>",
      line,
      column,
      get preview() {
        return `${input.split(/\r\n|\r|\n/)[this.line - 1] ?? ""}\n${" ".repeat(this.column - 1)}^`;
      },
      toString() {
        return `${this.file}:${this.line}:${this.column}`;
      },
    };
  };
  const evaluateRule = (name: string): Value | Err => {
    const start = offset;
    const startIndentKey = indentKey;
    const memo = cache[name]!;
    const entry = memo[start]?.[startIndentKey];
    if (entry) {
      if (entry.growing) {
        const index = stack.findIndex((e) => e.name === name && e.start === start && e.indentKey === startIndentKey);
        if (index !== -1) {
          const owner = stack[index]!;
          owner.involved ??= new Set();
          for (let i = index + 1; i < stack.length; i++) {
            owner.involved.add(stack[i]!.name);
          }
        }
      }
      offset = entry.offset;
      indent = entry.indent.slice();
      indentKey = entry.indentKey;
      indentSize = entry.indentSize;
      if (offset > rightmostOffset) rightmostOffset = offset;
      return entry.result;
    }
    const rule = rules[name]!;
    if (!rule.memoize) {
      const result = evaluateExpression(rule.expression);
      if (offset > rightmostOffset) rightmostOffset = offset;
      return result;
    }
    if (!rule.isLeftRecursive) {
      const result = evaluateExpression(rule.expression);
      (memo[start] ??= {})[startIndentKey] = {
        offset,
        indent: indent.slice(),
        indentKey,
        indentSize,
        result,
        growing: false,
      };
      if (offset > rightmostOffset) rightmostOffset = offset;
      return result;
    }
    const frame = { name, involved: null, start, indentKey: startIndentKey };
    stack.push(frame);
    let result: Value | Err = err;
    let endPos = start;
    (memo[start] ??= {})[startIndentKey] = {
      offset: start,
      indent: indent.slice(),
      indentKey,
      indentSize,
      result,
      growing: true,
    };
    while (true) {
      offset = start;
      const attempt = evaluateExpression(rule.expression);
      if (attempt === err) {
        break;
      }
      const attemptEnd = offset;
      if (result !== err && attemptEnd <= endPos) {
        break;
      }
      result = attempt;
      endPos = attemptEnd;
      (memo[start] ??= {})[startIndentKey] = {
        offset: endPos,
        indent: indent.slice(),
        indentKey,
        indentSize,
        result,
        growing: true,
      };
    }
    stack.pop();
    if (stack.some((e) => e.involved?.has(name))) {
      delete memo[start][startIndentKey];
    } else {
      (memo[start] ??= {})[startIndentKey] = {
        offset: endPos,
        indent: indent.slice(),
        indentKey,
        indentSize,
        result,
        growing: false,
      };
    }
    offset = endPos;
    if (offset > rightmostOffset) rightmostOffset = offset;
    return result;
  };
  const evaluateExpression = (expression: ResolvedExpression): Value | Err => {
    switch (expression.tag) {
      case "Choice": {
        const saved = offset;
        for (const e of expression.expressions) {
          const result = evaluateExpression(e);
          if (result === err) {
            offset = saved;
            continue;
          }
          return result;
        }
        return err;
      }
      case "Node": {
        const saved = offset;
        const result = evaluateExpression(expression.expression);
        if (result === err) {
          return err;
        }
        const node: Node = {
          tag: expression.name,
          get location() {
            return getLocation(saved);
          },
        };
        switch (expression.expression.tag) {
          case "Field": {
            node[expression.expression.name] = result;
            break;
          }
          case "Sequence": {
            const expressions = expression.expression.expressions;
            for (let i = 0; i < expressions.length; i++) {
              const expression = expressions[i]!;
              if (expression.tag === "Field") {
                node[expression.name] = (result as Value[])[i]!;
              }
            }
          }
        }
        return node;
      }
      case "Sequence": {
        const results: Value[] = [];
        const extracted: Value[] = [];
        for (const e of expression.expressions) {
          const result = evaluateExpression(e);
          if (result === err) {
            return err;
          }
          if (e.tag === "Extract") {
            extracted.push(result);
            continue;
          }
          results.push(result);
        }
        if (extracted.length === 1) {
          return extracted[0]!;
        }
        if (extracted.length > 1) {
          return extracted;
        }
        return results;
      }
      case "Field":
      case "Extract": {
        return evaluateExpression(expression.expression);
      }
      case "Text": {
        const saved = offset;
        const result = evaluateExpression(expression.expression);
        if (result === err) {
          return err;
        }
        return input.substring(saved, offset);
      }
      case "And": {
        const saved = offset;
        const result = evaluateExpression(expression.expression);
        offset = saved;
        if (result === err) {
          return err;
        }
        return null;
      }
      case "Not": {
        const saved = offset;
        const result = evaluateExpression(expression.expression);
        offset = saved;
        if (result === err) {
          return null;
        }
        return err;
      }
      case "Optional": {
        const saved = offset;
        const result = evaluateExpression(expression.expression);
        if (result === err) {
          offset = saved;
          return null;
        }
        return result;
      }
      case "Zero": {
        const results: Value[] = [];
        while (true) {
          const saved = offset;
          const result = evaluateExpression(expression.expression);
          if (result === err) {
            offset = saved;
            break;
          }
          results.push(result);
        }
        return results;
      }
      case "One": {
        const result = evaluateExpression(expression.expression);
        if (result === err) {
          return err;
        }
        const results: Value[] = [result];
        while (true) {
          const saved = offset;
          const result = evaluateExpression(expression.expression);
          if (result === err) {
            offset = saved;
            break;
          }
          results.push(result);
        }
        return results;
      }
      case "Repeat": {
        const results: Value[] = [];
        const saved = offset;
        let count = 0;
        while (expression.max === undefined || count < expression.max) {
          const saved = offset;
          if (count > 0 && expression.separator !== undefined) {
            const result = evaluateExpression(expression.separator);
            if (result === err) {
              offset = saved;
              break;
            }
          }
          const result = evaluateExpression(expression.expression);
          if (result === err) {
            offset = saved;
            break;
          }
          results.push(result);
          count++;
        }
        if (count < expression.min) {
          offset = saved;
          return err;
        }
        return results;
      }
      case "Reference": {
        return evaluateRule(expression.name);
      }
      case "Except": {
        const saved = offset;
        const result = evaluateExpression(expression.expression);
        offset = saved;
        if (result === err && offset < input.length) {
          return input.charAt(offset++);
        }
        return err;
      }
      case "Indent": {
        if (offset >= input.length) {
          return err;
        }
        const char = input.charAt(offset);
        if (char !== "\r" && char !== "\n") {
          return err;
        }
        offset++;
        if (char === "\r" && offset < input.length && input.charAt(offset) === "\n") {
          offset++;
        }
        while (offset < input.length) {
          let scan = offset;
          while (scan < input.length && (input.charAt(scan) === " " || input.charAt(scan) === "\t")) {
            scan++;
          }
          if (scan < input.length && (input.charAt(scan) === "\n" || input.charAt(scan) === "\r")) {
            offset = scan + 1;
            if (input.charAt(scan) === "\r" && offset < input.length && input.charAt(offset) === "\n") {
              offset++;
            }
            continue;
          }
          break;
        }
        const saved = offset;
        while (offset < input.length && (input.charAt(offset) === " " || input.charAt(offset) === "\t")) {
          offset++;
        }
        const next = offset - saved;
        if (indentSize === undefined) {
          if (next === 0) {
            return err;
          }
          indentSize = next;
        }
        if (next % indentSize !== 0) {
          return err;
        }
        const nextLevel = next / indentSize;
        if (nextLevel <= indent[indent.length - 1]!) {
          return err;
        }
        indent.push(nextLevel);
        indentKey += "," + nextLevel;
        const result = evaluateExpression(expression.expression);
        indent.pop();
        indentKey = indentKey.slice(0, indentKey.lastIndexOf(","));
        if (indent.length === 1) {
          indentSize = undefined;
        }
        return result;
      }
      case "Class": {
        if (offset >= input.length) {
          return err;
        }
        const char = input.charAt(offset);
        const value = expression.insensitive ? char.toUpperCase() : char;
        if (
          expression.predicates.some((predicate) => {
            switch (predicate.tag) {
              case "Equal":
                return (expression.insensitive ? predicate.value.toUpperCase() : predicate.value) === value;
              case "Between":
                return value >= (expression.insensitive ? predicate.min.toUpperCase() : predicate.min) && value <= (expression.insensitive ? predicate.max.toUpperCase() : predicate.max);
            }
          }) !== !!expression.negation
        ) {
          offset++;
          return char;
        }
        return err;
      }
      case "Literal": {
        if (offset + expression.value.length > input.length) {
          return err;
        }
        const substring = input.substring(offset, offset + expression.value.length);
        if ((expression.insensitive ? substring.toUpperCase() : substring) === (expression.insensitive ? expression.value.toUpperCase() : expression.value)) {
          offset += substring.length;
          return substring;
        }
        return err;
      }
      case "Any": {
        if (offset < input.length) {
          return input.charAt(offset++);
        }
        return err;
      }
    }
  };
  const result = evaluateRule(options.startRule ?? grammar.rules[0]!.name);
  if (result === err || offset < input.length) {
    const location = getLocation(offset);
    throw new ParseError(`Unexpected ${offset < input.length ? JSON.stringify(input.charAt(offset)) : "end of file"} at ${location}\n\n${location.preview}`, location, rightmostOffset);
  }
  return result;
};

// SECTION: buildGrammar
const _err = Symbol("err");

type _Err = typeof _err;

type _StackFrame = { start: number; indentKey: string; name: string; involved: Set<string> | null };

type _MemoEntry = {
  offset: number;
  indent: number[];
  indentKey: string;
  indentSize: number | undefined;
  result: Value | _Err;
  growing: boolean;
};

type _ParseContext = {
  input: string;
  offset: number;
  indent: number[];
  indentKey: string;
  indentSize: number | undefined;
  memo: Record<string, Record<number, Record<string, _MemoEntry>>>;
  stack: _StackFrame[];
  getLocation: (offset: number) => Location;
  parseRule: (name: string) => Value | _Err;
};

type _Parser = {
  parse(context: _ParseContext): Value | _Err;
};

type _PredicateParser = {
  match(value: string): boolean;
};

type _FieldExtractor = {
  assign(node: Node, result: Value): void;
};

type _RuleParser = {
  name: string;
  type: Type;
  expression: _Parser;
  resultCount: number;
  isLeftRecursive: boolean;
  memoize: boolean;
  parse?: (context: _ParseContext) => Value | _Err;
};

type _GrammarParser = {
  rules: Record<string, _RuleParser>;
  parse(input: string, options?: ParseOptions): Value;
};

const buildGrammar = (grammar: Grammar): _GrammarParser => {
  const resolved = resolveGrammar(grammar);
  const buildParser = (expression: ResolvedExpression): _Parser => {
    switch (expression.tag) {
      case "Choice": {
        const n = expression.expressions.length;
        if (n === 0) {
          return {
            parse(context) {
              return _err;
            },
          };
        }
        if (n === 1) {
          return buildParser(expression.expressions[0]!);
        }
        if (n === 2) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          return {
            parse(context) {
              const saved = context.offset;
              const r0 = p0.parse(context);
              if (r0 !== _err) return r0;
              context.offset = saved;
              const r1 = p1.parse(context);
              if (r1 !== _err) return r1;
              context.offset = saved;
              return _err;
            },
          };
        }
        if (n === 3) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          const p2 = buildParser(expression.expressions[2]!);
          return {
            parse(context) {
              const saved = context.offset;
              const r0 = p0.parse(context);
              if (r0 !== _err) return r0;
              context.offset = saved;
              const r1 = p1.parse(context);
              if (r1 !== _err) return r1;
              context.offset = saved;
              const r2 = p2.parse(context);
              if (r2 !== _err) return r2;
              context.offset = saved;
              return _err;
            },
          };
        }
        if (n === 4) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          const p2 = buildParser(expression.expressions[2]!);
          const p3 = buildParser(expression.expressions[3]!);
          return {
            parse(context) {
              const saved = context.offset;
              const r0 = p0.parse(context);
              if (r0 !== _err) return r0;
              context.offset = saved;
              const r1 = p1.parse(context);
              if (r1 !== _err) return r1;
              context.offset = saved;
              const r2 = p2.parse(context);
              if (r2 !== _err) return r2;
              context.offset = saved;
              const r3 = p3.parse(context);
              if (r3 !== _err) return r3;
              context.offset = saved;
              return _err;
            },
          };
        }
        if (n === 5) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          const p2 = buildParser(expression.expressions[2]!);
          const p3 = buildParser(expression.expressions[3]!);
          const p4 = buildParser(expression.expressions[4]!);
          return {
            parse(context) {
              const saved = context.offset;
              const r0 = p0.parse(context);
              if (r0 !== _err) return r0;
              context.offset = saved;
              const r1 = p1.parse(context);
              if (r1 !== _err) return r1;
              context.offset = saved;
              const r2 = p2.parse(context);
              if (r2 !== _err) return r2;
              context.offset = saved;
              const r3 = p3.parse(context);
              if (r3 !== _err) return r3;
              context.offset = saved;
              const r4 = p4.parse(context);
              if (r4 !== _err) return r4;
              context.offset = saved;
              return _err;
            },
          };
        }
        const ps = expression.expressions.map((e) => buildParser(e));
        return {
          parse(context) {
            const saved = context.offset;
            for (let i = 0; i < n; i++) {
              const result = ps[i]!.parse(context);
              if (result !== _err) return result;
              context.offset = saved;
            }
            return _err;
          },
        };
      }
      case "Node": {
        const inner = buildParser(expression.expression);
        const innerExpr = expression.expression;
        let extractor: _FieldExtractor;
        if (innerExpr.tag === "Field") {
          extractor = {
            assign(node, result) {
              node[innerExpr.name] = result;
            },
          };
        } else if (innerExpr.tag === "Sequence") {
          const fieldEntries = innerExpr.expressions.map((e, i) => (e.tag === "Field" ? { name: e.name, index: i } : null)).filter((x) => x !== null);
          extractor = {
            assign(node, result) {
              for (const { name, index } of fieldEntries) {
                node[name] = (result as Value[])[index]!;
              }
            },
          };
        } else {
          extractor = { assign() {} };
        }
        return {
          parse(context) {
            const saved = context.offset;
            const result = inner.parse(context);
            if (result === _err) return _err;
            const node: Node = {
              tag: expression.name,
              get location() {
                return context.getLocation(saved);
              },
            };
            extractor.assign(node, result);
            return node;
          },
        };
      }
      case "Sequence": {
        const n = expression.expressions.length;
        const extractIndices: number[] = [];
        for (let i = 0; i < expression.expressions.length; i++) {
          if (expression.expressions[i]!.tag === "Extract") {
            extractIndices.push(i);
          }
        }
        const extractCount = extractIndices.length;
        if (n === 0) {
          return {
            parse(context) {
              return [];
            },
          };
        }
        if (n === 1) {
          const p0 = buildParser(expression.expressions[0]!);
          if (extractCount === 1) return p0;
          return {
            parse(context) {
              const r0 = p0.parse(context);
              if (r0 === _err) return _err;
              return [r0];
            },
          };
        }
        if (n === 2) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          if (extractCount === 0)
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                return [r0, r1];
              },
            };
          if (extractCount === 1) {
            const ei = extractIndices[0]!;
            if (ei === 0)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  return r0;
                },
              };
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                return r1;
              },
            };
          }
          return {
            parse(context) {
              const r0 = p0.parse(context);
              if (r0 === _err) return _err;
              const r1 = p1.parse(context);
              if (r1 === _err) return _err;
              return [r0, r1];
            },
          };
        }
        if (n === 3) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          const p2 = buildParser(expression.expressions[2]!);
          if (extractCount === 0)
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                const r2 = p2.parse(context);
                if (r2 === _err) return _err;
                return [r0, r1, r2];
              },
            };
          if (extractCount === 1) {
            const ei = extractIndices[0]!;
            if (ei === 0)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  return r0;
                },
              };
            if (ei === 1)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  return r1;
                },
              };
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                const r2 = p2.parse(context);
                if (r2 === _err) return _err;
                return r2;
              },
            };
          }
          return {
            parse(context) {
              const r0 = p0.parse(context);
              if (r0 === _err) return _err;
              const r1 = p1.parse(context);
              if (r1 === _err) return _err;
              const r2 = p2.parse(context);
              if (r2 === _err) return _err;
              const vals = [r0, r1, r2];
              return extractIndices.map((i) => vals[i]!);
            },
          };
        }
        if (n === 4) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          const p2 = buildParser(expression.expressions[2]!);
          const p3 = buildParser(expression.expressions[3]!);
          if (extractCount === 0)
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                const r2 = p2.parse(context);
                if (r2 === _err) return _err;
                const r3 = p3.parse(context);
                if (r3 === _err) return _err;
                return [r0, r1, r2, r3];
              },
            };
          if (extractCount === 1) {
            const ei = extractIndices[0]!;
            if (ei === 0)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  return r0;
                },
              };
            if (ei === 1)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  return r1;
                },
              };
            if (ei === 2)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  return r2;
                },
              };
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                const r2 = p2.parse(context);
                if (r2 === _err) return _err;
                const r3 = p3.parse(context);
                if (r3 === _err) return _err;
                return r3;
              },
            };
          }
          return {
            parse(context) {
              const r0 = p0.parse(context);
              if (r0 === _err) return _err;
              const r1 = p1.parse(context);
              if (r1 === _err) return _err;
              const r2 = p2.parse(context);
              if (r2 === _err) return _err;
              const r3 = p3.parse(context);
              if (r3 === _err) return _err;
              const vals = [r0, r1, r2, r3];
              return extractIndices.map((i) => vals[i]!);
            },
          };
        }
        if (n === 5) {
          const p0 = buildParser(expression.expressions[0]!);
          const p1 = buildParser(expression.expressions[1]!);
          const p2 = buildParser(expression.expressions[2]!);
          const p3 = buildParser(expression.expressions[3]!);
          const p4 = buildParser(expression.expressions[4]!);
          if (extractCount === 0)
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                const r2 = p2.parse(context);
                if (r2 === _err) return _err;
                const r3 = p3.parse(context);
                if (r3 === _err) return _err;
                const r4 = p4.parse(context);
                if (r4 === _err) return _err;
                return [r0, r1, r2, r3, r4];
              },
            };
          if (extractCount === 1) {
            const ei = extractIndices[0]!;
            if (ei === 0)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  const r4 = p4.parse(context);
                  if (r4 === _err) return _err;
                  return r0;
                },
              };
            if (ei === 1)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  const r4 = p4.parse(context);
                  if (r4 === _err) return _err;
                  return r1;
                },
              };
            if (ei === 2)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  const r4 = p4.parse(context);
                  if (r4 === _err) return _err;
                  return r2;
                },
              };
            if (ei === 3)
              return {
                parse(context) {
                  const r0 = p0.parse(context);
                  if (r0 === _err) return _err;
                  const r1 = p1.parse(context);
                  if (r1 === _err) return _err;
                  const r2 = p2.parse(context);
                  if (r2 === _err) return _err;
                  const r3 = p3.parse(context);
                  if (r3 === _err) return _err;
                  const r4 = p4.parse(context);
                  if (r4 === _err) return _err;
                  return r3;
                },
              };
            return {
              parse(context) {
                const r0 = p0.parse(context);
                if (r0 === _err) return _err;
                const r1 = p1.parse(context);
                if (r1 === _err) return _err;
                const r2 = p2.parse(context);
                if (r2 === _err) return _err;
                const r3 = p3.parse(context);
                if (r3 === _err) return _err;
                const r4 = p4.parse(context);
                if (r4 === _err) return _err;
                return r4;
              },
            };
          }
          return {
            parse(context) {
              const r0 = p0.parse(context);
              if (r0 === _err) return _err;
              const r1 = p1.parse(context);
              if (r1 === _err) return _err;
              const r2 = p2.parse(context);
              if (r2 === _err) return _err;
              const r3 = p3.parse(context);
              if (r3 === _err) return _err;
              const r4 = p4.parse(context);
              if (r4 === _err) return _err;
              const vals = [r0, r1, r2, r3, r4];
              return extractIndices.map((i) => vals[i]!);
            },
          };
        }
        const ps = expression.expressions.map((e) => buildParser(e));
        return {
          parse(context) {
            const results: Value[] = [];
            const extracted: Value[] = [];
            for (let i = 0; i < n; i++) {
              const result = ps[i]!.parse(context);
              if (result === _err) return _err;
              if (expression.expressions[i]!.tag === "Extract") {
                extracted.push(result);
                continue;
              }
              results.push(result);
            }
            if (extractCount === 1) return extracted[0]!;
            if (extractCount > 1) return extracted;
            return results;
          },
        };
      }
      case "Field":
      case "Extract": {
        return buildParser(expression.expression);
      }
      case "Text": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const saved = context.offset;
            const result = inner.parse(context);
            if (result === _err) return _err;
            return context.input.substring(saved, context.offset);
          },
        };
      }
      case "And": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const saved = context.offset;
            const result = inner.parse(context);
            context.offset = saved;
            if (result === _err) return _err;
            return null;
          },
        };
      }
      case "Not": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const saved = context.offset;
            const result = inner.parse(context);
            context.offset = saved;
            if (result === _err) return null;
            return _err;
          },
        };
      }
      case "Optional": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const saved = context.offset;
            const result = inner.parse(context);
            if (result === _err) {
              context.offset = saved;
              return null;
            }
            return result;
          },
        };
      }
      case "Zero": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const results: Value[] = [];
            while (true) {
              const saved = context.offset;
              const result = inner.parse(context);
              if (result === _err) {
                context.offset = saved;
                break;
              }
              results.push(result);
            }
            return results;
          },
        };
      }
      case "One": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const first = inner.parse(context);
            if (first === _err) return _err;
            const results: Value[] = [first];
            while (true) {
              const saved = context.offset;
              const result = inner.parse(context);
              if (result === _err) {
                context.offset = saved;
                break;
              }
              results.push(result);
            }
            return results;
          },
        };
      }
      case "Repeat": {
        const inner = buildParser(expression.expression);
        const sep = expression.separator !== undefined ? buildParser(expression.separator) : undefined;
        return {
          parse(context) {
            const results: Value[] = [];
            const saved = context.offset;
            let count = 0;
            while (expression.max === undefined || count < expression.max) {
              const loopSave = context.offset;
              if (count > 0 && sep !== undefined) {
                const sepResult = sep.parse(context);
                if (sepResult === _err) {
                  context.offset = loopSave;
                  break;
                }
              }
              const result = inner.parse(context);
              if (result === _err) {
                context.offset = loopSave;
                break;
              }
              results.push(result);
              count++;
            }
            if (count < expression.min) {
              context.offset = saved;
              return _err;
            }
            return results;
          },
        };
      }
      case "Reference": {
        return {
          parse(context) {
            return context.parseRule(expression.name);
          },
        };
      }
      case "Except": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            const saved = context.offset;
            const result = inner.parse(context);
            context.offset = saved;
            if (result === _err && context.offset < context.input.length) {
              return context.input.charAt(context.offset++);
            }
            return _err;
          },
        };
      }
      case "Indent": {
        const inner = buildParser(expression.expression);
        return {
          parse(context) {
            if (context.offset >= context.input.length) {
              return _err;
            }
            const char = context.input.charAt(context.offset);
            if (char !== "\r" && char !== "\n") {
              return _err;
            }
            context.offset++;
            if (char === "\r" && context.offset < context.input.length && context.input.charAt(context.offset) === "\n") {
              context.offset++;
            }
            while (context.offset < context.input.length) {
              let scan = context.offset;
              while (scan < context.input.length && (context.input.charAt(scan) === " " || context.input.charAt(scan) === "\t")) {
                scan++;
              }
              if (scan < context.input.length && (context.input.charAt(scan) === "\n" || context.input.charAt(scan) === "\r")) {
                context.offset = scan + 1;
                if (context.input.charAt(scan) === "\r" && context.offset < context.input.length && context.input.charAt(context.offset) === "\n") {
                  context.offset++;
                }
                continue;
              }
              break;
            }
            const saved = context.offset;
            while (context.offset < context.input.length && (context.input.charAt(context.offset) === " " || context.input.charAt(context.offset) === "\t")) {
              context.offset++;
            }
            const next = context.offset - saved;
            if (next === 0) {
              return _err;
            }
            if (context.indentSize === undefined) {
              if (next === 0) return _err;
              context.indentSize = next;
            }
            if (next % context.indentSize !== 0) {
              return _err;
            }
            const nextLevel = next / context.indentSize;
            if (nextLevel <= context.indent[context.indent.length - 1]!) {
              return _err;
            }
            context.indent.push(nextLevel);
            context.indentKey += "," + nextLevel;
            const result = inner.parse(context);
            context.indent.pop();
            context.indentKey = context.indentKey.slice(0, context.indentKey.lastIndexOf(","));
            if (context.indent.length === 1) {
              context.indentSize = undefined;
            }
            return result;
          },
        };
      }
      case "Class": {
        const predicates: _PredicateParser[] = expression.predicates.map((predicate) => {
          switch (predicate.tag) {
            case "Equal": {
              const value = expression.insensitive ? predicate.value.toUpperCase() : predicate.value;
              return {
                match(v) {
                  return v === value;
                },
              };
            }
            case "Between": {
              const min = expression.insensitive ? predicate.min.toUpperCase() : predicate.min;
              const max = expression.insensitive ? predicate.max.toUpperCase() : predicate.max;
              return {
                match(v) {
                  return v >= min && v <= max;
                },
              };
            }
          }
        });
        return {
          parse(context) {
            if (context.offset >= context.input.length) {
              return _err;
            }
            const char = context.input.charAt(context.offset);
            const value = expression.insensitive ? char.toUpperCase() : char;
            if (predicates.some((p) => p.match(value)) !== !!expression.negation) {
              context.offset++;
              return char;
            }
            return _err;
          },
        };
      }
      case "Literal": {
        const length = expression.value.length;
        const value = expression.value;
        const upperValue = expression.insensitive ? value.toUpperCase() : value;
        return {
          parse(context) {
            if (context.offset + length > context.input.length) {
              return _err;
            }
            const substring = context.input.substring(context.offset, context.offset + length);
            if ((expression.insensitive ? substring.toUpperCase() : substring) === upperValue) {
              context.offset += length;
              return substring;
            }
            return _err;
          },
        };
      }
      case "Any": {
        return {
          parse(context) {
            if (context.offset < context.input.length) {
              return context.input.charAt(context.offset++);
            }
            return _err;
          },
        };
      }
    }
  };
  const rules = {} as Record<string, _RuleParser>;
  for (const rule of resolved.rules) {
    rules[rule.name] = {
      name: rule.name,
      type: rule.type,
      expression: buildParser(rule.expression),
      resultCount: rule.resultCount,
      isLeftRecursive: rule.isLeftRecursive,
      memoize: rule.memoize,
    };
  }
  const createContext = (input: string, options: ParseOptions): _ParseContext => {
    const stack: _StackFrame[] = [];
    const getLocation = (offset: number): Location => {
      let line = 1;
      let column = 1;
      for (let i = 0; i < offset; i++) {
        const char = input.charCodeAt(i);
        if (char === 13) {
          if (input.charCodeAt(i + 1) === 10) {
            i++;
          }
          line++;
          column = 1;
          continue;
        }
        if (char === 10) {
          line++;
          column = 1;
          continue;
        }
        column++;
      }
      return {
        file: options.file ?? "<unknown>",
        line,
        column,
        get preview() {
          return `${input.split(/\r\n|\r|\n/)[this.line - 1] ?? ""}\n${" ".repeat(this.column - 1)}^`;
        },
        toString() {
          return `${this.file}:${this.line}:${this.column}`;
        },
      };
    };
    let context!: _ParseContext;
    context = {
      input,
      offset: 0,
      indent: [0],
      indentKey: "0",
      indentSize: undefined,
      memo: {},
      stack,
      getLocation,
      parseRule(name) {
        return rules[name]!.parse!(context);
      },
    };
    for (const rule of Object.values(rules)) {
      if (rule.isLeftRecursive) {
        const name = rule.name;
        const expression = rule.expression;
        rule.parse = (context) => {
          const start = context.offset;
          const startIndentKey = context.indentKey;
          const ruleMemo = (context.memo[name] ??= {});
          const entry = ruleMemo[start]?.[startIndentKey];
          if (entry) {
            if (entry.growing) {
              const index = stack.findIndex((e) => e.name === name && e.start === start && e.indentKey === startIndentKey);
              if (index !== -1) {
                const owner = stack[index]!;
                owner.involved ??= new Set();
                for (let i = index + 1; i < stack.length; i++) {
                  owner.involved.add(stack[i]!.name);
                }
              }
            }
            context.offset = entry.offset;
            context.indent = entry.indent.slice();
            context.indentKey = entry.indentKey;
            context.indentSize = entry.indentSize;
            return entry.result;
          }
          const frame = { name, involved: null, start, indentKey: startIndentKey };
          stack.push(frame);
          let result: Value | _Err = _err;
          let endPos = start;
          (ruleMemo[start] ??= {})[startIndentKey] = {
            offset: start,
            indent: context.indent.slice(),
            indentKey: context.indentKey,
            indentSize: context.indentSize,
            result,
            growing: true,
          };
          while (true) {
            context.offset = start;
            const attempt = expression.parse(context);
            if (attempt === _err) break;
            const attemptEnd = context.offset;
            if (result !== _err && attemptEnd <= endPos) break;
            result = attempt;
            endPos = attemptEnd;
            (ruleMemo[start] ??= {})[startIndentKey] = {
              offset: endPos,
              indent: context.indent.slice(),
              indentKey: context.indentKey,
              indentSize: context.indentSize,
              result,
              growing: true,
            };
          }
          stack.pop();
          if (stack.some((e) => e.involved?.has(name))) {
            delete ruleMemo[start][startIndentKey];
          } else {
            (ruleMemo[start] ??= {})[startIndentKey] = {
              offset: endPos,
              indent: context.indent.slice(),
              indentKey: context.indentKey,
              indentSize: context.indentSize,
              result,
              growing: false,
            };
          }
          context.offset = endPos;
          return result;
        };
      } else if (!rule.memoize) {
        const expression = rule.expression;
        rule.parse = (context) => expression.parse(context);
      } else {
        const name = rule.name;
        const expression = rule.expression;
        rule.parse = (context) => {
          const start = context.offset;
          const startIndentKey = context.indentKey;
          const ruleMemo = (context.memo[name] ??= {});
          const entry = ruleMemo[start]?.[startIndentKey];
          if (entry) {
            context.offset = entry.offset;
            context.indent = entry.indent.slice();
            context.indentKey = entry.indentKey;
            context.indentSize = entry.indentSize;
            return entry.result;
          }
          const result = expression.parse(context);
          (ruleMemo[start] ??= {})[startIndentKey] = {
            offset: context.offset,
            indent: context.indent.slice(),
            indentKey: context.indentKey,
            indentSize: context.indentSize,
            result,
            growing: false,
          };
          return result;
        };
      }
    }
    return context;
  };
  return {
    rules,
    parse(input, options = {}) {
      const context = createContext(input, options);
      const result = context.parseRule(options.startRule ?? resolved.rules[0]!.name);
      if (result === _err || context.offset < input.length) {
        const location = context.getLocation(context.offset);
        throw new ParseError(`Unexpected ${context.offset < input.length ? JSON.stringify(input.charAt(context.offset)) : "end of file"} at ${location}\n\n${location.preview}`, location, 0);
      }
      return result;
    },
  };
};

// SECTION: emitJs
const emitJs = (grammar: ResolvedGrammar) => {
  const rulesByName = new Map(grammar.rules.map((rule) => [rule.name, rule]));
  const emitJsExpression = (expression: ResolvedExpression): string => {
    switch (expression.tag) {
      case "Choice": {
        let buffer = `${expression.result} = err`;
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitJsExpression(e)}
            if (${e.result} === err) {
              offset = ${expression.saved}
              ${buffer}
            } else {
              ${expression.result} = ${e.result}
            }
          `;
        }
        return `
          const ${expression.saved} = offset
          ${buffer}
        `;
      }
      case "Node": {
        const fields =
          expression.expression.tag === "Field"
            ? [
                {
                  name: expression.expression.name,
                  result: expression.expression.result,
                },
              ]
            : expression.expression.tag === "Sequence"
              ? expression.expression.expressions
                  .map((e) => {
                    if (e.tag !== "Field") {
                      return null;
                    }
                    return { name: e.name, result: e.result };
                  })
                  .filter((field) => field !== null)
              : [];
        return `
          const ${expression.saved} = offset
          ${emitJsExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            ${expression.result} = {
              tag: ${JSON.stringify(expression.name)},
              get location () {
                return getLocation(${expression.saved})
              },
              ${fields.map((field) => `${field.name}: ${field.result}`).join(", ")}
            }
          }
        `;
      }
      case "Sequence": {
        const extracts = expression.expressions.filter((e) => e.tag === "Extract");
        let buffer;
        if (extracts.length === 1) {
          buffer = `${expression.result} = ${extracts[0]!.result}`;
        } else if (extracts.length > 1) {
          buffer = `${expression.result} = [${extracts.map((extract) => extract.result).join(", ")}]`;
        } else {
          buffer = `${expression.result} = [${expression.expressions.map((e) => e.result).join(", ")}]`;
        }
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitJsExpression(e)}
            if (${e.result} === err) {
              ${expression.result} = err
            } else {
              ${buffer}
            }
          `;
        }
        return buffer;
      }
      case "Field":
      case "Extract": {
        return emitJsExpression(expression.expression);
      }
      case "Text": {
        return `
          const ${expression.saved} = offset
          ${emitJsExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            ${expression.result} = input.substring(${expression.saved}, offset)
          }
        `;
      }
      case "And": {
        return `
          const ${expression.saved} = offset
          ${emitJsExpression(expression.expression)}
          offset = ${expression.saved}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            ${expression.result} = null
          }
        `;
      }
      case "Not": {
        return `
          const ${expression.saved} = offset
          ${emitJsExpression(expression.expression)}
          offset = ${expression.saved}
          if (${expression.expression.result} === err) {
            ${expression.result} = null
          } else {
            ${expression.result} = err
          }
        `;
      }
      case "Optional": {
        return `
          const ${expression.saved} = offset
          ${emitJsExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            offset = ${expression.saved}
            ${expression.result} = null
          } else {
            ${expression.result} = ${expression.expression.result}
          }
        `;
      }
      case "Zero": {
        return `
          const ${expression.results} = []
          while (true) {
            const ${expression.saved} = offset
            ${emitJsExpression(expression.expression)}
            if (${expression.expression.result} === err) {
              offset = ${expression.saved}
              break
            }
            ${expression.results}.push(${expression.expression.result})
          }
          ${expression.result} = ${expression.results}
        `;
      }
      case "One": {
        return `
          ${emitJsExpression(expression.expression)}
          if (${expression.expression.result} === err) {
            ${expression.result} = err
          } else {
            const ${expression.results} = [${expression.expression.result}]
            while (true) {
              const ${expression.saved} = offset
              ${emitJsExpression(expression.expression)}
              if (${expression.expression.result} === err) {
                offset = ${expression.saved}
                break
              }
              ${expression.results}.push(${expression.expression.result})
            }
            ${expression.result} = ${expression.results}
          }
        `;
      }
      case "Repeat": {
        return `
          const ${expression.results} = []
          const ${expression.saved1} = offset
          let ${expression.count} = 0
          while (${expression.max === undefined ? "true" : `${expression.count} < ${expression.max}`}) {
            const ${expression.saved2} = offset
            ${
              expression.separator === undefined
                ? ""
                : `
              if (${expression.count} > 0) {
                ${emitJsExpression(expression.separator)}
                if (${expression.separator.result} === err) {
                  offset = ${expression.saved2}
                  break
                }
              }
            `
            }
            ${emitJsExpression(expression.expression)}
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
        `;
      }
      case "Reference": {
        const target = rulesByName.get(expression.name)!;
        if (!target.inlineable) {
          return `${expression.result} = parse${expression.name}()`;
        }
        const results = [...Array(target.resultCount).keys()].map((key) => `result${target.resultStart + key}`).join(", ");
        return `
          {
            let ${results}
            ${emitJsExpression(target.expression)}
            ${expression.result} = ${target.expression.result}
          }
        `;
      }
      case "Except": {
        return `
          const ${expression.saved} = offset
          ${emitJsExpression(expression.expression)}
          offset = ${expression.saved}
          if (${expression.expression.result} === err && offset < input.length) {
            ${expression.result} = input.charAt(offset++)
          } else {
            ${expression.result} = err
          }
        `;
      }
      case "Indent": {
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
                while (scan < input.length && (input.charAt(scan) === ' ' || input.charAt(scan) === '\\t')) {
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
              while (offset < input.length && (input.charAt(offset) === ' ' || input.charAt(offset) === '\\t')) {
                offset++
              }
              const next = offset - ${expression.saved}
              if (next === 0) {
                ${expression.result} = err
              } else {
                if (indentSize === undefined) {
                  indentSize = next
                }
                if (next % indentSize !== 0) {
                  ${expression.result} = err
                } else {
                  const nextLevel = next / indentSize
                  if (nextLevel > indent[indent.length - 1]) {
                    indent.push(nextLevel)
                    indentKey += ',' + nextLevel
                    ${emitJsExpression(expression.expression)}
                    indent.pop()
                    indentKey = indentKey.slice(0, indentKey.lastIndexOf(','))
                    if (indent.length === 1) {
                      indentSize = undefined
                    }
                    ${expression.result} = ${expression.expression.result}
                  } else {
                    ${expression.result} = err
                  }
                }
              }
            } else {
              ${expression.result} = err
            }
          } else {
            ${expression.result} = err
          }
        `;
      }
      case "Class": {
        const predicates = expression.predicates
          .map((predicate) => {
            const value = expression.insensitive ? "uppercased" : "value";
            switch (predicate.tag) {
              case "Equal":
                return `${value} === ${JSON.stringify(expression.insensitive ? predicate.value.toUpperCase() : predicate.value)}`;
              case "Between":
                return `(${value} >= ${JSON.stringify(expression.insensitive ? predicate.min.toUpperCase() : predicate.min)} && ${value} <= ${JSON.stringify(expression.insensitive ? predicate.max.toUpperCase() : predicate.max)})`;
            }
          })
          .join(" || ");
        return `
          if (offset < input.length) {
            const value = input.charAt(offset)
            ${expression.insensitive ? "const uppercased = value.toUpperCase()" : ""}
            if (${expression.negation ? "!" : ""}(${predicates})) {
              offset++
              ${expression.result} = value
            } else {
              ${expression.result} = err
            }
          } else {
            ${expression.result} = err
          }
        `;
      }
      case "Literal": {
        const length = expression.value.length;
        if (expression.insensitive) {
          const value = JSON.stringify(expression.value.toUpperCase());
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
          `;
        } else {
          const value = JSON.stringify(expression.value);
          return `
            if (input.startsWith(${value}, offset)) {
              offset += ${length}
              ${expression.result} = ${value}
            } else {
              ${expression.result} = err
            }
          `;
        }
      }
      case "Any": {
        return `
          if (offset < input.length) {
            ${expression.result} = input.charAt(offset++)
          } else {
            ${expression.result} = err
          }
        `;
      }
    }
  };
  const emitJsRule = (rule: ResolvedRule) => {
    const results = [...Array(rule.resultCount).keys()].map((key) => `result${rule.resultStart + key}`).join(", ");
    if (rule.inlineable) return "";
    if (!rule.memoize) {
      return `
        const parse${rule.name} = rules[${JSON.stringify(rule.name)}] = () => {
          let ${results}
          ${emitJsExpression(rule.expression)}
          return ${rule.expression.result}
        }
      `;
    }
    if (!rule.isLeftRecursive) {
      return `
        const parse${rule.name} = rules[${JSON.stringify(rule.name)}] = () => {
          const key = offset + '@' + indentKey
          const entry = cache.${rule.name}[key]
          if (entry) {
            offset = entry.offset
            indent = entry.indent.slice()
            indentKey = entry.indentKey
            indentSize = entry.indentSize
            return entry.result
          }
          let ${results}
          ${emitJsExpression(rule.expression)}
          cache.${rule.name}[key] = { offset, indent: indent.slice(), indentKey, indentSize, result: ${rule.expression.result} }
          return ${rule.expression.result}
        }
      `;
    }
    return `
      const parse${rule.name} = rules[${JSON.stringify(rule.name)}] = () => {
        const start = offset
    const key = start + '@' + indentKey
        const memo = cache.${rule.name}
        const entry = memo[key]
        if (entry) {
          if (entry.growing) {
            const index = stack.findIndex(e => e.key === key)
            if (index !== -1) {
              const owner = stack[index]
              owner.involved ??= new Set()
              for (let i = index + 1; i < stack.length; i++) {
                owner.involved.add(stack[i].name)
              }
            }
          }
          offset = entry.offset
          indent = entry.indent.slice()
          indentKey = entry.indentKey
          indentSize = entry.indentSize
          return entry.result
        }
        let ${results}
        const frame = { key, name: '${rule.name}', involved: null }
        stack.push(frame)
        let result = err
        let endPos = start
    memo[key] = { offset: start, indent: indent.slice(), indentKey, indentSize, result, growing: true }
        while (true) {
          offset = start
          ${emitJsExpression(rule.expression)}
          if (${rule.expression.result} === err) {
            break
          }
          const attemptEnd = offset
          if (result !== err && attemptEnd <= endPos) {
            break
          }
          result = ${rule.expression.result}
          endPos = attemptEnd
      memo[key] = { offset: endPos, indent: indent.slice(), indentKey, indentSize, result, growing: true }
        }
        stack.pop()
        if (stack.some(e => e.involved?.has('${rule.name}'))) {
          delete memo[key]
        } else {
      memo[key] = { offset: endPos, indent: indent.slice(), indentKey, indentSize, result, growing: false }
        }
        offset = endPos
        return result
      }
    `;
  };
  const rules = grammar.rules.map(emitJsRule).join("");
  const cache = grammar.rules.map((rule) => `${rule.name}: {}`).join(", ");
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
      const stack = []
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
      let indentKey = '0'
      let indentSize
      ${rules}
      const result = rules[options.startRule ?? ${JSON.stringify(grammar.rules[0]!.name)}]()
      if (result === err || offset < input.length) {
        const location = getLocation(offset)
        throw new ParseError(\`Unexpected \${offset < input.length ? JSON.stringify(input.charAt(offset)) : 'end of file'} at \${location}\\n\\n\${location.preview}\`, location)
      }
      return result
    }
    export { parse }
  `;
};

// SECTION: emitPhp
const emitPhp = (grammar: ResolvedGrammar, parserClassName = "Parser", errorClassName = "ParserError") => {
  const emitPhpExpression = (expression: ResolvedExpression): string => {
    switch (expression.tag) {
      case "Choice": {
        let buffer = `$${expression.result} = $this->err;`;
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitPhpExpression(e)}
            if ($${e.result} === $this->err) {
              $this->offset = $${expression.saved};
              ${buffer}
            } else {
              $${expression.result} = $${e.result};
            }
          `;
        }
        return `
          $${expression.saved} = $this->offset;
          ${buffer}
        `;
      }
      case "Node": {
        const fields =
          expression.expression.tag === "Field"
            ? [
                {
                  name: expression.expression.name,
                  result: expression.expression.result,
                },
              ]
            : expression.expression.tag === "Sequence"
              ? expression.expression.expressions
                  .map((e) => {
                    if (e.tag !== "Field") {
                      return null;
                    }
                    return { name: e.name, result: e.result };
                  })
                  .filter((field) => field !== null)
              : [];
        return `
          $${expression.saved} = $this->offset;
          ${emitPhpExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = [
              'tag' => ${JSON.stringify(expression.name)},
              'location' => $this->getLocation($${expression.saved}),
              ${fields.map((field) => `'${field.name}' => $${field.result}`).join(", ")}
            ];
          }
        `;
      }
      case "Sequence": {
        const extracts = expression.expressions.filter((e) => e.tag === "Extract");
        let buffer;
        if (extracts.length === 1) {
          buffer = `$${expression.result} = $${extracts[0]!.result};`;
        } else if (extracts.length > 1) {
          buffer = `$${expression.result} = [${extracts.map((extract) => `$${extract.result}`).join(", ")}];`;
        } else {
          buffer = `$${expression.result} = [${expression.expressions.map((e) => `$${e.result}`).join(", ")}];`;
        }
        for (const e of expression.expressions.toReversed()) {
          buffer = `
            ${emitPhpExpression(e)}
            if ($${e.result} === $this->err) {
              $${expression.result} = $this->err;
            } else {
              ${buffer}
            }
          `;
        }
        return buffer;
      }
      case "Field":
      case "Extract": {
        return emitPhpExpression(expression.expression);
      }
      case "Text": {
        return `
          $${expression.saved} = $this->offset;
          ${emitPhpExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = substr($this->input, $${expression.saved}, $this->offset - $${expression.saved});
          }
        `;
      }
      case "And": {
        return `
          $${expression.saved} = $this->offset;
          ${emitPhpExpression(expression.expression)}
          $this->offset = $${expression.saved};
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.result} = null;
          }
        `;
      }
      case "Not": {
        return `
          $${expression.saved} = $this->offset;
          ${emitPhpExpression(expression.expression)}
          $this->offset = $${expression.saved};
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = null;
          } else {
            $${expression.result} = $this->err;
          }
        `;
      }
      case "Optional": {
        return `
          $${expression.saved} = $this->offset;
          ${emitPhpExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $this->offset = $${expression.saved};
            $${expression.result} = null;
          } else {
            $${expression.result} = $${expression.expression.result};
          }
        `;
      }
      case "Zero": {
        return `
          $${expression.results} = [];
          while (true) {
            $${expression.saved} = $this->offset;
            ${emitPhpExpression(expression.expression)}
            if ($${expression.expression.result} === $this->err) {
              $this->offset = $${expression.saved};
              break;
            }
            array_push($${expression.results}, $${expression.expression.result});
          }
          $${expression.result} = $${expression.results};
        `;
      }
      case "One": {
        return `
          ${emitPhpExpression(expression.expression)}
          if ($${expression.expression.result} === $this->err) {
            $${expression.result} = $this->err;
          } else {
            $${expression.results} = [$${expression.expression.result}];
            while (true) {
              $${expression.saved} = $this->offset;
              ${emitPhpExpression(expression.expression)}
              if ($${expression.expression.result} === $this->err) {
                $this->offset = $${expression.saved};
                break;
              }
              array_push($${expression.results}, $${expression.expression.result});
            }
            $${expression.result} = $${expression.results};
          }
        `;
      }
      case "Repeat": {
        return `
          $${expression.results} = [];
          $${expression.saved1} = $this->offset;
          $${expression.count} = 0;
          while (${expression.max === undefined ? "true" : `$${expression.count} < ${expression.max}`}) {
            $${expression.saved2} = $this->offset;
            ${
              expression.separator === undefined
                ? ""
                : `
              if ($${expression.count} > 0) {
                ${emitPhpExpression(expression.separator)}
                if ($${expression.separator.result} === $this->err) {
                  $this->offset = $${expression.saved2};
                  break;
                }
              }
            `
            }
            ${emitPhpExpression(expression.expression)}
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
        `;
      }
      case "Reference": {
        return `$${expression.result} = $this->parse${expression.name}();`;
      }
      case "Except": {
        return `
          $${expression.saved} = $this->offset;
          ${emitPhpExpression(expression.expression)}
          $this->offset = $${expression.saved};
          if ($${expression.expression.result} === $this->err && $this->offset < strlen($this->input)) {
            $${expression.result} = $this->input[$this->offset++];
          } else {
            $${expression.result} = $this->err;
          }
        `;
      }
      case "Indent": {
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
                while ($scan < strlen($this->input) && ($this->input[$scan] === ' ' || $this->input[$scan] === "\\t")) {
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
              while ($this->offset < strlen($this->input) && ($this->input[$this->offset] === ' ' || $this->input[$this->offset] === "\\t")) {
                $this->offset++;
              }
              $next = $this->offset - $${expression.saved};
              if ($next === 0) {
                $${expression.result} = $this->err;
              } else {
                if ($this->indentSize === null) {
                  $this->indentSize = $next;
                }
                if ($next % $this->indentSize !== 0) {
                  $${expression.result} = $this->err;
                } else {
                  $nextLevel = $next / $this->indentSize;
                  if ($nextLevel > $this->indent[count($this->indent) - 1]) {
                    array_push($this->indent, $nextLevel);
                    ${emitPhpExpression(expression.expression)}
                    array_pop($this->indent);
                    if (count($this->indent) === 1) {
                      $this->indentSize = null;
                    }
                    $${expression.result} = $${expression.expression.result};
                  } else {
                    $${expression.result} = $this->err;
                  }
                }
              }
            } else {
              $${expression.result} = $this->err;
            }
          } else {
            $${expression.result} = $this->err;
          }
        `;
      }
      case "Class": {
        const predicates = expression.predicates
          .map((predicate) => {
            const value = expression.insensitive ? "uppercased" : "value";
            switch (predicate.tag) {
              case "Equal":
                return `$${value} === ${JSON.stringify(expression.insensitive ? predicate.value.toUpperCase() : predicate.value)}`;
              case "Between":
                return `($${value} >= ${JSON.stringify(expression.insensitive ? predicate.min.toUpperCase() : predicate.min)} && $${value} <= ${JSON.stringify(expression.insensitive ? predicate.max.toUpperCase() : predicate.max)})`;
            }
          })
          .join(" || ");
        return `
          if ($this->offset < strlen($this->input)) {
            $value = $this->input[$this->offset];
            ${expression.insensitive ? "$uppercased = strtoupper($value);" : ""}
            if (${expression.negation ? "!" : ""}(${predicates})) {
              $this->offset++;
              $${expression.result} = $value;
            } else {
              $${expression.result} = $this->err;
            }
          } else {
            $${expression.result} = $this->err;
          }
        `;
      }
      case "Literal": {
        const length = expression.value.length;
        const value = JSON.stringify(expression.value).replace(/\$/g, "\\$"); // "${" <-- error
        return `
          if (substr_compare($this->input, ${value}, $this->offset, ${length}, ${!!expression.insensitive}) === 0) {
            $${expression.result} = substr($this->input, $this->offset, ${length});
            $this->offset += ${length};
          } else {
            $${expression.result} = $this->err;
          }
        `;
      }
      case "Any": {
        return `
          if ($this->offset < strlen($this->input)) {
            $${expression.result} = $this->input[$this->offset++];
          } else {
            $${expression.result} = $this->err;
          }
        `;
      }
    }
  };
  const emitPhpRule = (rule: ResolvedRule) => {
    if (!rule.isLeftRecursive) {
      return `
        private function parse${rule.name}() {
          $key = $this->offset . '@' . implode(',', $this->indent);
          $entry = @$this->cache['${rule.name}'][$key];
          if ($entry) {
            $this->offset = $entry['offset'];
            $this->indent = $entry['indent'];
            $this->indentSize = $entry['indentSize'];
            return $entry['result'];
          }
          ${emitPhpExpression(rule.expression)}
          $this->cache['${rule.name}'][$key] = ['offset' => $this->offset, 'indent' => $this->indent, 'indentSize' => $this->indentSize, 'result' => $${rule.expression.result}];
          return $${rule.expression.result};
        }
      `;
    }
    return `
      private function parse${rule.name}() {
        $start = $this->offset;
        $key = $start . '@' . implode(',', $this->indent);
        $entry = @$this->cache['${rule.name}'][$key];
        if ($entry) {
          if ($entry['growing']) {
            foreach ($this->stack as $i => &$frame) {
              if ($frame['key'] === $key) {
                $frame['involved'] ??= [];
                for ($j = $i + 1; $j < count($this->stack); $j++) {
                  $frame['involved'][$this->stack[$j]['name']] = true;
                }
                break;
              }
            }
          }
          $this->offset = $entry['offset'];
          $this->indent = $entry['indent'];
          $this->indentSize = $entry['indentSize'];
          return $entry['result'];
        }
        $frame = ['key' => $key, 'name' => '${rule.name}', 'involved' => null];
        $this->stack[] = $frame;
        $result = $this->err;
        $endPos = $start;
        $this->cache['${rule.name}'][$key] = ['offset' => $start, 'indent' => $this->indent, 'indentSize' => $this->indentSize, 'result' => $result, 'growing' => true];
        while (true) {
          $this->offset = $start;
          ${emitPhpExpression(rule.expression)}
          if ($${rule.expression.result} === $this->err) {
            break;
          }
          $attemptEnd = $this->offset;
          if ($result !== $this->err && $attemptEnd <= $endPos) {
            break;
          }
          $result = $${rule.expression.result};
          $endPos = $attemptEnd;
          $this->cache['${rule.name}'][$key] = ['offset' => $endPos, 'indent' => $this->indent, 'indentSize' => $this->indentSize, 'result' => $result, 'growing' => true];
        }
        array_pop($this->stack);
        $deleteMemo = false;
        foreach ($this->stack as $f) {
          if ($f['involved'] && isset($f['involved']['${rule.name}'])) {
            $deleteMemo = true;
            break;
          }
        }
        if ($deleteMemo) {
          unset($this->cache['${rule.name}'][$key]);
        } else {
          $this->cache['${rule.name}'][$key] = ['offset' => $endPos, 'indent' => $this->indent, 'indentSize' => $this->indentSize, 'result' => $result, 'growing' => false];
        }
        $this->offset = $endPos;
        return $result;
      }
    `;
  };
  const rules = grammar.rules.map(emitPhpRule).join("");
  return `
    class ${errorClassName} extends RuntimeException {
      public $location;
      function __construct($message, $location) {
        parent::__construct($message);
        $this->location = $location;
      }
    }
    class ${parserClassName} {
      private $err;
      private $input;
      private $file;
      private $offset;
      private $indent;
      private $indentSize;
      private $cache;
      private $stack;
      function __construct() {
        $this->err = new stdClass();
        $this->stack = [];
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
        $this->indentSize = null;
        $result = $this->{'parse' . ($startRule ?? '${grammar.rules[0]?.name}')}();
        if ($result === $this->err || $this->offset < strlen($input)) {
          $location = $this->getLocation($this->offset);
          $unexpected = $this->offset < strlen($input) ? json_encode($input[$this->offset], JSON_UNESCAPED_SLASHES) : 'end of file';
          $locationString = ($location['toString'])();
          $locationPreview = ($location['preview'])();
          throw new ${errorClassName}("Unexpected $unexpected at $locationString\\n\\n$locationPreview", $location);
        }
        return $result;
      }
    }
  `;
};

// SECTION: packratGrammar
const packratGrammar: Grammar = {
  rules: [
    {
      name: "Grammar",
      expression: {
        tag: "Node",
        name: "Grammar",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "rules",
              expression: {
                tag: "Repeat",
                min: 1,
                expression: { tag: "Reference", name: "Rule" },
                separator: { tag: "Reference", name: "_" },
              },
            },
            { tag: "Reference", name: "_" },
          ],
        },
      },
    },
    {
      name: "Rule",
      expression: {
        tag: "Node",
        name: "Rule",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "name",
              expression: { tag: "Reference", name: "Id" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "=" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Expression" },
            },
          ],
        },
      },
    },
    {
      name: "Expression",
      expression: { tag: "Reference", name: "Choice" },
    },
    {
      name: "Choice",
      expression: {
        tag: "Choice",
        expressions: [
          {
            tag: "Node",
            name: "Choice",
            expression: {
              tag: "Field",
              name: "expressions",
              expression: {
                tag: "Repeat",
                expression: { tag: "Reference", name: "Node" },
                min: 2,
                separator: {
                  tag: "Sequence",
                  expressions: [
                    { tag: "Reference", name: "_" },
                    { tag: "Literal", value: "/" },
                    { tag: "Reference", name: "_" },
                  ],
                },
              },
            },
          },
          { tag: "Reference", name: "Node" },
        ],
      },
    },
    {
      name: "Node",
      expression: {
        tag: "Choice",
        expressions: [
          {
            tag: "Node",
            name: "Node",
            expression: {
              tag: "Sequence",
              expressions: [
                {
                  tag: "Field",
                  name: "expression",
                  expression: { tag: "Reference", name: "Sequence" },
                },
                { tag: "Reference", name: "_" },
                { tag: "Literal", value: "->" },
                { tag: "Reference", name: "_" },
                {
                  tag: "Field",
                  name: "name",
                  expression: { tag: "Reference", name: "Id" },
                },
              ],
            },
          },
          { tag: "Reference", name: "Sequence" },
        ],
      },
    },
    {
      name: "Sequence",
      expression: {
        tag: "Choice",
        expressions: [
          {
            tag: "Node",
            name: "Sequence",
            expression: {
              tag: "Field",
              name: "expressions",
              expression: {
                tag: "Repeat",
                expression: { tag: "Reference", name: "Select" },
                min: 2,
                separator: { tag: "Reference", name: "__" },
              },
            },
          },
          { tag: "Reference", name: "Select" },
        ],
      },
    },
    {
      name: "Select",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Reference", name: "Field" },
          { tag: "Reference", name: "Extract" },
          { tag: "Reference", name: "Prefix" },
        ],
      },
    },
    {
      name: "Field",
      expression: {
        tag: "Node",
        name: "Field",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "name",
              expression: { tag: "Reference", name: "Id" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: ":" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Prefix" },
            },
          ],
        },
      },
    },
    {
      name: "Extract",
      expression: {
        tag: "Node",
        name: "Extract",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: "^" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Prefix" },
            },
          ],
        },
      },
    },
    {
      name: "Prefix",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Reference", name: "Text" },
          { tag: "Reference", name: "And" },
          { tag: "Reference", name: "Not" },
          { tag: "Reference", name: "Postfix" },
        ],
      },
    },
    {
      name: "Text",
      expression: {
        tag: "Node",
        name: "Text",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: "$" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Postfix" },
            },
          ],
        },
      },
    },
    {
      name: "And",
      expression: {
        tag: "Node",
        name: "And",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: "&" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Postfix" },
            },
          ],
        },
      },
    },
    {
      name: "Not",
      expression: {
        tag: "Node",
        name: "Not",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: "!" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Postfix" },
            },
          ],
        },
      },
    },
    {
      name: "Postfix",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Reference", name: "Optional" },
          { tag: "Reference", name: "Zero" },
          { tag: "Reference", name: "One" },
          { tag: "Reference", name: "Repeat" },
          { tag: "Reference", name: "Primary" },
        ],
      },
    },
    {
      name: "Optional",
      expression: {
        tag: "Node",
        name: "Optional",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Primary" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "?" },
          ],
        },
      },
    },
    {
      name: "Zero",
      expression: {
        tag: "Node",
        name: "Zero",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Primary" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "*" },
          ],
        },
      },
    },
    {
      name: "One",
      expression: {
        tag: "Node",
        name: "One",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Primary" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "+" },
          ],
        },
      },
    },
    {
      name: "Repeat",
      expression: {
        tag: "Node",
        name: "Repeat",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Primary" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "{" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "min",
              expression: { tag: "Reference", name: "Number" },
            },
            {
              tag: "Field",
              name: "max",
              expression: {
                tag: "Optional",
                expression: { tag: "Reference", name: "RepeatMax" },
              },
            },
            {
              tag: "Field",
              name: "separator",
              expression: {
                tag: "Optional",
                expression: { tag: "Reference", name: "RepeatSeparator" },
              },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "}" },
          ],
        },
      },
    },
    {
      name: "RepeatMax",
      expression: {
        tag: "Sequence",
        expressions: [
          { tag: "Reference", name: "_" },
          { tag: "Literal", value: "," },
          { tag: "Reference", name: "_" },
          {
            tag: "Extract",
            expression: { tag: "Reference", name: "Number" },
          },
        ],
      },
    },
    {
      name: "RepeatSeparator",
      expression: {
        tag: "Sequence",
        expressions: [
          { tag: "Reference", name: "_" },
          { tag: "Literal", value: ";" },
          { tag: "Reference", name: "_" },
          {
            tag: "Extract",
            expression: { tag: "Reference", name: "Expression" },
          },
        ],
      },
    },
    {
      name: "Number",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Literal", value: "0" },
          {
            tag: "Text",
            expression: {
              tag: "Sequence",
              expressions: [
                {
                  tag: "Class",
                  predicates: [{ tag: "Between", min: "1", max: "9" }],
                },
                {
                  tag: "Zero",
                  expression: {
                    tag: "Class",
                    predicates: [{ tag: "Between", min: "0", max: "9" }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      name: "Primary",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Reference", name: "Reference" },
          { tag: "Reference", name: "Except" },
          { tag: "Reference", name: "Indent" },
          { tag: "Reference", name: "Class" },
          { tag: "Reference", name: "Literal" },
          { tag: "Reference", name: "Any" },
          { tag: "Reference", name: "Group" },
        ],
      },
    },
    {
      name: "Except",
      expression: {
        tag: "Node",
        name: "Except",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: "~" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Primary" },
            },
          ],
        },
      },
    },
    {
      name: "Indent",
      expression: {
        tag: "Node",
        name: "Indent",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: ">>" },
            { tag: "Reference", name: "_" },
            {
              tag: "Field",
              name: "expression",
              expression: { tag: "Reference", name: "Expression" },
            },
            { tag: "Reference", name: "_" },
            { tag: "Literal", value: "<<" },
          ],
        },
      },
    },
    {
      name: "Group",
      expression: {
        tag: "Sequence",
        expressions: [
          { tag: "Literal", value: "(" },
          { tag: "Reference", name: "_" },
          {
            tag: "Extract",
            expression: { tag: "Reference", name: "Expression" },
          },
          { tag: "Reference", name: "_" },
          { tag: "Literal", value: ")" },
        ],
      },
    },
    {
      name: "Reference",
      expression: {
        tag: "Node",
        name: "Reference",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "name",
              expression: { tag: "Reference", name: "Id" },
            },
            {
              tag: "Not",
              expression: {
                tag: "Sequence",
                expressions: [
                  { tag: "Reference", name: "_" },
                  { tag: "Literal", value: "=" },
                ],
              },
            },
          ],
        },
      },
    },
    {
      name: "Id",
      expression: {
        tag: "Text",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Class",
              predicates: [
                { tag: "Between", min: "a", max: "z" },
                { tag: "Equal", value: "_" },
              ],
              insensitive: true,
            },
            {
              tag: "Zero",
              expression: {
                tag: "Class",
                predicates: [
                  { tag: "Between", min: "a", max: "z" },
                  { tag: "Between", min: "0", max: "9" },
                  { tag: "Equal", value: "_" },
                ],
                insensitive: true,
              },
            },
          ],
        },
      },
    },
    {
      name: "Class",
      expression: {
        tag: "Node",
        name: "Class",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: "[" },
            {
              tag: "Field",
              name: "negation",
              expression: {
                tag: "Optional",
                expression: { tag: "Literal", value: "^" },
              },
            },
            {
              tag: "Field",
              name: "predicates",
              expression: {
                tag: "Zero",
                expression: { tag: "Reference", name: "ClassItem" },
              },
            },
            { tag: "Literal", value: "]" },
            {
              tag: "Field",
              name: "insensitive",
              expression: {
                tag: "Optional",
                expression: { tag: "Literal", value: "i" },
              },
            },
          ],
        },
      },
    },
    {
      name: "ClassItem",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Reference", name: "Between" },
          { tag: "Reference", name: "Equal" },
        ],
      },
    },
    {
      name: "Between",
      expression: {
        tag: "Node",
        name: "Between",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "min",
              expression: { tag: "Reference", name: "PredicateItem" },
            },
            { tag: "Literal", value: "-" },
            {
              tag: "Field",
              name: "max",
              expression: { tag: "Reference", name: "PredicateItem" },
            },
          ],
        },
      },
    },
    {
      name: "Equal",
      expression: {
        tag: "Node",
        name: "Equal",
        expression: {
          tag: "Field",
          name: "value",
          expression: { tag: "Reference", name: "PredicateItem" },
        },
      },
    },
    {
      name: "PredicateItem",
      expression: {
        tag: "Choice",
        expressions: [
          {
            tag: "Text",
            expression: {
              tag: "Sequence",
              expressions: [{ tag: "Literal", value: "\\" }, { tag: "Any" }],
            },
          },
          {
            tag: "Except",
            expression: { tag: "Literal", value: "]" },
          },
        ],
      },
    },
    {
      name: "Literal",
      expression: {
        tag: "Node",
        name: "Literal",
        expression: {
          tag: "Sequence",
          expressions: [
            {
              tag: "Field",
              name: "value",
              expression: { tag: "Reference", name: "String" },
            },
            {
              tag: "Field",
              name: "insensitive",
              expression: {
                tag: "Optional",
                expression: { tag: "Literal", value: "i" },
              },
            },
          ],
        },
      },
    },
    {
      name: "String",
      expression: {
        tag: "Text",
        expression: {
          tag: "Sequence",
          expressions: [
            { tag: "Literal", value: '"' },
            {
              tag: "Extract",
              expression: {
                tag: "Text",
                expression: {
                  tag: "Zero",
                  expression: { tag: "Reference", name: "StringItem" },
                },
              },
            },
            { tag: "Literal", value: '"' },
          ],
        },
      },
    },
    {
      name: "StringItem",
      expression: {
        tag: "Choice",
        expressions: [
          {
            tag: "Sequence",
            expressions: [{ tag: "Literal", value: "\\" }, { tag: "Any" }],
          },
          {
            tag: "Except",
            expression: { tag: "Literal", value: '"' },
          },
        ],
      },
    },
    {
      name: "Any",
      expression: {
        tag: "Node",
        name: "Any",
        expression: { tag: "Literal", value: "." },
      },
    },
    {
      name: "_",
      expression: {
        tag: "Zero",
        expression: { tag: "Reference", name: "Space" },
      },
    },
    {
      name: "__",
      expression: {
        tag: "One",
        expression: { tag: "Reference", name: "Space" },
      },
    },
    {
      name: "Space",
      expression: {
        tag: "Choice",
        expressions: [
          { tag: "Reference", name: "WhiteSpace" },
          { tag: "Reference", name: "SingleLineComment" },
          { tag: "Reference", name: "MultiLineComment" },
        ],
      },
    },
    {
      name: "WhiteSpace",
      expression: {
        tag: "One",
        expression: {
          tag: "Class",
          predicates: [
            { tag: "Equal", value: " " },
            { tag: "Equal", value: "\t" },
            { tag: "Equal", value: "\r" },
            { tag: "Equal", value: "\n" },
          ],
        },
      },
    },
    {
      name: "SingleLineComment",
      expression: {
        tag: "Sequence",
        expressions: [
          { tag: "Literal", value: "//" },
          {
            tag: "Zero",
            expression: {
              tag: "Except",
              expression: {
                tag: "Class",
                predicates: [
                  { tag: "Equal", value: "\r" },
                  { tag: "Equal", value: "\n" },
                ],
              },
            },
          },
        ],
      },
    },
    {
      name: "MultiLineComment",
      expression: {
        tag: "Sequence",
        expressions: [
          { tag: "Literal", value: "/*" },
          {
            tag: "Zero",
            expression: {
              tag: "Except",
              expression: { tag: "Literal", value: "*/" },
            },
          },
          { tag: "Literal", value: "*/" },
        ],
      },
    },
  ],
};

const resolvedPackratGrammar = resolveGrammar(packratGrammar);
const grammarCache = new Map<string, ResolvedGrammar>();

const getResolvedGrammar = (grammarText: string): ResolvedGrammar => {
  if (grammarCache.has(grammarText)) {
    return grammarCache.get(grammarText)!;
  }
  const grammar = resolveGrammar(parseGrammar(evaluateGrammar(resolvedPackratGrammar, grammarText)));
  grammarCache.set(grammarText, grammar);
  return grammar;
};

// SECTION: createPhpWorker
type PhpWorker = {
  eval: (phpCode: string) => Promise<any>;
  close: () => void;
};

const phpWorkerLoop = `$stdin = fopen('php://stdin', 'r');
$lastId = null;
register_shutdown_function(function () use (&$lastId) {
  $error = error_get_last();
  if ($error !== null && $lastId !== null) {
    echo json_encode(['jsonrpc' => '2.0', 'id' => $lastId, 'error' => ['code' => -32603, 'message' => $error['message']]]) . "\\n";
    fflush(STDOUT);
  }
});
while (($line = fgets($stdin)) !== false) {
  $line = trim($line);
  if ($line === '') continue;
  $request = json_decode($line, true);
  if (!is_array($request)) continue;
  $id = $request['id'] ?? null;
  $lastId = $id;
  $code = preg_replace('/^\\s*<\\?php\\s*/', '', $request['params']['code'] ?? '');
  $code = preg_replace('/\\?>\\s*$/', '', $code);
  ob_start();
  try {
    eval($code);
    $result = ob_get_clean();
  } catch (Throwable $e) {
    ob_end_clean();
    echo json_encode(['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => -32603, 'message' => $e->getMessage()]]) . "\\n";
    fflush(STDOUT);
    continue;
  }
  echo json_encode(['jsonrpc' => '2.0', 'id' => $id, 'result' => $result]) . "\\n";
  fflush(STDOUT);
}
`;

const createPhpWorker = (phpBinary: string = "php"): PhpWorker => {
  const proc = Bun.spawn([phpBinary, "-r", phpWorkerLoop], {
    stdin: "pipe",
    stdout: "pipe",
  });
  let nextId = 0;
  const pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>();
  let buffer = "";
  const readStdout = async () => {
    for await (const chunk of proc.stdout) {
      buffer += Buffer.from(chunk).toString();
      let index;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line === "") continue;
        let response: { id: number; result?: any; error?: { message: string } };
        try {
          response = JSON.parse(line);
        } catch {
          continue;
        }
        const entry = pending.get(response.id);
        if (entry) {
          pending.delete(response.id);
          if (response.error) {
            entry.reject(new Error(response.error.message));
          } else {
            entry.resolve(response.result);
          }
        }
      }
    }
    const error = new Error("PHP worker closed unexpectedly");
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };
  readStdout();
  return {
    eval: async (phpCode: string) => {
      const id = nextId++;
      const promise = new Promise<any>((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      await proc.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "eval",
          params: { code: phpCode },
        }) + "\n",
      );
      return promise;
    },
    close: () => {
      proc.stdin.end();
      proc.kill();
    },
  };
};

let phpWorker: PhpWorker | undefined = undefined;
let classCounter = 0;

// SECTION: packrat
const packrat = async (input: TemplateStringsArray | string): Promise<(input: string, options?: ParseOptions) => Promise<Value>> => {
  const grammarText = typeof input === "string" ? input : input.join("");
  if (import.meta.env.MODE === "php") {
    const id = ++classCounter;
    const parser = emitPhp(getResolvedGrammar(grammarText), `Parser${id}`, `ParserError${id}`);
    if (!phpWorker) {
      phpWorker = createPhpWorker();
    }
    await phpWorker.eval(`<?php\n${parser}`);
    return async (input: string, options: ParseOptions = {}) => {
      const php = `<?php
      $parser = new Parser${id}();
      $in = json_decode(<<<'JSON'
${JSON.stringify({ input, startRule: options.startRule, file: options.file })}
JSON
, true);
      echo json_encode($parser->parse($in['input'], startRule: $in['startRule'] ?? null, file: $in['file'] ?? null));
      `;
      return JSON.parse((await phpWorker?.eval(php)) as unknown as string);
    };
  }
  if (import.meta.env.MODE === "js") {
    const parser = emitJs(getResolvedGrammar(grammarText));
    return async (input: string, options: ParseOptions = {}) => {
      const js = `
        ${parser}
        const options = ${JSON.stringify(options)}
        try {
          console.log(JSON.stringify(parse(${JSON.stringify(input)}, options)))
        } catch (e) {
          console.log(JSON.stringify({ __error: true, message: e.message }))
        }
      `;
      const out = Bun.spawnSync(["bun", "-"], {
        stdin: Buffer.from(js),
      }).stdout.toString();
      const result = JSON.parse(out);
      if (result?.__error) {
        throw new Error(result.message);
      }
      return result;
    };
  }
  const grammar = getResolvedGrammar(grammarText);
  return async (input: string, options: ParseOptions = {}) => {
    return evaluateGrammar(grammar, input, options);
  };
};

const stringifyGrammarTypes = (grammar: ResolvedGrammar): string => {
  const stringifyType = (type: Type): string => {
    switch (type.tag) {
      case "Recursion":
        return "unknown";
      case "Null":
        return "null";
      case "String":
        return "string";
      case "Array":
        if (type.element.tag !== "Union" && type.element.tag !== "Array") {
          return stringifyType(type.element) + "[]";
        }
        return `(${stringifyType(type.element)})[]`;
      case "Node": {
        return type.name;
      }
      case "Union":
        return type.types
          .toSorted((a, b) => {
            if (a.tag === "Node" && b.tag === "Node") {
              return a.name.localeCompare(b.name);
            }
            return a.tag.localeCompare(b.tag);
          })
          .map(stringifyType)
          .join(" | ");
    }
  };
  return grammar.rules.map((rule) => `${rule.name}: ${stringifyType(rule.type)}`).join("\n");
};

// console.log(stringifyGrammarTypes(resolvedPackratGrammar))

export { buildGrammar, createPhpWorker, emitJs, evaluateGrammar, isNode, packrat, packratGrammar, ParseError, parseGrammar, resolveGrammar, type Location, type Node, type Value as Ok };
