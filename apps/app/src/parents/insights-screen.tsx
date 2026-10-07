/**
 * E5 "What's hard" (`docs/rewrite/TECHNICAL_SPEC.md` §5.6): what to work on again with a child,
 * how regularly they practised and what grew, over 7 or 30 days. Computed by the server from every
 * answer; never a score, never a comparison.
 */
import type { ApiSchema, ChildProfile } from '@little-tables/api-contract'
import {
  Badge,
  Button,
  EmptyState,
  ListGroup,
  ListRow,
  NavigationBar,
  Screen,
  SegmentedControl,
} from '@little-tables/ui'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { useApp } from '../app/app-context.js'
import { todayKey } from '../app/derived.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey, Translator } from '../i18n/translator.js'
import { displayFact } from '../reward/insight.js'
import { formatAnswer } from '../session/format.js'
import { useApi } from './api.js'

type Range = '7d' | '30d'

/** One thing to work on, in a parent's words. */
const struggleCopy = (struggle: ApiSchema.Struggle, translator: Translator) =>
  struggle.reasons
    .map((reason) => {
      switch (reason) {
        case 'mistakes': {
          const mistakes = translator.t('hard.mistakes', {
            answers: struggle.answers,
            mistakes: struggle.mistakes,
          })
          return struggle.commonWrongAnswer === null
            ? mistakes
            : `${mistakes} · ${translator.t('hard.commonAnswer', {
                answer: formatAnswer(struggle.commonWrongAnswer, translator.language),
              })}`
        }
        case 'lapses':
          return translator.t('hard.lapses')
        case 'slow':
          return translator.t('hard.slow', {
            seconds: translator.number(Math.round((struggle.medianLatencyMs ?? 0) / 1000)),
          })
      }
    })
    .concat(
      (struggle.persons ?? []).length === 0
        ? []
        : [
            translator.t('hard.persons', {
              persons: (struggle.persons ?? [])
                .slice(0, 2)
                .map(({ person }) => pronouns[person] ?? '')
                .join(', '),
            }),
          ],
    )
    .join(' · ')

/** The subjects of each person, as French conjugation tables write them. */
const pronouns: ReadonlyArray<string> = ['je', 'tu', 'il, elle', 'nous', 'vous', 'ils, elles']

export function InsightsScreen() {
  const { profileId } = useParams({ strict: false })
  const { family } = useApp()
  const child = family.profiles.find(({ id }) => id === profileId) ?? null
  const navigate = useNavigate()
  if (child === null) {
    void navigate({ replace: true, to: '/parents' })
    return null
  }
  return <Insights child={child} key={child.id} />
}

function Insights({ child }: Readonly<{ child: ChildProfile }>) {
  const translator = useI18n()
  const { count, t } = translator
  const api = useApi()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('7d')
  const [today] = useState(() => todayKey())
  const insights = useQuery({
    queryFn: () => api((client) => client.insights(child.id, range, today)),
    queryKey: ['insights', child.id, range, today],
  })

  const back = () =>
    void navigate({ params: { profileId: child.id }, to: '/parents/children/$profileId' })
  const data = insights.data
  const grown = (
    [
      { facts: data?.growth.becameFluent ?? [], message: 'hard.becameFluent' },
      { facts: data?.growth.becameFamiliar ?? [], message: 'hard.becameFamiliar' },
    ] as const
  ).filter(({ facts }) => facts.length > 0)
  return (
    <Screen
      tone="grouped"
      top={<NavigationBar back={{ label: child.name, onBack: back }} title={t('hard.title')} />}
    >
      <SegmentedControl
        label={t('hard.range')}
        onChange={setRange}
        options={[
          { label: t('hard.range7'), value: '7d' },
          { label: t('hard.range30'), value: '30d' },
        ]}
        value={range}
      />
      {insights.isError ? (
        <EmptyState
          action={
            <Button onClick={() => void insights.refetch()} variant="tinted">
              {t('hard.retry')}
            </Button>
          }
          description={t('hard.error')}
          title={t('hard.title')}
        />
      ) : data === undefined ? (
        <div aria-busy className="flex flex-col gap-3" role="status">
          {[0, 1, 2].map((index) => (
            <div className="h-16 animate-pulse rounded-card bg-surface" key={index} />
          ))}
        </div>
      ) : data.answers === 0 ? (
        <EmptyState
          description={t('hard.emptyCopy', { name: child.name })}
          title={t('hard.emptyTitle')}
        />
      ) : (
        <>
          <ListGroup title={t('hard.regularity')}>
            <ListRow
              detail={count('hard.answers', data.answers)}
              title={count('hard.practicedDays', data.regularity.practicedDays, {
                total: data.regularity.rangeDays,
              })}
            />
            {data.regularity.weeks === 0 ? null : (
              <ListRow
                title={count('hard.bloomingWeeks', data.regularity.bloomingWeeks, {
                  weeks: data.regularity.weeks,
                })}
              />
            )}
            <ListRow
              title={count('hard.minutes', Math.max(1, Math.round(data.timeSpentMs / 60_000)))}
            />
          </ListGroup>

          <ListGroup title={t('hard.toWorkOn')}>
            {data.struggles.length === 0 ? (
              <ListRow title={t('hard.nothingToWorkOn')} />
            ) : (
              data.struggles.map((struggle) => (
                <ListRow
                  key={struggle.factKey}
                  subtitle={struggleCopy(struggle, translator)}
                  title={displayFact(struggle.factKey, translator)}
                  {...(struggle.skill === null
                    ? {}
                    : { detail: t(`skill.${struggle.skill}` as MessageKey) })}
                />
              ))
            )}
          </ListGroup>

          <ListGroup title={t('hard.grew')}>
            {grown.length === 0 ? (
              <ListRow title={t('hard.nothingGrew')} />
            ) : (
              grown.map(({ facts, message }) => (
                <ListRow
                  key={message}
                  subtitle={facts.map((key) => displayFact(key, translator)).join(', ')}
                  title={count(message, facts.length)}
                />
              ))
            )}
          </ListGroup>

          {data.wellOnTheWay.tables.length + data.wellOnTheWay.skills.length === 0 ? null : (
            <section className="flex flex-col gap-2">
              <h2 className="px-4 text-footnote font-extrabold uppercase tracking-wide text-label-2">
                {t('hard.wellOnTheWay')}
              </h2>
              <div className="flex flex-wrap gap-2 px-1">
                {data.wellOnTheWay.tables.map((table) => (
                  <Badge key={table} tone="leaf">
                    {t('hard.table', { table })}
                  </Badge>
                ))}
                {data.wellOnTheWay.skills.map((skill) => (
                  <Badge key={skill} tone="leaf">
                    {t(`skill.${skill}` as MessageKey)}
                  </Badge>
                ))}
              </div>
            </section>
          )}
          <p className="px-4 text-footnote font-semibold text-label-3">{t('hard.footer')}</p>
        </>
      )}
    </Screen>
  )
}
