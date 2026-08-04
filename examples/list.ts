import { packrat, type Ok } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/list.packrat`, 'utf-8')
const parse = packrat(grammarText)

export function parseList (source: string): Ok {
  return parse(source)
}
