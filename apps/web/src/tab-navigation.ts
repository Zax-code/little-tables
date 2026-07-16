type TabClick = Readonly<{
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  preventDefault: () => void
  shiftKey: boolean
}>

type Transition = (action: () => Promise<void> | void) => Promise<void>

type TransitionBetweenTabsOptions = Readonly<{
  currentPath: string
  event: TabClick
  navigate: () => Promise<void> | void
  nextPath: string
  transition: Transition
}>

export async function transitionBetweenTabs({
  currentPath,
  event,
  navigate,
  nextPath,
  transition,
}: TransitionBetweenTabsOptions) {
  if (
    currentPath === nextPath ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false
  }

  event.preventDefault()
  await transition(navigate)
  return true
}
