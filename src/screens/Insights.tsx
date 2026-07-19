import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { touchesAccount } from '../lib/ledger'
import { monthlyCashflow, spendingByCategory, topPayees } from '../lib/insights'
import { formatCents, formatSigned, MINUS } from '../lib/money'
import { monthLabel } from '../lib/dates'
import { SheetHeader } from '../components/controls'

/** Insights for the selected account: cash flow, categories, trend, payees. */
export function Insights() {
  const { accounts, txns, selectedAccountId } = useData()
  const navigate = useNavigate()

  const now = new Date()
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() })

  const account = accounts.find((a) => a.id === selectedAccountId) ?? null
  const accountTxns = useMemo(
    () => (account ? txns.filter((t) => touchesAccount(t, account.id)) : []),
    [txns, account],
  )

  const categories = useMemo(
    () => spendingByCategory(accountTxns, period.year, period.month),
    [accountTxns, period],
  )
  const trend = useMemo(
    () => monthlyCashflow(accountTxns, period.year, period.month, 6),
    [accountTxns, period],
  )
  const payees = useMemo(
    () => topPayees(accountTxns, period.year, period.month, 5),
    [accountTxns, period],
  )

  if (!account) {
    navigate('/', { replace: true })
    return null
  }

  const current = trend[trend.length - 1]
  const netCents = current.inCents - current.outCents
  const maxCategory = categories[0]?.cents ?? 0
  const maxFlow = Math.max(1, ...trend.flatMap((m) => [m.inCents, m.outCents]))
  const hasAny = current.inCents > 0 || current.outCents > 0

  function shiftMonth(delta: number) {
    setPeriod(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <div className="app-shell" style={{ paddingBottom: 32 }}>
      <SheetHeader
        title="Insights"
        left={<button onClick={() => navigate('/')} style={{ color: 'inherit' }}>Done</button>}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '2px 16px 8px',
        }}
      >
        <button
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          style={{ padding: '4px 10px', color: 'var(--ink-tertiary)', fontWeight: 700 }}
        >
          ‹
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-secondary)', minWidth: 130, textAlign: 'center' }}>
          {monthLabel(period.year, period.month)}
        </div>
        <button
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
          style={{ padding: '4px 10px', color: 'var(--ink-tertiary)', fontWeight: 700 }}
        >
          ›
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-tertiary)', marginTop: -4 }}>
        {account.name}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* cash flow */}
        <div className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow soft">In</div>
            <div className="num amount-income" style={{ fontSize: 20, fontWeight: 700 }}>
              {current.inCents ? `+${formatCents(current.inCents)}` : '$0.00'}
            </div>
          </div>
          <div>
            <div className="eyebrow soft">Out</div>
            <div className="num amount-expense" style={{ fontSize: 20, fontWeight: 700 }}>
              {current.outCents ? `${MINUS}${formatCents(current.outCents)}` : '$0.00'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow soft">Net</div>
            <div
              className={`num ${netCents > 0 ? 'amount-income' : netCents < 0 ? 'amount-expense' : ''}`}
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {formatSigned(netCents)}
            </div>
          </div>
        </div>

        {!hasAny && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ink-tertiary)',
              fontWeight: 600,
              fontSize: 14,
              padding: '24px 16px',
            }}
          >
            Nothing recorded in {monthLabel(period.year, period.month)}.
          </div>
        )}

        {/* spending by category */}
        {categories.length > 0 && (
          <div>
            <div className="section-label" style={{ paddingTop: 0 }}>Spending by category</div>
            <div className="card" style={{ padding: '6px 16px' }}>
              {categories.map((c) => (
                <div key={`${c.categoryId}:${c.label}`} style={{ padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {c.icon} {c.label}
                      <span style={{ fontSize: 12, color: 'var(--ink-tertiary)', fontWeight: 600, marginLeft: 6 }}>
                        ×{c.count}
                      </span>
                    </div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                      {formatCents(c.cents)}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--seg-bg)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${maxCategory ? (c.cents / maxCategory) * 100 : 0}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* income vs spending trend */}
        <div>
          <div className="section-label" style={{ paddingTop: 0 }}>Income vs spending · 6 months</div>
          <div className="card" style={{ padding: '16px 16px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
              {trend.map((m) => (
                <div
                  key={`${m.year}-${m.month}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%', width: '100%', justifyContent: 'center' }}>
                    <div
                      title={`In ${formatCents(m.inCents)}`}
                      style={{
                        width: 10,
                        height: `${(m.inCents / maxFlow) * 100}%`,
                        minHeight: m.inCents ? 3 : 1,
                        borderRadius: 3,
                        background: 'var(--income)',
                        opacity: m.inCents ? 1 : 0.25,
                      }}
                    />
                    <div
                      title={`Out ${formatCents(m.outCents)}`}
                      style={{
                        width: 10,
                        height: `${(m.outCents / maxFlow) * 100}%`,
                        minHeight: m.outCents ? 3 : 1,
                        borderRadius: 3,
                        background: 'var(--expense)',
                        opacity: m.outCents ? 1 : 0.25,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-tertiary)' }}>
                    {new Date(m.year, m.month, 1).toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--ink-tertiary)' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--income)', marginRight: 5 }} />Income</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--expense)', marginRight: 5 }} />Spending</span>
            </div>
          </div>
        </div>

        {/* top payees */}
        {payees.length > 0 && (
          <div>
            <div className="section-label" style={{ paddingTop: 0 }}>Top payees</div>
            <div className="card field-rows">
              {payees.map((p) => (
                <div key={p.name} className="field-row" style={{ minHeight: 48 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {p.name}
                    <span style={{ fontSize: 12, color: 'var(--ink-tertiary)', fontWeight: 600, marginLeft: 6 }}>
                      ×{p.count}
                    </span>
                  </div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                    {formatCents(p.cents)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
