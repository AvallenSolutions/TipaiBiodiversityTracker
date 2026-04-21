import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: DS.sans,
  fontSize: 15,
  padding: '8px 0',
  borderBottom: `1px solid ${DS.ink}`,
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  background: 'transparent',
  color: DS.ink,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function LoginPage() {
  const { signIn, signInAsGuest, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'guest'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestSent, setGuestSent] = useState(false)

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGuestLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInAsGuest(email)
      setGuestSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: DS.paper,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Masthead */}
        <div style={{
          borderTop: `3px double ${DS.ink}`,
          paddingTop: 16,
          marginBottom: 40,
          textAlign: 'center',
        }}>
          <Mono size={9} letter={0.22} color={DS.ochre}>◆ Wildlife Luxuries / Tipai</Mono>
          <h1 style={{
            fontFamily: DS.serif,
            fontSize: 36,
            fontWeight: 300,
            letterSpacing: '-0.02em',
            margin: '8px 0 4px',
            color: DS.ink,
          }}>
            The Field Journal
          </h1>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            margin: 0,
          }}>
            Track and protect forest life.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: `1px solid ${DS.ink}`,
          marginBottom: 32,
        }}>
          {(['login', 'guest'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                fontFamily: DS.serif,
                fontSize: 14,
                fontStyle: 'italic',
                fontWeight: 300,
                color: mode === m ? DS.ink : DS.inkSoft,
                background: 'none',
                border: 'none',
                borderBottom: mode === m ? `2px solid ${DS.ochre}` : '2px solid transparent',
                padding: '8px 0 10px',
                cursor: 'pointer',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {m === 'login' ? 'Staff / Naturalist' : 'Guest Access'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px',
            background: DS.rust,
            color: DS.ivory,
            fontFamily: DS.mono,
            fontSize: 10,
            letterSpacing: '0.05em',
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {/* Guest: sent confirmation */}
        {mode === 'guest' && guestSent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 12 }}>◆ Check your inbox</Mono>
            <p style={{
              fontFamily: DS.serif,
              fontSize: 16,
              fontWeight: 300,
              lineHeight: 1.55,
              color: DS.ink,
              margin: '0 0 8px',
            }}>
              A sign-in link has been sent to
            </p>
            <p style={{
              fontFamily: DS.mono,
              fontSize: 12,
              color: DS.ochre,
              letterSpacing: '0.05em',
              margin: '0 0 20px',
            }}>
              {email}
            </p>
            <p style={{
              fontFamily: DS.serif,
              fontSize: 13,
              fontStyle: 'italic',
              color: DS.inkSoft,
              margin: 0,
            }}>
              Click the link in the email to enter the journal.
            </p>
            <button
              onClick={() => { setGuestSent(false); setEmail('') }}
              style={{
                marginTop: 24,
                fontFamily: DS.serif,
                fontSize: 13,
                fontStyle: 'italic',
                color: DS.inkSoft,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Use a different address
            </button>
          </div>

        ) : mode === 'guest' ? (
          /* Guest: enter email */
          <form onSubmit={handleGuestLogin}>
            <p style={{
              fontFamily: DS.serif,
              fontSize: 14,
              fontStyle: 'italic',
              fontWeight: 300,
              color: DS.inkSoft,
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}>
              Enter your email and we'll send a sign-in link — no password needed.
            </p>
            <div style={{ marginBottom: 28 }}>
              <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 6 }}>Email address</Mono>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.name@example.com"
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                fontFamily: DS.serif,
                fontSize: 16,
                fontStyle: 'italic',
                fontWeight: 300,
                color: DS.ivory,
                background: loading ? DS.inkSoft : DS.ink,
                border: 'none',
                padding: '14px 0',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
                transition: 'background 0.15s',
              }}
            >
              {loading ? '⋯ Sending' : 'Send Magic Link →'}
            </button>
          </form>

        ) : (
          /* Staff: password login */
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 24 }}>
              <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 6 }}>Email address</Mono>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.name@example.com"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 32 }}>
              <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 6 }}>Password</Mono>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                fontFamily: DS.serif,
                fontSize: 16,
                fontStyle: 'italic',
                fontWeight: 300,
                color: DS.ivory,
                background: loading ? DS.inkSoft : DS.ink,
                border: 'none',
                padding: '14px 0',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
                transition: 'background 0.15s',
              }}
            >
              {loading ? '⋯ Signing in' : 'Sign In →'}
            </button>
          </form>
        )}

        {/* Footer links */}
        <div style={{
          marginTop: 36,
          paddingTop: 20,
          borderTop: `0.5px solid ${DS.inkHair}`,
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 13,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            margin: 0,
          }}>
            No account?{' '}
            <Link to="/signup" style={{ color: DS.ink, textDecoration: 'underline' }}>
              Register here
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
