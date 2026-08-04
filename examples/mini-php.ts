import { packrat, type Ok } from '../packrat'
import { readFileSync } from 'node:fs'

const grammarText = readFileSync(`${import.meta.dir}/mini-php.packrat`, 'utf-8')
const parse = packrat(grammarText)

export function parsePhp (source: string): Ok {
  const templateToPhp = (source: string): string => {
    const quote = (text: string): string =>
      text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')
    let out = ''
    let i = 0
    while (i < source.length) {
      const open = source.indexOf('<?', i)
      if (open === -1) {
        out += `echo "${quote(source.slice(i))}"; `
        break
      }
      if (open > i) out += `echo "${quote(source.slice(i, open))}"; `
      if (source.startsWith('<?=', open)) {
        const close = source.indexOf('?>', open + 3)
        if (close === -1) throw new Error('unterminated <?= tag')
        out += `echo ${source.slice(open + 3, close).trim()}; `
        i = close + 2
      } else if (source.startsWith('<?php', open)) {
        const close = source.indexOf('?>', open + 5)
        if (close === -1) {
          out += source.slice(open + 5)
          i = source.length
        } else {
          out += source.slice(open + 5, close)
          i = close + 2
        }
      } else {
        out += 'echo "<?"; '
        i = open + 2
      }
    }
    return `<?php ${out}`
  }

  return parse(templateToPhp(source))
}
