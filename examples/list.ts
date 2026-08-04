import { packrat, type Ok, type Node } from '../packrat'

const grammarText = await Bun.file(`${import.meta.dir}/list.packrat`).text()
const parse = packrat(grammarText)

const field = <T = Ok>(node: Ok, name: string): T => (node as Node)[name] as unknown as T

export function parseList (source: string): number[] {
  const ast = parse(source) as Node
  const items = field<Ok[]>(ast, 'items')
  return items.map(item => parseInt(field<string>(field<Ok>(item, 'value'), 'value')))
}
