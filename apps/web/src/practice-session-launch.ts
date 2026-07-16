type Task = () => Promise<void> | void
type Transition = (action: Task) => Promise<void>

type LaunchPracticeSessionOptions = Readonly<{
  invalidate: Task
  navigate: Task
  persist: Task
  transition: Transition
}>

type ResumePracticeSessionOptions = Readonly<{
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
}: ResumePracticeSessionOptions) {
  await transition(navigate)
}
