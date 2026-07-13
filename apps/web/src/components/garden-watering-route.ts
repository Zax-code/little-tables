type RandomSource = () => number

export function pickNextGardenTarget(
  currentIndex: number,
  targetCount: number,
  random: RandomSource = Math.random,
) {
  if (targetCount < 2) return currentIndex

  const normalizedCurrentIndex = ((currentIndex % targetCount) + targetCount) % targetCount
  const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON)
  const offset = 1 + Math.floor(randomValue * (targetCount - 1))

  return (normalizedCurrentIndex + offset) % targetCount
}
