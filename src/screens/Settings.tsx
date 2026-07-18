import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { SheetHeader } from '../components/controls'
import { ChevronRight } from '../components/icons'

export function Settings() {
  const { user } = useAuth()
  const { accounts, payees, txns } = useData()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <SheetHeader
        title="Settings"
        left={<button onClick={() => navigate('/')} style={{ color: 'inherit' }}>Done</button>}
      />
      <div style={{ padding: '8px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card field-rows">
          <div className="field-row" style={{ minHeight: 56 }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {user?.displayName || user?.email}
              </div>
              {user?.displayName && (
                <div style={{ fontSize: 13, color: 'var(--ink-tertiary)' }}>{user.email}</div>
              )}
            </div>
          </div>
          <div className="field-row">
            <div className="label">Theme</div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
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
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="card field-rows">
          <button className="field-row" onClick={() => navigate('/accounts')}>
            <div className="label" style={{ color: 'var(--ink)' }}>Accounts</div>
            <div className="value" style={{ color: 'var(--ink-tertiary)' }}>
              {accounts.length}
              <ChevronRight color="var(--ink-faint)" />
            </div>
          </button>
          <button className="field-row" onClick={() => navigate('/payees')}>
            <div className="label" style={{ color: 'var(--ink)' }}>Payees</div>
            <div className="value" style={{ color: 'var(--ink-tertiary)' }}>
              {payees.length}
              <ChevronRight color="var(--ink-faint)" />
            </div>
          </button>
          <button className="field-row" onClick={() => navigate('/settings/import')}>
            <div className="label" style={{ color: 'var(--ink)' }}>Import data</div>
            <div className="value" style={{ color: 'var(--ink-tertiary)' }}>
              <ChevronRight color="var(--ink-faint)" />
            </div>
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', padding: '0 4px' }}>
          {txns.length.toLocaleString()} transactions synced. Works offline — changes
          upload automatically when you're back online.
        </div>

        <button
          onClick={() => void signOut(auth)}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            color: 'var(--expense)',
            fontSize: 16,
            fontWeight: 700,
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
