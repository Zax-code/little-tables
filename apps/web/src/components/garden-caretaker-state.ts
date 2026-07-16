import { selectGardenCaretakerTarget } from './garden-watering-route.js'

export type GardenCaretakerPhase =
  'arriving' | 'departing' | 'finishing-arrival' | 'traveling' | 'walking' | 'watering'

export type GardenCaretakerTarget = Readonly<{
  caretakerX: number
  caretakerY: number
  facing: 'left' | 'right'
  id: string
  pageIndex: number
  waterX: number
  waterY: number
}>

type CrossGardenJourney = Readonly<{
  arrival: GardenCaretakerTarget
  destination: GardenCaretakerTarget
  direction: 'left' | 'right'
}>

export type GardenCaretakerState = Readonly<{
  crossGardenJourney: CrossGardenJourney | undefined
  phase: GardenCaretakerPhase
  target: GardenCaretakerTarget | undefined
  walkDuration: number
  walkFacing: 'left' | 'right'
}>

export type GardenCaretakerAction =
  | Readonly<{
      randomValue: number
      targets: readonly GardenCaretakerTarget[]
      type: 'targets-measured'
    }>
  | Readonly<{
      crossGardenJourney: CrossGardenJourney
      target: GardenCaretakerTarget
      walkDuration: number
      walkFacing: 'left' | 'right'
      type: 'depart'
    }>
  | Readonly<{
      target: GardenCaretakerTarget
      walkDuration: number
      walkFacing: 'left' | 'right'
      type: 'walk'
    }>
  | Readonly<{ type: 'travel' }>
  | Readonly<{
      target: GardenCaretakerTarget
      walkDuration: number
      walkFacing: 'left' | 'right'
      type: 'arrive'
    }>
  | Readonly<{ target: GardenCaretakerTarget; type: 'finish-arrival' }>
  | Readonly<{ type: 'water' }>

export const initialGardenCaretakerState: GardenCaretakerState = {
  crossGardenJourney: undefined,
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
  if (action.type === 'depart') {
    return {
      crossGardenJourney: action.crossGardenJourney,
      phase: 'departing',
      target: action.target,
      walkDuration: action.walkDuration,
      walkFacing: action.walkFacing,
    }
  }
  if (action.type === 'travel') return { ...state, phase: 'traveling', target: undefined }
  if (action.type === 'arrive') {
    return {
      ...state,
      phase: 'arriving',
      target: action.target,
      walkDuration: action.walkDuration,
      walkFacing: action.walkFacing,
    }
  }
  if (action.type === 'finish-arrival') {
    return { ...state, phase: 'finishing-arrival', target: action.target }
  }
  return { ...state, crossGardenJourney: undefined, phase: 'watering' }
}
