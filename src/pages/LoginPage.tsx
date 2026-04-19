import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DS } from '@/lib/ledger-design'

const ink = DS.ink
const ivory = DS.ivory
const paper = DS.paper
const ochre = DS.ochre
const inkSoft = DS.inkSoft
const inkHair = DS.inkHair

const mono: React.CSSProperties = {
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' as const,
}
const serif = (size = 18, weight = 300): React.CSSProperties => ({
  fontFamily: DS.serif, fontSize: size, fontWeight: weight, letterSpacing: '-0.01em',
})
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none',
  borderBottom: `1px solid ${ink}`, outline: 'none',
  fontFamily: DS.sans, fontSize: 15, color: ink, padding: '10px 0',
  display: 'block',
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
      minHeight: '100vh', background: paper, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px',
      backgroundImage: `
        radial-gradient(circle at 20% 15%, rgba(184,147,90,0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 85%, rgba(63,80,72,0.05) 0%, transparent 50%)
      `,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <img src="/wildlife-luxuries-logo.png" alt="Wildlife Luxuries"
               style={{ height: 52, width: 'auto', display: 'block', margin: '0 auto 20px' }} />
          <div style={{ borderTop: `3px double ${ink}`, marginBottom: 16 }} />
          <div style={{ ...mono, color: ochre, marginBottom: 8 }}>◆ The Field Log</div>
          <div style={{ ...serif(36, 200), letterSpacing: '-0.03em', lineHeight: 1, color: ink }}>
            Sign in to<br/><em style={{ fontStyle: 'italic' }}>the logbook.</em>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 32,
          border: `0.5px solid ${ink}`,
        }}>
          {(['login', 'guest'] as const).map((m, i) => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              padding: '10px', background: mode === m ? ink : 'transparent',
              color: mode === m ? ivory : inkSoft, border: 'none',
              borderRight: i === 0 ? `0.5px solid ${ink}` : 'none',
              cursor: 'pointer', ...mono, letterSpacing: '0.18em',
            }}>
              {m === 'login' ? 'Staff / Naturalist' : 'Guest'}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div style={{ background: ivory, border: `1px solid ${ink}`, padding: '28px 24px' }}>

          {error && (
            <div style={{
              marginBottom: 20, padding: '10px 14px',
              borderLeft: `2px solid ${DS.rust}`, background: DS.bone,
              fontFamily: DS.sans, fontSize: 13, color: DS.rust,
            }}>
              {error}
            </div>
          )}

          {mode === 'guest' && guestSent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ ...mono, color: ochre, marginBottom: 16 }}>◆ Check your email</div>
              <div style={{ ...serif(20, 300), color: ink, lineHeight: 1.5 }}>
                We've sent a link to <em>{email}</em>.<br/>Click it to sign in.
              </div>
            </div>
          ) : mode === 'guest' ? (
            <form onSubmit={handleGuestLogin}>
              <div style={{ ...mono, color: inkSoft, marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email — no password needed.
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ ...mono, color: inkSoft, display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="your.email@example.com" style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px', background: ink, color: ivory, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                ...mono, letterSpacing: '0.25em',
              }}>
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ ...mono, color: inkSoft, display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="your.email@example.com" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 32 }}>
                <label style={{ ...mono, color: inkSoft, display: 'block', marginBottom: 4 }}>Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••" minLength={6} style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '16px', background: ink, color: ivory, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                ...mono, letterSpacing: '0.25em',
              }}>
                <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                {!loading && <span style={{ fontFamily: DS.serif, fontStyle: 'italic', fontSize: 16, textTransform: 'none', letterSpacing: 0 }}>→</span>}
              </button>
              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <span style={{ ...mono, color: inkSoft }}>
                  No account?{' '}
                  <Link to="/signup" style={{ color: ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Sign up
                  </Link>
                </span>
              </div>
            </form>
          )}
        </div>

        {/* Footer rule */}
        <div style={{ borderTop: `0.5px solid ${inkHair}`, marginTop: 32 }} />
        <div style={{ ...mono, color: inkSoft, textAlign: 'center', marginTop: 14, fontSize: 8 }}>
          Wildlife Luxuries · Kanha Tiger Reserve
        </div>
      </div>
    </div>
  )
}
