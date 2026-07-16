import { LearningEngine, type LearningSnapshot, type PracticePolicy } from '@little-tables/domain'
import type { LocalBootstrap } from '@little-tables/local-store'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useFlowerTransition } from '../flower-transition.js'
import { launchPracticeSession, resumePracticeSession } from '../practice-session-launch.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'

const learnerTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

type PracticeLauncher = Readonly<{
  resume: () => Promise<void>
  start: (policy: PracticePolicy) => Promise<boolean>
  startDaily: () => Promise<boolean>
  startDivision: () => Promise<boolean>
  startQuick: () => Promise<boolean>
  startTable: (table: number) => Promise<boolean>
  startTableElevenOrTwelve: (table: 11 | 12) => Promise<boolean>
}>

export function usePracticeLauncher(data: LocalBootstrap | undefined): PracticeLauncher {
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const queryClient = useQueryClient()

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
        invalidate: () => queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey }),
        navigate: () => navigate({ to: '/practice' }),
        persist: () => practiceStore.startSession(session, snapshot),
        transition,
      })
      return true
    },
    [data?.snapshot, navigate, queryClient, transition],
  )

  return {
    resume,
    start,
    startDaily: () => start({ kind: 'daily-watering' }),
    startDivision: () => start({ curriculum: { packs: ['inverse-division'] }, questionCount: 6 }),
    startQuick: () => start({ questionCount: 5 }),
    startTable: (table) => start({ focusTable: table, questionCount: 8 }),
    startTableElevenOrTwelve: (table) =>
      start({
        curriculum: { packs: ['core', 'bonus-11-12'] },
        focusTable: table,
        questionCount: 8,
      }),
  }
}
