/** Local midnight for a given ms timestamp. */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function todayMs(): number {
  return startOfDay(Date.now())
}

/** "Jul 11" style short date. */
export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Today · Jul 12" / "Jul 11" for the entry form. */
export function friendlyDate(ms: number): string {
  const label = shortDate(ms)
  if (startOfDay(ms) === todayMs()) return `Today · ${label}`
  return label
}

/** "July 2026" month header. */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function inMonth(ms: number, year: number, month: number): boolean {
  const d = new Date(ms)
  return d.getFullYear() === year && d.getMonth() === month
}

/** yyyy-mm-dd for <input type="date">, in local time. */
export function toDateInput(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function fromDateInput(value: string): number {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
