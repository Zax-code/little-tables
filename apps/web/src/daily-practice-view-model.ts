import { LearningEngine, type ComebackKind, type PracticeRhythm } from '@little-tables/domain'

export type { ComebackKind }
export type DailyPracticeView = PracticeRhythm

export const deriveDailyPracticeView = LearningEngine.derivePracticeRhythm
