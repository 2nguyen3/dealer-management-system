/**
 * Lists every interface message ID (Vietnamese source text) as JSON.
 * Usage (from ui/): npm run i18n:extract [-- output.json]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { extractMessages } from '../src/lib/i18n/extract.ts'

const root = join(import.meta.dirname, '..')
const sources: Record<string, string> = {}
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'test') walk(path)
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      sources['/' + relative(root, path).split(sep).join('/')] = readFileSync(
        path,
        'utf8',
      )
  }
}
walk(join(root, 'src'))
const messages = [...extractMessages(sources).keys()].sort()
const json = JSON.stringify(messages, null, 2) + '\n'
const output = process.argv[2]
if (output) writeFileSync(output, json)
else process.stdout.write(json)
console.error(`${messages.length} messages`)
