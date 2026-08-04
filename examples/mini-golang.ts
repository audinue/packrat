import { packrat, type Ok } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-golang.packrat`, 'utf-8')
const parse = packrat(grammarText)

export function parseGo (source: string): Ok {
  return parse(source.trim() + '\n')
}
