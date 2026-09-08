import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { touchesAccount } from '../lib/ledger'
import { categoryTxns } from '../lib/insights'
import { getCategory } from '../lib/categories'
import { formatCents, MINUS } from '../lib/money'
import { shortDate } from '../lib/dates'
import { parsePeriod, periodLabel, periodRange } from '../lib/period'
import { SheetHeader } from '../components/controls'
import { ChevronRight } from '../components/icons'

/** The transactions behind one Insights category row for the period. */
export function CategoryTxns() {
  const { accounts, txns, selectedAccountId } = useData()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const period = useMemo(() => parsePeriod(params), [params])
  const range = useMemo(() => periodRange(period), [period])
  const categoryId = params.get('cat') ?? ''
  const label = params.get('label') ?? getCategory(categoryId).name

  const account = accounts.find((a) => a.id === selectedAccountId) ?? null
  const accountTxns = useMemo(
    () => (account ? txns.filter((t) => touchesAccount(t, account.id)) : []),
    [txns, account],
  )
  const list = useMemo(
    () => categoryTxns(accountTxns, range, categoryId, label),
    [accountTxns, range, categoryId, label],
  )

  if (!account || !categoryId) {
    navigate('/insights', { replace: true })
    return null
  }

  const totalCents = list.reduce((sum, t) => sum + t.amountCents, 0)

  return (
    <div className="app-shell" style={{ paddingBottom: 32 }}>
      <SheetHeader
        title={`${getCategory(categoryId).icon} ${label}`}
        left={<button onClick={() => navigate(-1)} style={{ color: 'inherit' }}>‹ Insights</button>}
      />
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-tertiary)' }}>
        {periodLabel(period)} · {account.name}
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          className="card"
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-secondary)' }}>
            {list.length} transaction{list.length === 1 ? '' : 's'}
          </div>
          <div className="num amount-expense" style={{ fontSize: 22, fontWeight: 700 }}>
            {MINUS}
            {formatCents(totalCents)}
          </div>
        </div>

        {list.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ink-tertiary)',
              fontWeight: 600,
              fontSize: 14,
              padding: '32px 16px',
            }}
          >
            No transactions in this period.
          </div>
        ) : (
          <div className="card field-rows">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/txn/${t.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 16px',
                  minHeight: 54,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.payeeName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', marginTop: 1 }}>
                    {[shortDate(t.date), t.memo].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                  <div className="num amount-expense" style={{ fontSize: 15, fontWeight: 700 }}>
                    {MINUS}
                    {formatCents(t.amountCents)}
                  </div>
                  <ChevronRight color="var(--ink-faint)" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
