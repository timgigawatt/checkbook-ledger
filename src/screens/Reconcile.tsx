import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { setTxnsCleared } from '../data/repo'
import {
  accountBalances,
  reconcileDifference,
  registerSections,
  touchesAccount,
} from '../lib/ledger'
import { digitsToCents, formatCents, MINUS } from '../lib/money'
import { AmountInput } from '../components/AmountInput'
import { categoryLabel } from '../lib/categories'
import { shortDate } from '../lib/dates'
import { formatSigned } from '../lib/money'
import { effectOn } from '../lib/ledger'
import { CheckIcon } from '../components/icons'
import type { Txn } from '../types'

/**
 * Reconcile mode per design 1c: enter the statement ending balance, check
 * off outstanding items that appear on the statement, watch the difference
 * fall to zero, then finish — which stamps them cleared + reconciled.
 */
export function Reconcile() {
  const { user } = useAuth()
  const { accounts, txns, selectedAccountId } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const location = useLocation()
  const preselected: string[] = (location.state as { selected?: string[] } | null)?.selected ?? []

  const account = accounts.find((a) => a.id === selectedAccountId) ?? null
  const accountTxns = useMemo(
    () => (account ? txns.filter((t) => touchesAccount(t, account.id)) : []),
    [txns, account],
  )
  const outstanding = useMemo(
    () => registerSections(accountTxns).outstanding,
    [accountTxns],
  )
  const balances = useMemo(
    () => (account ? accountBalances(account, accountTxns) : null),
    [account, accountTxns],
  )

  const [statementDigits, setStatementDigits] = useState('')
  const [statementNegative, setStatementNegative] = useState(false)
  const [statementCents, setStatementCents] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set(preselected))
  const [finishing, setFinishing] = useState(false)

  if (!account || !balances) {
    navigate('/', { replace: true })
    return null
  }

  const checkedTxns = outstanding.filter((t) => checked.has(t.id))
  const difference =
    statementCents === null
      ? null
      : reconcileDifference(statementCents, balances.clearedCents, checkedTxns, account.id)
  const balanced = difference === 0
  const headerBg = balanced ? 'var(--balanced)' : 'var(--accent-deep)'
  const softColor = balanced ? 'var(--balanced-soft)' : 'var(--reconcile-soft)'

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function finish() {
    if (!user || !balanced) return
    setFinishing(true)
    try {
      await setTxnsCleared(user.uid, [...checked], true)
      toast(`Reconciled ${checked.size} transaction${checked.size === 1 ? '' : 's'}`)
      navigate('/')
    } finally {
      setFinishing(false)
    }
  }

  // Statement balance entry step
  if (statementCents === null) {
    const parsed = digitsToCents(statementDigits)
    return (
      <div className="app-shell">
        <div style={{ background: 'var(--accent-deep)', padding: '18px 16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Reconcile</div>
            <button onClick={() => navigate(-1)} style={{ fontSize: 15, color: 'var(--reconcile-soft)' }}>
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--reconcile-soft)', marginTop: 2 }}>
            {account.name}
          </div>
        </div>
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>What does the statement say?</div>
            <div style={{ fontSize: 15, color: 'var(--ink-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              Enter the ending balance from your bank statement. You'll check off each
              transaction that appears on it.
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px 16px', textAlign: 'center' }}>
            <div className="eyebrow soft">Statement ending balance</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                color: statementNegative ? 'var(--expense)' : 'var(--ink)',
              }}
            >
              {statementNegative && (
                <span className="num" style={{ fontSize: 40, fontWeight: 700 }}>
                  {MINUS}
                </span>
              )}
              <AmountInput
                className="num"
                ariaLabel="Statement ending balance"
                autoFocus
                digits={statementDigits}
                onDigitsChange={setStatementDigits}
                onMinus={() => setStatementNegative((n) => !n)}
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: 'inherit',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  textAlign: 'center',
                  width: '60%',
                  padding: 0,
                }}
              />
            </div>
            <button
              onClick={() => setStatementNegative((n) => !n)}
              style={{
                marginTop: 6,
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent)',
                padding: '4px 10px',
                borderRadius: 10,
                background: 'var(--accent-tint)',
              }}
            >
              ± Negative balance
            </button>
          </div>
          <button
            className="btn-primary"
            disabled={parsed === null}
            onClick={() =>
              parsed !== null && setStatementCents(statementNegative ? -parsed : parsed)
            }
          >
            Start reconciling
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell" style={{ paddingBottom: 100 }}>
      <div style={{ background: headerBg, padding: '18px 16px', transition: 'background 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Reconcile</div>
          <button onClick={() => navigate(-1)} style={{ fontSize: 15, color: softColor }}>
            Cancel
          </button>
        </div>
        <div style={{ fontSize: 13, color: softColor, marginTop: 2 }}>
          {account.name} · ending balance{' '}
          <span className="num" style={{ fontWeight: 700, color: '#fff' }}>
            {formatCents(statementCents)}
          </span>
        </div>
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div className="eyebrow" style={{ color: softColor }}>
              Difference remaining
            </div>
            <div
              className="num"
              style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}
            >
              {formatCents(difference ?? 0)}
            </div>
          </div>
          {balanced && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 30,
                padding: '0 12px',
                borderRadius: 15,
                background: 'rgba(255,255,255,0.16)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <CheckIcon size={12} />
              Balanced
            </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.22)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: outstanding.length
                  ? `${(checked.size / outstanding.length) * 100}%`
                  : '100%',
                height: '100%',
                borderRadius: 3,
                background: '#fff',
                transition: 'width 0.2s',
              }}
            />
          </div>
          <div className="num" style={{ fontSize: 13, color: softColor, marginTop: 6 }}>
            {checked.size} of {outstanding.length} checked
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 12px 0' }}>
        {balanced && checked.size === outstanding.length && outstanding.length > 0 ? (
          <BalancedCard count={checked.size} />
        ) : outstanding.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ink-tertiary)',
              fontWeight: 600,
              padding: '48px 24px',
            }}
          >
            No outstanding transactions to reconcile.
          </div>
        ) : (
          <>
            <div className="section-label" style={{ paddingTop: 0 }}>
              Check off items on your statement
            </div>
            <div className="card">
              {outstanding.map((t) => (
                <ReconcileRow
                  key={t.id}
                  txn={t}
                  accountId={account.id}
                  checked={checked.has(t.id)}
                  onToggle={() => toggle(t.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 520,
          padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
          background: 'var(--canvas)',
        }}
      >
        {balanced ? (
          <button
            className="btn-primary"
            style={{ background: 'var(--balanced)', color: '#fff' }}
            disabled={finishing}
            onClick={() => void finish()}
          >
            Finish reconciliation
          </button>
        ) : (
          <button className="btn-primary num" disabled>
            Off by {formatCents(Math.abs(difference ?? 0)).replace('−', '')}
          </button>
        )}
      </div>
    </div>
  )
}

function ReconcileRow({
  txn,
  accountId,
  checked,
  onToggle,
}: {
  txn: Txn
  accountId: string
  checked: boolean
  onToggle: () => void
}) {
  const effect = effectOn(txn, accountId)
  return (
    <button className="list-row" onClick={onToggle} style={{ width: '100%' }}>
      <div className="disc-wrap">
        {checked ? (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent-deep)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon />
          </div>
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px dashed var(--dashed-ring)',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: checked ? 600 : 700,
            color: checked ? 'var(--ink-tertiary)' : 'var(--ink)',
          }}
        >
          {txn.payeeName}
        </div>
        <div
          style={{
            fontSize: 13,
            color: checked ? 'var(--ink-faint)' : 'var(--ink-secondary)',
            marginTop: 1,
          }}
        >
          {[txn.checkNumber ? `#${txn.checkNumber}` : null, shortDate(txn.date), categoryLabel(txn.categoryId, txn.categoryName)]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div
        className="num"
        style={{
          fontSize: 17,
          fontWeight: checked ? 600 : 700,
          color: checked
            ? 'var(--ink-tertiary)'
            : effect < 0
              ? 'var(--expense)'
              : 'var(--income)',
        }}
      >
        {formatSigned(effect)}
      </div>
    </button>
  )
}

function BalancedCard({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div
        className="card"
        style={{
          padding: '32px 28px',
          textAlign: 'center',
          width: '100%',
          borderRadius: 20,
          boxShadow: '0 12px 32px rgba(16,42,30,0.08)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--balanced)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <CheckIcon size={28} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>Balanced to the penny.</div>
        <div style={{ fontSize: 15, color: 'var(--ink-secondary)', marginTop: 6, lineHeight: 1.45 }}>
          {count} transaction{count === 1 ? '' : 's'} cleared against the statement.
          <br />
          Reconciled{' '}
          {new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          .
        </div>
      </div>
    </div>
  )
}
