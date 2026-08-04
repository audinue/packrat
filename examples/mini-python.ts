import { packrat, type Ok } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-python.packrat`, 'utf-8')
const parse = packrat(grammarText)

export function parsePy (source: string): Ok {
  return parse(source)
}
