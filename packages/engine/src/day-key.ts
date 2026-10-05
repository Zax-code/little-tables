const formatters = new Map<string, Intl.DateTimeFormat>()

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timeZone)
  if (cached !== undefined) return cached
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    })
  } catch {
    // An unknown zone falls back to UTC, as the server does.
    formatter = formatterFor('UTC')
  }
  formatters.set(timeZone, formatter)
  return formatter
}

/** The learner's calendar date of an instant, written `YYYY-MM-DD`. */
export const learningDayKey = (at: number, timeZone: string): string => {
  const parts = formatterFor(timeZone).formatToParts(new Date(at))
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** The device's IANA time zone. */
export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone
