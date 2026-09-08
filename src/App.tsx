import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { SignIn } from './screens/SignIn'
import { Register } from './screens/Register'
import { TxnForm } from './screens/TxnForm'
import { Accounts, AccountForm } from './screens/Accounts'
import { Insights } from './screens/Insights'
import { CategoryTxns } from './screens/CategoryTxns'
import { Payees } from './screens/Payees'
import { Settings } from './screens/Settings'
import { ImportScreen } from './screens/Import'

function Routed() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--ink-tertiary)', fontWeight: 600 }}>Checkbook Ledger</div>
      </div>
    )
  }

  if (!user) return <SignIn />

  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/txn/:id" element={<TxnForm />} />
        <Route path="/txn/new" element={<TxnForm />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/insights/category" element={<CategoryTxns />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountForm />} />
        <Route path="/payees" element={<Payees />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/import" element={<ImportScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routed />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
