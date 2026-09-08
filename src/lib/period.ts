import { fromDateInput, monthLabel, monthRange, rangeLabel, type DateRange } from './dates'

/**
 * The Insights period lives in the URL so back-navigation keeps it:
 * month mode is `?y=2026&m=8`, range mode is `?from=…&to=…` (yyyy-mm-dd,
 * both days inclusive).
 */
export type Period =
  | { mode: 'month'; year: number; month: number }
  | { mode: 'range'; from: string; to: string }

export function currentMonthPeriod(): Period {
  const now = new Date()
  return { mode: 'month', year: now.getFullYear(), month: now.getMonth() }
}

export function parsePeriod(params: URLSearchParams): Period {
  const from = params.get('from')
  const to = params.get('to')
  if (from && to) return { mode: 'range', from, to }
  const y = Number(params.get('y'))
  const m = Number(params.get('m'))
  if (params.has('y') && params.has('m') && Number.isInteger(y) && m >= 0 && m <= 11) {
    return { mode: 'month', year: y, month: m }
  }
  return currentMonthPeriod()
}

/** The URL params that reproduce this period, for links and navigation. */
export function periodParams(period: Period): Record<string, string> {
  return period.mode === 'month'
    ? { y: String(period.year), m: String(period.month) }
    : { from: period.from, to: period.to }
}

export function periodRange(period: Period): DateRange {
  if (period.mode === 'month') return monthRange(period.year, period.month)
  const end = new Date(fromDateInput(period.to))
  end.setDate(end.getDate() + 1) // inclusive "to" day → exclusive endMs
  return { startMs: fromDateInput(period.from), endMs: end.getTime() }
}

export function periodLabel(period: Period): string {
  return period.mode === 'month'
    ? monthLabel(period.year, period.month)
    : rangeLabel(periodRange(period))
}

/** Month the 6-month trend chart ends at. */
export function trendAnchor(period: Period): { year: number; month: number } {
  if (period.mode === 'month') return { year: period.year, month: period.month }
  const end = new Date(periodRange(period).endMs - 1)
  return { year: end.getFullYear(), month: end.getMonth() }
}
