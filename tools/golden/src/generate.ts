/**
 * Generates golden vectors from the frozen TypeScript engine in ../legacy-domain.
 *
 * The Rust engine (crates/lt-domain) must reproduce every vector exactly. Dates are written as
 * Unix milliseconds; everything else keeps the shape of the TypeScript values.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import {
  expectedAnswer,
  isExerciseAnswerCorrect,
  isExerciseWellFormed,
  isProductionExercise,
  type Exercise,
  type LearningPathSettings,
  type PracticeAnswer,
  type SkillId,
} from '../legacy-domain/exercises.js'
import {
  LearningEngine,
  type AttemptEvent,
  type LearningSnapshot,
  type PracticePolicy,
  type PracticeQuestion,
  type PracticeSession,
} from '../legacy-domain/learning-engine.js'
import {
  countBorrows,
  countCarries,
  deriveOpenSkills,
  derivePathProgress,
  generateExercise,
  interactionFamily,
  learningSkills,
  skillWeight,
} from '../legacy-domain/learning-paths.js'

const here = dirname(fileURLToPath(import.meta.url))
const outputDirectory = join(here, '../../../crates/lt-domain/tests/golden')

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** The engine's generator, copied so vectors can drive it from a known seed. */
const makeRandom = (initialSeed: number): (() => number) => {
  let state = initialSeed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

/** Dates become milliseconds, undefined properties disappear, everything else is kept as is. */
const plain = (value: unknown): unknown => {
  if (value instanceof Date) return value.getTime()
  if (Array.isArray(value)) return value.map(plain)
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) result[key] = plain(entry)
    }
    return result
  }
  return value
}

const write = (name: string, value: unknown): void => {
  mkdirSync(outputDirectory, { recursive: true })
  const json = JSON.stringify(plain(value))
  writeFileSync(join(outputDirectory, `${name}.json.gz`), gzipSync(json, { level: 9 }))
  console.log(`${name}: ${(json.length / 1024).toFixed(0)} KiB raw`)
}

const allSkillIds = learningSkills.map(({ id }) => id)

/** Every level key of every skill, with subtraction levels for every addition pair. */
const allKeys = (): ReadonlyArray<string> =>
  learningSkills.flatMap((skill) => [...skill.keys({}, true)])

/* ------------------------------------------------------------------------------------------ */
/* Primitive vectors                                                                           */
/* ------------------------------------------------------------------------------------------ */

const rngVectors = () =>
  [0, 1, 42, 123_456_789, 4_294_967_295, 2_147_483_648, 987_654_321].map((seed) => {
    const random = makeRandom(seed)
    return { seed, values: Array.from({ length: 32 }, () => random()) }
  })

const wrongAnswersFor = (exercise: Exercise, random: () => number): PracticeAnswer[] => {
  const expected = expectedAnswer(exercise)
  const answers: PracticeAnswer[] = []
  if ('choices' in exercise) answers.push(...exercise.choices)
  switch (expected.type) {
    case 'integer':
      answers.push(
        { type: 'integer', value: expected.value + 1 },
        { type: 'integer', value: Math.max(0, expected.value - 1) },
      )
      break
    case 'fraction':
      answers.push(
        { ...expected, numerator: expected.numerator * 2, denominator: expected.denominator * 2 },
        { ...expected, numerator: expected.numerator + 1 },
        {
          denominator: expected.denominator,
          numerator: expected.numerator,
          type: 'fraction',
          whole: 0,
        },
      )
      break
    case 'comparison':
      answers.push(
        { symbol: '<', type: 'comparison' },
        { symbol: '=', type: 'comparison' },
        { symbol: '>', type: 'comparison' },
      )
      break
    case 'tick':
      answers.push(
        { index: expected.index + 1, type: 'tick' },
        { index: expected.index, type: 'tick' },
      )
      break
    case 'selection':
      answers.push(
        { ids: [...expected.ids].reverse(), type: 'selection' },
        { ids: expected.ids.slice(1), type: 'selection' },
        { ids: [...expected.ids, ...expected.ids.slice(0, 1)], type: 'selection' },
        { ids: [Math.floor(random() * 12)], type: 'selection' },
      )
      break
  }
  return answers
}

const exerciseVectors = () => {
  const vectors: unknown[] = []
  const keys = allKeys()
  for (const key of keys) {
    for (const recall of [false, true]) {
      const seeds = key.startsWith('add:') || key.startsWith('sub:') ? 3 : 24
      for (let index = 0; index < seeds; index += 1) {
        const seed = (index * 2_654_435_761 + key.length * 97 + (recall ? 13 : 0)) >>> 0
        const random = makeRandom(seed)
        const exercise = generateExercise(key, { random, recall })
        const expected = expectedAnswer(exercise)
        const answers = [expected, ...wrongAnswersFor(exercise, makeRandom(seed + 1))].map(
          (answer) => ({ answer, correct: isExerciseAnswerCorrect(exercise, answer) }),
        )
        vectors.push({
          answers,
          exercise,
          expected,
          family: interactionFamily(key),
          key,
          nextRandom: random(),
          production: isProductionExercise(exercise),
          recall,
          seed,
          weight: skillWeight(key),
          wellFormed: isExerciseWellFormed(exercise),
        })
      }
    }
  }
  return vectors
}

const columnCountVectors = () => {
  const random = makeRandom(2024)
  const vectors: unknown[] = []
  for (let index = 0; index < 400; index += 1) {
    const digits = 1 + Math.floor(random() * 4)
    const first = Math.floor(random() * 10 ** digits)
    const second = Math.floor(random() * 10 ** Math.max(1, digits - Math.floor(random() * 2)))
    const third = Math.floor(random() * 1000)
    vectors.push({
      borrows: countBorrows(first, second),
      carries2: countCarries([first, second]),
      carries3: countCarries([first, second, third]),
      first,
      second,
      third,
    })
  }
  return vectors
}

/* ------------------------------------------------------------------------------------------ */
/* Learner simulation                                                                          */
/* ------------------------------------------------------------------------------------------ */

type Scenario = Readonly<{
  accuracy: number
  days: number
  name: string
  pathsAt: ReadonlyArray<readonly [day: number, settings: LearningPathSettings]>
  seed: number
  timeZone: string
}>

const automatic: LearningPathSettings = {
  enabledSkills: [],
  focusSkill: null,
  mode: 'automatic',
  subtractionMethod: 'compensation',
}

const everything = (focusSkill: SkillId | null = null): LearningPathSettings => ({
  enabledSkills: [...allSkillIds],
  focusSkill,
  mode: 'manual',
  subtractionMethod: 'decomposition',
})

const scenarios: ReadonlyArray<Scenario> = [
  {
    accuracy: 0.85,
    days: 70,
    name: 'tables-paris',
    pathsAt: [[0, automatic]],
    seed: 11,
    timeZone: 'Europe/Paris',
  },
  {
    accuracy: 0.7,
    days: 45,
    name: 'all-paths-new-york',
    pathsAt: [
      [0, everything()],
      [15, everything('column-addition')],
      [30, everything('fraction-line')],
    ],
    seed: 22,
    timeZone: 'America/New_York',
  },
  {
    accuracy: 0.92,
    days: 55,
    name: 'focus-shanghai',
    pathsAt: [
      [
        0,
        {
          ...automatic,
          enabledSkills: ['fraction-read', 'numeration'],
          focusSkill: 'fraction-read',
        },
      ],
      [20, everything('near-ten')],
      [40, everything('fraction-operation')],
    ],
    seed: 33,
    timeZone: 'Asia/Shanghai',
  },
  {
    accuracy: 0.6,
    days: 40,
    name: 'struggling-auckland',
    pathsAt: [
      [0, automatic],
      [10, { ...everything('subtraction-facts'), mode: 'automatic' }],
    ],
    seed: 44,
    timeZone: 'Pacific/Auckland',
  },
  {
    accuracy: 0.95,
    days: 90,
    name: 'advanced-utc',
    pathsAt: [
      [0, automatic],
      [60, everything('column-subtraction')],
    ],
    seed: 55,
    timeZone: 'UTC',
  },
  {
    accuracy: 0.8,
    days: 35,
    name: 'fractions-los-angeles',
    pathsAt: [
      [
        0,
        {
          ...everything('fraction-compare'),
          enabledSkills: [
            'fraction-read',
            'fraction-equal',
            'fraction-line',
            'fraction-compare',
            'fraction-operation',
          ],
        },
      ],
    ],
    seed: 66,
    timeZone: 'America/Los_Angeles',
  },
]

const responseFor = (
  question: PracticeQuestion,
  correct: boolean,
  random: () => number,
): Readonly<{ response?: PracticeAnswer; selected?: number }> => {
  const exercise = question.exercise
  if (exercise === undefined) {
    const answer = LearningEngine.correctAnswer(question)
    if (correct) return { selected: answer }
    const wrong = question.choices.filter((choice) => choice !== answer)
    return {
      selected:
        wrong.length > 0
          ? (wrong[Math.floor(random() * wrong.length)] ?? 0)
          : answer + 1 + Math.floor(random() * 3),
    }
  }
  const expected = expectedAnswer(exercise)
  if (correct) {
    if ('choices' in exercise && exercise.choices.length > 0 && !isProductionExercise(exercise)) {
      const right = exercise.choices.find((choice) => isExerciseAnswerCorrect(exercise, choice))
      if (right !== undefined) return { response: right }
    }
    return { response: expected }
  }
  const wrong = wrongAnswersFor(exercise, random).filter(
    (answer) =>
      !isExerciseAnswerCorrect(exercise, answer) &&
      (isProductionExercise(exercise) ||
        !('choices' in exercise) ||
        exercise.choices.length === 0 ||
        exercise.choices.some((choice) => JSON.stringify(choice) === JSON.stringify(answer))),
  )
  return { response: wrong[Math.floor(random() * wrong.length)] ?? expected }
}

const extraPolicies = (paths: LearningPathSettings, random: () => number): PracticePolicy => {
  const draw = Math.floor(random() * 7)
  switch (draw) {
    case 0:
      return { curriculum: { paths }, questionCount: 5 }
    case 1:
      return {
        focusTable: [2, 5, 10, 3, 4, 6, 7, 8, 9][Math.floor(random() * 9)] ?? 2,
        questionCount: 8,
      }
    case 2:
      return {
        curriculum: { packs: ['core', 'bonus-11-12'] },
        focusTable: random() < 0.5 ? 11 : 12,
        questionCount: 8,
      }
    case 3:
      return { curriculum: { packs: ['inverse-division'] }, questionCount: 6 }
    case 4: {
      const focusSkill = allSkillIds[Math.floor(random() * allSkillIds.length)] ?? 'addition-facts'
      return {
        curriculum: { paths },
        focusSkill,
        questionCount: focusSkill.startsWith('column') ? 9 : 8,
      }
    }
    case 5:
      return {
        curriculum: { packs: ['core', 'bonus-11-12', 'inverse-division'], paths },
        questionCount: 10,
      }
    default:
      return { curriculum: { paths }, questionCount: 12 }
  }
}

const tamperings = (event: AttemptEvent): ReadonlyArray<AttemptEvent> => [
  event,
  { ...event, correct: !event.correct },
  { ...event, answerMode: event.answerMode === 'keypad' ? 'choice' : 'keypad' },
  { ...event, choices: [1, 2, 3] },
  { ...event, sequence: event.questionCount },
  { ...event, factKey: event.factKey.startsWith('add:') ? 'add:9:9' : `${event.factKey}x` },
]

const runScenario = (scenario: Scenario) => {
  const random = makeRandom(scenario.seed)
  const steps: unknown[] = []
  let snapshot: LearningSnapshot = LearningEngine.emptySnapshot()
  const practiceDayKeys = new Set<string>()
  const completions: Array<{ learningDayKey: string; sessionKind: PracticeSession['kind'] }> = []
  let paths: LearningPathSettings = automatic
  const start = Date.UTC(2026, 0, 5, 7, 0, 0)

  for (let day = 0; day < scenario.days; day += 1) {
    for (const [changeDay, settings] of scenario.pathsAt) if (changeDay === day) paths = settings
    if (random() < 0.2) continue
    const sessionsToday = 1 + (random() < 0.45 ? 1 : 0) + (random() < 0.15 ? 1 : 0)
    let clock = start + day * 86_400_000 + Math.floor(random() * 16) * 3_600_000

    for (let sessionIndex = 0; sessionIndex < sessionsToday; sessionIndex += 1) {
      const policy: PracticePolicy =
        sessionIndex === 0
          ? { curriculum: { paths }, kind: 'daily-watering' }
          : extraPolicies(paths, random)
      const seed = Math.floor(random() * 4_294_967_296)
      const now = new Date(clock)
      const snapshotAtStart = snapshot
      let session = LearningEngine.createSession({
        now,
        policy,
        seed,
        snapshot,
        timeZone: scenario.timeZone,
      })
      steps.push({
        expect: session,
        now,
        op: 'createSession',
        policy,
        seed,
        timeZone: scenario.timeZone,
      })
      if (session.questions.length === 0) continue

      const events: AttemptEvent[] = []
      while (session.currentIndex < session.questions.length) {
        const question = session.questions[session.currentIndex] as PracticeQuestion
        const correct = random() < scenario.accuracy
        const { response, selected } = responseFor(question, correct, random)
        clock += 1_200 + Math.floor(random() * 6_000)
        const answeredAt = new Date(clock)
        const eventId = `e-${scenario.seed}-${day}-${sessionIndex}-${session.currentIndex}-${events.length}`
        const result = LearningEngine.answer({
          answeredAt,
          eventId,
          session,
          ...(response === undefined ? {} : { response }),
          ...(selected === undefined ? {} : { selected }),
        })
        steps.push({
          answeredAt,
          eventId,
          expect: {
            correct: result.correct,
            currentIndex: result.session.currentIndex,
            event: result.event,
            questionIds: result.session.questions.map(({ id }) => id),
          },
          op: 'answer',
          ...(response === undefined ? {} : { response }),
          ...(selected === undefined ? {} : { selected }),
        })
        events.push(result.event)
        session = result.session
        practiceDayKeys.add(result.event.learningDayKey ?? '')
        if (random() < 0.08) {
          steps.push({
            expect: LearningEngine.deriveRescueStrategies({ question, snapshot }),
            op: 'rescue',
            question,
          })
        }
      }

      snapshot = LearningEngine.reduce({ attempts: events, snapshot, timeZone: scenario.timeZone })
      const last = events.at(-1) as AttemptEvent
      completions.push({ learningDayKey: last.learningDayKey ?? '', sessionKind: session.kind })
      steps.push({
        attempts: events.map(({ eventId }) => eventId),
        expectInsight: LearningEngine.deriveSessionInsight({
          attempts: events,
          snapshot: snapshotAtStart,
          timeZone: scenario.timeZone,
        }),
        op: 'reduce',
        timeZone: scenario.timeZone,
      })
      steps.push({
        expect: events.flatMap((event) =>
          tamperings(event).map((candidate) => LearningEngine.validateExerciseAttempt(candidate)),
        ),
        op: 'validate',
        attempts: events.map(({ eventId }) => eventId),
      })
    }

    if (day % 5 === 4 || day === scenario.days - 1) {
      const todayKey = LearningEngine.learningDayKey({
        at: new Date(clock),
        timeZone: scenario.timeZone,
      })
      const ledger = LearningEngine.deriveGardenRewardLedger({ completions })
      const rhythmInput = {
        activeSession: { currentIndex: day % 6, kind: 'daily-watering' as const, questionCount: 6 },
        practiceDayKeys: [...practiceDayKeys],
        rewardedDayKeys: ledger.rewardedDayKeys,
        todayKey,
      }
      const garden = {
        awardedFlowerIds: ['twilight-lupine', 'rose-lotus'].slice(0, day % 3) as never,
        completedSessions: ledger.gardenBloomCount,
        flowerOrder:
          day % 2 === 0 ? undefined : (['blue-wisteria', 'rose-lotus', 'nonsense'] as never),
        snapshot,
      }
      steps.push({
        completions: [...completions],
        expect: {
          garden: LearningEngine.deriveGardenProgress(garden),
          ledger,
          openSkills: deriveOpenSkills(
            snapshot.facts,
            paths,
            LearningEngine.deriveLearningProgress({ snapshot }).packs.bonus1112.unlocked,
          ),
          pathProgress: derivePathProgress(snapshot.facts, paths, false),
          progress: [
            LearningEngine.deriveLearningProgress({ snapshot }),
            LearningEngine.deriveLearningProgress({
              curriculum: { packs: ['core', 'bonus-11-12', 'inverse-division'], paths },
              snapshot,
            }),
          ],
          rewards: LearningEngine.deriveRewards(garden),
          rhythm: LearningEngine.derivePracticeRhythm(rhythmInput),
        },
        garden,
        op: 'derive',
        paths,
        rhythmInput,
        snapshot,
        todayKey,
      })
    }
  }
  return { name: scenario.name, steps }
}

/* ------------------------------------------------------------------------------------------ */
/* Pure derivations with synthetic inputs                                                      */
/* ------------------------------------------------------------------------------------------ */

const rhythmVectors = () => {
  const random = makeRandom(77)
  const vectors: unknown[] = []
  const dayKey = (offset: number) =>
    new Date(Date.UTC(2026, 2, 28) + offset * 86_400_000).toISOString().slice(0, 10)
  for (let index = 0; index < 150; index += 1) {
    const todayKey = dayKey(Math.floor(random() * 30))
    const practiceDayKeys = Array.from({ length: Math.floor(random() * 12) }, () =>
      dayKey(Math.floor(random() * 40) - 5),
    )
    const rewardedDayKeys = practiceDayKeys.filter(() => random() < 0.6)
    const activeSession =
      random() < 0.3
        ? null
        : {
            currentIndex: Math.floor(random() * 9),
            kind: random() < 0.6 ? ('daily-watering' as const) : ('extra-practice' as const),
            questionCount: Math.floor(random() * 9),
          }
    const input = { activeSession, practiceDayKeys, rewardedDayKeys, todayKey }
    vectors.push({ expect: LearningEngine.derivePracticeRhythm(input), input })
  }
  return vectors
}

const ledgerVectors = () => {
  const random = makeRandom(88)
  const vectors: unknown[] = []
  for (let index = 0; index < 120; index += 1) {
    const day = () => `2026-04-${String(1 + Math.floor(random() * 20)).padStart(2, '0')}`
    const completions = Array.from({ length: Math.floor(random() * 10) }, () => ({
      learningDayKey: day(),
      ...(random() < 0.2
        ? {}
        : {
            sessionKind: random() < 0.6 ? ('daily-watering' as const) : ('extra-practice' as const),
          }),
    }))
    const input = {
      completions,
      ...(random() < 0.5
        ? {}
        : { gardenBloomCount: Math.floor(random() * 12) + (random() < 0.2 ? 0.5 : 0) }),
      ...(random() < 0.5
        ? {}
        : { rewardedDayKeys: Array.from({ length: Math.floor(random() * 5) }, day) }),
    }
    const merged = {
      ledgers: [
        { gardenBloomCount: Math.floor(random() * 10), rewardedDayKeys: [day(), day()] },
        { gardenBloomCount: Math.floor(random() * 10), rewardedDayKeys: [day()] },
      ],
    }
    vectors.push({
      expect: LearningEngine.deriveGardenRewardLedger(input),
      expectMerged: LearningEngine.mergeGardenRewardLedgers(merged),
      input,
      merged,
    })
  }
  return vectors
}

const fluentSnapshot = (count: number): LearningSnapshot => {
  const facts: Record<string, LearningSnapshot['facts'][string]> = {}
  for (let index = 0; index < count; index += 1) {
    facts[`frac:read:${index}`] = {
      correctCount: 5,
      correctStreak: 3,
      difficulty: 0.4,
      dueAt: null,
      lapseCount: 0,
      lastReviewedAt: null,
      latencyMs: null,
      recallDayKeys: [],
      stabilityDays: 4,
      state: 'fluent',
      successfulDayKeys: [],
    }
  }
  return { algorithmVersion: '1', facts, processedEventIds: [] }
}

const gardenVectors = () => {
  const random = makeRandom(99)
  const ids = LearningEngine.gardenFlowerIds
  const vectors: unknown[] = []
  for (let index = 0; index < 160; index += 1) {
    const order =
      random() < 0.4
        ? undefined
        : [...ids].sort(() => (random() < 0.5 ? -1 : 1)).slice(0, Math.floor(random() * 10))
    const input = {
      awardedFlowerIds: random() < 0.5 ? undefined : ids.filter(() => random() < 0.3),
      completedSessions:
        index % 40 === 39 ? Number.NaN : Math.floor(random() * 32) + (random() < 0.1 ? 0.7 : 0),
      flowerOrder: order,
      snapshot: fluentSnapshot(Math.floor(random() * 35)),
    }
    vectors.push({
      expect: LearningEngine.deriveGardenProgress(input),
      expectRewards: LearningEngine.deriveRewards({
        ...input,
        completedSessions: Number.isNaN(input.completedSessions) ? 0 : input.completedSessions,
      }),
      input: {
        ...input,
        completedSessions: Number.isNaN(input.completedSessions) ? null : input.completedSessions,
      },
    })
  }
  return vectors
}

const dayKeyVectors = () => {
  const random = makeRandom(5)
  const zones = [
    'UTC',
    'Europe/Paris',
    'America/New_York',
    'Asia/Shanghai',
    'Pacific/Auckland',
    'America/Los_Angeles',
    'Australia/Lord_Howe',
    'Asia/Kathmandu',
  ]
  return Array.from({ length: 400 }, () => {
    const at = Date.UTC(2025, 0, 1) + Math.floor(random() * 3 * 365 * 86_400_000)
    const timeZone = zones[Math.floor(random() * zones.length)] ?? 'UTC'
    return { at, dayKey: LearningEngine.learningDayKey({ at: new Date(at), timeZone }), timeZone }
  })
}

write('rng', rngVectors())
write('exercises', exerciseVectors())
write('columns', columnCountVectors())
write('rhythm', rhythmVectors())
write('ledger', ledgerVectors())
write('garden', gardenVectors())
write('day-keys', dayKeyVectors())
for (const scenario of scenarios) write(`scenario-${scenario.name}`, runScenario(scenario))
