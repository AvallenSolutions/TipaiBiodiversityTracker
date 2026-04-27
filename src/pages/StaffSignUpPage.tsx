import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'

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

// Staff/naturalist self-signup. The form deliberately does NOT offer a
// role selector: the database trigger forces every new user to start as
// 'guest', and an admin promotes legitimate staff and naturalists from
// the Admin page after signup. The wording here makes the wait visible.
export default function StaffSignUpPage() {
  const { signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(email, password, displayName)
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
        <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <div style={{
            borderTop: `3px double ${DS.ink}`,
            paddingTop: 16,
            marginBottom: 32,
          }}>
            <Mono size={9} letter={0.22} color={DS.ochre}>◆ Request received</Mono>
          </div>
          <h2 style={{
            fontFamily: DS.serif,
            fontSize: 32,
            fontWeight: 300,
            letterSpacing: '-0.02em',
            color: DS.ink,
            margin: '0 0 16px',
          }}>
            Thanks — check your email.
          </h2>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            lineHeight: 1.55,
            margin: '0 0 16px',
          }}>
            We've sent a verification link to <strong style={{ fontWeight: 400, color: DS.ink, fontStyle: 'normal' }}>{email}</strong>.
            Click it to confirm your address.
          </p>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 14,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            lineHeight: 1.55,
            margin: '0 0 32px',
          }}>
            Your account starts as a <em>guest</em>. An admin will review your
            request and upgrade you to staff or naturalist before you can
            access the Ledger.
          </p>
          <Link to="/staff/login" style={{
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
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{
          borderTop: `3px double ${DS.ink}`,
          paddingTop: 16,
          marginBottom: 32,
          textAlign: 'center',
        }}>
          <Mono size={9} letter={0.22} color={DS.ochre}>◆ Wildlife Luxuries / Staff request</Mono>
          <h1 style={{
            fontFamily: DS.serif,
            fontSize: 32,
            fontWeight: 300,
            letterSpacing: '-0.02em',
            margin: '8px 0 4px',
            color: DS.ink,
          }}>
            Request staff access
          </h1>
          <p style={{
            fontFamily: DS.serif,
            fontSize: 14,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.inkSoft,
            margin: 0,
            lineHeight: 1.5,
          }}>
            New accounts start as guest. An admin reviews and upgrades the role.
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

          <div style={{ marginBottom: 32 }}>
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
            {loading ? '⋯ Submitting' : 'Request access →'}
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
            Already a staff member?{' '}
            <Link to="/staff/login" style={{ color: DS.ink, textDecoration: 'underline' }}>
              Sign in
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
            Just visiting the reserve?{' '}
            <Link to="/login" style={{ color: DS.ink, textDecoration: 'underline' }}>
              Guest sign-in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
