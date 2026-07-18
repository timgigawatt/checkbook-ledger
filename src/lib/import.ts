import { dollarsToCents } from './money'
import { getCategory, resolveImportedCategory, TRANSFER_CATEGORY_ID } from './categories'
import { startOfDay } from './dates'

/**
 * Mapping of the old Realm export (Checkbook - Account Tracker) onto the
 * new schema. Input is the JSON export of the Realm tables, or a flat CSV
 * of transactions. Everything here is pure so it is unit-testable; the
 * import screen handles file reading and Firestore writes.
 */

export interface ImportedAccount {
  /** Old identifier transactions point at (RealmAccounts.documentId). */
  ref: string
  name: string
  openingBalanceCents: number
}

export interface ImportedPayee {
  name: string
  defaultCategoryId: string
  useCount: number
}

export interface ImportedTxn {
  accountRef: string | null
  type: 'expense' | 'income' | 'transfer'
  amountCents: number
  payeeName: string
  categoryId: string
  categoryName?: string
  date: number
  checkNumber?: string
  memo?: string
  cleared: boolean
  /** Old identifier of the destination account for transfers. */
  transferAccountRef?: string
}

export interface ImportParseResult {
  accounts: ImportedAccount[]
  payees: ImportedPayee[]
  txns: ImportedTxn[]
  warnings: string[]
}

type Row = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[$,]/g, ''))
    if (Number.isFinite(n)) return n
  }
  return null
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  const s = str(v).toLowerCase()
  if (['true', 'yes', '1', 'y', 'cleared'].includes(s)) return true
  if (['false', 'no', '0', 'n', 'outstanding'].includes(s)) return false
  return fallback
}

function pick(row: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k]
    const found = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase())
    if (found && row[found] != null && row[found] !== '') return row[found]
  }
  return undefined
}

/** Epoch seconds vs milliseconds vs date string → local-midnight ms. */
function parseWhen(v: unknown): number | null {
  const n = num(v)
  if (n !== null && n > 0) {
    // epoch seconds land well below year ~2255 in ms terms
    const ms = n < 9_000_000_000 ? n * 1000 : n
    return startOfDay(ms)
  }
  const s = str(v)
  if (s) {
    const parsed = Date.parse(s)
    if (!Number.isNaN(parsed)) return startOfDay(parsed)
  }
  return null
}

function mapRealmTxn(row: Row, warnings: string[], index: number): ImportedTxn | null {
  const amount = num(pick(row, 'amount'))
  const date = parseWhen(pick(row, 'time', 'date'))
  const payeeName = str(pick(row, 'name', 'payee'))
  if (amount === null || date === null) {
    warnings.push(`Transaction ${index + 1}: missing amount or date — skipped`)
    return null
  }

  const typeRaw = str(pick(row, 'type'))
  const inAccount = str(pick(row, 'inAccountId'))
  const outAccount = str(pick(row, 'outAccountId'))
  const isTransfer = Boolean(inAccount && outAccount && inAccount !== outAccount)

  const categoryName = str(pick(row, 'categoryName', 'category')) || undefined
  const categoryId = isTransfer
    ? TRANSFER_CATEGORY_ID
    : resolveImportedCategory(str(pick(row, 'categoryId', 'cat_id')) || undefined, categoryName)

  const base = {
    amountCents: Math.abs(dollarsToCents(amount)),
    payeeName: payeeName || 'Unknown payee',
    categoryId,
    categoryName,
    date,
    checkNumber: str(pick(row, 'checkNum', 'checkNumber', 'check')) || undefined,
    memo: str(pick(row, 'memo', 'note', 'desc')) || undefined,
    // Old history defaults to cleared unless the export says otherwise.
    cleared: bool(pick(row, 'cleared', 'isCleared', 'clear'), true),
  }

  if (isTransfer) {
    return {
      ...base,
      type: 'transfer',
      accountRef: outAccount,
      transferAccountRef: inAccount,
    }
  }

  const type: ImportedTxn['type'] =
    typeRaw === '1' || typeRaw.toLowerCase() === 'income' ? 'income' : 'expense'
  return {
    ...base,
    type,
    accountRef: str(pick(row, 'accountId', 'account')) || null,
  }
}

function mapCsvTxn(row: Row, warnings: string[], index: number): ImportedTxn | null {
  const amount = num(pick(row, 'amount'))
  const date = parseWhen(pick(row, 'date', 'time'))
  if (amount === null || date === null) {
    warnings.push(`Row ${index + 1}: missing amount or date — skipped`)
    return null
  }
  const typeRaw = str(pick(row, 'type')).toLowerCase()
  const categoryName = str(pick(row, 'category', 'categoryName')) || undefined
  const categoryId = resolveImportedCategory(undefined, categoryName)
  // Explicit type wins; otherwise a negative amount marks an expense, an
  // income-kind category marks income, and everything else is an expense
  // (all-positive expense CSVs are the common case).
  const type: ImportedTxn['type'] =
    typeRaw === 'income' || typeRaw === '1'
      ? 'income'
      : typeRaw === 'expense' || typeRaw === '0'
        ? 'expense'
        : amount < 0
          ? 'expense'
          : getCategoryKind(categoryId) === 'income'
            ? 'income'
            : 'expense'
  return {
    accountRef: str(pick(row, 'account', 'accountId')) || null,
    type,
    amountCents: Math.abs(dollarsToCents(amount)),
    payeeName: str(pick(row, 'payee', 'name', 'description')) || 'Unknown payee',
    categoryId,
    categoryName,
    date,
    checkNumber: str(pick(row, 'check', 'checkNumber', 'check #')) || undefined,
    memo: str(pick(row, 'memo', 'note', 'notes')) || undefined,
    cleared: bool(pick(row, 'cleared', 'status'), true),
  }
}

function getCategoryKind(categoryId: string): 'expense' | 'income' | 'either' {
  return getCategory(categoryId).kind
}

function findTable(data: Record<string, unknown>, ...names: string[]): Row[] {
  for (const name of names) {
    const key = Object.keys(data).find((k) => k.toLowerCase() === name.toLowerCase())
    if (key && Array.isArray(data[key])) return data[key] as Row[]
  }
  return []
}

/** Parse a Realm JSON export ({RealmAccounts, RealmPayee, RealmTransaction}) or a flat JSON array of transactions. */
export function parseRealmJson(data: unknown): ImportParseResult {
  const warnings: string[] = []

  if (Array.isArray(data)) {
    const txns = (data as Row[])
      .map((row, i) => mapRealmTxn(row, warnings, i))
      .filter((t): t is ImportedTxn => t !== null)
    return { accounts: [], payees: derivePayees(txns), txns, warnings }
  }

  if (typeof data !== 'object' || data === null) {
    return { accounts: [], payees: [], txns: [], warnings: ['Unrecognized JSON shape'] }
  }

  const obj = data as Record<string, unknown>
  const accountRows = findTable(obj, 'RealmAccounts', 'accounts')
  const payeeRows = findTable(obj, 'RealmPayee', 'payees')
  const txnRows = findTable(obj, 'RealmTransaction', 'transactions')

  const accounts: ImportedAccount[] = accountRows.map((row, i) => ({
    ref: str(pick(row, 'documentId', '_id', 'id')) || `account-${i}`,
    name: str(pick(row, 'name')) || `Account ${i + 1}`,
    openingBalanceCents: dollarsToCents(num(pick(row, 'startBalance')) ?? 0),
  }))

  const payees: ImportedPayee[] = payeeRows
    .map((row) => ({
      name: str(pick(row, 'name')),
      defaultCategoryId: resolveImportedCategory(
        str(pick(row, 'categoryId')) || undefined,
        str(pick(row, 'categoryName')) || undefined,
      ),
      useCount: num(pick(row, 'useNum', 'useCount')) ?? 0,
    }))
    .filter((p) => p.name !== '')

  const txns = txnRows
    .map((row, i) => mapRealmTxn(row, warnings, i))
    .filter((t): t is ImportedTxn => t !== null)

  return {
    accounts,
    payees: payees.length ? payees : derivePayees(txns),
    txns,
    warnings,
  }
}

/** Parse CSV rows (already split into objects by the caller, e.g. papaparse). */
export function parseCsvRows(rows: Row[]): ImportParseResult {
  const warnings: string[] = []
  const txns = rows
    .map((row, i) => mapCsvTxn(row, warnings, i))
    .filter((t): t is ImportedTxn => t !== null)
  return { accounts: [], payees: derivePayees(txns), txns, warnings }
}

/** Build payee records from transactions when the export has no payee table. */
export function derivePayees(txns: ImportedTxn[]): ImportedPayee[] {
  const map = new Map<string, ImportedPayee>()
  for (const t of txns) {
    if (t.type === 'transfer') continue
    const key = t.payeeName.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.useCount += 1
    } else {
      map.set(key, { name: t.payeeName, defaultCategoryId: t.categoryId, useCount: 1 })
    }
  }
  return [...map.values()]
}
