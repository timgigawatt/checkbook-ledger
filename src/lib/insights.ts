import type { Txn } from '../types'
import { categoryLabel, getCategory } from './categories'
import { inMonth, inRange, type DateRange } from './dates'

/**
 * Insights math over one account's transactions. Transfers are excluded
 * everywhere — moving money between accounts is neither income nor spending.
 */

export interface CategorySpend {
  categoryId: string
  label: string
  icon: string
  cents: number
  count: number
}

/** Expense totals by category for a date range, largest first. */
export function spendingByCategory(txns: Txn[], range: DateRange): CategorySpend[] {
  const map = new Map<string, CategorySpend>()
  for (const t of txns) {
    if (t.type !== 'expense' || !inRange(t.date, range)) continue
    const label = categoryLabel(t.categoryId, t.categoryName)
    const key = `${t.categoryId}:${label}`
    const entry = map.get(key)
    if (entry) {
      entry.cents += t.amountCents
      entry.count += 1
    } else {
      map.set(key, {
        categoryId: t.categoryId,
        label,
        icon: getCategory(t.categoryId).icon,
        cents: t.amountCents,
        count: 1,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents)
}

/** The expenses behind one spendingByCategory row, newest first. */
export function categoryTxns(txns: Txn[], range: DateRange, categoryId: string, label: string): Txn[] {
  return txns
    .filter(
      (t) =>
        t.type === 'expense' &&
        inRange(t.date, range) &&
        t.categoryId === categoryId &&
        categoryLabel(t.categoryId, t.categoryName) === label,
    )
    .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt || b.id.localeCompare(a.id))
}

export interface MonthCashflow {
  year: number
  month: number
  inCents: number
  outCents: number
}

/** Income vs spending for the `count` months ending at (year, month), oldest first. */
export function monthlyCashflow(
  txns: Txn[],
  year: number,
  month: number,
  count: number,
): MonthCashflow[] {
  const months: MonthCashflow[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth(), inCents: 0, outCents: 0 })
  }
  for (const t of txns) {
    if (t.type === 'transfer') continue
    const slot = months.find((m) => inMonth(t.date, m.year, m.month))
    if (!slot) continue
    if (t.type === 'income') slot.inCents += t.amountCents
    else slot.outCents += t.amountCents
  }
  return months
}

/** Total income and spending inside a date range. */
export function cashflowTotals(txns: Txn[], range: DateRange): { inCents: number; outCents: number } {
  let inCents = 0
  let outCents = 0
  for (const t of txns) {
    if (t.type === 'transfer' || !inRange(t.date, range)) continue
    if (t.type === 'income') inCents += t.amountCents
    else outCents += t.amountCents
  }
  return { inCents, outCents }
}

export interface PayeeSpend {
  name: string
  cents: number
  count: number
}

/** Biggest expense payees for a date range, largest first. */
export function topPayees(txns: Txn[], range: DateRange, limit = 5): PayeeSpend[] {
  const map = new Map<string, PayeeSpend>()
  for (const t of txns) {
    if (t.type !== 'expense' || !inRange(t.date, range)) continue
    const key = t.payeeName.toLowerCase()
    const entry = map.get(key)
    if (entry) {
      entry.cents += t.amountCents
      entry.count += 1
    } else {
      map.set(key, { name: t.payeeName, cents: t.amountCents, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents).slice(0, limit)
}
