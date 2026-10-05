import {
  LearningEngine,
  type LearningSnapshot,
  type PracticePolicy,
  type SkillId,
} from '@little-tables/domain'
import type { LocalBootstrap } from '@little-tables/local-store'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useFlowerTransition } from '../flower-transition.js'
import { launchPracticeSession, resumePracticeSession } from '../practice-session-launch.js'
import { localBootstrapQueryKey, practiceStoreFor } from '../store.js'
import { learningPathsFor } from '../learning-path-settings.js'
import { useFamilyProfile } from '../use-family-profile.js'

const learnerTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

type PracticeLauncher = Readonly<{
  resume: () => Promise<void>
  start: (policy: PracticePolicy) => Promise<boolean>
  startDaily: () => Promise<boolean>
  startDivision: () => Promise<boolean>
  startQuick: () => Promise<boolean>
  startSkill: (skill: SkillId) => Promise<boolean>
  startTable: (table: number) => Promise<boolean>
  startTableElevenOrTwelve: (table: 11 | 12) => Promise<boolean>
}>

export function usePracticeLauncher(data: LocalBootstrap | undefined): PracticeLauncher {
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const queryClient = useQueryClient()
  const { activeProfile } = useFamilyProfile()
  const practiceStore = practiceStoreFor(activeProfile.id)
  const bootstrapQueryKey = localBootstrapQueryKey(activeProfile.id)
  const paths = learningPathsFor(activeProfile)

  const resume = useCallback(
    () =>
      resumePracticeSession({
        navigate: () => navigate({ to: '/practice' }),
        transition,
      }),
    [navigate, transition],
  )

  const start = useCallback(
    async (policy: PracticePolicy): Promise<boolean> => {
      const snapshot: LearningSnapshot = data?.snapshot ?? LearningEngine.emptySnapshot()
      const session = LearningEngine.createSession({
        now: new Date(),
        policy,
        seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now(),
        snapshot,
        timeZone: learnerTimeZone(),
      })
      if (session.questions.length === 0) return false
      await launchPracticeSession({
        invalidate: () => queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }),
        navigate: () => navigate({ to: '/practice' }),
        persist: () => practiceStore.startSession(session, snapshot),
        transition,
      })
      return true
    },
    [bootstrapQueryKey, data?.snapshot, navigate, practiceStore, queryClient, transition],
  )

  return {
    resume,
    start,
    startDaily: () => start({ curriculum: { paths }, kind: 'daily-watering' }),
    startDivision: () => start({ curriculum: { packs: ['inverse-division'] }, questionCount: 6 }),
    startQuick: () => start({ curriculum: { paths }, questionCount: 5 }),
    startSkill: (skill) =>
      start({
        curriculum: { paths },
        focusSkill: skill,
        questionCount: skill === 'column-addition' || skill === 'column-subtraction' ? 9 : 8,
      }),
    startTable: (table) => start({ focusTable: table, questionCount: 8 }),
    startTableElevenOrTwelve: (table) =>
      start({
        curriculum: { packs: ['core', 'bonus-11-12'] },
        focusTable: table,
        questionCount: 8,
      }),
  }
}
