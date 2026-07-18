import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { useToast } from '../context/ToastContext'
import { CheckIcon } from '../components/icons'

type Mode = 'signin' | 'signup' | 'reset'

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.'
    case 'auth/email-already-in-use':
      return 'An account already exists for that email — try signing in.'
    case 'auth/weak-password':
      return 'Password needs at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.'
    case 'auth/too-many-requests':
      return 'Too many attempts — wait a moment and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setError(friendlyAuthError(code))
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'reset') {
      void run(async () => {
        await sendPasswordResetEmail(auth, email)
        toast('Password reset email sent')
        setMode('signin')
      })
    } else if (mode === 'signup') {
      void run(() => createUserWithEmailAndPassword(auth, email, password))
    } else {
      void run(() => signInWithEmailAndPassword(auth, email, password))
    }
  }

  const inputStyle = {
    width: '100%',
    height: 48,
    borderRadius: 12,
    border: '1px solid var(--surface-border)',
    background: 'var(--surface)',
    padding: '0 14px',
    fontSize: 16,
    outline: 'none',
    color: 'var(--ink)',
  } as const

  return (
    <div
      className="app-shell"
      style={{ justifyContent: 'center', padding: '32px 24px', gap: 22 }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: 'var(--shadow-btn)',
          }}
        >
          <CheckIcon size={26} color="var(--check-on-disc)" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 16, letterSpacing: '-0.01em' }}>
          Checkbook Ledger
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-secondary)', marginTop: 4 }}>
          Your register, balanced to the penny.
        </div>
      </div>

      <button
        className="btn-secondary"
        disabled={busy}
        onClick={() => void run(() => signInWithPopup(auth, googleProvider))}
        style={{ gap: 10 }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path
            fill="#FFC107"
            d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
          />
        </svg>
        Continue with Google
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: 'var(--ink-tertiary)',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
        or
        <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          style={inputStyle}
          type="email"
          required
          placeholder="Email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== 'reset' && (
          <input
            style={inputStyle}
            type="password"
            required
            placeholder="Password"
            value={password}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {error && (
          <div style={{ color: 'var(--expense)', fontSize: 14, fontWeight: 600 }}>{error}</div>
        )}
        <button className="btn-primary" type="submit" disabled={busy}>
          {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}
        </button>
      </form>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--accent)',
        }}
      >
        {mode === 'signin' ? (
          <>
            <button onClick={() => setMode('signup')} style={{ color: 'inherit' }}>
              Create an account
            </button>
            <button onClick={() => setMode('reset')} style={{ color: 'inherit' }}>
              Forgot password?
            </button>
          </>
        ) : (
          <button onClick={() => setMode('signin')} style={{ color: 'inherit' }}>
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
