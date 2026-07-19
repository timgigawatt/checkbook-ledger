import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { deleteTxn, saveTxn, upsertPayee } from '../data/repo'
import {
  CATEGORIES,
  DEFAULT_EXPENSE_CATEGORY_ID,
  DEFAULT_INCOME_CATEGORY_ID,
  TRANSFER_CATEGORY_ID,
  getCategory,
} from '../lib/categories'
import { centsToEntry, digitsToCents, MINUS } from '../lib/money'
import { AmountInput } from '../components/AmountInput'
import { friendlyDate, fromDateInput, startOfDay, toDateInput, todayMs } from '../lib/dates'
import { FieldRow, SheetHeader, Switch } from '../components/controls'
import { ChevronRight, TransferIcon } from '../components/icons'
import type { Txn, TxnType } from '../types'

export function TxnForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const { accounts, payees, txns, selectedAccountId } = useData()
  const navigate = useNavigate()
  const toast = useToast()

  const editing: Txn | null = useMemo(
    () => (id && id !== 'new' ? (txns.find((t) => t.id === id) ?? null) : null),
    [id, txns],
  )

  const [type, setType] = useState<TxnType>(editing?.type ?? 'expense')
  const [amountDigits, setAmountDigits] = useState(
    editing ? String(editing.amountCents) : '',
  )
  const [payeeName, setPayeeName] = useState(editing?.payeeName ?? '')
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? DEFAULT_EXPENSE_CATEGORY_ID,
  )
  const [categoryTouched, setCategoryTouched] = useState(Boolean(editing))
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? selectedAccountId ?? accounts[0]?.id ?? '',
  )
  const [transferAccountId, setTransferAccountId] = useState(
    editing?.transferAccountId ?? accounts.find((a) => a.id !== accountId)?.id ?? '',
  )
  const [date, setDate] = useState(editing?.date ?? todayMs())
  const [checkNumber, setCheckNumber] = useState(editing?.checkNumber ?? '')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [cleared, setCleared] = useState(editing?.cleared ?? false)
  const [picker, setPicker] = useState<'category' | 'account' | 'toAccount' | null>(null)
  const [busy, setBusy] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  // When the form is opened by deep link or refresh, the accounts snapshot
  // can arrive after mount — backfill the default account once it does.
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(selectedAccountId ?? accounts[0].id)
    }
  }, [accountId, accounts, selectedAccountId])

  const amountCents = digitsToCents(amountDigits)
  const canSave =
    amountCents !== null &&
    amountCents > 0 &&
    accountId !== '' &&
    (type === 'transfer'
      ? transferAccountId !== '' && transferAccountId !== accountId
      : payeeName.trim() !== '')

  const suggestions = useMemo(() => {
    const q = payeeName.trim().toLowerCase()
    const pool = [...payees].sort((a, b) => b.useCount - a.useCount)
    const matched = q ? pool.filter((p) => p.nameLower.includes(q)) : pool
    return matched.slice(0, 3)
  }, [payees, payeeName])

  function pickType(next: TxnType) {
    setType(next)
    if (!categoryTouched) {
      setCategoryId(
        next === 'income'
          ? DEFAULT_INCOME_CATEGORY_ID
          : next === 'transfer'
            ? TRANSFER_CATEGORY_ID
            : DEFAULT_EXPENSE_CATEGORY_ID,
      )
    }
  }

  function pickPayee(name: string) {
    setPayeeName(name)
    const payee = payees.find((p) => p.nameLower === name.toLowerCase())
    if (payee && !categoryTouched) setCategoryId(payee.defaultCategoryId)
  }

  async function onSave() {
    if (!user || !canSave || amountCents === null) return
    setBusy(true)
    try {
      const isTransfer = type === 'transfer'
      const trimmedPayee = payeeName.trim()
      let payeeId: string | null = editing?.payeeId ?? null
      if (!isTransfer) {
        payeeId = await upsertPayee(user.uid, payees, trimmedPayee, categoryId)
      }
      await saveTxn(
        user.uid,
        {
          accountId,
          type,
          amountCents,
          payeeId: isTransfer ? null : payeeId,
          payeeName: isTransfer ? 'Transfer' : trimmedPayee,
          categoryId: isTransfer ? TRANSFER_CATEGORY_ID : categoryId,
          categoryName: editing?.categoryName,
          date: startOfDay(date),
          checkNumber: checkNumber.trim() || undefined,
          memo: memo.trim() || undefined,
          cleared,
          clearedAt: cleared ? (editing?.clearedAt ?? Date.now()) : undefined,
          reconciledAt: editing?.reconciledAt,
          transferAccountId: isTransfer ? transferAccountId : undefined,
        },
        editing?.id,
      )
      toast(editing ? 'Transaction updated' : 'Transaction saved')
      navigate(-1)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!user || !editing) return
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return
    await deleteTxn(user.uid, editing.id)
    toast('Transaction deleted')
    navigate(-1)
  }

  const amountColor =
    type === 'expense' ? 'var(--expense)' : type === 'income' ? 'var(--income)' : 'var(--ink)'
  const amountPrefix = type === 'expense' ? MINUS : type === 'income' ? '+' : ''
  const accountName = (aid: string) => accounts.find((a) => a.id === aid)?.name ?? 'Choose…'

  const segments: { key: TxnType; label: string; color: string }[] = [
    { key: 'expense', label: 'Expense', color: 'var(--expense)' },
    { key: 'income', label: 'Income', color: 'var(--income)' },
    { key: 'transfer', label: 'Transfer', color: 'var(--accent)' },
  ]

  return (
    <div className="app-shell">
      <SheetHeader
        title={editing ? 'Edit Transaction' : 'New Transaction'}
        left={<button onClick={() => navigate(-1)} style={{ color: 'inherit' }}>Cancel</button>}
        right={
          <button
            onClick={() => void onSave()}
            disabled={!canSave || busy}
            style={{ color: canSave ? 'var(--accent)' : 'var(--ink-faint)', fontWeight: 700 }}
          >
            Save
          </button>
        }
      />

      {/* type segmented control */}
      <div
        style={{
          margin: '10px 16px 0',
          display: 'flex',
          background: 'var(--seg-bg)',
          borderRadius: 14,
          padding: 3,
          gap: 3,
        }}
      >
        {segments.map((seg) => {
          const active = type === seg.key
          return (
            <button
              key={seg.key}
              onClick={() => pickType(seg.key)}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 11,
                background: active ? seg.color : 'transparent',
                color: active ? '#fff' : 'var(--ink-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 15,
                fontWeight: active ? 700 : 600,
                boxShadow: active ? `0 2px 6px ${seg.color}55` : 'none',
              }}
            >
              {seg.key === 'expense' && <span style={{ fontSize: 17 }}>{MINUS}</span>}
              {seg.key === 'income' && <span style={{ fontSize: 17 }}>+</span>}
              {seg.key === 'transfer' && <TransferIcon size={14} />}
              {seg.label}
            </button>
          )
        })}
      </div>

      {/* amount */}
      <button
        className="card"
        onClick={() => amountRef.current?.focus()}
        style={{ margin: '12px 16px 0', padding: '14px 16px 16px', textAlign: 'center' }}
      >
        <div className="eyebrow soft">Amount</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 2,
            color: amountColor,
          }}
        >
          <span className="num" style={{ fontSize: 40, fontWeight: 700 }}>
            {amountPrefix}$
          </span>
          <AmountInput
            ref={amountRef}
            className="num"
            ariaLabel="Amount"
            autoFocus={!editing}
            digits={amountDigits}
            onDigitsChange={setAmountDigits}
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: amountColor,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: `${Math.max(4, (amountCents === null ? 0 : centsToEntry(amountCents).length) + 1)}ch`,
              maxWidth: '60vw',
              padding: 0,
            }}
          />
        </div>
      </button>

      {/* fields */}
      <div className="card field-rows" style={{ margin: '12px 16px 0' }}>
        {type !== 'transfer' && (
          <div style={{ padding: '10px 16px 12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 30,
                gap: 12,
              }}
            >
              <div style={{ fontSize: 15, color: 'var(--ink-secondary)', flex: '0 0 auto' }}>
                Payee
              </div>
              <input
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Who was paid?"
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  textAlign: 'right',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  flex: 1,
                  minWidth: 0,
                }}
              />
            </div>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6, overflowX: 'auto' }}>
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    className="chip"
                    style={
                      p.nameLower === payeeName.trim().toLowerCase()
                        ? { fontWeight: 700 }
                        : undefined
                    }
                    onClick={() => pickPayee(p.name)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {type !== 'transfer' && (
          <FieldRow label="Category" onClick={() => setPicker('category')}>
            {getCategory(categoryId).icon} {getCategory(categoryId).name}
            <ChevronRight color="var(--ink-faint)" />
          </FieldRow>
        )}

        <FieldRow label={type === 'transfer' ? 'From account' : 'Account'} onClick={() => setPicker('account')}>
          {accountName(accountId)}
          <ChevronRight color="var(--ink-faint)" />
        </FieldRow>

        {type === 'transfer' && (
          <FieldRow label="To account" onClick={() => setPicker('toAccount')}>
            {transferAccountId ? accountName(transferAccountId) : 'Choose…'}
            <ChevronRight color="var(--ink-faint)" />
          </FieldRow>
        )}

        <div className="field-row" style={{ position: 'relative' }}>
          <div className="label">Date</div>
          <div className="value">{friendlyDate(date)}</div>
          <input
            type="date"
            value={toDateInput(date)}
            onChange={(e) => e.target.value && setDate(fromDateInput(e.target.value))}
            aria-label="Transaction date"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              width: '100%',
              cursor: 'pointer',
            }}
          />
        </div>

        {type !== 'transfer' && (
          <div className="field-row">
            <div className="label">Check #</div>
            <input
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Optional"
              inputMode="numeric"
            />
          </div>
        )}

        <div className="field-row">
          <div className="label">Memo</div>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Add memo…"
          />
        </div>
      </div>

      {/* toggles */}
      <div className="card field-rows" style={{ margin: '12px 16px 0' }}>
        <div className="field-row">
          <div style={{ fontSize: 15, color: 'var(--ink)' }}>Cleared</div>
          <Switch on={cleared} onChange={setCleared} />
        </div>
      </div>

      <div style={{ margin: '14px 16px 0' }}>
        <button className="btn-primary" disabled={!canSave || busy} onClick={() => void onSave()}>
          Save transaction
        </button>
        {!editing && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--ink-tertiary)',
              marginTop: 8,
            }}
          >
            Payee + amount is enough — everything else is optional
          </div>
        )}
        {editing && (
          <button
            onClick={() => void onDelete()}
            style={{
              width: '100%',
              height: 48,
              marginTop: 10,
              borderRadius: 14,
              color: 'var(--expense)',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Delete transaction
          </button>
        )}
      </div>
      <div style={{ height: 40 }} />

      {picker && (
        <PickerSheet
          title={
            picker === 'category'
              ? 'Category'
              : picker === 'account'
                ? type === 'transfer'
                  ? 'From account'
                  : 'Account'
                : 'To account'
          }
          onClose={() => setPicker(null)}
        >
          {picker === 'category'
            ? CATEGORIES.filter((c) =>
                type === 'income' ? c.kind !== 'expense' : c.kind !== 'income',
              ).map((c) => (
                <PickerRow
                  key={c.id}
                  selected={c.id === categoryId}
                  onClick={() => {
                    setCategoryId(c.id)
                    setCategoryTouched(true)
                    setPicker(null)
                  }}
                >
                  {c.icon} {c.name}
                </PickerRow>
              ))
            : accounts
                .filter((a) => !a.archived)
                .filter((a) => (picker === 'toAccount' ? a.id !== accountId : true))
                .map((a) => (
                  <PickerRow
                    key={a.id}
                    selected={
                      picker === 'toAccount' ? a.id === transferAccountId : a.id === accountId
                    }
                    onClick={() => {
                      if (picker === 'toAccount') setTransferAccountId(a.id)
                      else {
                        setAccountId(a.id)
                        if (a.id === transferAccountId) setTransferAccountId('')
                      }
                      setPicker(null)
                    }}
                  >
                    {a.name}
                  </PickerRow>
                ))}
        </PickerSheet>
      )}
    </div>
  )
}

function PickerSheet({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" style={{ paddingBottom: 24 }}>
        <div
          style={{
            padding: '16px 16px 8px',
            fontSize: 17,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {title}
        </div>
        <div className="card field-rows" style={{ margin: '8px 16px 0' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function PickerRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button className="field-row" onClick={onClick} style={{ textAlign: 'left' }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: selected ? 700 : 600,
          color: selected ? 'var(--accent)' : 'var(--ink)',
        }}
      >
        {children}
      </div>
      {selected && <div style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</div>}
    </button>
  )
}
