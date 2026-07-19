import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { createAccount, updateAccount } from '../data/repo'
import { accountBalances, touchesAccount } from '../lib/ledger'
import { digitsToCents, formatCents, MINUS } from '../lib/money'
import { AmountInput } from '../components/AmountInput'
import { SheetHeader } from '../components/controls'
import { ChevronRight, PlusIcon } from '../components/icons'

export function Accounts() {
  const { accounts, txns } = useData()
  const navigate = useNavigate()

  const balancesById = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of accounts) {
      map.set(
        a.id,
        accountBalances(a, txns.filter((t) => touchesAccount(t, a.id))).balanceCents,
      )
    }
    return map
  }, [accounts, txns])

  return (
    <div className="app-shell">
      <SheetHeader
        title="Accounts"
        left={<button onClick={() => navigate('/')} style={{ color: 'inherit' }}>Done</button>}
        right={
          <button onClick={() => navigate('/accounts/new')} aria-label="Add account" style={{ color: 'inherit' }}>
            <PlusIcon size={18} color="var(--accent)" />
          </button>
        }
      />
      <div style={{ padding: '8px 16px' }}>
        {accounts.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--ink-secondary)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>
              Create your first account
            </div>
            <div style={{ fontSize: 15, marginTop: 6 }}>
              "Everyday Checking" is a good place to start.
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => navigate('/accounts/new')}
            >
              New account
            </button>
          </div>
        )}
        {accounts.length > 0 && (
          <div className="card field-rows">
            {accounts.map((a) => (
              <button
                key={a.id}
                className="field-row"
                onClick={() => navigate(`/accounts/${a.id}`)}
                style={{ minHeight: 56, opacity: a.archived ? 0.5 : 1 }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {a.name}
                    {a.archived && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--ink-tertiary)',
                          marginLeft: 8,
                        }}
                      >
                        Archived
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="num" style={{ fontSize: 16, fontWeight: 600 }}>
                    {formatCents(balancesById.get(a.id) ?? 0)}
                  </span>
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

export function AccountForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { user } = useAuth()
  const { accounts, selectAccount } = useData()
  const navigate = useNavigate()
  const toast = useToast()

  const account = isNew ? null : (accounts.find((a) => a.id === id) ?? null)
  const [name, setName] = useState(account?.name ?? '')
  const [openingDigits, setOpeningDigits] = useState(
    account ? String(Math.abs(account.openingBalanceCents)) : '',
  )
  const [openingNegative, setOpeningNegative] = useState(
    (account?.openingBalanceCents ?? 0) < 0,
  )
  const [busy, setBusy] = useState(false)

  if (!isNew && !account) {
    navigate('/accounts', { replace: true })
    return null
  }

  const parsed = digitsToCents(openingDigits)
  const openingCents = parsed === null ? 0 : openingNegative ? -parsed : parsed
  const canSave = name.trim() !== ''

  async function onSave() {
    if (!user || !canSave) return
    setBusy(true)
    try {
      if (isNew) {
        const newId = await createAccount(
          user.uid,
          name.trim(),
          openingCents,
          accounts.length,
        )
        selectAccount(newId)
        toast('Account created')
      } else if (account) {
        await updateAccount(user.uid, account.id, {
          name: name.trim(),
          openingBalanceCents: openingCents,
        })
        toast('Account updated')
      }
      navigate(-1)
    } finally {
      setBusy(false)
    }
  }

  async function toggleArchived() {
    if (!user || !account) return
    await updateAccount(user.uid, account.id, { archived: !account.archived })
    toast(account.archived ? 'Account unarchived' : 'Account archived')
    navigate('/accounts')
  }

  return (
    <div className="app-shell">
      <SheetHeader
        title={isNew ? 'New Account' : 'Edit Account'}
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
      <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card field-rows">
          <div className="field-row">
            <div className="label">Name</div>
            <input
              autoFocus={isNew}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Everyday Checking"
            />
          </div>
          <div className="field-row">
            <div className="label">Opening balance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <button
                onClick={() => setOpeningNegative((n) => !n)}
                aria-label="Toggle negative balance"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: openingNegative ? 'var(--expense)' : 'var(--ink-tertiary)',
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: openingNegative ? 'transparent' : 'var(--chip-bg)',
                  border: openingNegative ? '1px solid var(--expense)' : '1px solid transparent',
                  flex: '0 0 auto',
                }}
              >
                {openingNegative ? MINUS : '±'}
              </button>
              <AmountInput
                className="num"
                ariaLabel="Opening balance"
                digits={openingDigits}
                onDigitsChange={setOpeningDigits}
                onMinus={() => setOpeningNegative((n) => !n)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'right',
                  fontSize: 16,
                  fontWeight: 600,
                  color: openingNegative ? 'var(--expense)' : 'var(--ink)',
                  flex: 1,
                  minWidth: 0,
                  outline: 'none',
                  padding: '12px 0',
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', padding: '0 4px', lineHeight: 1.5 }}>
          Set the opening balance to your bank's current balance so the register matches
          from day one. Digits fill in as cents — type 18300 for $183.00. Tap ± if the
          account starts overdrawn.
        </div>
        {!isNew && account && (
          <button
            onClick={() => void toggleArchived()}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              color: account.archived ? 'var(--accent)' : 'var(--expense)',
              fontSize: 16,
              fontWeight: 700,
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
            }}
          >
            {account.archived ? 'Unarchive account' : 'Archive account'}
          </button>
        )}
      </div>
    </div>
  )
}
