export function getTodayInLagos(): { dateStr: string; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateStr = formatter.format(new Date()) // 'YYYY-MM-DD'

  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
  })
  const weekdayStr = weekdayFormatter.format(new Date())
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  const dayOfWeek = map[weekdayStr] ?? 1

  return { dateStr, dayOfWeek }
}
