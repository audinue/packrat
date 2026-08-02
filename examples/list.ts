import { packrat, type Ok, type Node } from '../packrat'

const field = <T = Ok>(node: Ok, name: string): T => (node as Node)[name] as unknown as T

const parse = packrat`
  List = "[" _ items:Item { 1 ; _ "," _ } _ ","? _ "]" -> List
  Item = value:Int -> Item
  Int = value:Number -> Int
  Number = "0" / $( [1-9] [0-9]* )
  _ = Space*
  Space = [ \\t\\r\\n]+
`

export function parseList (source: string): number[] {
  const ast = parse(source) as Node
  const items = field<Ok[]>(ast, 'items')
  return items.map(item => parseInt(field<string>(field<Ok>(item, 'value'), 'value')))
}
