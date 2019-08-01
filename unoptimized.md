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
if (end < length) {
  char = input[end]
  if (char >= 'x' && char <= 'y') {
    if (capturing) {
      result = char
    } else {
      result = ''
    }
  } else {
    if (reporting) {
      report("'x'..'y'")
    }
    result = error
  }
  end++
} else {
  if (reporting) {
    report("'x'..'y'")
  }
  result = error
}
```
