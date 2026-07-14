export type MasteryState = 'unseen' | 'learning' | 'familiar' | 'fluent'

export type FactMastery = Readonly<{
  correctCount: number
  correctStreak: number
  difficulty: number
  dueAt: Date | null
  lastReviewedAt: Date | null
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
  right: number
}>

export type PracticeSession = Readonly<{
  createdAt: Date
  currentQuestionStartedAt: Date
  currentIndex: number
  id: string
  questions: ReadonlyArray<PracticeQuestion>
  seed: number
}>

export type AttemptEvent = Readonly<{
  answerMode: 'choice' | 'keypad'
  answeredAt: Date
  choices: ReadonlyArray<number>
  correct: boolean
  eventId: string
  factKey: string
  latencyMs: number
  left: number
  right: number
  questionCount: number
  selected: number
  sequence: number
  sessionId: string
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

type CreateSessionInput = Readonly<{
  now: Date
  policy: Readonly<{ focusTable?: number; questionCount: number }>
  seed: number
  snapshot: LearningSnapshot
}>

type ReduceAttemptsInput = Readonly<{
  attempts: ReadonlyArray<AttemptEvent>
  snapshot: LearningSnapshot
}>

export type GardenReward = Readonly<{
  id: string
  kind: 'flower' | 'pot' | 'sparkle'
  label: string
}>

export type GardenPlantStage = 'dormant' | 'growing' | 'locked' | 'mature'

type GardenPlantMilestone = Readonly<{
  id: string
  lockedUntilStart: boolean
  matureAt: number
  name: string
  startAt: number
}>

export const gardenPlantMilestones = [
  {
    id: 'coral-tulip',
    lockedUntilStart: false,
    matureAt: 2,
    name: 'coral tulip',
    startAt: 1,
  },
  {
    id: 'sunny-daisy',
    lockedUntilStart: false,
    matureAt: 4,
    name: 'sunny daisy',
    startAt: 3,
  },
  {
    id: 'red-tulip',
    lockedUntilStart: false,
    matureAt: 7,
    name: 'red tulip',
    startAt: 5,
  },
  {
    id: 'cloud-daisy',
    lockedUntilStart: false,
    matureAt: 10,
    name: 'cloud daisy',
    startAt: 8,
  },
  {
    id: 'blush-tulip',
    lockedUntilStart: false,
    matureAt: 12,
    name: 'blush tulip',
    startAt: 11,
  },
  {
    id: 'celebration-daisy',
    lockedUntilStart: true,
    matureAt: 15,
    name: 'celebration daisy',
    startAt: 13,
  },
] as const satisfies ReadonlyArray<GardenPlantMilestone>

export type GardenPlantId = (typeof gardenPlantMilestones)[number]['id']

export type GardenPlantProgress = Readonly<{
  id: GardenPlantId
  lockedUntilStart: boolean
  matureAt: number
  name: string
  stage: GardenPlantStage
  startAt: number
}>

export type GardenNextStep = Readonly<{
  bloomsRemaining: number
  plant: GardenPlantProgress
  targetAt: number
  targetStage: 'growing' | 'mature'
  unlocksPot: boolean
}>

export type GardenProgress = Readonly<{
  bloomCount: number
  featuredPlant: GardenPlantProgress | null
  nextStep: GardenNextStep | null
  plants: ReadonlyArray<GardenPlantProgress>
  rewards: ReadonlyArray<GardenReward>
}>

type DeriveRewardsInput = Readonly<{
  completedSessions: number
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

const ALL_FACTS: ReadonlyArray<readonly [number, number]> = [
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

const canonicalFactKey = (left: number, right: number): string =>
  `${Math.min(left, right)}:${Math.max(left, right)}`

const WEAK_FACT_DIFFICULTY = 0.53

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

const choicesFor = (left: number, right: number, random: () => number): ReadonlyArray<number> => {
  const answer = left * right
  const candidates = [
    answer,
    left * Math.max(1, right - 1),
    left * Math.min(10, right + 1),
    right * Math.max(1, left - 1),
    right * Math.min(10, left + 1),
    answer - left,
    answer + right,
    answer + 2,
    Math.max(0, answer - 2),
  ]
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

const updateMastery = (current: FactMastery, attempt: AttemptEvent): FactMastery => {
  const dayKey = attempt.answeredAt.toISOString().slice(0, 10)
  const successfulDayKeys = attempt.correct
    ? [...new Set([...current.successfulDayKeys, dayKey])]
    : current.successfulDayKeys
  const recallDayKeys =
    attempt.correct && attempt.answerMode === 'keypad'
      ? [...new Set([...current.recallDayKeys, dayKey])]
      : current.recallDayKeys
  const correctCount = current.correctCount + (attempt.correct ? 1 : 0)
  const stabilityDays = attempt.correct
    ? current.stabilityDays === 0
      ? 1
      : Math.min(60, current.stabilityDays * 1.8)
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
    correctStreak: attempt.correct ? current.correctStreak + 1 : 0,
    difficulty: Math.min(1, Math.max(0, current.difficulty + (attempt.correct ? -0.02 : 0.08))),
    dueAt: addDays(attempt.answeredAt, Math.max(0.04, stabilityDays)),
    lapseCount: current.lapseCount + (attempt.correct ? 0 : 1),
    lastReviewedAt: attempt.answeredAt,
    latencyMs: !attempt.correct
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

const reduce = ({ attempts, snapshot }: ReduceAttemptsInput): LearningSnapshot => {
  const processed = new Set(snapshot.processedEventIds)
  const facts: Record<string, FactMastery> = { ...snapshot.facts }
  let changed = false

  for (const attempt of attempts) {
    if (processed.has(attempt.eventId)) continue
    facts[attempt.factKey] = updateMastery(facts[attempt.factKey] ?? EMPTY_MASTERY, attempt)
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

const createSession = ({ now, policy, seed, snapshot }: CreateSessionInput): PracticeSession => {
  const random = makeRandom(seed)
  const todayKey = now.toISOString().slice(0, 10)
  const candidateFacts = ALL_FACTS.map(([left, right], curriculumIndex) => {
    const key = canonicalFactKey(left, right)
    const mastery = snapshot.facts[key]
    const due = mastery?.dueAt !== null && mastery?.dueAt !== undefined && mastery.dueAt <= now
    const reviewedToday = mastery?.lastReviewedAt?.toISOString().slice(0, 10) === todayKey
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
      due,
      left,
      mastery,
      reviewedToday,
      right,
      score: stateScore + dueScore + latencyScore + difficultyScore + random(),
      weak,
    }
  }).sort((first, second) => second.score - first.score)
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
    const selectedKeys = new Set(selected.map(({ left, right }) => canonicalFactKey(left, right)))
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
      .filter(({ left, right }) => !selectedKeys.has(canonicalFactKey(left, right)))
      .filter(
        ({ left, right }, index, values) =>
          values.findIndex(
            ({ left: otherLeft, right: otherRight }) =>
              canonicalFactKey(left, right) === canonicalFactKey(otherLeft, otherRight),
          ) === index,
      )
      .slice(0, Math.max(0, count - selected.length))
    return [...selected, ...fill]
  }
  const focusCount = Math.max(0, policy.questionCount - 2)
  const selectedFacts =
    policy.focusTable === undefined
      ? selectBalancedFacts(candidateFacts, policy.questionCount)
      : [
          ...selectBalancedFacts(
            candidateFacts.filter(
              ({ left, right }) => left === policy.focusTable || right === policy.focusTable,
            ),
            focusCount,
          ),
          ...selectBalancedFacts(
            candidateFacts.filter(
              ({ left, right }) => left !== policy.focusTable && right !== policy.focusTable,
            ),
            policy.questionCount - focusCount,
          ),
        ]
  const questions = selectedFacts.map(
    ({ left: canonicalLeft, mastery, right: canonicalRight }, index) => {
      const reverse = canonicalLeft !== canonicalRight && random() >= 0.5
      const left = reverse ? canonicalRight : canonicalLeft
      const right = reverse ? canonicalLeft : canonicalRight
      const answerMode: PracticeQuestion['answerMode'] =
        mastery?.state === 'familiar' || mastery?.state === 'fluent' ? 'keypad' : 'choice'
      return {
        answerMode,
        choices: answerMode === 'choice' ? choicesFor(left, right, random) : [],
        factKey: canonicalFactKey(canonicalLeft, canonicalRight),
        id: `q-${seed}-${index + 1}`,
        left,
        right,
      }
    },
  )

  return {
    createdAt: now,
    currentQuestionStartedAt: now,
    currentIndex: 0,
    id: `session-${now.getTime()}-${seed}`,
    questions,
    seed,
  }
}

const answer = ({ answeredAt, eventId, selected, session }: AnswerInput): AnswerResult => {
  const question = session.questions[session.currentIndex]
  if (question === undefined) throw new Error('The practice session is already complete')

  const correct = selected === question.left * question.right
  const event: AttemptEvent = {
    answerMode: question.answerMode,
    answeredAt,
    choices: question.choices,
    correct,
    eventId,
    factKey: question.factKey,
    latencyMs: Math.max(0, answeredAt.getTime() - session.currentQuestionStartedAt.getTime()),
    left: question.left,
    right: question.right,
    questionCount: session.questions.length,
    selected,
    sequence: session.currentIndex,
    sessionId: session.id,
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
  completedSessions,
  snapshot,
}: DeriveRewardsInput): ReadonlyArray<GardenReward> => {
  const rewards: GardenReward[] = []
  if (completedSessions >= 1) {
    rewards.push({ id: 'session:first-bloom', kind: 'flower', label: 'first tulip' })
  }
  if (completedSessions >= 3) {
    rewards.push({ id: 'session:three-daisy', kind: 'flower', label: 'sunny daisy' })
  }
  if (completedSessions >= 5) {
    rewards.push({ id: 'session:five-pink-pot', kind: 'pot', label: 'pink pot' })
  }
  const fluentFacts = Object.values(snapshot.facts).filter((fact) => fact.state === 'fluent').length
  if (fluentFacts >= 10) {
    rewards.push({ id: 'mastery:ten-sparkle', kind: 'sparkle', label: 'garden sparkle' })
  }
  return rewards
}

const deriveGardenProgress = (input: DeriveRewardsInput): GardenProgress => {
  const bloomCount = Number.isFinite(input.completedSessions)
    ? Math.max(0, Math.floor(input.completedSessions))
    : 0

  const plants: ReadonlyArray<GardenPlantProgress> = gardenPlantMilestones.map((plant) => ({
    ...plant,
    stage:
      bloomCount < plant.startAt
        ? plant.lockedUntilStart
          ? 'locked'
          : 'dormant'
        : bloomCount < plant.matureAt
          ? 'growing'
          : 'mature',
  }))
  const nextMilestone = gardenPlantMilestones
    .flatMap((plant) => [
      {
        plantId: plant.id,
        targetAt: plant.startAt,
        targetStage: 'growing' as const,
        unlocksPot: plant.lockedUntilStart,
      },
      {
        plantId: plant.id,
        targetAt: plant.matureAt,
        targetStage: 'mature' as const,
        unlocksPot: false,
      },
    ])
    .filter(({ targetAt }) => targetAt > bloomCount)
    .sort((left, right) => left.targetAt - right.targetAt)[0]
  const nextPlant = nextMilestone
    ? (plants.find(({ id }) => id === nextMilestone.plantId) ?? null)
    : null

  return {
    bloomCount,
    featuredPlant:
      plants.find(({ matureAt, startAt }) => bloomCount >= startAt && bloomCount <= matureAt) ??
      null,
    nextStep:
      nextMilestone && nextPlant
        ? {
            bloomsRemaining: nextMilestone.targetAt - bloomCount,
            plant: nextPlant,
            targetAt: nextMilestone.targetAt,
            targetStage: nextMilestone.targetStage,
            unlocksPot: nextMilestone.unlocksPot,
          }
        : null,
    plants,
    rewards: deriveRewards({ ...input, completedSessions: bloomCount }),
  }
}

export const LearningEngine = {
  answer,
  createSession,
  deriveGardenProgress,
  deriveRewards,
  emptySnapshot,
  reduce,
} as const
