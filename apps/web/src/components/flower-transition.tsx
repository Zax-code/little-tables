import { m, useReducedMotion } from 'motion/react'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'

type TransitionPhase = 'covering' | 'idle' | 'uncovering'
type TransitionAction = () => Promise<void> | void
type Wait = (milliseconds: number) => Promise<void>

type RunFlowerTransitionOptions = Readonly<{
  action: TransitionAction
  onPhaseChange: (phase: TransitionPhase) => void
  reduceMotion: boolean
  wait: Wait
}>

const coverDuration = 230
const uncoverDuration = 260
const flowerCount = 30
const flowerIndexes = Array.from({ length: flowerCount }, (_, index) => index)

const FlowerTransitionContext = createContext<((action: TransitionAction) => Promise<void>) | null>(
  null,
)

const delay: Wait = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })

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

export function FlowerTransitionProvider({ children }: PropsWithChildren) {
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const reduceMotion = useReducedMotion() === true
  const running = useRef(false)

  const transition = useCallback(
    async (action: TransitionAction) => {
      if (running.current) return
      running.current = true
      try {
        await runFlowerTransition({
          action,
          onPhaseChange: setPhase,
          reduceMotion,
          wait: delay,
        })
      } finally {
        running.current = false
      }
    },
    [reduceMotion],
  )

  return (
    <FlowerTransitionContext value={transition}>
      {children}
      {phase === 'idle' ? null : <FlowerCurtain phase={phase} />}
    </FlowerTransitionContext>
  )
}

export function useFlowerTransition() {
  const transition = useContext(FlowerTransitionContext)
  if (transition === null) throw new Error('FlowerTransitionProvider is missing')
  return transition
}

function FlowerCurtain({ phase }: Readonly<{ phase: Exclude<TransitionPhase, 'idle'> }>) {
  const covering = phase === 'covering'

  return (
    <m.div
      animate={{ opacity: covering ? 1 : 0 }}
      aria-hidden="true"
      className="flower-transition"
      initial={{ opacity: 0 }}
      transition={{ duration: covering ? 0.1 : 0.22, ease: 'easeInOut' }}
    >
      {flowerIndexes.map((index) => {
        const direction = index % 2 === 0 ? -1 : 1
        const delayIndex = covering ? index % 10 : (flowerCount - index) % 10
        return (
          <m.svg
            animate={{
              opacity: covering ? 1 : 0,
              rotate: covering ? 0 : direction * 18,
              scale: covering ? 1 : 0.2,
            }}
            className={`flower-transition__bloom flower-transition__bloom--${index % 4}`}
            initial={{ opacity: 0, rotate: direction * -18, scale: 0.2 }}
            key={index}
            transition={{
              delay: delayIndex * (covering ? 0.01 : 0.012),
              duration: 0.13,
              ease: covering ? 'backOut' : 'easeIn',
            }}
            viewBox="0 0 64 64"
          >
            <g className="flower-transition__petals">
              <ellipse cx="32" cy="14" rx="11" ry="17" />
              <ellipse cx="49" cy="27" rx="11" ry="17" transform="rotate(72 49 27)" />
              <ellipse cx="43" cy="48" rx="11" ry="17" transform="rotate(144 43 48)" />
              <ellipse cx="21" cy="48" rx="11" ry="17" transform="rotate(216 21 48)" />
              <ellipse cx="15" cy="27" rx="11" ry="17" transform="rotate(288 15 27)" />
            </g>
            <circle className="flower-transition__center" cx="32" cy="32" r="9" />
          </m.svg>
        )
      })}
    </m.div>
  )
}
