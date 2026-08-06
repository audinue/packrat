cd /Users/glend/Documents/packrat && bun -e '
import { packrat } from "./packrat"
import { readFileSync } from "node:fs"
const parser = await packrat(await readFileSync("examples/typescript.packrat", "utf-8"))

const t = `const evaluateRule = (name: string): Value | Err => {
    const start = offset;
    const key = start + "@" + indentKey;
    const memo = cache[name]!;
    const entry = memo[key];
    if (entry) {
      if (entry.growing) {
        const index = stack.findIndex((e) => e.key === key);
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
      // if (options.trace) {
      //   const tag = entry.result === err ? "ERR" : "OK";
      //   console.log(
      //     "  ".repeat(stack.length) + ``[\${name}]``,
      //     "CACHE",
      //     tag,
      //     ``@\${start}→\${offset}``,
      //     entry.result === err ? "" : JSON.stringify(entry.result).slice(0, 60),
      //   );
      // }
      if (offset > rightmostOffset) rightmostOffset = offset;
      return entry.result;
    }
    const rule = rules[name]!;
    if (options.trace)
      console.log(
        "  ".repeat(stack.length) + ``[\${name}]``,
        "ENTER",
        ``@\${start}``,
      );
    if (!rule.memoize) {
      const result = evaluateExpression(rule.expression);
      // if (options.trace) {
      //   const tag = result === err ? "ERR" : "OK";
      //   console.log(
      //     "  ".repeat(stack.length) + ``[\${name}]``,
      //     tag,
      //     ``@\${start}→\${offset}``,
      //     result === err ? "" : JSON.stringify(result).slice(0, 60),
      //   );
      // }
      if (offset > rightmostOffset) rightmostOffset = offset;
      return result;
    }
    if (!rule.isLeftRecursive) {
      const result = evaluateExpression(rule.expression);
      memo[key] = {
        offset,
        indent: indent.slice(),
        indentKey,
        indentSize,
        result,
        growing: false,
      };
      if (options.trace) {
        const tag = result === err ? "ERR" : "OK";
        console.log(
          "  ".repeat(stack.length) + ``[\${name}]``,
          tag,
          ``@\${start}→\${offset}``,
          result === err ? "" : JSON.stringify(result).slice(0, 60),
        );
      }
      if (offset > rightmostOffset) rightmostOffset = offset;
      return result;
    }
    const frame = { key, name, involved: null };
    stack.push(frame);
    let result: Value | Err = err;
    let endPos = start;
    memo[key] = {
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
      memo[key] = {
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
      delete memo[key];
    } else {
      memo[key] = {
        offset: endPos,
        indent: indent.slice(),
        indentKey,
        indentSize,
        result,
        growing: false,
      };
    }
    offset = endPos;
    if (options.trace) {
      const tag = result === err ? "ERR" : "OK";
      console.log(
        "  ".repeat(stack.length) + ``[\${name}]``,
        tag,
        ``@\${start}→\${offset}``,
        result === err ? "" : JSON.stringify(result).slice(0, 60),
      );
    }
    if (offset > rightmostOffset) rightmostOffset = offset;
    return result;
  };`
try { const r = await parser(t, { trace: true }); console.log("OK!") } catch(e) {
  console.log("FAIL:", e.message.slice(0, 200))
  console.log("rightmost:", e.rightmostOffset)
}
' 2>&1