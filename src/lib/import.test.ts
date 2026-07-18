import { describe, expect, it } from 'vitest'
import { parseCsvRows, parseRealmJson } from './import'

const realmExport = {
  RealmAccounts: [
    { _id: 'abc', documentId: 'doc-1', name: 'Checking', startBalance: 2000.0, nowBalance: 1857.06 },
  ],
  RealmPayee: [
    { _id: 'p1', name: 'Target', categoryId: 'cat_household', categoryName: 'Household', useNum: 42 },
    { _id: 'p2', name: 'Paycheck', categoryId: 'weird_id', categoryName: 'Income', useNum: 10 },
  ],
  RealmTransaction: [
    {
      _id: 't1',
      accountId: 'doc-1',
      name: 'Target',
      amount: 54.32,
      categoryId: 'cat_household',
      categoryName: 'Household',
      type: '0',
      time: 1_752_192_000, // epoch seconds
    },
    {
      _id: 't2',
      accountId: 'doc-1',
      name: 'Paycheck',
      amount: 1650.0,
      categoryId: 'cat_income',
      categoryName: 'Income',
      type: '1',
      time: 1_751_673_600,
    },
    {
      _id: 't3',
      accountId: 'doc-1',
      name: 'Broken row',
      amount: null,
      type: '0',
      time: 1_751_673_600,
    },
  ],
}

describe('parseRealmJson', () => {
  const result = parseRealmJson(realmExport)

  it('maps accounts with cents opening balances', () => {
    expect(result.accounts).toEqual([
      { ref: 'doc-1', name: 'Checking', openingBalanceCents: 200_000 },
    ])
  })

  it('maps payees, resolving unknown category ids by name', () => {
    expect(result.payees).toHaveLength(2)
    expect(result.payees[0]).toMatchObject({ name: 'Target', defaultCategoryId: 'cat_household' })
    expect(result.payees[1].defaultCategoryId).toBe('cat_income')
  })

  it('maps transactions with type, cents and dates, skipping broken rows', () => {
    expect(result.txns).toHaveLength(2)
    const [expense, income] = result.txns
    expect(expense).toMatchObject({
      type: 'expense',
      amountCents: 5432,
      payeeName: 'Target',
      accountRef: 'doc-1',
      cleared: true,
    })
    expect(income).toMatchObject({ type: 'income', amountCents: 165_000 })
    expect(result.warnings).toHaveLength(1)
  })

  it('detects transfers from distinct in/out accounts', () => {
    const { txns } = parseRealmJson({
      RealmTransaction: [
        {
          amount: 200,
          time: 1_751_673_600,
          type: '1',
          name: 'Transfer',
          outAccountId: 'doc-1',
          inAccountId: 'doc-2',
        },
      ],
    })
    expect(txns[0]).toMatchObject({
      type: 'transfer',
      accountRef: 'doc-1',
      transferAccountRef: 'doc-2',
      amountCents: 20_000,
    })
  })

  it('accepts a flat array of transactions and derives payees', () => {
    const result = parseRealmJson([
      { name: 'Shell', amount: 48.2, type: '0', time: 1_751_673_600 },
      { name: 'Shell', amount: 12.0, type: '0', time: 1_751_760_000 },
    ])
    expect(result.txns).toHaveLength(2)
    expect(result.payees).toEqual([
      expect.objectContaining({ name: 'Shell', useCount: 2 }),
    ])
  })
})

describe('parseCsvRows', () => {
  it('maps typical CSV columns', () => {
    const result = parseCsvRows([
      { date: '2026-07-11', payee: 'Costco', amount: '172.24', category: 'Groceries', cleared: 'no' },
      { date: '2026-07-05', payee: 'Employer', amount: '1650', type: 'income' },
    ])
    expect(result.txns[0]).toMatchObject({
      type: 'expense',
      amountCents: 17_224,
      payeeName: 'Costco',
      categoryId: 'cat_groceries',
      cleared: false,
    })
    expect(result.txns[1]).toMatchObject({ type: 'income', amountCents: 165_000, cleared: true })
  })

  it('falls back sensibly when no type column exists', () => {
    const rows = parseCsvRows([
      { date: '2026-07-01', payee: 'X', amount: '-5' },
      { date: '2026-07-01', payee: 'Y', amount: '5' },
      { date: '2026-07-01', payee: 'Z', amount: '5', category: 'Paycheck' },
    ])
    expect(rows.txns.map((t) => t.type)).toEqual(['expense', 'expense', 'income'])
  })
})
