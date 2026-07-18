import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { deletePayee, updatePayee } from '../data/repo'
import { CATEGORIES, getCategory } from '../lib/categories'
import { SheetHeader, Sheet } from '../components/controls'
import type { Payee } from '../types'

export function Payees() {
  const { user } = useAuth()
  const { payees } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Payee | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...payees]
      .filter((p) => !q || p.nameLower.includes(q))
      .sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name))
  }, [payees, search])

  function openEdit(p: Payee) {
    setEditing(p)
    setEditName(p.name)
    setEditCategory(p.defaultCategoryId)
  }

  async function saveEdit() {
    if (!user || !editing || !editName.trim()) return
    await updatePayee(user.uid, editing.id, {
      name: editName.trim(),
      nameLower: editName.trim().toLowerCase(),
      defaultCategoryId: editCategory,
    })
    toast('Payee updated')
    setEditing(null)
  }

  async function removePayee() {
    if (!user || !editing) return
    if (!window.confirm(`Delete payee "${editing.name}"? Past transactions keep their history.`))
      return
    await deletePayee(user.uid, editing.id)
    toast('Payee deleted')
    setEditing(null)
  }

  return (
    <div className="app-shell">
      <SheetHeader
        title="Payees"
        left={<button onClick={() => navigate('/')} style={{ color: 'inherit' }}>Done</button>}
      />
      <div style={{ padding: '4px 16px 24px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payees…"
          style={{
            width: '100%',
            height: 40,
            borderRadius: 12,
            border: '1px solid var(--surface-border)',
            background: 'var(--surface)',
            padding: '0 14px',
            fontSize: 15,
            outline: 'none',
            marginBottom: 12,
          }}
        />
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ink-tertiary)',
              fontWeight: 600,
              padding: '32px 24px',
            }}
          >
            {payees.length === 0
              ? 'Payees are created automatically as you add transactions.'
              : 'No payees match.'}
          </div>
        ) : (
          <div className="card field-rows">
            {filtered.slice(0, 200).map((p) => (
              <button
                key={p.id}
                className="field-row"
                style={{ minHeight: 56 }}
                onClick={() => openEdit(p)}
              >
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', marginTop: 1 }}>
                    {getCategory(p.defaultCategoryId).name} · used {p.useCount}×
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div style={{ padding: '16px 16px 32px' }}>
            <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
              Edit Payee
            </div>
            <div className="card field-rows">
              <div className="field-row">
                <div className="label">Name</div>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="field-row">
                <div className="label">Default category</div>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    textAlign: 'right',
                    outline: 'none',
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                className="btn-primary"
                style={{ flex: 1, height: 48 }}
                disabled={!editName.trim()}
                onClick={() => void saveEdit()}
              >
                Save
              </button>
              <button
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  color: 'var(--expense)',
                  fontWeight: 700,
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                }}
                onClick={() => void removePayee()}
              >
                Delete
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
