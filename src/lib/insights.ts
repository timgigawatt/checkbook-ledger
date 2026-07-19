import type { Txn } from '../types'
import { categoryLabel, getCategory } from './categories'
import { inMonth } from './dates'

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

/** Expense totals by category for one month, largest first. */
export function spendingByCategory(txns: Txn[], year: number, month: number): CategorySpend[] {
  const map = new Map<string, CategorySpend>()
  for (const t of txns) {
    if (t.type !== 'expense' || !inMonth(t.date, year, month)) continue
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

export interface PayeeSpend {
  name: string
  cents: number
  count: number
}

/** Biggest expense payees for one month, largest first. */
export function topPayees(txns: Txn[], year: number, month: number, limit = 5): PayeeSpend[] {
  const map = new Map<string, PayeeSpend>()
  for (const t of txns) {
    if (t.type !== 'expense' || !inMonth(t.date, year, month)) continue
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
