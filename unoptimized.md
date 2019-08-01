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
list = []
while (true) {
  savedOffset = offset
  // expression
  if (result == error) {
    result = list
    break
  } else {
    list.push(result)
  }
}
```

## Choice
```js
savedOffset = offset
// expressionA
if (result == error) {
  offset = savedOffset
  // expressionB
  if (result == error) {
    offset = savedOffset
    // expressionC
  }
}
```
