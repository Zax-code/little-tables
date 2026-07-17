const weekLength = 7

export const deriveWeekProgressSegments = (completedDays: number): ReadonlyArray<boolean> => {
  const filledSegments = Math.min(weekLength, Math.max(0, Math.floor(completedDays)))

  return Array.from({ length: weekLength }, (_, index) => index < filledSegments)
}
