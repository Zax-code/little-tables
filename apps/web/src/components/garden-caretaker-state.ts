import { selectGardenCaretakerTarget } from './garden-watering-route.js'

export type GardenCaretakerPhase = 'walking' | 'watering'

export type GardenCaretakerTarget = Readonly<{
  caretakerX: number
  caretakerY: number
  facing: 'left' | 'right'
  id: string
  pageIndex: number
  waterX: number
  waterY: number
}>

export type GardenCaretakerState = Readonly<{
  phase: GardenCaretakerPhase
  target: GardenCaretakerTarget | undefined
  walkDuration: number
  walkFacing: 'left' | 'right'
}>

export type GardenCaretakerAction =
  | Readonly<{
      initialPage: number
      randomValue: number
      targets: readonly GardenCaretakerTarget[]
      type: 'targets-measured'
    }>
  | Readonly<{
      target: GardenCaretakerTarget
      walkDuration: number
      walkFacing: 'left' | 'right'
      type: 'walk'
    }>
  | Readonly<{ type: 'water' }>

export const initialGardenCaretakerState: GardenCaretakerState = {
  phase: 'watering',
  target: undefined,
  walkDuration: 1,
  walkFacing: 'right',
}

export function transitionGardenCaretaker(
  state: GardenCaretakerState,
  action: GardenCaretakerAction,
): GardenCaretakerState {
  if (action.type === 'targets-measured') {
    if (state.phase !== 'watering') return state
    return {
      ...state,
      target: selectGardenCaretakerTarget(
        state.target?.id,
        action.targets,
        () => action.randomValue,
        action.targets.filter(({ pageIndex }) => pageIndex === action.initialPage),
      ),
    }
  }
  if (action.type === 'walk') {
    return {
      ...state,
      phase: 'walking',
      target: action.target,
      walkDuration: action.walkDuration,
      walkFacing: action.walkFacing,
    }
  }
  return { ...state, phase: 'watering' }
}
