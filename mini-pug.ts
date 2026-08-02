import { isNode, packrat } from './packrat'

const parsePug = packrat`
  Pug = Newlines* elements:(^Element Newlines*)+ Newlines* _ -> Pug
  Element = name:Tag attrs:Attrs? text:InlineText? _ children:>> Element <<* -> Element
  Attrs = "(" _ attrs:(^Attr _)+ _ ")" -> Attrs
  Attr = name:AttrName value:( _ "=" _ ^AttrValue )? -> Attr
  AttrName = $([a-z] [a-z0-9_-]*)
  AttrValue = "\\\"" ^$(NotQuote*) "\\\""
  NotQuote = ~"\\\""
  Newlines = [\\r\\n]+
  Tag = $([a-z.#] [a-z0-9.#]*)
  InlineText = __ ^$(NotNewline+)
  NotNewline = ~[\\r\\n]
  _ = Space*
  __ = Space+
  Space = [\\t ]+
`

const parseTag = (raw: string): { tag: string, classes: string[], id: string | null } => {
  const parts = raw.match(/[a-z][a-z0-9]*|[.#][a-z][a-z0-9]*/gi)
  if (!parts) return { tag: 'div', classes: [], id: null }
  let tag = 'div'
  const classes: string[] = []
  let id: string | null = null
  for (const part of parts) {
    if (part.startsWith('.')) {
      classes.push(part.slice(1))
    } else if (part.startsWith('#')) {
      id = part.slice(1)
    } else {
      tag = part.toLowerCase()
    }
  }
  return { tag, classes, id }
}

const escapeHtml = (str: string): string => {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const render = (node: unknown): string => {
  if (Array.isArray(node)) return node.map(render).join('')
  if (typeof node === 'string') return escapeHtml(node)
  if (node === null || node === undefined) return ''
  if (!isNode(node)) return ''
  switch (node.tag) {
    case 'Pug':
      return render(node.elements)
    case 'Element':
      return renderElement(
        (node.name as string) ?? 'div',
        node.attrs,
        node.text as string | null,
        node.children,
      )
    default:
      return ''
  }
}

const renderAttrs = (attrs: unknown): string => {
  if (!isNode(attrs) || attrs.tag !== 'Attrs') return ''
  return ((attrs.attrs as unknown[] | null) ?? []).map(renderAttr).join('')
}

const renderAttr = (attr: unknown): string => {
  if (!isNode(attr) || attr.tag !== 'Attr') return ''
  const name = attr.name as string
  const value = attr.value as string | null
  return value === null ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`
}

const renderElement = (tagRaw: string, attrs: unknown, text: string | null, children: unknown): string => {
  const { tag, classes, id } = parseTag(tagRaw)
  const clsStr = classes.length ? ` class="${classes.join(' ')}"` : ''
  const idStr = id ? ` id="${id}"` : ''
  const attrStr = renderAttrs(attrs)
  const textContent = text ? escapeHtml(text) : ''
  const childrenContent = render(children)
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  if (voidElements.has(tag)) {
    return `<${tag}${clsStr}${idStr}${attrStr} />`
  }
  return `<${tag}${clsStr}${idStr}${attrStr}>${textContent}${childrenContent}</${tag}>`
}

const pug = (input: string): string => {
  return render(parsePug(input))
}

export { pug }
