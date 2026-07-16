import { createContext, useContext } from 'react'

export type TransitionPhase =
  | Readonly<{ type: 'covering' }>
  | Readonly<{ type: 'idle' }>
  | Readonly<{ duration: number; type: 'uncovering' }>
export type TransitionAction = () => Promise<void> | void
type Wait = (milliseconds: number) => Promise<void>

type RunFlowerTransitionOptions = Readonly<{
  action: TransitionAction
  now?: () => number
  onPhaseChange: (phase: TransitionPhase) => void
  reduceMotion: boolean
  wait: Wait
}>

const coverDuration = 500
const uncoverDuration = 500

export const FlowerTransitionContext = createContext<
  ((action: TransitionAction) => Promise<void>) | null
>(null)

export async function runFlowerTransition({
  action,
  now = Date.now,
  onPhaseChange,
  reduceMotion,
  wait,
}: RunFlowerTransitionOptions) {
  if (reduceMotion) {
    await action()
    return
  }

  onPhaseChange({ type: 'covering' })
  await wait(coverDuration)

  const actionStartedAt = now()
  try {
    await action()
  } finally {
    const actionDuration = Math.max(0, now() - actionStartedAt)
    const remainingDuration = Math.max(0, uncoverDuration - actionDuration)
    onPhaseChange({ duration: remainingDuration, type: 'uncovering' })
    if (remainingDuration > 0) await wait(remainingDuration)
    onPhaseChange({ type: 'idle' })
  }
}

export function useFlowerTransition() {
  const transition = useContext(FlowerTransitionContext)
  if (transition === null) throw new Error('FlowerTransitionProvider is missing')
  return transition
}
