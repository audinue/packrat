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
if (result != error) {
  if (capturing) {
    begin = savedEnd
    result = map()
  }
}
```

## Type
```js
savedEnd = end
// expression
if (result != error) {
  if (capturing) {
    begin = savedEnd
    result = {type: 'Name', location: location()}
  }
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
      result = [resultA, resultB, resultC]
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
if (result != error) {
  if (capturing) {
    result = substring(savedEnd, end)
  }
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
result = result == error ? '' : error
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
}
while (true) {
  savedEnd = end
  // expression
  if (result == error) {
    end = savedEnd
    if (capturing) {
      result = list
    } else {
      result = ''
    }
    break
  } else if (capturing) {
    list.push(result)
  }
}
```

## One
```js
// expression
if (result != error) {
  if (capturing) {
    list = [result]
  }
  while (true) {
    savedEnd = end
    // expression
    if (result == error) {
      end = savedEnd
      if (capturing) {
        result = list
      } else {
        result = ''
      }
      break
    } else if (capturing) {
      list.push(result)
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
      result = char
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
    result = ''
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
    result = ''
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
    result = ''
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
    result = ''
  }
  end++
} else {
  if (reporting) {
    report('any')
  }
  result = error
}
```
