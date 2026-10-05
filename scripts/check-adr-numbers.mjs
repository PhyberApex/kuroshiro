import { readdirSync } from 'node:fs'
import process from 'node:process'

const ADR_DIR = 'docs/adr'
const NUMBER_PREFIX = /^(\d+)-/
const DUPLICATE_ADR_NUMBER_EXIT_CODE = 1

const filenames = readdirSync(ADR_DIR).filter(name => name.endsWith('.md'))

const filenamesByNumber = new Map()
for (const filename of filenames) {
  const match = NUMBER_PREFIX.exec(filename)
  if (!match)
    continue
  const number = match[1]
  const group = filenamesByNumber.get(number) ?? []
  group.push(filename)
  filenamesByNumber.set(number, group)
}

const duplicates = [...filenamesByNumber.entries()].filter(([, group]) => group.length > 1)

if (duplicates.length > 0) {
  for (const [number, group] of duplicates)
    console.error(`Duplicate ADR number ${number}: ${group.join(', ')}`)
  process.exit(DUPLICATE_ADR_NUMBER_EXIT_CODE)
}

console.log(`No duplicate ADR numbers across ${filenames.length} files in ${ADR_DIR}.`)
