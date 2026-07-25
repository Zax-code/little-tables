export type MasteryState = 'unseen' | 'learning' | 'familiar' | 'fluent'
export type QuestionOperation = 'divide' | 'multiply'

export type FactMastery = Readonly<{
  correctCount: number
  correctStreak: number
  difficulty: number
  dueAt: Date | null
  lastReviewedAt: Date | null
  lastReviewedDayKey?: string | undefined
  lapseCount: number
  latencyMs: number | null
  recallDayKeys: ReadonlyArray<string>
  successfulDayKeys: ReadonlyArray<string>
  stabilityDays: number
  state: MasteryState
}>

export type LearningSnapshot = Readonly<{
  algorithmVersion: '1'
  facts: Readonly<Record<string, FactMastery>>
  processedEventIds: ReadonlyArray<string>
}>

export type PracticeQuestion = Readonly<{
  answerMode: 'choice' | 'keypad'
  choices: ReadonlyArray<number>
  factKey: string
  id: string
  left: number
  operation: QuestionOperation
  right: number
}>

export type PracticeSession = Readonly<{
  createdAt: Date
  currentQuestionStartedAt: Date
  currentIndex: number
  id: string
  kind: 'daily-watering' | 'extra-practice'
  questions: ReadonlyArray<PracticeQuestion>
  seed: number
  timeZone: string
}>

export type ComebackKind = 'long' | 'none' | 'short'

export type PracticeRhythm = Readonly<{
  comeback: ComebackKind
  dailyWateringDone: boolean
  petalCount: number
  totalRewardedDays: number
  visitsUntilBloomingWeek: number
  week: ReadonlyArray<Readonly<{ dayKey: string; practiced: boolean; today: boolean }>>
  weeklyPracticeDays: number
}>

type DerivePracticeRhythmInput = Readonly<{
  activeSession: Readonly<{
    currentIndex: number
    kind: PracticeSession['kind']
    questionCount: number
  }> | null
  practiceDayKeys: ReadonlyArray<string>
  rewardedDayKeys: ReadonlyArray<string>
  todayKey: string
}>

export type GardenRewardLedger = Readonly<{
  gardenBloomCount: number
  gardenBloomsEarned: number
  rewardedDayKeys: ReadonlyArray<string>
}>

type DeriveGardenRewardLedgerInput = Readonly<{
  completions: ReadonlyArray<
    Readonly<{
      learningDayKey: string
      sessionKind?: PracticeSession['kind'] | undefined
    }>
  >
  gardenBloomCount?: number | undefined
  rewardedDayKeys?: ReadonlyArray<string> | undefined
}>

type MergeGardenRewardLedgersInput = Readonly<{
  ledgers: ReadonlyArray<
    Readonly<{
      gardenBloomCount: number
      rewardedDayKeys: ReadonlyArray<string>
    }>
  >
}>

export type AttemptEvent = Readonly<{
  answerMode: 'choice' | 'keypad'
  answeredAt: Date
  choices: ReadonlyArray<number>
  correct: boolean
  eventId: string
  factKey: string
  latencyMs: number
  learningDayKey?: string | undefined
  left: number
  operation?: QuestionOperation | undefined
  right: number
  questionCount: number
  selected: number
  sequence: number
  sessionId: string
  sessionKind?: PracticeSession['kind'] | undefined
}>

export type AnswerResult = Readonly<{
  correct: boolean
  event: AttemptEvent
  session: PracticeSession
}>

type AnswerInput = Readonly<{
  answeredAt: Date
  eventId: string
  selected: number
  session: PracticeSession
}>

export type CurriculumPack = 'bonus-11-12' | 'core' | 'inverse-division'

export type CurriculumPolicy = Readonly<{
  packs?: ReadonlyArray<CurriculumPack>
}>

export type PracticePolicy =
  | Readonly<{
      curriculum?: CurriculumPolicy
      focusTable?: number
      kind?: 'extra-practice'
      questionCount: number
    }>
  | Readonly<{
      curriculum?: CurriculumPolicy
      kind: 'daily-watering'
    }>

type CreateSessionInput = Readonly<{
  now: Date
  policy: PracticePolicy
  seed: number
  snapshot: LearningSnapshot
  timeZone?: string
}>

type ReduceAttemptsInput = Readonly<{
  attempts: ReadonlyArray<AttemptEvent>
  snapshot: LearningSnapshot
  timeZone?: string
}>

export type GardenReward = Readonly<{
  id: string
  kind: 'background' | 'flower' | 'pot' | 'sparkle'
  label: string
}>

export type GardenPlantStage = 'dormant' | 'growing' | 'locked' | 'mature'
export type GardenChapterStage = 'complete' | 'growing' | 'locked'

type GardenPlantMilestone = Readonly<{
  chapterId: GardenChapterId
  id: GardenPlantId
  lockedUntilStart: boolean
  masteryRequired: number
  matureAt: number
  name: string
  startAt: number
}>

type GardenChapterMilestone = Readonly<{
  id: GardenChapterId
  matureAt: number
  name: string
  plants: ReadonlyArray<GardenPlantMilestone>
  startAt: number
}>

const gardenFlowerCatalog = [
  {
    id: 'rose-lotus',
    name: 'rose lotus',
  },
  {
    id: 'twilight-lupine',
    name: 'twilight lupine',
  },
  {
    id: 'velvet-foxglove',
    name: 'velvet foxglove',
  },
  {
    id: 'plum-snapdragon',
    name: 'plum snapdragon',
  },
  {
    id: 'sunset-zinnia',
    name: 'sunset zinnia',
  },
  {
    id: 'ruby-bleeding-heart',
    name: 'ruby bleeding heart',
  },
  {
    id: 'blushing-peony',
    name: 'blushing peony',
  },
  {
    id: 'ivory-magnolia',
    name: 'ivory magnolia',
  },
  {
    id: 'blue-wisteria',
    name: 'blue wisteria',
  },
] as const

export type GardenPlantId = (typeof gardenFlowerCatalog)[number]['id']

const gardenChapterDefinitions = [
  { id: 'sunny-meadow', name: 'sunny meadow' },
  { id: 'secret-greenhouse', name: 'secret greenhouse' },
  { id: 'starlit-garden', name: 'starlit garden' },
] as const

export type GardenChapterId = (typeof gardenChapterDefinitions)[number]['id']

const gardenFlowerIds: ReadonlyArray<GardenPlantId> = gardenFlowerCatalog.map(({ id }) => id)
const gardenBloomsPerFlower = 3

export type GardenCollectionSnapshot = Readonly<{
  awardedFlowerIds: ReadonlyArray<GardenPlantId>
  bloomsPerFlower: typeof gardenBloomsPerFlower
  catalogVersion: '1'
  flowerOrder: ReadonlyArray<GardenPlantId>
  introductionSeen: boolean
}>

const gardenFlowerById: ReadonlyMap<GardenPlantId, (typeof gardenFlowerCatalog)[number]> = new Map(
  gardenFlowerCatalog.map((flower) => [flower.id, flower]),
)

const normalizedFlowerOrder = (
  flowerOrder: ReadonlyArray<GardenPlantId> | undefined,
): ReadonlyArray<GardenPlantId> => {
  const knownIds = new Set<GardenPlantId>(gardenFlowerIds)
  const uniqueIds: GardenPlantId[] = []
  for (const id of flowerOrder ?? []) {
    if (knownIds.has(id) && !uniqueIds.includes(id)) uniqueIds.push(id)
  }
  return [...uniqueIds, ...gardenFlowerIds.filter((id) => !uniqueIds.includes(id))]
}

const gardenMilestonesForOrder = (
  flowerOrder: ReadonlyArray<GardenPlantId> | undefined,
): Readonly<{
  chapters: ReadonlyArray<GardenChapterMilestone>
  plants: ReadonlyArray<GardenPlantMilestone>
}> => {
  const plants = normalizedFlowerOrder(flowerOrder).map((id, index): GardenPlantMilestone => {
    const chapterIndex = Math.floor(index / 3)
    const chapter = gardenChapterDefinitions[chapterIndex]
    const flower = gardenFlowerById.get(id)
    if (chapter === undefined || flower === undefined) {
      throw new Error(`Unknown garden flower at position ${index}`)
    }
    const chapterEnd = index % 3 === 2
    return {
      chapterId: chapter.id,
      id,
      lockedUntilStart: chapterEnd,
      masteryRequired: chapterEnd ? ([5, 15, 30][chapterIndex] ?? 0) : 0,
      matureAt: (index + 1) * gardenBloomsPerFlower,
      name: flower.name,
      startAt: index * gardenBloomsPerFlower + 1,
    }
  })
  const chapters = gardenChapterDefinitions.map((chapter, chapterIndex) => {
    const chapterPlants = plants.slice(chapterIndex * 3, chapterIndex * 3 + 3)
    return {
      ...chapter,
      matureAt: (chapterIndex + 1) * 3 * gardenBloomsPerFlower,
      plants: chapterPlants,
      startAt: chapterIndex * 3 * gardenBloomsPerFlower + 1,
    }
  })
  return { chapters, plants }
}

export type GardenPlantProgress = Readonly<{
  bloomsEarned: number
  bloomsRequired: number
  chapterId: GardenChapterId
  collected: boolean
  id: GardenPlantId
  lockedUntilStart: boolean
  masteryRemaining: number
  masteryRequired: number
  matureAt: number
  name: string
  stage: GardenPlantStage
  startAt: number
}>

export type GardenNextStep = Readonly<{
  blockedByMastery: boolean
  bloomsRemaining: number
  fluentFactsRemaining: number
  plant: GardenPlantProgress
  practiceDaysRemaining: number
  targetAt: number
  targetStage: 'growing' | 'mature'
  unlocksPot: boolean
}>

export type GardenChapterProgress = Readonly<{
  collectedCount: number
  id: GardenChapterId
  matureAt: number
  name: string
  plants: ReadonlyArray<GardenPlantProgress>
  stage: GardenChapterStage
  startAt: number
  totalCount: number
}>

export type GardenCollectionProgress = Readonly<{
  collectedCount: number
  complete: boolean
  totalCount: number
}>

export type GardenProgress = Readonly<{
  bloomCount: number
  chapters: ReadonlyArray<GardenChapterProgress>
  collection: GardenCollectionProgress
  featuredPlant: GardenPlantProgress | null
  nextStep: GardenNextStep | null
  plants: ReadonlyArray<GardenPlantProgress>
  rewards: ReadonlyArray<GardenReward>
}>

type DeriveRewardsInput = Readonly<{
  awardedFlowerIds?: ReadonlyArray<GardenPlantId> | undefined
  completedSessions: number
  flowerOrder?: ReadonlyArray<GardenPlantId> | undefined
  snapshot: LearningSnapshot
}>

export type FactProgressCounts = Readonly<{
  familiar: number
  fluent: number
  growing: number
  total: number
  unseen: number
}>

export type TableLearningProgress = Readonly<{
  facts: FactProgressCounts
  table: number
}>

export type CurriculumPackUnlock = Readonly<{
  current: number
  reason: 'core-not-stable' | 'no-fluent-family' | null
  required: number
  unlocked: boolean
}>

export type CurriculumPackProgress = Readonly<{
  bonus1112: CurriculumPackUnlock
  core: CurriculumPackUnlock
  inverseDivision: CurriculumPackUnlock
}>

export type LearningProgress = Readonly<{
  divisionFacts: FactProgressCounts
  facts: FactProgressCounts
  packs: CurriculumPackProgress
  tables: ReadonlyArray<TableLearningProgress>
}>

type DeriveLearningProgressInput = Readonly<{
  curriculum?: CurriculumPolicy
  snapshot: LearningSnapshot
}>

export type SessionInsight = Readonly<{
  count: number
  factKeys: ReadonlyArray<string>
  kind:
    | 'facts-became-familiar'
    | 'facts-became-fluent'
    | 'facts-practised'
    | 'keypad-recalls'
    | 'mistakes-recovered'
}>

type DeriveSessionInsightInput = Readonly<{
  attempts: ReadonlyArray<AttemptEvent>
  snapshot: LearningSnapshot
  timeZone?: string
}>

export type RescueStrategy =
  | Readonly<{
      columns: number
      kind: 'array'
      rows: number
      total: number
    }>
  | Readonly<{
      kind: 'commutative-flip'
      left: number
      right: number
      total: number
    }>
  | Readonly<{
      adjustment: Readonly<{ factKey: string; factor: number; product: number }>
      anchor: Readonly<{ factKey: string; factor: number; product: number }>
      commonFactor: number
      kind: 'known-fact-bridge'
      operator: 'add' | 'subtract'
      targetFactor: number
      total: number
    }>

type DeriveRescueStrategiesInput = Readonly<{
  question: PracticeQuestion
  snapshot: LearningSnapshot
}>

const INITIAL_FACTS: ReadonlyArray<readonly [number, number]> = [
  [2, 2],
  [2, 5],
  [5, 5],
  [2, 10],
  [5, 10],
  [3, 3],
  [3, 4],
  [4, 5],
  [3, 5],
  [4, 4],
  [2, 3],
  [2, 4],
]

const CORE_FACTS: ReadonlyArray<readonly [number, number]> = [
  ...INITIAL_FACTS,
  ...Array.from({ length: 10 }, (_, leftIndex) =>
    Array.from(
      { length: 10 - leftIndex },
      (_, rightOffset) => [leftIndex + 1, leftIndex + rightOffset + 1] as const,
    ),
  ).flat(),
].filter(
  ([left, right], index, values) =>
    values.findIndex(([otherLeft, otherRight]) => left === otherLeft && right === otherRight) ===
    index,
)

const BONUS_FACTS: ReadonlyArray<readonly [number, number]> = [
  ...Array.from({ length: 11 }, (_, index) => [index + 1, 11] as const),
  ...Array.from({ length: 12 }, (_, index) => [index + 1, 12] as const),
]

const canonicalFactKey = (left: number, right: number): string =>
  `${Math.min(left, right)}:${Math.max(left, right)}`

type QuestionOperands = Readonly<{
  left: number
  operation?: QuestionOperation
  right: number
}>

type CurriculumFact = Readonly<{
  factKey: string
  left: number
  operation: QuestionOperation
  right: number
  tables: ReadonlyArray<number>
}>

const correctAnswer = ({ left, operation = 'multiply', right }: QuestionOperands): number => {
  if (operation === 'multiply') return left * right
  if (right === 0 || !Number.isInteger(left / right)) {
    throw new RangeError('Division questions require a non-zero divisor and an integer answer')
  }
  return left / right
}

const factKey = ({ left, operation = 'multiply', right }: QuestionOperands): string =>
  operation === 'multiply' ? canonicalFactKey(left, right) : `divide:${left}:${right}`

const divisionCurriculumFor = (snapshot: LearningSnapshot): ReadonlyArray<CurriculumFact> =>
  Object.entries(snapshot.facts)
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([multiplicationKey, mastery]): ReadonlyArray<CurriculumFact> => {
      const match = /^(\d+):(\d+)$/.exec(multiplicationKey)
      if (match === null || mastery.state !== 'fluent') return []
      const first = Number(match[1])
      const second = Number(match[2])
      const product = first * second
      return [...new Set([first, second])].map((divisor) => ({
        factKey: factKey({ left: product, operation: 'divide', right: divisor }),
        left: product,
        operation: 'divide',
        right: divisor,
        tables: first === second ? [first] : [first, second],
      }))
    })

const WEAK_FACT_DIFFICULTY = 0.53
const CHOICE_RECALL_STABILITY_FACTOR = 1.5
const KEYPAD_RECALL_STABILITY_FACTOR = 2

const makeRandom = (initialSeed: number): (() => number) => {
  let state = initialSeed >>> 0

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

const shuffle = <A>(values: ReadonlyArray<A>, random: () => number): ReadonlyArray<A> => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const value = result[index]
    result[index] = result[other] as A
    result[other] = value as A
  }
  return result
}

const choicesFor = (question: QuestionOperands, random: () => number): ReadonlyArray<number> => {
  const { left, operation = 'multiply', right } = question
  const answer = correctAnswer(question)
  const candidates =
    operation === 'multiply'
      ? [
          answer,
          left * Math.max(1, right - 1),
          left * Math.min(12, right + 1),
          right * Math.max(1, left - 1),
          right * Math.min(12, left + 1),
          answer - left,
          answer + right,
          answer + 2,
          Math.max(0, answer - 2),
        ]
      : [answer, Math.max(0, answer - 1), answer + 1, right, answer + 2, Math.max(0, answer - 2)]
  const distinct = [...new Set(candidates.filter((candidate) => candidate >= 0))]
  let fallback = 1
  while (distinct.length < 4) {
    if (!distinct.includes(fallback)) distinct.push(fallback)
    fallback += 1
  }
  const wrong = shuffle(
    distinct.filter((candidate) => candidate !== answer),
    random,
  ).slice(0, 3)
  return shuffle([answer, ...wrong], random)
}

const emptySnapshot = (): LearningSnapshot => ({
  algorithmVersion: '1',
  facts: {},
  processedEventIds: [],
})

const EMPTY_MASTERY: FactMastery = {
  correctCount: 0,
  correctStreak: 0,
  difficulty: 0.5,
  dueAt: null,
  lapseCount: 0,
  lastReviewedAt: null,
  latencyMs: null,
  recallDayKeys: [],
  stabilityDays: 0,
  state: 'unseen',
  successfulDayKeys: [],
}

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

const learningDayKey = ({ at, timeZone }: Readonly<{ at: Date; timeZone: string }>): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

const dateForDayKey = (dayKey: string): Date => new Date(`${dayKey}T00:00:00.000Z`)

const shiftDayKey = (dayKey: string, days: number): string => {
  const date = dateForDayKey(dayKey)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const daysBetween = (earlier: string, later: string): number =>
  Math.max(
    0,
    Math.round((dateForDayKey(later).getTime() - dateForDayKey(earlier).getTime()) / 86_400_000),
  )

const derivePracticeRhythm = ({
  activeSession,
  practiceDayKeys,
  rewardedDayKeys,
  todayKey,
}: DerivePracticeRhythmInput): PracticeRhythm => {
  const practiced = new Set(practiceDayKeys)
  const rewarded = new Set(rewardedDayKeys)
  const week = Array.from({ length: 7 }, (_, index) => {
    const dayKey = shiftDayKey(todayKey, index - 6)
    return { dayKey, practiced: practiced.has(dayKey), today: dayKey === todayKey }
  })
  const weeklyPracticeDays = week.filter(({ practiced: wasPracticed }) => wasPracticed).length
  const latestPracticeDay = [...practiced]
    .filter((dayKey) => dayKey <= todayKey)
    .sort()
    .at(-1)
  const daysAway = latestPracticeDay === undefined ? 0 : daysBetween(latestPracticeDay, todayKey)
  const comeback: ComebackKind = daysAway >= 7 ? 'long' : daysAway >= 2 ? 'short' : 'none'
  const dailyWateringDone = rewarded.has(todayKey)
  const activeDaily = activeSession?.kind === 'daily-watering' ? activeSession : null
  const partialPetals =
    activeDaily === null || activeDaily.questionCount <= 0
      ? 0
      : Math.min(4, Math.ceil((activeDaily.currentIndex / activeDaily.questionCount) * 5))

  return {
    comeback,
    dailyWateringDone,
    petalCount: dailyWateringDone ? 5 : partialPetals,
    totalRewardedDays: rewarded.size,
    visitsUntilBloomingWeek: Math.max(0, 3 - weeklyPracticeDays),
    week,
    weeklyPracticeDays,
  }
}

const deriveGardenRewardLedger = ({
  completions,
  gardenBloomCount = 0,
  rewardedDayKeys = [],
}: DeriveGardenRewardLedgerInput): GardenRewardLedger => {
  const rewarded = new Set(rewardedDayKeys)
  let bloomCount = Math.max(0, Math.floor(gardenBloomCount), rewarded.size)
  let gardenBloomsEarned = 0

  for (const completion of completions) {
    if (completion.sessionKind === 'extra-practice' || rewarded.has(completion.learningDayKey)) {
      continue
    }
    rewarded.add(completion.learningDayKey)
    bloomCount += 1
    gardenBloomsEarned += 1
  }

  return {
    gardenBloomCount: bloomCount,
    gardenBloomsEarned,
    rewardedDayKeys: [...rewarded].sort(),
  }
}

const mergeGardenRewardLedgers = ({ ledgers }: MergeGardenRewardLedgersInput): GardenRewardLedger =>
  deriveGardenRewardLedger({
    completions: [],
    gardenBloomCount: Math.max(0, ...ledgers.map(({ gardenBloomCount }) => gardenBloomCount)),
    rewardedDayKeys: ledgers.flatMap(({ rewardedDayKeys }) => rewardedDayKeys),
  })

const masteryState = (
  correctCount: number,
  successfulDays: number,
  recallDays: number,
  current: MasteryState,
): MasteryState => {
  if (correctCount >= 5 && successfulDays >= 3 && recallDays >= 2) return 'fluent'
  if (correctCount >= 3 && successfulDays >= 2) return 'familiar'
  if (correctCount > 0 || current !== 'unseen') return 'learning'
  return 'unseen'
}

const updateMastery = (
  current: FactMastery,
  attempt: AttemptEvent,
  timeZone: string,
): FactMastery => {
  const dayKey = attempt.learningDayKey ?? learningDayKey({ at: attempt.answeredAt, timeZone })
  const isNewSuccessfulDay = attempt.correct && !current.successfulDayKeys.includes(dayKey)
  const successfulDayKeys = attempt.correct
    ? [...new Set([...current.successfulDayKeys, dayKey])]
    : current.successfulDayKeys
  const recallDayKeys =
    attempt.correct && attempt.answerMode === 'keypad'
      ? [...new Set([...current.recallDayKeys, dayKey])]
      : current.recallDayKeys
  // Durable mastery advances at most once per local learning day. Repeating a fact can still
  // repair an error and reinforce the answer, but a long same-day session is not evidence of
  // spaced recall.
  const correctCount = current.correctCount + (isNewSuccessfulDay ? 1 : 0)
  const stabilityDays = attempt.correct
    ? current.stabilityDays === 0
      ? 1
      : isNewSuccessfulDay
        ? Math.min(
            60,
            current.stabilityDays *
              (attempt.answerMode === 'keypad'
                ? KEYPAD_RECALL_STABILITY_FACTOR
                : CHOICE_RECALL_STABILITY_FACTOR),
          )
        : current.stabilityDays
    : Math.max(0, current.stabilityDays * 0.35)
  const nextState = attempt.correct
    ? masteryState(correctCount, successfulDayKeys.length, recallDayKeys.length, current.state)
    : current.state === 'unseen'
      ? 'learning'
      : current.state === 'fluent'
        ? 'familiar'
        : 'learning'

  return {
    correctCount,
    correctStreak: attempt.correct ? current.correctStreak + (isNewSuccessfulDay ? 1 : 0) : 0,
    difficulty: Math.min(
      1,
      Math.max(0, current.difficulty + (attempt.correct ? (isNewSuccessfulDay ? -0.02 : 0) : 0.08)),
    ),
    dueAt:
      attempt.correct && !isNewSuccessfulDay && current.dueAt !== null
        ? current.dueAt
        : addDays(attempt.answeredAt, Math.max(0.04, stabilityDays)),
    lapseCount: current.lapseCount + (attempt.correct ? 0 : 1),
    lastReviewedAt: attempt.answeredAt,
    lastReviewedDayKey: dayKey,
    latencyMs:
      !attempt.correct || !isNewSuccessfulDay
        ? current.latencyMs
        : current.latencyMs === null
          ? attempt.latencyMs
          : Math.round(current.latencyMs * 0.7 + attempt.latencyMs * 0.3),
    recallDayKeys,
    stabilityDays,
    state: nextState,
    successfulDayKeys,
  }
}

const reduce = ({
  attempts,
  snapshot,
  timeZone = 'UTC',
}: ReduceAttemptsInput): LearningSnapshot => {
  const processed = new Set(snapshot.processedEventIds)
  const facts: Record<string, FactMastery> = { ...snapshot.facts }
  let changed = false

  for (const attempt of attempts) {
    if (processed.has(attempt.eventId)) continue
    facts[attempt.factKey] = updateMastery(
      facts[attempt.factKey] ?? EMPTY_MASTERY,
      attempt,
      timeZone,
    )
    processed.add(attempt.eventId)
    changed = true
  }

  if (!changed) return snapshot
  return {
    ...snapshot,
    facts,
    processedEventIds: [...processed],
  }
}

const deriveCurriculumPackProgress = (snapshot: LearningSnapshot): CurriculumPackProgress => {
  const stableCoreFacts = CORE_FACTS.filter(([left, right]) => {
    const state = snapshot.facts[canonicalFactKey(left, right)]?.state ?? 'unseen'
    return state === 'familiar' || state === 'fluent'
  }).length
  const fluentFamilies = Object.entries(snapshot.facts).filter(
    ([candidateFactKey, mastery]) =>
      /^\d+:\d+$/.test(candidateFactKey) && mastery.state === 'fluent',
  ).length
  const bonusUnlocked = stableCoreFacts === CORE_FACTS.length
  const inverseDivisionUnlocked = fluentFamilies >= 1

  return {
    bonus1112: {
      current: stableCoreFacts,
      reason: bonusUnlocked ? null : 'core-not-stable',
      required: CORE_FACTS.length,
      unlocked: bonusUnlocked,
    },
    core: { current: 0, reason: null, required: 0, unlocked: true },
    inverseDivision: {
      current: fluentFamilies,
      reason: inverseDivisionUnlocked ? null : 'no-fluent-family',
      required: 1,
      unlocked: inverseDivisionUnlocked,
    },
  }
}

const deriveLearningProgress = ({
  curriculum,
  snapshot,
}: DeriveLearningProgressInput): LearningProgress => {
  const packs = curriculum?.packs ?? ['core']
  const packProgress = deriveCurriculumPackProgress(snapshot)
  const multiplicationFacts = [
    ...(packs.includes('core') ? CORE_FACTS : []),
    ...(packs.includes('bonus-11-12') && packProgress.bonus1112.unlocked ? BONUS_FACTS : []),
  ]
  const divisionFacts =
    packs.includes('inverse-division') && packProgress.inverseDivision.unlocked
      ? divisionCurriculumFor(snapshot)
      : []
  const countsForKeys = (selectedFactKeys: ReadonlyArray<string>): FactProgressCounts => {
    const states = selectedFactKeys.map(
      (selectedFactKey) => snapshot.facts[selectedFactKey]?.state ?? 'unseen',
    )
    return {
      familiar: states.filter((state) => state === 'familiar').length,
      fluent: states.filter((state) => state === 'fluent').length,
      growing: states.filter((state) => state === 'learning').length,
      total: states.length,
      unseen: states.filter((state) => state === 'unseen').length,
    }
  }
  const multiplicationFactKeys = multiplicationFacts.map(([left, right]) =>
    canonicalFactKey(left, right),
  )
  const divisionFactKeys = divisionFacts.map(({ factKey: divisionFactKey }) => divisionFactKey)
  const tables = [...new Set(multiplicationFacts.flatMap(([left, right]) => [left, right]))].sort(
    (first, second) => first - second,
  )

  return {
    divisionFacts: countsForKeys(divisionFactKeys),
    facts: countsForKeys([...multiplicationFactKeys, ...divisionFactKeys]),
    packs: packProgress,
    tables: tables.map((table) => ({
      facts: countsForKeys(
        multiplicationFacts
          .filter(([left, right]) => left === table || right === table)
          .map(([left, right]) => canonicalFactKey(left, right)),
      ),
      table,
    })),
  }
}

const deriveSessionInsight = ({
  attempts,
  snapshot,
  timeZone = 'UTC',
}: DeriveSessionInsightInput): SessionInsight | null => {
  const after = reduce({ attempts, snapshot, timeZone })
  const factKeys = [...new Set(attempts.map(({ factKey: attemptedFactKey }) => attemptedFactKey))]
  const becameFluent = factKeys.filter(
    (attemptedFactKey) =>
      after.facts[attemptedFactKey]?.state === 'fluent' &&
      snapshot.facts[attemptedFactKey]?.state !== 'fluent',
  )
  const becameFamiliar = factKeys.filter((attemptedFactKey) => {
    const beforeState = snapshot.facts[attemptedFactKey]?.state ?? 'unseen'
    const afterState = after.facts[attemptedFactKey]?.state ?? 'unseen'
    return afterState === 'familiar' && beforeState !== 'familiar' && beforeState !== 'fluent'
  })

  if (becameFluent.length > 0) {
    return {
      count: becameFluent.length,
      factKeys: becameFluent,
      kind: 'facts-became-fluent',
    }
  }

  if (becameFamiliar.length > 0) {
    return {
      count: becameFamiliar.length,
      factKeys: becameFamiliar,
      kind: 'facts-became-familiar',
    }
  }

  const missed = new Set<string>()
  const recovered = new Set<string>()
  for (const attempt of attempts) {
    if (!attempt.correct) missed.add(attempt.factKey)
    else if (missed.has(attempt.factKey)) recovered.add(attempt.factKey)
  }
  if (recovered.size > 0) {
    return {
      count: recovered.size,
      factKeys: [...recovered],
      kind: 'mistakes-recovered',
    }
  }

  const keypadRecalls = [
    ...new Set(
      attempts
        .filter(({ answerMode, correct }) => answerMode === 'keypad' && correct)
        .map(({ factKey: attemptedFactKey }) => attemptedFactKey),
    ),
  ]
  if (keypadRecalls.length > 0) {
    return { count: keypadRecalls.length, factKeys: keypadRecalls, kind: 'keypad-recalls' }
  }

  const practised = [
    ...new Set(
      attempts
        .filter(({ correct }) => correct)
        .map(({ factKey: attemptedFactKey }) => attemptedFactKey),
    ),
  ]
  return practised.length > 0
    ? { count: practised.length, factKeys: practised, kind: 'facts-practised' }
    : null
}

const deriveRescueStrategies = ({
  question,
  snapshot,
}: DeriveRescueStrategiesInput): ReadonlyArray<RescueStrategy> => {
  if (question.operation !== 'multiply') return []

  const total = correctAnswer(question)
  const strategies: RescueStrategy[] = [
    { columns: question.right, kind: 'array', rows: question.left, total },
  ]
  if (question.left !== question.right) {
    strategies.push({
      kind: 'commutative-flip',
      left: question.right,
      right: question.left,
      total,
    })
  }

  const preferredAnchors = [10, 5, 2, 1, 12, 11, 9, 8, 7, 6, 4, 3]
  const orientations = [
    { commonFactor: question.right, targetFactor: question.left },
    { commonFactor: question.left, targetFactor: question.right },
  ]
  for (const { commonFactor, targetFactor } of orientations) {
    for (const anchorFactor of preferredAnchors) {
      if (anchorFactor === targetFactor) continue
      const adjustmentFactor = Math.abs(targetFactor - anchorFactor)
      if (adjustmentFactor === 0) continue
      const anchorFactKey = canonicalFactKey(anchorFactor, commonFactor)
      const adjustmentFactKey = canonicalFactKey(adjustmentFactor, commonFactor)
      if (
        snapshot.facts[anchorFactKey]?.state !== 'fluent' ||
        snapshot.facts[adjustmentFactKey]?.state !== 'fluent'
      ) {
        continue
      }
      strategies.push({
        adjustment: {
          factKey: adjustmentFactKey,
          factor: adjustmentFactor,
          product: adjustmentFactor * commonFactor,
        },
        anchor: {
          factKey: anchorFactKey,
          factor: anchorFactor,
          product: anchorFactor * commonFactor,
        },
        commonFactor,
        kind: 'known-fact-bridge',
        operator: anchorFactor < targetFactor ? 'add' : 'subtract',
        targetFactor,
        total,
      })
      return strategies
    }
  }

  return strategies
}

const createSession = ({
  now,
  policy,
  seed,
  snapshot,
  timeZone = 'UTC',
}: CreateSessionInput): PracticeSession => {
  const random = makeRandom(seed)
  const sessionKind = policy.kind === 'daily-watering' ? 'daily-watering' : 'extra-practice'
  const todayKey = learningDayKey({ at: now, timeZone })
  const curriculumPacks = policy.curriculum?.packs ?? ['core']
  const packProgress = deriveCurriculumPackProgress(snapshot)
  const multiplicationFacts = [
    ...(curriculumPacks.includes('core') ? CORE_FACTS : []),
    ...(curriculumPacks.includes('bonus-11-12') && packProgress.bonus1112.unlocked
      ? BONUS_FACTS
      : []),
  ]
  const multiplicationCurriculum = multiplicationFacts.map(([left, right]): CurriculumFact => ({
    factKey: canonicalFactKey(left, right),
    left,
    operation: 'multiply',
    right,
    tables: left === right ? [left] : [left, right],
  }))
  const divisionCurriculum =
    curriculumPacks.includes('inverse-division') && packProgress.inverseDivision.unlocked
      ? divisionCurriculumFor(snapshot)
      : []
  const curriculum = [...multiplicationCurriculum, ...divisionCurriculum]
  const candidateFacts = curriculum
    .map((curriculumFact, curriculumIndex) => {
      const mastery = snapshot.facts[curriculumFact.factKey]
      const due = mastery?.dueAt !== null && mastery?.dueAt !== undefined && mastery.dueAt <= now
      const reviewedToday = mastery?.lastReviewedDayKey
        ? mastery.lastReviewedDayKey === todayKey
        : mastery?.lastReviewedAt !== null && mastery?.lastReviewedAt !== undefined
          ? learningDayKey({ at: mastery.lastReviewedAt, timeZone }) === todayKey
          : false
      const weak =
        mastery !== undefined &&
        (mastery.correctStreak === 0 ||
          (mastery.lapseCount > 0 && mastery.correctStreak === 1) ||
          mastery.difficulty >= WEAK_FACT_DIFFICULTY ||
          (mastery.latencyMs !== null && mastery.latencyMs > 3_000))
      const stateScore =
        mastery === undefined
          ? Math.max(0, 120 - curriculumIndex)
          : mastery.state === 'learning'
            ? 260
            : mastery.state === 'familiar'
              ? 210
              : 40
      const dueScore = due ? 220 : 0
      const latencyScore = mastery?.latencyMs !== null && (mastery?.latencyMs ?? 0) > 3_000 ? 35 : 0
      const difficultyScore = (mastery?.difficulty ?? 0) * 40
      return {
        ...curriculumFact,
        due,
        mastery,
        reviewedToday,
        score: stateScore + dueScore + latencyScore + difficultyScore + random(),
        weak,
      }
    })
    .sort((first, second) => second.score - first.score)
  const selectBalancedFacts = (
    candidates: ReadonlyArray<(typeof candidateFacts)[number]>,
    count: number,
  ): ReadonlyArray<(typeof candidateFacts)[number]> => {
    const priorityReview = candidates.filter(
      ({ due, mastery, weak }) => mastery !== undefined && (due || weak),
    )
    const olderReview = candidates.filter(
      ({ due, mastery, reviewedToday, weak }) =>
        mastery !== undefined && !due && !weak && !reviewedToday,
    )
    const recentReview = candidates.filter(
      ({ due, mastery, reviewedToday, weak }) =>
        mastery !== undefined && !due && !weak && reviewedToday,
    )
    const unseen = candidates.filter(({ mastery }) => mastery === undefined)
    // Urgent sessions spend half their slots on due or weak facts and reserve 30% for
    // unseen material. Otherwise, half-new sessions prevent a recently learned pool
    // from monopolizing practice; remaining mixed slots prefer older reviews.
    const priorityTarget = priorityReview.length > 0 ? Math.max(1, Math.floor(count / 2)) : 0
    const unseenTarget =
      priorityReview.length > 0 ? (count === 1 ? 0 : Math.ceil(count * 0.3)) : Math.ceil(count / 2)
    const selected = [...priorityReview.slice(0, priorityTarget), ...unseen.slice(0, unseenTarget)]
    const selectedKeys = new Set(selected.map(({ factKey: selectedFactKey }) => selectedFactKey))
    const remainingPriority = priorityReview.slice(priorityTarget)
    const olderPriority = remainingPriority.filter(({ reviewedToday }) => !reviewedToday)
    const recentPriority = remainingPriority.filter(({ reviewedToday }) => reviewedToday)
    const remainingUnseen = unseen.slice(unseenTarget)
    const mixedAndFallback =
      priorityReview.length > 0
        ? [
            ...olderReview,
            ...olderPriority,
            ...remainingUnseen,
            ...recentReview,
            ...recentPriority,
            ...candidates,
          ]
        : [...olderReview, ...recentReview, ...remainingUnseen, ...candidates]
    const fill = mixedAndFallback
      .filter(({ factKey: candidateFactKey }) => !selectedKeys.has(candidateFactKey))
      .filter(
        ({ factKey: candidateFactKey }, index, values) =>
          values.findIndex(({ factKey: otherFactKey }) => candidateFactKey === otherFactKey) ===
          index,
      )
      .slice(0, Math.max(0, count - selected.length))
    return [...selected, ...fill]
  }
  const selectDailyWateringFacts = (): ReadonlyArray<(typeof candidateFacts)[number]> => {
    const priority = candidateFacts.filter(
      ({ due, mastery, weak }) => mastery !== undefined && (due || weak),
    )
    const questionCount = Math.min(8, Math.max(5, priority.length))
    const selected = priority.slice(0, questionCount)
    const selectedKeys = new Set(selected.map(({ factKey: selectedFactKey }) => selectedFactKey))
    const addUntilFull = (candidates: ReadonlyArray<(typeof candidateFacts)[number]>): void => {
      for (const candidate of candidates) {
        if (selected.length >= questionCount) return
        if (selectedKeys.has(candidate.factKey)) continue
        selected.push(candidate)
        selectedKeys.add(candidate.factKey)
      }
    }

    addUntilFull(
      candidateFacts.filter(
        ({ mastery, reviewedToday }) => mastery !== undefined && !reviewedToday,
      ),
    )
    addUntilFull(candidateFacts.filter(({ mastery }) => mastery !== undefined))
    const unseen = candidateFacts.filter(({ mastery }) => mastery === undefined)
    addUntilFull(unseen.slice(0, 2))
    // A brand-new learner has no review pool yet. Fill the five-question introduction,
    // then future waterings cap new material at two facts while reviews are available.
    addUntilFull(unseen)

    return selected
  }
  const questionCount = policy.kind === 'daily-watering' ? 0 : policy.questionCount
  const focusTable = policy.kind === 'daily-watering' ? undefined : policy.focusTable
  const focusCount = Math.max(0, questionCount - 2)
  const selectedFacts =
    policy.kind === 'daily-watering'
      ? selectDailyWateringFacts()
      : focusTable === undefined
        ? selectBalancedFacts(candidateFacts, questionCount)
        : [
            ...selectBalancedFacts(
              candidateFacts.filter(({ tables }) => tables.includes(focusTable)),
              focusCount,
            ),
            ...selectBalancedFacts(
              candidateFacts.filter(({ tables }) => !tables.includes(focusTable)),
              questionCount - focusCount,
            ),
          ]
  const questions = selectedFacts.map(
    (
      { factKey: selectedFactKey, left: canonicalLeft, mastery, operation, right: canonicalRight },
      index,
    ) => {
      const reverse =
        operation === 'multiply' && canonicalLeft !== canonicalRight && random() >= 0.5
      const left = reverse ? canonicalRight : canonicalLeft
      const right = reverse ? canonicalLeft : canonicalRight
      const answerMode: PracticeQuestion['answerMode'] =
        mastery?.state === 'familiar' || mastery?.state === 'fluent' ? 'keypad' : 'choice'
      return {
        answerMode,
        choices: answerMode === 'choice' ? choicesFor({ left, operation, right }, random) : [],
        factKey: selectedFactKey,
        id: `q-${seed}-${index + 1}`,
        left,
        operation,
        right,
      }
    },
  )

  return {
    createdAt: now,
    currentQuestionStartedAt: now,
    currentIndex: 0,
    id: `session-${now.getTime()}-${seed}`,
    kind: sessionKind,
    questions,
    seed,
    timeZone,
  }
}

const answer = ({ answeredAt, eventId, selected, session }: AnswerInput): AnswerResult => {
  const question = session.questions[session.currentIndex]
  if (question === undefined) throw new Error('The practice session is already complete')

  const correct = selected === correctAnswer(question)
  const event: AttemptEvent = {
    answerMode: question.answerMode,
    answeredAt,
    choices: question.choices,
    correct,
    eventId,
    factKey: question.factKey,
    latencyMs: Math.max(0, answeredAt.getTime() - session.currentQuestionStartedAt.getTime()),
    learningDayKey: learningDayKey({ at: answeredAt, timeZone: session.timeZone }),
    left: question.left,
    operation: question.operation,
    right: question.right,
    questionCount: session.questions.length,
    selected,
    sequence: session.currentIndex,
    sessionId: session.id,
    sessionKind: session.kind,
  }
  let questions = session.questions
  if (!correct && session.currentIndex + 1 < session.questions.length) {
    const retryIndex = Math.min(session.questions.length - 1, session.currentIndex + 3)
    const retryQuestion: PracticeQuestion = {
      ...question,
      id: `${question.id}-retry-${eventId}`,
    }
    const revised = [...session.questions]
    revised.splice(retryIndex, 0, retryQuestion)
    revised.pop()
    questions = revised
  }

  return {
    correct,
    event,
    session: {
      ...session,
      currentIndex: session.currentIndex + 1,
      currentQuestionStartedAt: answeredAt,
      questions,
    },
  }
}

const deriveRewards = ({
  awardedFlowerIds,
  completedSessions,
  flowerOrder,
  snapshot,
}: DeriveRewardsInput): ReadonlyArray<GardenReward> => {
  const rewards: GardenReward[] = []
  const fluentFacts = Object.values(snapshot.facts).filter((fact) => fact.state === 'fluent').length
  const order = normalizedFlowerOrder(flowerOrder)
  const awarded = new Set(awardedFlowerIds ?? [])
  order.forEach((id, index) => {
    const chapterEnd = index % 3 === 2
    const masteryRequired = chapterEnd ? ([5, 15, 30][Math.floor(index / 3)] ?? 0) : 0
    if (
      completedSessions >= (index + 1) * gardenBloomsPerFlower &&
      fluentFacts >= masteryRequired
    ) {
      awarded.add(id)
    }
    if (awarded.has(id)) {
      rewards.push({
        id: `collection:${id}`,
        kind: 'flower',
        label: gardenFlowerById.get(id)?.name ?? id,
      })
    }
  })
  if (completedSessions >= 5) {
    rewards.push({ id: 'session:five-pink-pot', kind: 'pot', label: 'pink pot' })
  }
  if (fluentFacts >= 10) {
    rewards.push({ id: 'mastery:ten-sparkle', kind: 'sparkle', label: 'garden sparkle' })
  }
  if (completedSessions >= 9 && fluentFacts >= 5) {
    rewards.push({ id: 'chapter:sunny-meadow', kind: 'pot', label: 'sunny meadow pot' })
  }
  if (completedSessions >= 18 && fluentFacts >= 15) {
    rewards.push({
      id: 'chapter:secret-greenhouse',
      kind: 'background',
      label: 'secret greenhouse backdrop',
    })
  }
  if (completedSessions >= 27 && fluentFacts >= 30) {
    rewards.push({
      id: 'chapter:starlit-garden',
      kind: 'sparkle',
      label: 'starlit garden glow',
    })
  }
  return rewards
}

const deriveGardenProgress = (input: DeriveRewardsInput): GardenProgress => {
  const bloomCount = Number.isFinite(input.completedSessions)
    ? Math.max(0, Math.floor(input.completedSessions))
    : 0

  const fluentFacts = Object.values(input.snapshot.facts).filter(
    ({ state }) => state === 'fluent',
  ).length
  const milestones = gardenMilestonesForOrder(input.flowerOrder)
  const awarded = new Set(input.awardedFlowerIds ?? [])
  const plants: ReadonlyArray<GardenPlantProgress> = milestones.plants.map((plant) => {
    const masteryRemaining = Math.max(0, plant.masteryRequired - fluentFacts)
    const permanentlyAwarded = awarded.has(plant.id)
    const stage: GardenPlantStage = permanentlyAwarded
      ? 'mature'
      : bloomCount < plant.startAt
        ? plant.lockedUntilStart
          ? 'locked'
          : 'dormant'
        : masteryRemaining > 0
          ? 'locked'
          : bloomCount < plant.matureAt
            ? 'growing'
            : 'mature'
    return {
      ...plant,
      bloomsEarned: permanentlyAwarded
        ? gardenBloomsPerFlower
        : Math.max(0, Math.min(gardenBloomsPerFlower, bloomCount - plant.startAt + 1)),
      bloomsRequired: gardenBloomsPerFlower,
      collected: permanentlyAwarded || stage === 'mature',
      masteryRemaining: permanentlyAwarded ? 0 : masteryRemaining,
      stage,
    }
  })
  const nextPlant = plants.find(({ stage }) => stage !== 'mature') ?? null
  const nextTarget = nextPlant
    ? nextPlant.stage === 'growing' ||
      (nextPlant.masteryRemaining > 0 && bloomCount >= nextPlant.startAt)
      ? { targetAt: nextPlant.matureAt, targetStage: 'mature' as const }
      : { targetAt: nextPlant.startAt, targetStage: 'growing' as const }
    : null
  const practiceDaysRemaining = nextTarget ? Math.max(0, nextTarget.targetAt - bloomCount) : 0
  const chapters: ReadonlyArray<GardenChapterProgress> = milestones.chapters.map((chapter) => {
    const chapterPlants = plants.filter(({ chapterId }) => chapterId === chapter.id)
    const collectedCount = chapterPlants.filter(({ collected }) => collected).length
    return {
      collectedCount,
      id: chapter.id,
      matureAt: chapter.matureAt,
      name: chapter.name,
      plants: chapterPlants,
      stage:
        collectedCount === chapterPlants.length
          ? 'complete'
          : bloomCount >= chapter.startAt
            ? 'growing'
            : 'locked',
      startAt: chapter.startAt,
      totalCount: chapterPlants.length,
    }
  })
  const collectedCount = plants.filter(({ collected }) => collected).length

  return {
    bloomCount,
    chapters,
    collection: {
      collectedCount,
      complete: collectedCount === plants.length,
      totalCount: plants.length,
    },
    featuredPlant:
      plants.find(
        ({ matureAt, stage, startAt }) =>
          stage !== 'locked' && bloomCount >= startAt && bloomCount <= matureAt,
      ) ?? null,
    nextStep:
      nextTarget && nextPlant
        ? {
            blockedByMastery: nextPlant.masteryRemaining > 0 && practiceDaysRemaining === 0,
            bloomsRemaining: practiceDaysRemaining,
            fluentFactsRemaining: nextPlant.masteryRemaining,
            plant: nextPlant,
            practiceDaysRemaining,
            targetAt: nextTarget.targetAt,
            targetStage: nextTarget.targetStage,
            unlocksPot: nextPlant.lockedUntilStart && nextTarget.targetStage === 'growing',
          }
        : null,
    plants,
    rewards: deriveRewards({ ...input, completedSessions: bloomCount }),
  }
}

export const LearningEngine = {
  answer,
  correctAnswer,
  createSession,
  deriveGardenRewardLedger,
  deriveLearningProgress,
  deriveGardenProgress,
  derivePracticeRhythm,
  deriveRewards,
  deriveRescueStrategies,
  deriveSessionInsight,
  emptySnapshot,
  factKey,
  gardenBloomsPerFlower,
  gardenFlowerIds,
  learningDayKey,
  mergeGardenRewardLedgers,
  reduce,
} as const
