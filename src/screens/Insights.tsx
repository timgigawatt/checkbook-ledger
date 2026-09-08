import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { touchesAccount } from '../lib/ledger'
import { cashflowTotals, monthlyCashflow, spendingByCategory, topPayees } from '../lib/insights'
import { formatCents, formatSigned, MINUS } from '../lib/money'
import { monthLabel, toDateInput, todayMs } from '../lib/dates'
import {
  parsePeriod,
  periodLabel,
  periodParams,
  periodRange,
  trendAnchor,
  type Period,
} from '../lib/period'
import { Sheet, SheetHeader } from '../components/controls'
import { ChevronRight } from '../components/icons'

/** Insights for the selected account: cash flow, categories, trend, payees. */
export function Insights() {
  const { accounts, txns, selectedAccountId } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)

  const period = useMemo(() => parsePeriod(params), [params])
  const range = useMemo(() => periodRange(period), [period])

  const account = accounts.find((a) => a.id === selectedAccountId) ?? null
  const accountTxns = useMemo(
    () => (account ? txns.filter((t) => touchesAccount(t, account.id)) : []),
    [txns, account],
  )

  const totals = useMemo(() => cashflowTotals(accountTxns, range), [accountTxns, range])
  const categories = useMemo(() => spendingByCategory(accountTxns, range), [accountTxns, range])
  const payees = useMemo(() => topPayees(accountTxns, range, 5), [accountTxns, range])
  const anchor = trendAnchor(period)
  const trend = useMemo(
    () => monthlyCashflow(accountTxns, anchor.year, anchor.month, 6),
    [accountTxns, anchor.year, anchor.month],
  )

  if (!account) {
    navigate('/', { replace: true })
    return null
  }

  const netCents = totals.inCents - totals.outCents
  const maxCategory = categories[0]?.cents ?? 0
  const maxFlow = Math.max(1, ...trend.flatMap((m) => [m.inCents, m.outCents]))
  const hasAny = totals.inCents > 0 || totals.outCents > 0

  function setPeriod(next: Period) {
    setParams(periodParams(next), { replace: true })
  }

  function shiftMonth(delta: number) {
    if (period.mode !== 'month') return
    const d = new Date(period.year, period.month + delta, 1)
    setPeriod({ mode: 'month', year: d.getFullYear(), month: d.getMonth() })
  }

  function openCategory(categoryId: string, label: string) {
    const q = new URLSearchParams({ cat: categoryId, label, ...periodParams(period) })
    navigate(`/insights/category?${q.toString()}`)
  }

  return (
    <div className="app-shell" style={{ paddingBottom: 32 }}>
      <SheetHeader
        title="Insights"
        left={<button onClick={() => navigate('/')} style={{ color: 'inherit' }}>Done</button>}
        right={
          <button
            onClick={() => setFilterOpen(true)}
            style={{ fontWeight: 700, color: period.mode === 'range' ? 'var(--accent)' : 'inherit' }}
          >
            Filter
          </button>
        }
      />
      {period.mode === 'month' ? (
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
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '2px 16px 8px',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            {periodLabel(period)}
          </div>
          <button
            aria-label="Clear date range"
            onClick={() => setPeriod({ mode: 'month', year: anchor.year, month: anchor.month })}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--accent-tint)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-tertiary)', marginTop: -4 }}>
        {account.name}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* cash flow */}
        <div className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow soft">In</div>
            <div className="num amount-income" style={{ fontSize: 20, fontWeight: 700 }}>
              {totals.inCents ? `+${formatCents(totals.inCents)}` : '$0.00'}
            </div>
          </div>
          <div>
            <div className="eyebrow soft">Out</div>
            <div className="num amount-expense" style={{ fontSize: 20, fontWeight: 700 }}>
              {totals.outCents ? `${MINUS}${formatCents(totals.outCents)}` : '$0.00'}
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
            Nothing recorded in {periodLabel(period)}.
          </div>
        )}

        {/* spending by category */}
        {categories.length > 0 && (
          <div>
            <div className="section-label" style={{ paddingTop: 0 }}>Spending by category</div>
            <div className="card field-rows">
              {categories.map((c) => (
                <button
                  key={`${c.categoryId}:${c.label}`}
                  onClick={() => openCategory(c.categoryId, c.label)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {c.icon} {c.label}
                      <span style={{ fontSize: 12, color: 'var(--ink-tertiary)', fontWeight: 600, marginLeft: 6 }}>
                        ×{c.count}
                      </span>
                    </div>
                    <div
                      className="num"
                      style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {formatCents(c.cents)}
                      <ChevronRight color="var(--ink-faint)" />
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
                </button>
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

      {filterOpen && (
        <PeriodFilterSheet
          period={period}
          onApply={(next) => {
            setPeriod(next)
            setFilterOpen(false)
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}

/** Preset ranges are relative to today; custom is an inclusive From/To. */
function PeriodFilterSheet({
  period,
  onApply,
  onClose,
}: {
  period: Period
  onApply: (next: Period) => void
  onClose: () => void
}) {
  const range = periodRange(period)
  const [from, setFrom] = useState(toDateInput(range.startMs))
  const [to, setTo] = useState(toDateInput(Math.min(range.endMs - 1, todayMs())))

  const now = new Date()
  const today = toDateInput(todayMs())
  const monthStart = (back: number) =>
    toDateInput(new Date(now.getFullYear(), now.getMonth() - back, 1).getTime())

  const presets: { label: string; period: Period }[] = [
    { label: 'This month', period: { mode: 'month', year: now.getFullYear(), month: now.getMonth() } },
    { label: 'Last 3 months', period: { mode: 'range', from: monthStart(2), to: today } },
    { label: 'Last 6 months', period: { mode: 'range', from: monthStart(5), to: today } },
    {
      label: 'Year to date',
      period: { mode: 'range', from: toDateInput(new Date(now.getFullYear(), 0, 1).getTime()), to: today },
    },
    {
      label: 'This year',
      period: {
        mode: 'range',
        from: toDateInput(new Date(now.getFullYear(), 0, 1).getTime()),
        to: toDateInput(new Date(now.getFullYear(), 11, 31).getTime()),
      },
    },
  ]

  const customValid = from !== '' && to !== '' && from <= to

  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: '16px 16px 8px', fontSize: 17, fontWeight: 700, textAlign: 'center' }}>
        Date range
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 16px 4px' }}>
        {presets.map((p) => (
          <button key={p.label} className="chip" onClick={() => onApply(p.period)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="section-label" style={{ padding: '12px 22px 6px' }}>Custom</div>
      <div className="card field-rows" style={{ margin: '0 16px' }}>
        <div className="field-row">
          <div className="label">From</div>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Range start"
          />
        </div>
        <div className="field-row">
          <div className="label">To</div>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Range end"
          />
        </div>
      </div>
      <div style={{ padding: '14px 16px 28px' }}>
        <button
          className="btn-primary"
          disabled={!customValid}
          onClick={() => onApply({ mode: 'range', from, to })}
        >
          Apply range
        </button>
      </div>
    </Sheet>
  )
}
