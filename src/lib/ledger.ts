import type { Account, Txn } from '../types'

/**
 * Signed effect of a transaction on a given account's balance, in cents.
 * Zero when the transaction doesn't touch the account.
 */
export function effectOn(txn: Txn, accountId: string): number {
  if (txn.type === 'transfer') {
    if (txn.accountId === accountId) return -txn.amountCents
    if (txn.transferAccountId === accountId) return txn.amountCents
    return 0
  }
  if (txn.accountId !== accountId) return 0
  return txn.type === 'expense' ? -txn.amountCents : txn.amountCents
}

export function touchesAccount(txn: Txn, accountId: string): boolean {
  return txn.accountId === accountId || txn.transferAccountId === accountId
}

export interface AccountBalances {
  /** opening + every transaction */
  balanceCents: number
  /** opening + cleared transactions */
  clearedCents: number
  /** sum of uncleared effects (balance − cleared) */
  outstandingCents: number
}

export function accountBalances(account: Account, txns: Txn[]): AccountBalances {
  let balance = account.openingBalanceCents
  let cleared = account.openingBalanceCents
  for (const t of txns) {
    const effect = effectOn(t, account.id)
    balance += effect
    if (t.cleared) cleared += effect
  }
  return {
    balanceCents: balance,
    clearedCents: cleared,
    outstandingCents: balance - cleared,
  }
}

/** Stable chronological order: date, then createdAt, then id. */
function chronological(a: Txn, b: Txn): number {
  return a.date - b.date || a.createdAt - b.createdAt || a.id.localeCompare(b.id)
}

/**
 * Running balance after each transaction for one account, keyed by txn id.
 * Includes every transaction regardless of cleared state, oldest first.
 */
export function runningBalances(account: Account, txns: Txn[]): Map<string, number> {
  const relevant = txns.filter((t) => touchesAccount(t, account.id)).sort(chronological)
  const out = new Map<string, number>()
  let balance = account.openingBalanceCents
  for (const t of relevant) {
    balance += effectOn(t, account.id)
    out.set(t.id, balance)
  }
  return out
}

/**
 * Register order: one mixed list, newest first, cleared and uncleared
 * interleaved by date (the disc icon carries the state).
 */
export function registerOrder(txns: Txn[]): Txn[] {
  return [...txns].sort((a, b) => chronological(b, a))
}

/** Sum of effects for a batch selection, for the live total in the select bar. */
export function selectionTotal(txns: Txn[], accountId: string): number {
  return txns.reduce((sum, t) => sum + effectOn(t, accountId), 0)
}

/** Case-insensitive register search over payee, memo, category and check #. */
export function matchesSearch(txn: Txn, query: string, categoryName: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    txn.payeeName.toLowerCase().includes(q) ||
    (txn.memo ?? '').toLowerCase().includes(q) ||
    categoryName.toLowerCase().includes(q) ||
    (txn.checkNumber ?? '').toLowerCase().includes(q) ||
    (txn.amountCents / 100).toFixed(2).includes(q)
  )
}
