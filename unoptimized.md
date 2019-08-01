### Any
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

## Reference
```js
result = parseName()
```

## Zero
```js
savedEnd = end
list = []
while (true) {
  // expression
  if (result == error) {
    end = savedEnd
    result = list
    break
  } else {
    list.push(result)
    savedEnd = end
  }
}
```

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
  result = ''
}
```
