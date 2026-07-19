import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import {
  accountBalances,
  matchesSearch,
  registerOrder,
  runningBalances,
  selectionTotal,
  touchesAccount,
} from '../lib/ledger'
import { categoryLabel } from '../lib/categories'
import { inMonth, monthLabel } from '../lib/dates'
import { saveTxn, setTxnsCleared } from '../data/repo'
import { formatCents } from '../lib/money'
import { SummaryHeader } from '../components/SummaryHeader'
import { TxnRow } from '../components/TxnRow'
import {
  ChevronDown,
  PlusIcon,
  ReconcileIcon,
  SearchIcon,
} from '../components/icons'
import type { Txn } from '../types'

export function Register() {
  const { user } = useAuth()
  const { accounts, txns, ready, selectedAccountId, selectAccount } = useData()
  const navigate = useNavigate()
  const toast = useToast()

  const now = new Date()
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [hideCleared, setHideCleared] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [staged, setStaged] = useState<Set<string>>(new Set())
  const [committing, setCommitting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const account = accounts.find((a) => a.id === selectedAccountId) ?? null
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const accountTxns = useMemo(
    () => (account ? txns.filter((t) => touchesAccount(t, account.id)) : []),
    [txns, account],
  )
  const balances = useMemo(
    () => (account ? accountBalances(account, accountTxns) : null),
    [account, accountTxns],
  )
  const running = useMemo(
    () => (account ? runningBalances(account, accountTxns) : new Map<string, number>()),
    [account, accountTxns],
  )

  const searching = searchOpen && search.trim() !== ''

  // One mixed list, newest first. Uncleared items stay visible in every
  // month (that's the point of a checkbook); cleared history pages by month.
  const visible = useMemo(() => {
    if (!account) return [] as Txn[]
    const ordered = registerOrder(accountTxns)
    if (searching) {
      return ordered.filter((t) =>
        matchesSearch(t, search, categoryLabel(t.categoryId, t.categoryName)),
      )
    }
    return ordered.filter(
      (t) =>
        (!t.cleared || inMonth(t.date, month.year, month.month)) &&
        (!hideCleared || !t.cleared),
    )
  }, [account, accountTxns, month, searching, search, hideCleared])

  const stagedTxns = useMemo(
    () => accountTxns.filter((t) => !t.cleared && staged.has(t.id)),
    [accountTxns, staged],
  )
  const stagedTotal = account ? selectionTotal(stagedTxns, account.id) : 0

  if (!ready) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--ink-tertiary)', fontWeight: 600 }}>Loading your ledger…</div>
      </div>
    )
  }

  if (!account) {
    navigate('/accounts', { replace: true })
    return null
  }

  const partnerName = (t: Txn) =>
    t.accountId === account.id
      ? (accountNames.get(t.transferAccountId ?? '') ?? 'account')
      : (accountNames.get(t.accountId) ?? 'account')

  function toggleStage(t: Txn) {
    setStaged((prev) => {
      const next = new Set(prev)
      if (next.has(t.id)) next.delete(t.id)
      else next.add(t.id)
      return next
    })
  }

  async function unclear(t: Txn) {
    if (!user) return
    const { id, createdAt, updatedAt, ...rest } = t
    void createdAt
    void updatedAt
    await saveTxn(user.uid, { ...rest, cleared: false, clearedAt: undefined }, id)
    toast('Marked outstanding')
  }

  async function commitReconcile() {
    if (!user || stagedTxns.length === 0) {
      toast('Tap the circle on outstanding items first')
      return
    }
    setCommitting(true)
    try {
      await setTxnsCleared(user.uid, stagedTxns.map((t) => t.id), true)
      toast(
        `Reconciled ${stagedTxns.length} transaction${stagedTxns.length === 1 ? '' : 's'}`,
      )
      setStaged(new Set())
    } finally {
      setCommitting(false)
    }
  }

  function shiftMonth(delta: number) {
    setMonth(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const isEmpty = accountTxns.length === 0
  const hasStaged = stagedTxns.length > 0

  return (
    <div className="app-shell" style={{ paddingBottom: hasStaged ? 170 : 110 }}>
      <div className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAccountMenuOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              {account.name}
              <ChevronDown color="var(--ink-secondary)" />
            </button>
            {accountMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 30,
                  left: 0,
                  zIndex: 30,
                  minWidth: 200,
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 14,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                }}
              >
                {accounts
                  .filter((a) => !a.archived)
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        selectAccount(a.id)
                        setAccountMenuOpen(false)
                        setStaged(new Set())
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: 15,
                        fontWeight: a.id === account.id ? 700 : 600,
                        color: a.id === account.id ? 'var(--accent)' : 'var(--ink)',
                        borderTop: '1px solid var(--row-divider)',
                      }}
                    >
                      {a.name}
                    </button>
                  ))}
                <button
                  onClick={() => navigate('/accounts')}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink-secondary)',
                    borderTop: '1px solid var(--row-divider)',
                  }}
                >
                  Manage accounts…
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              aria-label="Search"
              onClick={() => {
                setSearchOpen((o) => {
                  if (o) setSearch('')
                  return !o
                })
                setTimeout(() => searchRef.current?.focus(), 50)
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: searchOpen ? 'var(--accent-tint)' : 'var(--chip-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: searchOpen ? 'var(--accent)' : 'var(--ink-secondary)',
              }}
            >
              <SearchIcon />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                aria-label="Menu"
                onClick={() => setMenuOpen((o) => !o)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--chip-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--ink-secondary)',
                  letterSpacing: 1,
                  paddingBottom: 6,
                }}
              >
                …
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 40,
                    right: 0,
                    zIndex: 30,
                    minWidth: 190,
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 14,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { label: 'Accounts', to: '/accounts' },
                    { label: 'Payees', to: '/payees' },
                    { label: 'Settings', to: '/settings' },
                  ].map((item) => (
                    <button
                      key={item.to}
                      onClick={() => {
                        setMenuOpen(false)
                        navigate(item.to)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        borderTop: '1px solid var(--row-divider)',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {balances && <SummaryHeader balances={balances} muted={isEmpty} />}

        {searchOpen && (
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payee, memo, category, amount…"
            style={{
              width: '100%',
              marginTop: 12,
              height: 40,
              borderRadius: 12,
              border: '1px solid var(--surface-border)',
              background: 'var(--canvas)',
              padding: '0 14px',
              fontSize: 15,
              outline: 'none',
            }}
          />
        )}
      </div>

      {/* filter row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            style={{ padding: '4px 6px', color: 'var(--ink-tertiary)', fontWeight: 700 }}
          >
            ‹
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-secondary)' }}>
            {monthLabel(month.year, month.month)}
          </div>
          <button
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            style={{ padding: '4px 6px', color: 'var(--ink-tertiary)', fontWeight: 700 }}
          >
            ›
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`filter-chip ${hasStaged ? 'active' : ''}`}
            onClick={() => void commitReconcile()}
            disabled={committing}
          >
            <ReconcileIcon />
            Reconcile{hasStaged ? ` · ${stagedTxns.length}` : ''}
          </button>
          <button
            className={`filter-chip ${hideCleared ? 'active' : ''}`}
            onClick={() => setHideCleared((h) => !h)}
          >
            <span className={`mini-toggle ${hideCleared ? 'on' : ''}`} />
            Hide cleared
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '6px 12px 0' }}>
        {isEmpty ? (
          <EmptyState accountId={account.id} />
        ) : visible.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ink-tertiary)',
              fontSize: 14,
              fontWeight: 600,
              padding: '48px 24px',
            }}
          >
            {searching
              ? 'No transactions match your search.'
              : `Nothing in ${monthLabel(month.year, month.month)}.`}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 6 }}>
            {visible.map((t) => (
              <TxnRow
                key={t.id}
                txn={t}
                accountId={account.id}
                runningBalanceCents={running.get(t.id)}
                transferPartnerName={t.type === 'transfer' ? partnerName(t) : undefined}
                staged={staged.has(t.id)}
                onRowClick={() => navigate(`/txn/${t.id}`)}
                onDiscClick={() => (t.cleared ? void unclear(t) : toggleStage(t))}
              />
            ))}
          </div>
        )}
      </div>

      {/* staged commit bar */}
      {hasStaged && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 520,
            background: 'var(--surface)',
            borderTop: '1px solid var(--surface-border)',
            padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
            zIndex: 25,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div className="num" style={{ fontSize: 14, fontWeight: 700 }}>
              {stagedTxns.length} staged · {formatCents(stagedTotal)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="num" style={{ fontSize: 13, color: 'var(--ink-tertiary)' }}>
                Cleared if committed{' '}
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                  {balances ? formatCents(balances.clearedCents + stagedTotal) : ''}
                </span>
              </div>
              <button
                onClick={() => setStaged(new Set())}
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-secondary)' }}
              >
                Deselect
              </button>
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ height: 50, borderRadius: 14, fontSize: 16 }}
            disabled={committing}
            onClick={() => void commitReconcile()}
          >
            Reconcile — mark {stagedTxns.length} cleared
          </button>
        </div>
      )}

      <button className="fab" aria-label="Add transaction" onClick={() => navigate('/txn/new')}>
        <PlusIcon color="var(--check-on-disc)" />
      </button>
    </div>
  )
}

function EmptyState({ accountId }: { accountId: string }) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 44px 0',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: '3px dashed var(--dashed-ring)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlusIcon size={26} color="var(--dashed-ring)" />
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, marginTop: 20 }}>No transactions yet</div>
      <div style={{ fontSize: 15, color: 'var(--ink-secondary)', marginTop: 6, lineHeight: 1.5 }}>
        Start with your bank's current balance so the register matches from day one.
      </div>
      <button
        onClick={() => navigate(`/accounts/${accountId}`)}
        style={{
          height: 48,
          padding: '0 22px',
          borderRadius: 14,
          background: 'var(--accent-tint)',
          color: 'var(--accent)',
          fontSize: 16,
          fontWeight: 700,
          marginTop: 20,
        }}
      >
        Set opening balance
      </button>
    </div>
  )
}
