import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import {
  accountsCol,
  payeesCol,
  txnsCol,
  snapToAccount,
  snapToPayee,
  snapToTxn,
} from '../data/repo'
import type { Account, Payee, Txn } from '../types'

interface DataState {
  accounts: Account[]
  payees: Payee[]
  txns: Txn[]
  ready: boolean
  selectedAccountId: string | null
  selectAccount: (id: string) => void
}

const DataContext = createContext<DataState>({
  accounts: [],
  payees: [],
  txns: [],
  ready: false,
  selectedAccountId: null,
  selectAccount: () => {},
})

const ACCOUNT_KEY = 'checkbook.selectedAccount'

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [payees, setPayees] = useState<Payee[]>([])
  const [txns, setTxns] = useState<Txn[]>([])
  const [loaded, setLoaded] = useState({ accounts: false, payees: false, txns: false })
  const [selected, setSelected] = useState<string | null>(
    () => localStorage.getItem(ACCOUNT_KEY) || null,
  )

  useEffect(() => {
    if (!user) {
      setAccounts([])
      setPayees([])
      setTxns([])
      setLoaded({ accounts: false, payees: false, txns: false })
      return
    }
    const uid = user.uid
    const unsubs = [
      onSnapshot(query(accountsCol(uid), orderBy('sortOrder')), (snap) => {
        setAccounts(snap.docs.map(snapToAccount))
        setLoaded((l) => ({ ...l, accounts: true }))
      }),
      onSnapshot(payeesCol(uid), (snap) => {
        setPayees(snap.docs.map(snapToPayee))
        setLoaded((l) => ({ ...l, payees: true }))
      }),
      onSnapshot(query(txnsCol(uid), orderBy('date', 'desc')), (snap) => {
        setTxns(snap.docs.map(snapToTxn))
        setLoaded((l) => ({ ...l, txns: true }))
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [user])

  const active = accounts.filter((a) => !a.archived)
  const selectedAccountId =
    selected && accounts.some((a) => a.id === selected)
      ? selected
      : (active[0]?.id ?? accounts[0]?.id ?? null)

  const value = useMemo<DataState>(
    () => ({
      accounts,
      payees,
      txns,
      ready: loaded.accounts && loaded.payees && loaded.txns,
      selectedAccountId,
      selectAccount: (id: string) => {
        localStorage.setItem(ACCOUNT_KEY, id)
        setSelected(id)
      },
    }),
    [accounts, payees, txns, loaded, selectedAccountId],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
