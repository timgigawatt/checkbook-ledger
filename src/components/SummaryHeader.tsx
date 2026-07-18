import { formatCents } from '../lib/money'
import type { AccountBalances } from '../lib/ledger'

/** Balance / Cleared / Outstanding block. Balance = Cleared + Outstanding. */
export function SummaryHeader({ balances, muted }: { balances: AccountBalances; muted?: boolean }) {
  const inkMain = muted ? 'var(--ink-faint)' : 'var(--ink)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 10,
      }}
    >
      <div>
        <div className="eyebrow">Balance</div>
        <div
          className="num"
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: inkMain,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          {formatCents(balances.balanceCents)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, textAlign: 'right', paddingBottom: 2 }}>
        <div>
          <div className="eyebrow soft">Cleared</div>
          <div className="num" style={{ fontSize: 15, fontWeight: 600, color: inkMain }}>
            {formatCents(balances.clearedCents)}
          </div>
        </div>
        <div>
          <div className="eyebrow soft">Outstanding</div>
          <div
            className="num"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: inkMain,
              borderBottom: '2px dashed var(--dashed-ring)',
              display: 'inline-block',
            }}
          >
            {formatCents(balances.outstandingCents)}
          </div>
        </div>
      </div>
    </div>
  )
}
