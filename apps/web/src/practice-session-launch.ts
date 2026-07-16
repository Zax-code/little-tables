type Task = () => Promise<void> | void
type Transition = (action: Task) => Promise<void>

type LaunchPracticeSessionOptions = Readonly<{
  invalidate: Task
  navigate: Task
  persist: Task
  transition: Transition
}>

type TransitionPracticeNavigationOptions = Readonly<{
  navigate: Task
  transition: Transition
}>

export async function launchPracticeSession({
  invalidate,
  navigate,
  persist,
  transition,
}: LaunchPracticeSessionOptions) {
  await persist()
  await invalidate()
  await transition(navigate)
}

export async function resumePracticeSession({
  navigate,
  transition,
}: TransitionPracticeNavigationOptions) {
  await transition(navigate)
}

export async function returnToGardenAfterPractice({
  navigate,
  transition,
}: TransitionPracticeNavigationOptions) {
  await transition(navigate)
}
