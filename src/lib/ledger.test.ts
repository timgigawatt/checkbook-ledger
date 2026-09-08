import { describe, expect, it } from 'vitest'
import {
  accountBalances,
  effectOn,
  monthGroups,
  registerOrder,
  runningBalances,
  selectionTotal,
} from './ledger'
import type { Account, Txn } from '../types'

const account: Account = {
  id: 'checking',
  name: 'Everyday Checking',
  openingBalanceCents: 200_000,
  archived: false,
  sortOrder: 0,
  createdAt: 0,
}

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
    categoryId: 'cat_other',
    date: seq * 86_400_000,
    cleared: false,
    createdAt: seq,
    updatedAt: seq,
    ...partial,
  }
}

describe('effectOn', () => {
  it('subtracts expenses and adds income', () => {
    expect(effectOn(txn({ type: 'expense', amountCents: 5432 }), 'checking')).toBe(-5432)
    expect(effectOn(txn({ type: 'income', amountCents: 165_000 }), 'checking')).toBe(165_000)
  })

  it('handles both sides of a transfer', () => {
    const t = txn({ type: 'transfer', amountCents: 20_000, transferAccountId: 'savings' })
    expect(effectOn(t, 'checking')).toBe(-20_000)
    expect(effectOn(t, 'savings')).toBe(20_000)
    expect(effectOn(t, 'other')).toBe(0)
  })

  it('ignores transactions for other accounts', () => {
    expect(effectOn(txn({ accountId: 'savings' }), 'checking')).toBe(0)
  })
})

describe('accountBalances', () => {
  it('splits balance into cleared + outstanding', () => {
    const txns = [
      txn({ type: 'income', amountCents: 165_000, cleared: true }),
      txn({ type: 'expense', amountCents: 145_000, cleared: true }),
      txn({ type: 'expense', amountCents: 5432, cleared: false }),
      txn({ type: 'expense', amountCents: 1168, cleared: false }),
    ]
    const b = accountBalances(account, txns)
    expect(b.clearedCents).toBe(200_000 + 165_000 - 145_000)
    expect(b.outstandingCents).toBe(-5432 - 1168)
    expect(b.balanceCents).toBe(b.clearedCents + b.outstandingCents)
  })

  it('equals opening balance with no transactions', () => {
    const b = accountBalances(account, [])
    expect(b.balanceCents).toBe(200_000)
    expect(b.outstandingCents).toBe(0)
  })
})

describe('runningBalances', () => {
  it('accumulates chronologically regardless of cleared state', () => {
    const t1 = txn({ type: 'income', amountCents: 100_000, date: 1, cleared: true })
    const t2 = txn({ type: 'expense', amountCents: 30_000, date: 2, cleared: false })
    const t3 = txn({ type: 'expense', amountCents: 20_000, date: 3, cleared: true })
    const rb = runningBalances(account, [t3, t1, t2])
    expect(rb.get(t1.id)).toBe(300_000)
    expect(rb.get(t2.id)).toBe(270_000)
    expect(rb.get(t3.id)).toBe(250_000)
  })

  it('breaks same-day ties by creation order', () => {
    const t1 = txn({ type: 'income', amountCents: 1000, date: 5 })
    const t2 = txn({ type: 'expense', amountCents: 400, date: 5 })
    const rb = runningBalances(account, [t2, t1])
    expect(rb.get(t1.id)).toBe(201_000)
    expect(rb.get(t2.id)).toBe(200_600)
  })
})

describe('registerOrder', () => {
  it('keeps cleared and uncleared interleaved by date, newest first', () => {
    const older = txn({ date: 1, cleared: true })
    const open = txn({ date: 2, cleared: false })
    const newer = txn({ date: 3, cleared: true })
    expect(registerOrder([older, open, newer]).map((t) => t.id)).toEqual([
      newer.id,
      open.id,
      older.id,
    ])
  })

  it('breaks same-day ties by creation order, newest first', () => {
    const first = txn({ date: 5 })
    const second = txn({ date: 5 })
    expect(registerOrder([first, second]).map((t) => t.id)).toEqual([second.id, first.id])
  })
})

describe('monthGroups', () => {
  it('buckets by calendar month, newest month first', () => {
    const july = txn({ date: new Date(2026, 6, 4).getTime() })
    const sept1 = txn({ date: new Date(2026, 8, 2).getTime() })
    const sept2 = txn({ date: new Date(2026, 8, 20).getTime() })
    const groups = monthGroups([july, sept1, sept2])
    expect(groups.map((g) => `${g.year}-${g.month}`)).toEqual(['2026-8', '2026-6'])
    expect(groups[0].txns.map((t) => t.id)).toEqual([sept2.id, sept1.id])
    expect(groups[1].txns.map((t) => t.id)).toEqual([july.id])
  })

  it('returns nothing for an empty register', () => {
    expect(monthGroups([])).toEqual([])
  })
})

describe('selectionTotal', () => {
  it('sums signed effects for the batch bar', () => {
    const items = [
      txn({ type: 'expense', amountCents: 5432 }),
      txn({ type: 'expense', amountCents: 1168 }),
      txn({ type: 'expense', amountCents: 4820 }),
    ]
    expect(selectionTotal(items, 'checking')).toBe(-11_420)
  })
})
