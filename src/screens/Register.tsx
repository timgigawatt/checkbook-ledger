import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import {
  accountBalances,
  matchesSearch,
  monthGroups,
  registerOrder,
  runningBalances,
  selectionTotal,
  touchesAccount,
} from '../lib/ledger'
import { categoryLabel } from '../lib/categories'
import { monthLabel } from '../lib/dates'
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

const ROW_BATCH = 80
const groupKey = (g: { year: number; month: number }) => `${g.year}-${g.month}`
const positionKey = (accountId: string) => `checkbook.register.pos.${accountId}`

interface SavedPosition {
  txnId: string
  scrollY: number
  renderCount: number
}

export function Register() {
  const { user } = useAuth()
  const { accounts, txns, ready, selectedAccountId, selectAccount } = useData()
  const navigate = useNavigate()
  const toast = useToast()

  const [hideCleared, setHideCleared] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [staged, setStaged] = useState<Set<string>>(new Set())
  const [committing, setCommitting] = useState(false)
  const [renderCount, setRenderCount] = useState(ROW_BATCH)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [pendingJump, setPendingJump] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const dividerRefs = useRef(new Map<string, HTMLDivElement>())
  const restoredRef = useRef(false)

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

  const searchResults = useMemo(() => {
    if (!searching) return [] as Txn[]
    return registerOrder(accountTxns).filter((t) =>
      matchesSearch(t, search, categoryLabel(t.categoryId, t.categoryName)),
    )
  }, [searching, accountTxns, search])

  // Every month in one continuous list, newest first; "hide cleared"
  // filters before grouping so empty months simply disappear.
  const groups = useMemo(
    () => monthGroups(hideCleared ? accountTxns.filter((t) => !t.cleared) : accountTxns),
    [accountTxns, hideCleared],
  )
  const totalRows = useMemo(() => groups.reduce((n, g) => n + g.txns.length, 0), [groups])
  const hasMore = renderCount < totalRows

  // Render incrementally: the first `renderCount` rows across the groups.
  const displayGroups = useMemo(() => {
    const out: typeof groups = []
    let budget = renderCount
    for (const g of groups) {
      if (budget <= 0) break
      out.push(budget >= g.txns.length ? g : { ...g, txns: g.txns.slice(0, budget) })
      budget -= g.txns.length
    }
    return out
  }, [groups, renderCount])

  const stagedTxns = useMemo(
    () => accountTxns.filter((t) => !t.cleared && staged.has(t.id)),
    [accountTxns, staged],
  )
  const stagedTotal = account ? selectionTotal(stagedTxns, account.id) : 0

  // Extend the list as the sentinel near the bottom comes into view.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || searching) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRenderCount((c) => c + ROW_BATCH)
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, searching, displayGroups])

  // Track which month group sits under the header so the label follows
  // the scroll — the visual cue that the month shifted.
  useEffect(() => {
    if (searching) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const threshold = (headRef.current?.getBoundingClientRect().bottom ?? 120) + 44
        let best: string | null = null
        for (const g of groups) {
          const el = dividerRefs.current.get(groupKey(g))
          if (!el) continue
          if (el.getBoundingClientRect().top <= threshold) best = groupKey(g)
          else break
        }
        setCurrentKey(best ?? (groups.length ? groupKey(groups[0]) : null))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [groups, searching, renderCount])

  // Jump-scroll once the target month's divider exists in the DOM.
  useEffect(() => {
    if (!pendingJump) return
    const el = dividerRefs.current.get(pendingJump)
    if (!el) return
    const headBottom = headRef.current?.getBoundingClientRect().height ?? 110
    const top = el.getBoundingClientRect().top + window.scrollY - headBottom - 46
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    setPendingJump(null)
  }, [pendingJump, renderCount])

  // Coming back from a transaction: restore depth + scroll, flash the row.
  useEffect(() => {
    if (!ready || !account || restoredRef.current) return
    restoredRef.current = true
    let saved: SavedPosition | null = null
    try {
      const raw = sessionStorage.getItem(positionKey(account.id))
      if (raw) {
        sessionStorage.removeItem(positionKey(account.id))
        saved = JSON.parse(raw) as SavedPosition
      }
    } catch {
      saved = null
    }
    if (!saved) return
    const { txnId, scrollY, renderCount: savedCount } = saved
    setRenderCount((c) => Math.max(c, savedCount))
    setHighlightId(txnId)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY })
        // If heights shifted (edit changed a month), pull the row into view.
        setTimeout(() => {
          const el = document.getElementById(`txn-${txnId}`)
          if (!el) return
          const r = el.getBoundingClientRect()
          if (r.top < 90 || r.bottom > window.innerHeight) {
            el.scrollIntoView({ block: 'center' })
          }
        }, 60)
      }),
    )
    window.setTimeout(() => setHighlightId(null), 1800)
  }, [ready, account])

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

  function openTxn(t: Txn) {
    if (account) {
      try {
        sessionStorage.setItem(
          positionKey(account.id),
          JSON.stringify({ txnId: t.id, scrollY: window.scrollY, renderCount }),
        )
      } catch {
        // storage unavailable — navigation still works, just no anchor
      }
    }
    navigate(`/txn/${t.id}`)
  }

  // ‹ › jump to the adjacent month that actually has transactions.
  function jumpMonth(delta: -1 | 1) {
    if (groups.length === 0) return
    const key = currentKey ?? groupKey(groups[0])
    const idx = groups.findIndex((g) => groupKey(g) === key)
    const target = idx + (delta < 0 ? 1 : -1) // groups run newest → oldest
    if (target < 0 || target >= groups.length) return
    let needed = 1
    for (let i = 0; i <= target; i++) needed += groups[i].txns.length
    setRenderCount((c) => Math.max(c, Math.min(needed + ROW_BATCH / 2, totalRows)))
    setPendingJump(groupKey(groups[target]))
  }

  const isEmpty = accountTxns.length === 0
  const hasStaged = stagedTxns.length > 0

  const now = new Date()
  const currentGroup = groups.find((g) => groupKey(g) === currentKey) ?? groups[0]
  const labelYear = currentGroup?.year ?? now.getFullYear()
  const labelMonth = currentGroup?.month ?? now.getMonth()
  const currentIdx = currentGroup ? groups.indexOf(currentGroup) : -1
  const canOlder = currentIdx >= 0 && currentIdx < groups.length - 1
  const canNewer = currentIdx > 0

  return (
    <div className="app-shell" style={{ paddingBottom: hasStaged ? 170 : 110 }}>
      <div className="screen-head" ref={headRef}>
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
                        setRenderCount(ROW_BATCH)
                        setCurrentKey(null)
                        window.scrollTo({ top: 0 })
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
                    { label: 'Insights', to: '/insights' },
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
            aria-label="Jump to previous month"
            onClick={() => jumpMonth(-1)}
            disabled={!canOlder}
            style={{
              padding: '4px 6px',
              color: canOlder ? 'var(--ink-tertiary)' : 'var(--ink-faint)',
              fontWeight: 700,
            }}
          >
            ‹
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-secondary)' }}>
            {monthLabel(labelYear, labelMonth)}
          </div>
          <button
            aria-label="Jump to next month"
            onClick={() => jumpMonth(1)}
            disabled={!canNewer}
            style={{
              padding: '4px 6px',
              color: canNewer ? 'var(--ink-tertiary)' : 'var(--ink-faint)',
              fontWeight: 700,
            }}
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
        ) : searching ? (
          searchResults.length === 0 ? (
            <ListMessage>No transactions match your search.</ListMessage>
          ) : (
            <div className="card" style={{ marginTop: 6 }}>
              {searchResults.map((t) => (
                <TxnRow
                  key={t.id}
                  txn={t}
                  accountId={account.id}
                  runningBalanceCents={running.get(t.id)}
                  transferPartnerName={t.type === 'transfer' ? partnerName(t) : undefined}
                  staged={staged.has(t.id)}
                  onRowClick={() => openTxn(t)}
                  onDiscClick={() => (t.cleared ? void unclear(t) : toggleStage(t))}
                />
              ))}
            </div>
          )
        ) : groups.length === 0 ? (
          <ListMessage>Nothing to show — everything is cleared and hidden.</ListMessage>
        ) : (
          <>
            {displayGroups.map((g) => (
              <div key={groupKey(g)}>
                <div
                  ref={(el) => {
                    if (el) dividerRefs.current.set(groupKey(g), el)
                    else dividerRefs.current.delete(groupKey(g))
                  }}
                  className="section-label"
                  style={{ paddingLeft: 8 }}
                >
                  {monthLabel(g.year, g.month)}
                </div>
                <div className="card">
                  {g.txns.map((t) => (
                    <TxnRow
                      key={t.id}
                      id={`txn-${t.id}`}
                      txn={t}
                      accountId={account.id}
                      runningBalanceCents={running.get(t.id)}
                      transferPartnerName={t.type === 'transfer' ? partnerName(t) : undefined}
                      staged={staged.has(t.id)}
                      highlighted={t.id === highlightId}
                      onRowClick={() => openTxn(t)}
                      onDiscClick={() => (t.cleared ? void unclear(t) : toggleStage(t))}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <div
                ref={sentinelRef}
                style={{
                  textAlign: 'center',
                  color: 'var(--ink-faint)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '18px 0 8px',
                }}
              >
                Loading earlier months…
              </div>
            )}
          </>
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

function ListMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: 'center',
        color: 'var(--ink-tertiary)',
        fontSize: 14,
        fontWeight: 600,
        padding: '48px 24px',
      }}
    >
      {children}
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
