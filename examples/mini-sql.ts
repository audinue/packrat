import { packrat, type Ok } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-sql.packrat`, 'utf-8')
const parse = packrat(grammarText)

export function parseSql (source: string): Ok {
  return parse(source)
}
