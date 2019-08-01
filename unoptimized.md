## Choice
```js
savedEnd = end
// expressionA
if (result == error) {
  end = savedEnd
  // expressionB
  if (result == error) {
    end = savedEnd
    // expressionC
  }
}
```

## Action
```js
savedEnd = end
// expression
if (result != error && capturing) {
  begin = savedEnd
  result = map()
}
```

## Type
```js
savedEnd = end
// expression
if (result != error && capturing) {
  begin = savedEnd
  result = {type: 'Name', location: location()}
}
```

## Sequence
```js
// expressionA
if (resultA != error) {
  // expressionB
  if (resultB != error) {
    // expressionC
    if (resultC != error) {
      if (capturing) {
        result = [resultA, resultB, resultC]
      } else {
        result = ''
      }
    } else {
      result = error
    }
  } else {
    result = error
  }
} else {
  result = error
}
```

## Empty
```js
savedCapturing = capturing
capturing = false
// expression
capturing = savedCapturing
```

## Text
```js
savedEnd = end
savedCapturing = capturing
capturing = false
// expression
capturing = savedCapturing
if (result != error && capturing) {
  result = substring(savedEnd, end)
}
```

## And
```
savedEnd = end
savedCapturing = capturing
savedReporting = reporting
capturing = false
reporting = false
// expression
end = savedEnd
capturing = savedCapturing
reporting = savedReporting
```

## Not
```
savedEnd = end
savedCapturing = capturing
savedReporting = reporting
capturing = false
reporting = false
// expression
end = savedEnd
capturing = savedCapturing
reporting = savedReporting
result = result == error ? empty : error
```

## Optional
```js
savedEnd = end
// expression
if (result == error) {
  end = savedEnd
  result = null
}
```

## Zero
```js
if (capturing) {
  list = []
  while (true) {
    savedEnd = end
    // expression
    if (result == error) {
      end = savedEnd
      result = list
      break
    } else {
      list.push(result)
    }
  }
} else {
  while (true) {
    savedEnd = end
    // expression
    if (result == error) {
      end = savedEnd
      result = empty
      break
    }
  }
}
```

## One
```js
// expression
if (result != error) {
  if (capturing) {
    list = [result]
    while (true) {
      savedEnd = end
      // expression
      if (result == error) {
        end = savedEnd
        result = list
        break
      } else {
        list.push(result)
      }
    }
  } else {
    while (true) {
      savedEnd = end
      // expression
      if (result == error) {
        end = savedEnd
        result = empty
        break
      }
    }
  }
}
```

## Reference
```js
result = parseName()
```

## Class (Case Sensitive)
```js
if (end < length) {
  char = input[end]
  switch (char) {
    case 'a':
    case 'b':
      if (capturing) {
        result = char
      } else {
        result = empty
      }
      end++
      break
    default:
      if (reporting) {
        report('[a-b]')
      }
      result = error
  }
} else {
  if (reporting) {
    report('[a-b]')
  }
  result = error
}
```

## Literal (Case Sensitive)
```js
if (end + 3 < length && input.substr(end, 3) == 'foo') {
  if (capturing) {
    result = 'foo'
  } else {
    result = empty
  }
  end += 3
} else {
  if (reporting) {
    report('"foo"')
  }
  result = error
}
```

## Range
```js
if (end < length && (char = input[end]) >= 'x' && char <= 'y') {
  if (capturing) {
    result = char
  } else {
    result = empty
  }
  end++
} else {
  if (reporting) {
    report("'x'..'y'")
  }
  result = error
}
```

## Char
```js
if (end < length && input[end] == 'x') {
  if (capturing) {
    result = 'x'
  } else {
    result = empty
  }
  end++
} else {
  if (reporting) {
    report("'x'")
  }
  result = error
}
```

## Any
```js
if (end < length) {
  if (capturing) {
    result = input[end]
  } else {
    result = empty
  }
  end++
} else {
  if (reporting) {
    report('any')
  }
  result = error
}
```
