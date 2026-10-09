/** P2 and P3: the verb catalogue a parent ticks verbs in, and the sheet of one verb. */
import type { ChildProfile } from '@little-tables/api-contract'
import { Engine } from '@little-tables/engine'
import {
  maxConjugationVerbs,
  tenses,
  type ConjugationSettings,
  type Tense,
  type VerbTable,
} from '@little-tables/engine/schema'
import {
  Button,
  FormBreakdown,
  ListGroup,
  ListRow,
  NavigationBar,
  Screen,
  SegmentedControl,
  Sheet,
  Switch,
  TextField,
  toast,
} from '@little-tables/ui'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Effect } from 'effect'
import { useId, useMemo, useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { displayVerb, withSubject } from '../session/format.js'
import { noConjugation, useChild, usePathSettings } from './learning-paths.js'
import {
  loadVerbIndex,
  programmeVerbs,
  searchVerbs,
  sections,
  toggleTense,
} from './verb-catalogue.js'

export function VerbCatalogueScreen() {
  const { t } = useI18n()
  const child = useChild()
  if (child === null) return null
  return (
    <Catalogue
      back={{ label: t('school.title'), to: '/parents/children/$profileId/school' }}
      child={child}
      key={child.id}
      title={t('verbs.title')}
    />
  )
}

/** The same catalogue reached from the child's screen, the tenses ticked above the verbs. */
export function ConjugationScreen() {
  const { t } = useI18n()
  const child = useChild()
  if (child === null) return null
  return (
    <Catalogue
      back={{ label: child.name, to: '/parents/children/$profileId' }}
      child={child}
      key={child.id}
      title={t('school.conjugation')}
      withTenses
    />
  )
}

type CatalogueProps = Readonly<{
  back: Readonly<{
    label: string
    to: '/parents/children/$profileId' | '/parents/children/$profileId/school'
  }>
  child: ChildProfile
  title: string
  withTenses?: boolean
}>

/** The engine's table of a verb, or `null` when it cannot conjugate it. */
function useVerbTable(verb: string | null): VerbTable | null {
  const { runtime } = useApp()
  return useMemo(
    () =>
      verb === null
        ? null
        : runtime.runSync(Effect.flatMap(Engine, (engine) => engine.verbTable({ verb }))),
    [runtime, verb],
  )
}

function Catalogue({ back, child, title, withTenses = false }: CatalogueProps) {
  const { count, t } = useI18n()
  const navigate = useNavigate()
  const searchField = useId()
  const [settings, persist] = usePathSettings(child)
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const index = useQuery({
    queryFn: loadVerbIndex,
    queryKey: ['verb-index'],
    staleTime: Number.POSITIVE_INFINITY,
  })
  const conjugation = settings.conjugation ?? noConjugation
  const ticked = new Set(conjugation.verbs)

  const save = (next: ConjugationSettings) => persist({ ...settings, conjugation: next })
  const toggle = (verb: string) => {
    if (ticked.has(verb)) {
      save({
        ...conjugation,
        focus: conjugation.focus?.verb === verb ? null : conjugation.focus,
        verbs: conjugation.verbs.filter((current) => current !== verb),
      })
      return
    }
    if (conjugation.verbs.length >= maxConjugationVerbs) {
      toast.error(t('verbs.limit', { count: maxConjugationVerbs }))
      return
    }
    save({
      ...conjugation,
      // A first verb with no tense ticked yet starts at the present.
      tenses: conjugation.tenses.length === 0 ? ['present'] : conjugation.tenses,
      verbs: [...conjugation.verbs, verb],
    })
  }
  const tickProgramme = () => {
    const missing = programmeVerbs.filter((verb) => !ticked.has(verb))
    const verbs = [...conjugation.verbs, ...missing].slice(0, maxConjugationVerbs)
    save({
      ...conjugation,
      tenses: conjugation.tenses.length === 0 ? ['present'] : conjugation.tenses,
      verbs,
    })
  }
  // A tense the parent has not ticked cannot be put forward: the whole verb is, then.
  const focus = (verb: string, tense: Tense) =>
    persist({
      ...settings,
      conjugation: {
        ...conjugation,
        focus: { tense: conjugation.tenses.includes(tense) ? tense : null, verb },
      },
      focusSkill: null,
    })

  const listed = new Set(sections.flatMap((section) => section.verbs))
  const others = conjugation.verbs.filter((verb) => !listed.has(verb))
  const results = query.trim() === '' ? null : searchVerbs(index.data ?? [], query)

  const group = (title: string, verbs: ReadonlyArray<string>) => (
    <ListGroup key={title} title={title}>
      {verbs.map((verb) => (
        <VerbRow
          checked={ticked.has(verb)}
          key={verb}
          onOpen={() => setOpened(verb)}
          onToggle={() => toggle(verb)}
          verb={verb}
        />
      ))}
    </ListGroup>
  )

  return (
    <Screen
      tone="grouped"
      top={
        <NavigationBar
          back={{
            label: back.label,
            onBack: () => void navigate({ params: { profileId: child.id }, to: back.to }),
          }}
          title={title}
        />
      }
    >
      {withTenses ? (
        <TenseGroup
          onToggle={(tense) => save(toggleTense(conjugation, tense))}
          ticked={conjugation.tenses}
        />
      ) : null}
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-label-3"
        />
        <TextField
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className="[&_input]:pl-7"
          id={searchField}
          label={t('verbs.search')}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('verbs.search')}
          spellCheck={false}
          type="search"
          value={query}
        />
      </div>
      <p className="px-4 text-footnote font-semibold text-label-2">
        {count('verbs.count', conjugation.verbs.length)}
      </p>

      {results !== null ? (
        index.isError ? (
          <p className="px-4 text-subhead font-semibold text-label-2">{t('verbs.offline')}</p>
        ) : results.length === 0 && index.data !== undefined ? (
          <p className="px-4 text-subhead font-semibold text-label-2">
            {t('verbs.noResult', { query: query.trim() })}
          </p>
        ) : (
          group(t('verbs.section.results'), results)
        )
      ) : (
        <>
          <section className="flex items-center gap-3 rounded-card bg-sky-soft px-4 py-3">
            <span className="flex flex-1 flex-col">
              <span className="text-body font-extrabold">{t('verbs.programme')}</span>
              <span className="text-footnote font-semibold text-label-2">
                {t('verbs.programmeCopy')}
              </span>
            </span>
            <Button
              disabled={programmeVerbs.every((verb) => ticked.has(verb))}
              onClick={tickProgramme}
              size="sm"
            >
              {t('verbs.tickAll')}
            </Button>
          </section>
          {others.length === 0 ? null : group(t('verbs.section.others'), others)}
          {sections.map((section) => group(t(section.title), section.verbs))}
        </>
      )}

      <VerbSheet
        checked={opened !== null && ticked.has(opened)}
        childName={child.name}
        focused={conjugation.focus}
        onFocus={focus}
        onOpenChange={(open) => {
          if (!open) setOpened(null)
        }}
        onToggle={() => {
          if (opened !== null) toggle(opened)
        }}
        verb={opened}
      />
    </Screen>
  )
}

type TenseGroupProps = Readonly<{
  onToggle: (tense: Tense) => void
  ticked: ReadonlyArray<Tense>
}>

/** The four tenses, each with its switch. */
function TenseGroup({ onToggle, ticked }: TenseGroupProps) {
  const { t } = useI18n()
  const on = new Set(ticked)
  return (
    <ListGroup footer={t('conjugation.tensesCopy')} title={t('conjugation.tenses')}>
      {tenses.map((tense) => (
        <ListRow
          accessory={
            <Switch
              aria-label={t(`conj.tenseTitle.${tense}`)}
              checked={on.has(tense)}
              onCheckedChange={() => onToggle(tense)}
            />
          }
          key={tense}
          title={t(`conj.tenseTitle.${tense}`)}
        />
      ))}
    </ListGroup>
  )
}

type VerbRowProps = Readonly<{
  checked: boolean
  onOpen: () => void
  onToggle: () => void
  verb: string
}>

/** The infinitive and three forms (je, nous, ils at the present) beside a switch. */
function VerbRow({ checked, onOpen, onToggle, verb }: VerbRowProps) {
  const table = useVerbTable(verb)
  const present = table?.tenses.find((entry) => entry.tense === 'present')?.rows ?? []
  const samples = [0, 3, 5, 2]
    .flatMap((person) => present.filter((row) => row.person === person))
    .slice(0, 3)
    .map((row) => withSubject(row.subjects[0] ?? '', row.form))
    .join(' · ')
  const name = table?.display ?? displayVerb(verb)
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2" lang="fr">
      <button
        className="flex min-w-0 flex-1 flex-col text-left active:opacity-70"
        onClick={onOpen}
        type="button"
      >
        <span className="text-body font-semibold text-label">{name}</span>
        <span className="truncate text-footnote font-semibold text-label-2">{samples}</span>
      </button>
      <Switch aria-label={name} checked={checked} onCheckedChange={onToggle} />
    </div>
  )
}

type VerbSheetProps = Readonly<{
  checked: boolean
  childName: string
  focused: ConjugationSettings['focus']
  onFocus: (verb: string, tense: Tense) => void
  onOpenChange: (open: boolean) => void
  onToggle: () => void
  verb: string | null
}>

const groupKey: Readonly<Record<VerbTable['group'], MessageKey>> = {
  auxiliary: 'verbs.group.auxiliary',
  first: 'verbs.group.first',
  second: 'verbs.group.second',
  third: 'verbs.group.third',
}

/** P3: one verb at the four tenses, its ending in pink, and the switches of the catalogue. */
function VerbSheet({
  checked,
  childName,
  focused,
  onFocus,
  onOpenChange,
  onToggle,
  verb,
}: VerbSheetProps) {
  const { t } = useI18n()
  const table = useVerbTable(verb)
  const [tense, setTense] = useState<Tense>('present')
  const rows = table?.tenses.find((entry) => entry.tense === tense)?.rows ?? []
  const isFocus = focused !== null && focused.verb === verb && focused.tense === tense
  const description =
    table === null
      ? undefined
      : [
          t(groupKey[table.group]),
          table.cousin === null ? null : t('verbs.like', { verb: displayVerb(table.cousin) }),
          table.impersonal ? t('verbs.impersonal') : null,
          table.display === table.verb ? null : t('verbs.alsoWritten', { spelling: table.verb }),
        ]
          .filter((part) => part !== null)
          .join(' · ')
  return (
    <Sheet
      {...(description === undefined ? {} : { description })}
      onOpenChange={onOpenChange}
      open={verb !== null && table !== null}
      title={<span lang="fr">{table?.display ?? ''}</span>}
    >
      <SegmentedControl
        label={t('school.conjugation')}
        onChange={setTense}
        options={tenses.map((value) => ({
          label: <span lang="fr">{t(`conj.tenseShort.${value}`)}</span>,
          value,
        }))}
        value={tense}
      />
      <p className="px-1 text-subhead font-extrabold" lang="fr">
        {t(`conj.tenseTitle.${tense}`)}
      </p>
      <ul className="overflow-hidden rounded-card bg-surface" lang="fr">
        {rows.map((row) => (
          <li
            className="flex min-h-12 items-center gap-3 border-t border-separator px-4 first:border-t-0"
            key={row.person}
          >
            <span className="w-24 shrink-0 text-body font-semibold text-label-2">
              {row.subjects.join(', ')}
            </span>
            <FormBreakdown className="text-title-3" parts={row.parts} />
          </li>
        ))}
      </ul>
      <p className="px-1 text-footnote font-semibold text-label-2">{t('verbs.endingCopy')}</p>
      <div className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-4">
        <span className="flex-1 text-body font-semibold">
          {t('verbs.inWatering', { name: childName })}
        </span>
        <Switch
          aria-label={t('verbs.inWatering', { name: childName })}
          checked={checked}
          onCheckedChange={onToggle}
        />
      </div>
      <Button
        disabled={!checked || isFocus || verb === null}
        onClick={() => {
          if (verb !== null) onFocus(verb, tense)
        }}
        variant="tinted"
        width="full"
      >
        {t('verbs.focus', { tense: t(`conj.tense.${tense}`), verb: table?.display ?? '' })}
      </Button>
    </Sheet>
  )
}
