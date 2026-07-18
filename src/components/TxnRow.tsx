import type { Txn } from '../types'
import { categoryLabel } from '../lib/categories'
import { formatCents, formatSigned } from '../lib/money'
import { shortDate } from '../lib/dates'
import { effectOn } from '../lib/ledger'
import { ClearedDisc } from './ClearedDisc'
import { TransferIcon } from './icons'

/**
 * Register row per the component sheet: bold ink + tinted card while
 * outstanding, settled weight once cleared; expense −red, income +green,
 * transfers neutral with the paired-arrow glyph and no sign.
 */
export function TxnRow({
  txn,
  accountId,
  runningBalanceCents,
  transferPartnerName,
  selected,
  onRowClick,
  onDiscClick,
}: {
  txn: Txn
  accountId: string
  runningBalanceCents?: number
  transferPartnerName?: string
  selected?: boolean
  onRowClick?: () => void
  onDiscClick?: () => void
}) {
  const effect = effectOn(txn, accountId)
  const isTransfer = txn.type === 'transfer'
  const amountClass = isTransfer
    ? 'amount-transfer'
    : effect < 0
      ? 'amount-expense'
      : 'amount-income'

  const title = isTransfer
    ? txn.accountId === accountId
      ? `Transfer to ${transferPartnerName ?? 'account'}`
      : `Transfer from ${transferPartnerName ?? 'account'}`
    : txn.payeeName

  const subtitleParts = [
    txn.checkNumber ? `#${txn.checkNumber}` : null,
    shortDate(txn.date),
    isTransfer ? 'Transfer' : categoryLabel(txn.categoryId, txn.categoryName),
  ].filter(Boolean)

  const discState = selected ? 'selected' : txn.cleared ? 'cleared' : 'uncleared'

  return (
    <div className="list-row" style={selected ? { background: 'var(--outstanding-selected)' } : undefined}>
      <ClearedDisc state={discState} onClick={onDiscClick} />
      <button
        onClick={onRowClick}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: txn.cleared ? 600 : 700,
              color: txn.cleared ? 'var(--ink-settled)' : 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: txn.cleared ? 'var(--ink-tertiary)' : 'var(--ink-secondary)',
              marginTop: 1,
            }}
          >
            {subtitleParts.join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className={`num ${amountClass}`}
            style={{
              fontSize: 17,
              fontWeight: txn.cleared && !isTransfer && effect < 0 ? 600 : 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              justifyContent: 'flex-end',
            }}
          >
            {isTransfer && <TransferIcon color="var(--ink-secondary)" />}
            {isTransfer ? formatCents(Math.abs(effect)) : formatSigned(effect)}
          </div>
          {runningBalanceCents !== undefined && (
            <div className="num" style={{ fontSize: 13, color: 'var(--ink-tertiary)', marginTop: 1 }}>
              {formatCents(runningBalanceCents)}
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
