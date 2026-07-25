export function profileSwitchDelay(phase: 'commit' | 'finish', reducedMotion: boolean): number {
  if (reducedMotion) return 0
  return phase === 'commit' ? 90 : 240
}
