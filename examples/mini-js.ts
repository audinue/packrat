import { packrat, type Ok } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-js.packrat`, 'utf-8')
const parse = packrat(grammarText)

export function parseJs (source: string): Ok {
  return parse(source.trim() + '\n')
}
