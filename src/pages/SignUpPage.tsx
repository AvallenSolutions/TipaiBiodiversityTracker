import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import type { UserRole } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: '"Inter Tight", system-ui, sans-serif',
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

export default function SignUpPage() {
  const { signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(email, password, displayName, role)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
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
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{
            borderTop: `3px double ${DS.ink}`,
            paddingTop: 16,
            marginBottom: 32,
          }}>
            <Mono size={9} letter={0.22} color={DS.ochre}>◆ Account created</Mono>
          </div>
          <h2 style={{
            fontFamily: DS.serif,
            fontSize: 32,
            fontWeight: 300,
            letterSpacing: '-0.02em',
            color: DS.ink,
            margin: '0 0 16px',
          }}>
            Welcome to the field.
          </h2>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            lineHeight: 1.55,
            margin: '0 0 32px',
          }}>
            Check your email to verify your account, then sign in to begin logging.
          </p>
          <Link to="/login" style={{
            display: 'inline-block',
            fontFamily: DS.serif,
            fontSize: 16,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.ivory,
            background: DS.ink,
            padding: '12px 32px',
            textDecoration: 'none',
          }}>
            Go to Sign In →
          </Link>
        </div>
      </div>
    )
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
            Join the Journal
          </h1>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            margin: 0,
          }}>
            Create your field account.
          </p>
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 6 }}>Full name</Mono>
            <input
              type="text"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </div>

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

          <div style={{ marginBottom: 24 }}>
            <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 6 }}>Password</Mono>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              minLength={6}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 36 }}>
            <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 6 }}>Role</Mono>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              style={{
                ...inputStyle,
                appearance: 'none',
                WebkitAppearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="staff">Staff</option>
              <option value="naturalist">Naturalist</option>
            </select>
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
            {loading ? '⋯ Creating account' : 'Create Account →'}
          </button>
        </form>

        {/* Footer */}
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
            Already have an account?{' '}
            <Link to="/login" style={{ color: DS.ink, textDecoration: 'underline' }}>
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
