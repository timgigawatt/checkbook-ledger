import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Account, Payee, Txn, UserProfile } from '../types'
import { DEFAULT_EXPENSE_CATEGORY_ID } from '../lib/categories'

export const userDoc = (uid: string) => doc(db, 'users', uid)
export const accountsCol = (uid: string) => collection(db, 'users', uid, 'accounts')
export const payeesCol = (uid: string) => collection(db, 'users', uid, 'payees')
export const txnsCol = (uid: string) => collection(db, 'users', uid, 'transactions')

export function snapToAccount(snap: QueryDocumentSnapshot<DocumentData>): Account {
  const d = snap.data()
  return {
    id: snap.id,
    name: d.name ?? 'Account',
    openingBalanceCents: d.openingBalanceCents ?? 0,
    archived: d.archived ?? false,
    sortOrder: d.sortOrder ?? 0,
    createdAt: d.createdAt ?? 0,
  }
}

export function snapToPayee(snap: QueryDocumentSnapshot<DocumentData>): Payee {
  const d = snap.data()
  return {
    id: snap.id,
    name: d.name ?? '',
    nameLower: d.nameLower ?? (d.name ?? '').toLowerCase(),
    defaultCategoryId: d.defaultCategoryId ?? DEFAULT_EXPENSE_CATEGORY_ID,
    useCount: d.useCount ?? 0,
    lastUsedAt: d.lastUsedAt ?? 0,
  }
}

export function snapToTxn(snap: QueryDocumentSnapshot<DocumentData>): Txn {
  const d = snap.data()
  return {
    id: snap.id,
    accountId: d.accountId,
    type: d.type ?? 'expense',
    amountCents: d.amountCents ?? 0,
    payeeId: d.payeeId ?? null,
    payeeName: d.payeeName ?? '',
    categoryId: d.categoryId ?? DEFAULT_EXPENSE_CATEGORY_ID,
    categoryName: d.categoryName ?? undefined,
    date: d.date ?? 0,
    checkNumber: d.checkNumber ?? undefined,
    memo: d.memo ?? undefined,
    cleared: d.cleared ?? false,
    clearedAt: d.clearedAt ?? undefined,
    reconciledAt: d.reconciledAt ?? undefined,
    transferAccountId: d.transferAccountId ?? undefined,
    createdAt: d.createdAt ?? 0,
    updatedAt: d.updatedAt ?? 0,
  }
}

/** Strip undefined values — Firestore rejects them. */
function clean<T extends Record<string, unknown>>(data: T): UpdateData<DocumentData> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as UpdateData<DocumentData>
}

export async function ensureUserDoc(uid: string, email: string, displayName: string) {
  const profile: UserProfile = {
    email,
    displayName,
    currency: 'USD',
    settings: { theme: 'system', hideCleared: false },
  }
  await setDoc(userDoc(uid), clean({ ...profile }), { merge: true })
}

export async function createAccount(
  uid: string,
  name: string,
  openingBalanceCents: number,
  sortOrder: number,
): Promise<string> {
  const ref = await addDoc(accountsCol(uid), {
    name,
    openingBalanceCents,
    archived: false,
    sortOrder,
    createdAt: Date.now(),
  })
  return ref.id
}

export async function updateAccount(uid: string, id: string, data: Partial<Account>) {
  await updateDoc(doc(accountsCol(uid), id), clean({ ...data, id: undefined }))
}

export async function deleteAccount(uid: string, id: string) {
  await deleteDoc(doc(accountsCol(uid), id))
}

export async function saveTxn(
  uid: string,
  data: Omit<Txn, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
): Promise<string> {
  const now = Date.now()
  if (existingId) {
    await updateDoc(doc(txnsCol(uid), existingId), clean({ ...data, updatedAt: now }))
    return existingId
  }
  const ref = await addDoc(txnsCol(uid), clean({ ...data, createdAt: now, updatedAt: now }))
  return ref.id
}

export async function deleteTxn(uid: string, id: string) {
  await deleteDoc(doc(txnsCol(uid), id))
}

export async function setTxnsCleared(uid: string, ids: string[], reconciled: boolean) {
  const now = Date.now()
  // Firestore batches cap at 500 operations.
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 450)) {
      batch.update(doc(txnsCol(uid), id), {
        cleared: true,
        clearedAt: now,
        updatedAt: now,
        ...(reconciled ? { reconciledAt: now } : {}),
      })
    }
    await batch.commit()
  }
}

/**
 * Record a payee use: create it on first use, bump the counter and refresh
 * the cached default category on repeat use.
 */
export async function upsertPayee(
  uid: string,
  payees: Payee[],
  name: string,
  categoryId: string,
): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const existing = payees.find((p) => p.nameLower === trimmed.toLowerCase())
  const now = Date.now()
  if (existing) {
    await updateDoc(doc(payeesCol(uid), existing.id), {
      useCount: existing.useCount + 1,
      defaultCategoryId: categoryId,
      lastUsedAt: now,
    })
    return existing.id
  }
  const ref = await addDoc(payeesCol(uid), {
    name: trimmed,
    nameLower: trimmed.toLowerCase(),
    defaultCategoryId: categoryId,
    useCount: 1,
    lastUsedAt: now,
  })
  return ref.id
}

export async function updatePayee(uid: string, id: string, data: Partial<Payee>) {
  await updateDoc(doc(payeesCol(uid), id), clean({ ...data, id: undefined }))
}

export async function deletePayee(uid: string, id: string) {
  await deleteDoc(doc(payeesCol(uid), id))
}
