import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { Effect } from 'effect'
import { beforeAll, describe, expect, it } from 'vitest'

import init, { run } from '../wasm/lt_domain_wasm.js'
import { learningDayKey } from './day-key.js'
import { makeEngine, type EngineApi } from './engine.js'
import type {
  AnswerOutcome,
  AttemptEvent,
  LearningSnapshot,
  PracticeAnswer,
  PracticePolicy,
  PracticeSession,
} from './schema.js'

const goldenDirectory = join(import.meta.dirname, '../../../crates/lt-domain/tests/golden')
const load = (name: string): unknown =>
  JSON.parse(gunzipSync(readFileSync(join(goldenDirectory, name))).toString('utf8')) as unknown

type Step =
  | Readonly<{
      expect: unknown
      now: number
      op: 'createSession'
      policy: PracticePolicy
      seed: number
      timeZone: string
    }>
  | Readonly<{
      answeredAt: number
      eventId: string
      expect: Readonly<{ correct: boolean; event: unknown }>
      op: 'answer'
      response?: PracticeAnswer
      selected?: number
    }>
  | Readonly<{ expectInsight: unknown; op: 'reduce'; timeZone: string }>
  | Readonly<{
      expect: Readonly<{ progress: ReadonlyArray<unknown> }>
      op: 'derive'
      snapshot: unknown
    }>
  | Readonly<{ op: 'rescue' | 'validate' }>

let engine: EngineApi

beforeAll(async () => {
  await init({
    module_or_path: readFileSync(join(import.meta.dirname, '../wasm/lt_domain_wasm_bg.wasm')),
  })
  engine = makeEngine({ run })
})

const runSync = <A>(effect: Effect.Effect<A, unknown>): A => Effect.runSync(effect)

/** JSON equality: the engine writes `1.0` where JavaScript wrote `1`, which JSON.parse merges. */
const expectSame = (actual: unknown, expected: unknown): void => {
  expect(JSON.parse(JSON.stringify(actual))).toEqual(expected)
}

describe('day keys', () => {
  it('match the golden Intl vectors', () => {
    const vectors = load('day-keys.json.gz') as ReadonlyArray<
      Readonly<{ at: number; dayKey: string; timeZone: string }>
    >
    for (const vector of vectors) {
      expect(learningDayKey(vector.at, vector.timeZone)).toBe(vector.dayKey)
    }
  })
})

describe('WebAssembly engine', () => {
  const scenarios = readdirSync(goldenDirectory).filter((name) => name.startsWith('scenario-'))

  it.each(scenarios)('replays %s through the JSON boundary', (name: string) => {
    const { steps } = load(name) as { steps: ReadonlyArray<Step> }
    let snapshot: LearningSnapshot = engine.emptySnapshot
    let session: PracticeSession | null = null
    let events: AttemptEvent[] = []
    for (const step of steps.slice(0, 400)) {
      switch (step.op) {
        case 'createSession': {
          session = runSync(engine.createSession({ ...step, snapshot }))
          expectSame(session, step.expect)
          events = []
          break
        }
        case 'answer': {
          if (session === null) throw new Error('No session is running')
          const base: Readonly<{ answeredAt: number; eventId: string; session: PracticeSession }> =
            { answeredAt: step.answeredAt, eventId: step.eventId, session }
          const outcome: AnswerOutcome = runSync(
            engine.answer(
              step.response === undefined
                ? { ...base, selected: step.selected ?? 0 }
                : { ...base, response: step.response },
            ),
          )
          expect(outcome.correct).toBe(step.expect.correct)
          expectSame(outcome.event, step.expect.event)
          events.push(outcome.event)
          session = outcome.session
          break
        }
        case 'reduce': {
          const input = { attempts: events, snapshot, timeZone: step.timeZone }
          expectSame(runSync(engine.deriveSessionInsight(input)), step.expectInsight)
          snapshot = runSync(engine.reduce(input))
          break
        }
        case 'derive': {
          expectSame(snapshot, step.snapshot)
          expectSame(runSync(engine.deriveLearningProgress({ snapshot })), step.expect.progress[0])
          break
        }
        default:
          break
      }
    }
  })

  it('reports engine errors as typed failures', () => {
    const failure = Effect.runSync(
      Effect.flip(
        engine.reduce({ attempts: [], snapshot: { nope: true } as never, timeZone: 'UTC' }),
      ),
    )
    expect(failure._tag).toBe('EngineError')
    expect(failure.operation).toBe('reduce')
  })

  it('describes what an exercise screen reveals', () => {
    const column = runSync(
      engine.describeExercise({
        kind: 'column',
        operation: 'subtract',
        skill: 'column-subtraction',
        terms: [503, 128],
      }),
    )
    expect(column).toEqual({
      columnResult: 375,
      expected: { type: 'integer', value: 375 },
      production: true,
    })
    const line = runSync(
      engine.describeExercise({
        choices: [],
        kind: 'fraction-line',
        mode: 'place',
        skill: 'fraction-line',
        target: { denominator: 4, numerator: 3, whole: 0 },
        ticks: 4,
        units: 1,
      }),
    )
    expect(line.tickIndex).toBe(3)
    expect(line.expected).toEqual({ index: 3, type: 'tick' })
  })

  it('derives the verb meadow and the visit of a session', () => {
    const meadow = runSync(
      engine.deriveMeadow({
        settings: { focus: null, tenses: ['present'], verbs: ['aller', 'être'] },
        snapshot: engine.emptySnapshot,
        todayKey: '2026-10-08',
      }),
    )
    expect(meadow.verbs.map((verb) => [verb.verb, verb.silhouette, verb.stage])).toEqual([
      ['être', 'tulip', 'seed'],
      ['aller', 'anemone', 'seed'],
    ])
    expect(meadow.thirst).toEqual({ daysSince: 0, verb: 'aller' })
    expect(runSync(engine.meadowVisit({ attempts: [] }))).toBeNull()
  })

  it('composes the meadow watering and counts its blooms', () => {
    const paths = {
      conjugation: { focus: null, tenses: ['present' as const], verbs: ['aller', 'finir'] },
      enabledSkills: [],
      focusSkill: null,
      mode: 'automatic' as const,
      subtractionMethod: 'compensation' as const,
    }
    const meadow = runSync(
      engine.createSession({
        now: 1_790_000_000_000,
        policy: { algorithmVersion: '3', curriculum: { paths }, kind: 'meadow-watering' },
        seed: 4,
        snapshot: engine.emptySnapshot,
        timeZone: 'UTC',
      }),
    )
    expect(meadow.kind).toBe('meadow-watering')
    expect(meadow.questions.every(({ factKey }) => factKey.startsWith('conj:'))).toBe(true)
    const ledger = runSync(
      engine.deriveMeadowRewardLedger({
        completions: [{ learningDayKey: '2026-10-08', sessionKind: 'meadow-watering' }],
      }),
    )
    expect(ledger.gardenBloomCount).toBe(1)
  })
})
