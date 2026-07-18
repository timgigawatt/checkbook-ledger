import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { setTxnsCleared } from '../data/repo'
import {
  accountBalances,
  registerSections,
  selectionTotal,
  touchesAccount,
} from '../lib/ledger'
import { formatCents } from '../lib/money'
import { TxnRow } from '../components/TxnRow'

/**
 * Batch select per design 2a: tap outstanding rows to select, live total in
 * the header and bottom bar, then either mark cleared or carry the selection
 * into Reconcile.
 */
export function BatchSelect() {
  const { user } = useAuth()
  const { accounts, txns, selectedAccountId } = useData()
  const navigate = useNavigate()
  const toast = useToast()

  const account = accounts.find((a) => a.id === selectedAccountId) ?? null
  const accountTxns = useMemo(
    () => (account ? txns.filter((t) => touchesAccount(t, account.id)) : []),
    [txns, account],
  )
  const { outstanding, cleared } = useMemo(() => registerSections(accountTxns), [accountTxns])
  const balances = useMemo(
    () => (account ? accountBalances(account, accountTxns) : null),
    [account, accountTxns],
  )

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  if (!account || !balances) {
    navigate('/', { replace: true })
    return null
  }

  const selectedTxns = outstanding.filter((t) => selected.has(t.id))
  const total = selectionTotal(selectedTxns, account.id)
  const clearedIfCommitted = balances.clearedCents + total

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function markCleared() {
    if (!user || selected.size === 0) return
    setBusy(true)
    try {
      await setTxnsCleared(user.uid, [...selected], false)
      toast(`${selected.size} marked cleared`)
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell" style={{ paddingBottom: 140 }}>
      <div className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ fontSize: 15, color: 'var(--ink-secondary)' }}
          >
            Cancel
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Select outstanding</div>
          <button
            onClick={() =>
              setSelected(
                selected.size === outstanding.length
                  ? new Set()
                  : new Set(outstanding.map((t) => t.id)),
              )
            }
            style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}
          >
            {selected.size === outstanding.length && outstanding.length > 0 ? 'None' : 'All'}
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 10,
          }}
        >
          <div>
            <div className="eyebrow">Selected</div>
            <div
              className="num"
              style={{
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              {formatCents(total)}
            </div>
          </div>
          <div style={{ textAlign: 'right', paddingBottom: 2 }}>
            <div className="eyebrow soft">Cleared if committed</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 600 }}>
              {formatCents(clearedIfCommitted)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 12px 0' }}>
        <div className="section-label" style={{ paddingTop: 0 }}>
          Outstanding · {outstanding.length}
        </div>
        {outstanding.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ink-tertiary)',
              fontWeight: 600,
              padding: '32px 24px',
            }}
          >
            Nothing outstanding — the register is fully cleared.
          </div>
        ) : (
          <div className="card outstanding">
            {outstanding.map((t) => (
              <TxnRow
                key={t.id}
                txn={t}
                accountId={account.id}
                selected={selected.has(t.id)}
                onRowClick={() => toggle(t.id)}
                onDiscClick={() => toggle(t.id)}
              />
            ))}
          </div>
        )}

        {cleared.length > 0 && (
          <>
            <div className="section-label">Cleared · {cleared.length}</div>
            <div className="card" style={{ opacity: 0.45, pointerEvents: 'none' }}>
              {cleared.slice(0, 5).map((t) => (
                <TxnRow key={t.id} txn={t} accountId={account.id} />
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
          background: 'var(--surface)',
          borderTop: '1px solid var(--surface-border)',
          padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
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
            {selected.size} selected · {formatCents(total)}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-secondary)' }}
          >
            Deselect
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-primary"
            style={{ flex: 1, height: 50, borderRadius: 14, fontSize: 16 }}
            disabled={selected.size === 0 || busy}
            onClick={() => void markCleared()}
          >
            Mark cleared
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1, height: 50, borderRadius: 14, fontSize: 16 }}
            disabled={selected.size === 0}
            onClick={() => navigate('/reconcile', { state: { selected: [...selected] } })}
          >
            Reconcile…
          </button>
        </div>
      </div>
    </div>
  )
}
