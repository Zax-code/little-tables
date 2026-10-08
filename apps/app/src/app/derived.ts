/**
 * Values the screens derive from a child's state with the learning engine. The engine is loaded
 * before the first screen (see `main.tsx`), so these run synchronously during render.
 */
import { Engine, deviceTimeZone, learningDayKey, type EngineApi } from '@little-tables/engine'
import type { LearningPathSettings } from '@little-tables/engine/schema'
import { Effect } from 'effect'
import { useMemo } from 'react'

import { policies } from '../data/practice.js'
import type { ProfileState } from '../data/schema.js'
import type { AppRuntime } from '../runtime.js'
import { useApp } from './app-context.js'

const derive = <A>(
  runtime: AppRuntime,
  compute: (engine: EngineApi) => Effect.Effect<A, unknown>,
) => runtime.runSync(Effect.flatMap(Engine, compute))

export const todayKey = (now = Date.now()) => learningDayKey(now, deviceTimeZone())

/** The week in bloom, the daily watering and any comeback after a break. */
export function useRhythm(state: ProfileState) {
  const { runtime } = useApp()
  return useMemo(
    () =>
      derive(runtime, (engine) =>
        engine.derivePracticeRhythm({
          activeSession:
            state.activeSession === null
              ? null
              : {
                  currentIndex: state.activeSession.currentIndex,
                  kind: state.activeSession.kind,
                  questionCount: state.activeSession.questions.length,
                },
          practiceDayKeys: state.practiceDayKeys,
          rewardedDayKeys: state.rewardedDayKeys,
          todayKey: todayKey(),
        }),
      ),
    [runtime, state.activeSession, state.practiceDayKeys, state.rewardedDayKeys],
  )
}

/** Plants, chapters and the next step of the garden. */
export function useGarden(state: ProfileState) {
  const { runtime } = useApp()
  return useMemo(
    () =>
      derive(runtime, (engine) =>
        engine.deriveGardenProgress({
          awardedFlowerIds: state.gardenCollection.awardedFlowerIds,
          completedSessions: state.gardenBloomCount,
          flowerOrder: state.gardenCollection.flowerOrder,
          snapshot: state.snapshot,
        }),
      ),
    [runtime, state.gardenBloomCount, state.gardenCollection, state.snapshot],
  )
}

/** The verb meadow: a flower per ticked verb, the week's butterflies and the thirst. */
export function useMeadow(state: ProfileState, paths: LearningPathSettings) {
  const { runtime } = useApp()
  return useMemo(
    () =>
      derive(runtime, (engine) =>
        engine.deriveMeadow({
          ...(paths.conjugation === undefined ? {} : { settings: paths.conjugation }),
          snapshot: state.snapshot,
          todayKey: todayKey(),
        }),
      ),
    [paths.conjugation, runtime, state.snapshot],
  )
}

/** Tables, packs and learning paths of the child. */
export function useLearningProgress(state: ProfileState, paths: LearningPathSettings) {
  const { runtime } = useApp()
  return useMemo(
    () =>
      derive(runtime, (engine) =>
        engine.deriveLearningProgress({ curriculum: { paths }, snapshot: state.snapshot }),
      ),
    [paths, runtime, state.snapshot],
  )
}

/** How many questions today's watering will ask (the active one, or a new one at `now`). */
export function useDailyQuestionCount(
  state: ProfileState,
  paths: LearningPathSettings,
  now: number,
) {
  const { runtime } = useApp()
  return useMemo(() => {
    if (state.activeSession?.kind === 'daily-watering') return state.activeSession.questions.length
    return derive(runtime, (engine) =>
      engine.createSession({
        now,
        policy: policies.daily(paths),
        seed: 0,
        snapshot: state.snapshot,
        timeZone: deviceTimeZone(),
      }),
    ).questions.length
  }, [now, paths, runtime, state.activeSession, state.snapshot])
}
