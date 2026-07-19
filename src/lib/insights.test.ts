import { describe, expect, it } from 'vitest'
import { monthlyCashflow, spendingByCategory, topPayees } from './insights'
import type { Txn } from '../types'

let seq = 0
function txn(partial: Partial<Txn>): Txn {
  seq += 1
  return {
    id: `t${seq}`,
    accountId: 'checking',
    type: 'expense',
    amountCents: 1000,
    payeeId: null,
    payeeName: 'Test',
    categoryId: 'cat_groceries',
    date: new Date(2026, 6, 10).getTime(),
    cleared: true,
    createdAt: seq,
    updatedAt: seq,
    ...partial,
  }
}

describe('spendingByCategory', () => {
  it('groups month expenses by category, largest first', () => {
    const result = spendingByCategory(
      [
        txn({ categoryId: 'cat_groceries', amountCents: 6000 }),
        txn({ categoryId: 'cat_groceries', amountCents: 4000 }),
        txn({ categoryId: 'cat_gas', amountCents: 4820 }),
        txn({ type: 'income', categoryId: 'cat_income', amountCents: 165_000 }),
        txn({ type: 'transfer', transferAccountId: 'savings', amountCents: 20_000 }),
        txn({ categoryId: 'cat_gas', date: new Date(2026, 5, 10).getTime() }), // June
      ],
      2026,
      6,
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ label: 'Groceries', cents: 10_000, count: 2 })
    expect(result[1]).toMatchObject({ label: 'Gas', cents: 4820, count: 1 })
  })

  it('preserves imported category names on unknown ids', () => {
    const result = spendingByCategory(
      [txn({ categoryId: 'cat_other', categoryName: 'Lawn Care', amountCents: 500 })],
      2026,
      6,
    )
    expect(result[0].label).toBe('Lawn Care')
  })
})

describe('monthlyCashflow', () => {
  it('buckets income and spending per month, oldest first, ignoring transfers', () => {
    const result = monthlyCashflow(
      [
        txn({ type: 'income', amountCents: 165_000, date: new Date(2026, 6, 5).getTime() }),
        txn({ amountCents: 5432, date: new Date(2026, 6, 11).getTime() }),
        txn({ amountCents: 9999, date: new Date(2026, 5, 2).getTime() }),
        txn({ type: 'transfer', transferAccountId: 's', amountCents: 20_000, date: new Date(2026, 6, 8).getTime() }),
        txn({ amountCents: 1, date: new Date(2025, 6, 1).getTime() }), // outside window
      ],
      2026,
      6,
      3,
    )
    expect(result.map((m) => m.month)).toEqual([4, 5, 6])
    expect(result[2]).toMatchObject({ inCents: 165_000, outCents: 5432 })
    expect(result[1]).toMatchObject({ inCents: 0, outCents: 9999 })
    expect(result[0]).toMatchObject({ inCents: 0, outCents: 0 })
  })

  it('spans year boundaries', () => {
    const result = monthlyCashflow([], 2026, 0, 3)
    expect(result.map((m) => `${m.year}-${m.month}`)).toEqual(['2025-10', '2025-11', '2026-0'])
  })
})

describe('topPayees', () => {
  it('ranks month expense payees case-insensitively with a limit', () => {
    const result = topPayees(
      [
        txn({ payeeName: 'Target', amountCents: 5000 }),
        txn({ payeeName: 'target', amountCents: 4000 }),
        txn({ payeeName: 'Shell', amountCents: 4820 }),
        txn({ payeeName: 'Costco', amountCents: 100 }),
        txn({ type: 'income', payeeName: 'Paycheck', amountCents: 165_000 }),
      ],
      2026,
      6,
      2,
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ name: 'Target', cents: 9000, count: 2 })
    expect(result[1]).toMatchObject({ name: 'Shell', cents: 4820 })
  })
})
