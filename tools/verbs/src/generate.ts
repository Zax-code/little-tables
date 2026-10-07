/**
 * Builds, from the Lefff (Lexique des formes fléchies du français, Inria, LGPL-LR):
 *
 * - `crates/lt-domain/tests/fixtures/lefff-forms.json.gz`, the oracle the Rust conjugator must
 *   reproduce: present, imperfect and future (six persons) and the past participle of each verb;
 * - `crates/lt-domain/data/verbs-index.tsv`, every verb and its group, for the server;
 * - `apps/app/public/verbs/index.json`, the same index for the parent catalogue search.
 *
 * `--check` compares the outputs with the files in the repository instead of writing them.
 * The irregular forms the engine embeds are then extracted from the oracle by Rust:
 * `cargo run -p lt-domain --example extract-irregular-verbs`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

type Forms = ReadonlyArray<string | null>
type Entry = Readonly<{
  C?: Forms
  F?: Forms
  I?: Forms
  K?: Forms
  P?: Forms
}>

const require = createRequire(import.meta.url)
const lexicon = require('french-verbs-lefff/dist/conjugations.json') as Record<string, Entry>

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const check = process.argv.includes('--check')

const notice =
  'Derived from the Lefff (Lexique des formes fléchies du français, Benoît Sagot, Inria), ' +
  'distributed under the LGPL-LR licence. See THIRD_PARTY_NOTICES.md.'

/** Weather verbs: conjugated with « il » only, kept although the Lefff marks them defective. */
const impersonal = new Set(['falloir', 'grêler', 'neiger', 'pleuvoir'])

/**
 * Reviewed corrections to the Lefff, applied before anything is written. The Lefff keeps some
 * literary forms first; a CE2 child learns the usual one.
 */
const corrections: Readonly<Record<string, Partial<Record<'F' | 'I' | 'P', Forms>>>> = {
  pouvoir: { P: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'] },
}

const wellFormed = /^[a-zàâçéèêëîïôûùüÿœæ-]+(er|ir|ïr|re|oir)$/

const complete = (forms: Forms | undefined, length: number): forms is ReadonlyArray<string> =>
  forms?.length === length && forms.every((form) => typeof form === 'string')

export type Group = '1' | '2' | '3' | 'aux'

const groupOf = (verb: string, entry: Entry): Group => {
  if (verb === 'être' || verb === 'avoir') return 'aux'
  if (verb.endsWith('er') && verb !== 'aller') return '1'
  if (verb === 'haïr') return '2'
  const stem = verb.slice(0, -2)
  return verb.endsWith('ir') && entry.P?.[3] === `${stem}issons` ? '2' : '3'
}

type Row = Readonly<{ forms: ReadonlyArray<string | null>; group: Group; verb: string }>

const rows: Row[] = []
for (const [verb, raw] of Object.entries(lexicon)) {
  if (!wellFormed.test(verb)) continue
  const entry: Entry = { ...raw, ...corrections[verb] }
  const usable = complete(entry.P, 6) && complete(entry.I, 6) && complete(entry.F, 6)
  const participle = entry.K?.[0]
  if (typeof participle !== 'string') continue
  if (!usable && !impersonal.has(verb)) continue
  const pick = (forms: Forms | undefined) =>
    Array.from({ length: 6 }, (_, person) =>
      impersonal.has(verb) && person !== 2 ? null : (forms?.[person] ?? null),
    )
  rows.push({
    forms: [...pick(entry.P), ...pick(entry.I), ...pick(entry.F), participle],
    group: groupOf(verb, entry),
    verb,
  })
}
rows.sort((first, second) => (first.verb < second.verb ? -1 : first.verb > second.verb ? 1 : 0))

const oracle = gzipSync(
  JSON.stringify({ notice, verbs: Object.fromEntries(rows.map((row) => [row.verb, row.forms])) }),
  { level: 9 },
)
const index = `# ${notice}\n${rows.map((row) => `${row.verb}\t${row.group}`).join('\n')}\n`
const indexJson = `${JSON.stringify({ notice, verbs: rows.map((row) => [row.verb, row.group]) })}\n`

const outputs: ReadonlyArray<readonly [string, Buffer | string]> = [
  ['crates/lt-domain/tests/fixtures/lefff-forms.json.gz', oracle],
  ['crates/lt-domain/data/verbs-index.tsv', index],
  ['apps/app/public/verbs/index.json', indexJson],
]

let stale = false
for (const [path, content] of outputs) {
  const target = join(root, path)
  if (check) {
    const current = (() => {
      try {
        return readFileSync(target)
      } catch {
        return null
      }
    })()
    if (!current?.equals(Buffer.from(content))) {
      console.error(`${path} is out of date: run pnpm --filter @little-tables/verbs generate`)
      stale = true
    }
  } else {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    console.log(`${path}: ${Buffer.byteLength(content)} bytes`)
  }
}
const groups = rows.reduce<Record<string, number>>(
  (counts, row) => ({ ...counts, [row.group]: (counts[row.group] ?? 0) + 1 }),
  {},
)
console.log(`${rows.length} verbs`, groups)
if (stale) process.exit(1)
