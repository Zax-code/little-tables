import { createContext, useContext } from 'react'

export type TransitionPhase = 'covering' | 'idle' | 'uncovering'
export type TransitionAction = () => Promise<void> | void
type Wait = (milliseconds: number) => Promise<void>

type RunFlowerTransitionOptions = Readonly<{
  action: TransitionAction
  onPhaseChange: (phase: TransitionPhase) => void
  reduceMotion: boolean
  wait: Wait
}>

const coverDuration = 230
const uncoverDuration = 260

export const FlowerTransitionContext = createContext<
  ((action: TransitionAction) => Promise<void>) | null
>(null)

export async function runFlowerTransition({
  action,
  onPhaseChange,
  reduceMotion,
  wait,
}: RunFlowerTransitionOptions) {
  if (reduceMotion) {
    await action()
    return
  }

  onPhaseChange('covering')
  await wait(coverDuration)

  try {
    await action()
  } finally {
    onPhaseChange('uncovering')
    await wait(uncoverDuration)
    onPhaseChange('idle')
  }
}

export function useFlowerTransition() {
  const transition = useContext(FlowerTransitionContext)
  if (transition === null) throw new Error('FlowerTransitionProvider is missing')
  return transition
}
