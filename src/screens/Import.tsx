import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { payeesCol, txnsCol, createAccount } from '../data/repo'
import {
  parseCsvRows,
  parseRealmJson,
  type ImportParseResult,
} from '../lib/import'
import { SheetHeader } from '../components/controls'
import { formatCents } from '../lib/money'

type Stage =
  | { step: 'pick' }
  | { step: 'preview'; parsed: ImportParseResult; fileName: string }
  | { step: 'writing'; done: number; total: number }
  | { step: 'complete'; count: number; warnings: string[] }

/**
 * Import the old Checkbook app's data. Accepts the Realm JSON export
 * (RealmAccounts / RealmPayee / RealmTransaction tables) or a CSV of
 * transactions. Parsing is pure (src/lib/import.ts); this screen handles
 * files and batched Firestore writes.
 */
export function ImportScreen() {
  const { user } = useAuth()
  const { accounts, selectedAccountId } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ step: 'pick' })
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      let parsed: ImportParseResult
      if (file.name.toLowerCase().endsWith('.csv')) {
        const rows = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        })
        parsed = parseCsvRows(rows.data)
      } else {
        parsed = parseRealmJson(JSON.parse(text))
      }
      if (parsed.txns.length === 0 && parsed.accounts.length === 0) {
        setError('No transactions found in that file. Expected the Realm JSON export or a CSV with date, payee, and amount columns.')
        return
      }
      setStage({ step: 'preview', parsed, fileName: file.name })
    } catch {
      setError('Could not read that file — is it valid JSON or CSV?')
    }
  }

  async function runImport(parsed: ImportParseResult) {
    if (!user) return
    const uid = user.uid
    const total = parsed.accounts.length + parsed.payees.length + parsed.txns.length
    setStage({ step: 'writing', done: 0, total })
    let done = 0

    // 1. Accounts — map old refs to new ids. Without accounts in the file,
    //    everything lands in the currently selected account.
    const accountRefMap = new Map<string, string>()
    for (const [i, acc] of parsed.accounts.entries()) {
      const newId = await createAccount(uid, acc.name, acc.openingBalanceCents, accounts.length + i)
      accountRefMap.set(acc.ref, newId)
      done += 1
      setStage({ step: 'writing', done, total })
    }
    const fallbackAccountId =
      accountRefMap.values().next().value ?? selectedAccountId ?? accounts[0]?.id
    if (!fallbackAccountId) {
      setError('Create an account before importing transactions.')
      setStage({ step: 'pick' })
      return
    }
    const resolveAccount = (ref: string | null | undefined) =>
      (ref && accountRefMap.get(ref)) || fallbackAccountId

    // 2. Payees — batched; remember name → id for transaction links.
    const payeeIdByName = new Map<string, string>()
    const now = Date.now()
    for (let i = 0; i < parsed.payees.length; i += 400) {
      const batch = writeBatch(db)
      for (const p of parsed.payees.slice(i, i + 400)) {
        const ref = doc(payeesCol(uid))
        payeeIdByName.set(p.name.toLowerCase(), ref.id)
        batch.set(ref, {
          name: p.name,
          nameLower: p.name.toLowerCase(),
          defaultCategoryId: p.defaultCategoryId,
          useCount: p.useCount,
          lastUsedAt: now,
        })
      }
      await batch.commit()
      done += Math.min(400, parsed.payees.length - i)
      setStage({ step: 'writing', done, total })
    }

    // 3. Transactions — batched.
    for (let i = 0; i < parsed.txns.length; i += 400) {
      const batch = writeBatch(db)
      for (const t of parsed.txns.slice(i, i + 400)) {
        const ref = doc(txnsCol(uid))
        const record: Record<string, unknown> = {
          accountId: resolveAccount(t.accountRef),
          type: t.type,
          amountCents: t.amountCents,
          payeeId: t.type === 'transfer' ? null : (payeeIdByName.get(t.payeeName.toLowerCase()) ?? null),
          payeeName: t.payeeName,
          categoryId: t.categoryId,
          date: t.date,
          cleared: t.cleared,
          createdAt: now,
          updatedAt: now,
        }
        if (t.categoryName) record.categoryName = t.categoryName
        if (t.checkNumber) record.checkNumber = t.checkNumber
        if (t.memo) record.memo = t.memo
        if (t.cleared) record.clearedAt = now
        if (t.type === 'transfer') record.transferAccountId = resolveAccount(t.transferAccountRef)
        batch.set(ref, record)
      }
      await batch.commit()
      done += Math.min(400, parsed.txns.length - i)
      setStage({ step: 'writing', done, total })
    }

    setStage({ step: 'complete', count: parsed.txns.length, warnings: parsed.warnings })
    toast('Import complete')
  }

  const totalCents = (parsed: ImportParseResult) =>
    parsed.txns.reduce(
      (sum, t) =>
        sum + (t.type === 'expense' ? -t.amountCents : t.type === 'income' ? t.amountCents : 0),
      0,
    )

  return (
    <div className="app-shell">
      <SheetHeader
        title="Import data"
        left={
          stage.step !== 'writing' && (
            <button onClick={() => navigate(-1)} style={{ color: 'inherit' }}>
              Back
            </button>
          )
        }
      />
      <div style={{ padding: '8px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {stage.step === 'pick' && (
          <>
            <div style={{ fontSize: 15, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
              Bring over your history from the old Checkbook app. Two formats work:
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>
                  <b>Realm JSON export</b> — with RealmAccounts, RealmPayee and
                  RealmTransaction tables. Accounts, payees and all transactions import.
                </li>
                <li>
                  <b>CSV</b> — columns for date, payee, amount (plus optional category,
                  memo, check, cleared, type). Rows import into the current account.
                </li>
              </ul>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              Choose file…
            </button>
            {error && (
              <div style={{ color: 'var(--expense)', fontSize: 14, fontWeight: 600 }}>{error}</div>
            )}
          </>
        )}

        {stage.step === 'preview' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{stage.fileName}</div>
            <div className="card field-rows">
              <div className="field-row">
                <div className="label">Accounts</div>
                <div className="value num">{stage.parsed.accounts.length || '— (current account)'}</div>
              </div>
              <div className="field-row">
                <div className="label">Payees</div>
                <div className="value num">{stage.parsed.payees.length.toLocaleString()}</div>
              </div>
              <div className="field-row">
                <div className="label">Transactions</div>
                <div className="value num">{stage.parsed.txns.length.toLocaleString()}</div>
              </div>
              <div className="field-row">
                <div className="label">Net amount</div>
                <div className="value num">{formatCents(totalCents(stage.parsed))}</div>
              </div>
            </div>
            {stage.parsed.warnings.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--expense)', lineHeight: 1.5 }}>
                {stage.parsed.warnings.slice(0, 5).map((w) => (
                  <div key={w}>⚠ {w}</div>
                ))}
                {stage.parsed.warnings.length > 5 && (
                  <div>…and {stage.parsed.warnings.length - 5} more</div>
                )}
              </div>
            )}
            <button className="btn-primary" onClick={() => void runImport(stage.parsed)}>
              Import {stage.parsed.txns.length.toLocaleString()} transactions
            </button>
            <button
              className="btn-secondary"
              style={{ height: 48 }}
              onClick={() => setStage({ step: 'pick' })}
            >
              Choose a different file
            </button>
          </>
        )}

        {stage.step === 'writing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Importing…</div>
            <div
              style={{
                margin: '16px auto 0',
                maxWidth: 280,
                height: 6,
                borderRadius: 3,
                background: 'var(--seg-bg)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${stage.total ? (stage.done / stage.total) * 100 : 0}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  transition: 'width 0.2s',
                }}
              />
            </div>
            <div className="num" style={{ fontSize: 13, color: 'var(--ink-tertiary)', marginTop: 8 }}>
              {stage.done.toLocaleString()} of {stage.total.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', marginTop: 4 }}>
              Keep this tab open until the import finishes.
            </div>
          </div>
        )}

        {stage.step === 'complete' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 8 }}>
              Imported {stage.count.toLocaleString()} transactions
            </div>
            {stage.warnings.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 6 }}>
                {stage.warnings.length} row{stage.warnings.length === 1 ? ' was' : 's were'} skipped.
              </div>
            )}
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/')}>
              Open the register
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
