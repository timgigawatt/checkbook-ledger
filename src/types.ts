export type TxnType = 'expense' | 'income' | 'transfer'

export interface Account {
  id: string
  name: string
  openingBalanceCents: number
  archived: boolean
  sortOrder: number
  createdAt: number
}

export interface Payee {
  id: string
  name: string
  nameLower: string
  defaultCategoryId: string
  useCount: number
  lastUsedAt: number
}

export interface Txn {
  id: string
  accountId: string
  type: TxnType
  /** Always positive; sign is derived from type/direction. */
  amountCents: number
  payeeId: string | null
  payeeName: string
  categoryId: string
  /** Original category name from import, when categoryId is unknown. */
  categoryName?: string
  /** ms since epoch, local midnight of the transaction date */
  date: number
  checkNumber?: string
  memo?: string
  cleared: boolean
  clearedAt?: number
  reconciledAt?: number
  /** Transfer destination account (type === 'transfer' only). */
  transferAccountId?: string
  createdAt: number
  updatedAt: number
}

export interface UserSettings {
  theme: 'system' | 'light' | 'dark'
  hideCleared: boolean
}

export interface UserProfile {
  email: string
  displayName: string
  currency: string
  settings: UserSettings
}
