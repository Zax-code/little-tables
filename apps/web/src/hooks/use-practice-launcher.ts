import {
  Ce2Engine,
  LearningEngine,
  type Ce2Module,
  type Ce2Skill,
  type LearningSnapshot,
  type PracticePolicy,
} from '@little-tables/domain'
import type { LocalBootstrap } from '@little-tables/local-store'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'

import { useFlowerTransition } from '../flower-transition.js'
import { launchPracticeSession, resumePracticeSession } from '../practice-session-launch.js'
import { localBootstrapQueryKey, practiceStoreFor } from '../store.js'
import { useFamilyProfile } from '../use-family-profile.js'
import { nextDailyFamily } from '../daily-activity.js'

const learnerTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

type PracticeLauncher = Readonly<{
  resume: () => Promise<void>
  start: (policy: PracticePolicy) => Promise<boolean>
  startDaily: () => Promise<boolean>
  startCe2: (module: Ce2Module, skill?: Ce2Skill) => Promise<boolean>
  startDivision: () => Promise<boolean>
  startQuick: () => Promise<boolean>
  startTable: (table: number) => Promise<boolean>
  startTableElevenOrTwelve: (table: 11 | 12) => Promise<boolean>
}>

export function usePracticeLauncher(_data: LocalBootstrap | undefined): PracticeLauncher {
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const queryClient = useQueryClient()
  const { activeProfile } = useFamilyProfile()
  const practiceStore = practiceStoreFor(activeProfile.id)
  const bootstrapQueryKey = localBootstrapQueryKey(activeProfile.id)
  const launching = useRef(false)

  const resume = useCallback(
    () =>
      resumePracticeSession({
        navigate: () => navigate({ to: '/practice' }),
        transition,
      }),
    [navigate, transition],
  )

  const start = useCallback(
    async (policy: PracticePolicy, recordDailyFamily = false): Promise<boolean> => {
      if (launching.current) return false
      launching.current = true
      try {
        const latest = await practiceStore.load()
        if (latest.activeSession !== null || latest.ce2ActiveSession !== null) {
          await resume()
          return false
        }
        const snapshot: LearningSnapshot = latest.snapshot
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
          persist: async () => {
            await practiceStore.startSession(session, snapshot)
            if (recordDailyFamily && latest.ce2ContentVersion !== null) {
              await practiceStore.updateCe2Preferences({
                enabledModules: latest.ce2Preferences.enabledModules,
                eventId: crypto.randomUUID(),
                lastDailyFamily: 'tables',
                schemaVersion: 'ce2-preference-update/v1',
                updatedAt: new Date(),
              })
            }
          },
          transition,
        })
        return true
      } finally {
        launching.current = false
      }
    },
    [bootstrapQueryKey, navigate, practiceStore, queryClient, resume, transition],
  )

  const startCe2 = useCallback(
    async (module: Ce2Module, skill?: Ce2Skill): Promise<boolean> => {
      if (launching.current) return false
      launching.current = true
      try {
        const latest = await practiceStore.load()
        if (latest.activeSession !== null || latest.ce2ActiveSession !== null) {
          await resume()
          return false
        }
        if (latest.ce2ContentVersion === null) return false
        const now = new Date()
        const snapshot = Ce2Engine.activateModule(latest.ce2Snapshot, module)
        const session = Ce2Engine.createSession({
          kind: latest.ce2Preferences.enabledModules.includes(module)
            ? 'extra-practice'
            : 'discovery',
          module,
          now,
          seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now(),
          ...(skill === undefined ? {} : { skill }),
          snapshot,
          timeZone: learnerTimeZone(),
        })
        await launchPracticeSession({
          invalidate: () => queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }),
          navigate: () => navigate({ to: '/practice' }),
          persist: async () => {
            await practiceStore.startCe2Session(session, snapshot)
            await practiceStore.updateCe2Preferences({
              enabledModules: snapshot.enabledModules,
              eventId: crypto.randomUUID(),
              lastDailyFamily: latest.ce2Preferences.lastDailyFamily,
              schemaVersion: 'ce2-preference-update/v1',
              updatedAt: now,
            })
          },
          transition,
        })
        return true
      } finally {
        launching.current = false
      }
    },
    [bootstrapQueryKey, navigate, practiceStore, queryClient, resume, transition],
  )

  const startDaily = useCallback(async (): Promise<boolean> => {
    const latest = await practiceStore.load()
    if (latest.activeSession !== null || latest.ce2ActiveSession !== null) {
      await resume()
      return false
    }
    const family = nextDailyFamily(latest.ce2Preferences)
    const now = new Date()
    if (family === 'tables' || latest.ce2ContentVersion === null) {
      return start({ kind: 'daily-watering' }, true)
    }
    if (launching.current) return false
    launching.current = true
    try {
      const snapshot = {
        ...latest.ce2Snapshot,
        enabledModules: latest.ce2Preferences.enabledModules,
      }
      const session = Ce2Engine.createSession({
        kind: 'daily-watering',
        module: family,
        now,
        seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now(),
        snapshot,
        timeZone: learnerTimeZone(),
      })
      await launchPracticeSession({
        invalidate: () => queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }),
        navigate: () => navigate({ to: '/practice' }),
        persist: async () => {
          await practiceStore.startCe2Session(session, snapshot)
          await practiceStore.updateCe2Preferences({
            enabledModules: latest.ce2Preferences.enabledModules,
            eventId: crypto.randomUUID(),
            lastDailyFamily: family,
            schemaVersion: 'ce2-preference-update/v1',
            updatedAt: now,
          })
        },
        transition,
      })
      return true
    } finally {
      launching.current = false
    }
  }, [bootstrapQueryKey, navigate, practiceStore, queryClient, resume, start, transition])

  return {
    resume,
    start,
    startDaily,
    startCe2,
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
