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

// Staff/naturalist sign-in. Distinct from the guest entry point so a
// visitor never lands here by default — they'd have to follow the small
// "Staff or naturalist?" link from /login.
export default function StaffLoginPage() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

        <div style={{
          borderTop: `3px double ${DS.ink}`,
          paddingTop: 16,
          marginBottom: 40,
          textAlign: 'center',
        }}>
          <Mono size={9} letter={0.22} color={DS.ochre}>◆ Wildlife Luxuries / Staff & Naturalists</Mono>
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
            Sign in to your staff account.
          </p>
        </div>

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
            margin: '0 0 8px',
          }}>
            Need an account?{' '}
            <Link to="/staff/signup" style={{ color: DS.ink, textDecoration: 'underline' }}>
              Request access
            </Link>
          </p>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 13,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            margin: 0,
          }}>
            Just visiting?{' '}
            <Link to="/login" style={{ color: DS.ink, textDecoration: 'underline' }}>
              Guest sign-in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
