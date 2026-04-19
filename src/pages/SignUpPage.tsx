import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DS } from '@/lib/ledger-design'
import type { UserRole } from '@/types'

const mono: React.CSSProperties = {
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' as const,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none',
  borderBottom: `1px solid ${DS.ink}`, outline: 'none',
  fontFamily: DS.sans, fontSize: 15, color: DS.ink, padding: '10px 0', display: 'block',
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
        minHeight: '100vh', background: DS.paper, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px 24px',
        backgroundImage: `radial-gradient(circle at 20% 15%, rgba(184,147,90,0.06) 0%, transparent 50%)`,
      }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ ...mono, color: DS.forest, marginBottom: 20 }}>◆ Account created</div>
          <div style={{ fontFamily: DS.serif, fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em', color: DS.ink, marginBottom: 16 }}>
            Check your email<br/><em style={{ fontWeight: 300 }}>to verify, then sign in.</em>
          </div>
          <Link to="/login" style={{
            display: 'inline-block', padding: '14px 28px', background: DS.ink, color: DS.ivory,
            ...mono, letterSpacing: '0.25em', textDecoration: 'none', marginTop: 8,
          }}>
            Go to sign in →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: DS.paper, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px',
      backgroundImage: `
        radial-gradient(circle at 20% 15%, rgba(184,147,90,0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 85%, rgba(63,80,72,0.05) 0%, transparent 50%)
      `,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <img src="/wildlife-luxuries-logo.png" alt="Wildlife Luxuries"
               style={{ height: 52, width: 'auto', display: 'block', margin: '0 auto 20px' }} />
          <div style={{ borderTop: `3px double ${DS.ink}`, marginBottom: 16 }} />
          <div style={{ ...mono, color: DS.ochre, marginBottom: 8 }}>◆ Join the logbook</div>
          <div style={{ fontFamily: DS.serif, fontSize: 36, fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1, color: DS.ink }}>
            Create an <em style={{ fontStyle: 'italic' }}>account.</em>
          </div>
        </div>

        <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}`, padding: '28px 24px' }}>
          {error && (
            <div style={{
              marginBottom: 20, padding: '10px 14px',
              borderLeft: `2px solid ${DS.rust}`, background: DS.bone,
              fontFamily: DS.sans, fontSize: 13, color: DS.rust,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {([
              { label: 'Full Name', type: 'text', value: displayName, onChange: setDisplayName, required: true },
              { label: 'Email', type: 'email', value: email, onChange: setEmail, required: true },
              { label: 'Password', type: 'password', value: password, onChange: setPassword, required: true, minLength: 6 },
            ] as const).map(field => (
              <div key={field.label} style={{ marginBottom: 20 }}>
                <label style={{ ...mono, color: DS.inkSoft, display: 'block', marginBottom: 4 }}>{field.label}</label>
                <input
                  type={field.type}
                  required={field.required}
                  value={field.value}
                  onChange={e => (field.onChange as (v: string) => void)(e.target.value)}
                  minLength={'minLength' in field ? field.minLength : undefined}
                  style={inputStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 28 }}>
              <label style={{ ...mono, color: DS.inkSoft, display: 'block', marginBottom: 8 }}>Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: `0.5px solid ${DS.ink}` }}>
                {(['staff', 'naturalist'] as const).map((r, i) => (
                  <button key={r} type="button" onClick={() => setRole(r)} style={{
                    padding: '10px', background: role === r ? DS.ink : 'transparent',
                    color: role === r ? DS.ivory : DS.inkSoft, border: 'none',
                    borderRight: i === 0 ? `0.5px solid ${DS.ink}` : 'none',
                    cursor: 'pointer', ...mono, letterSpacing: '0.18em', textTransform: 'capitalize' as const,
                  }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '16px', background: DS.ink, color: DS.ivory, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              ...mono, letterSpacing: '0.25em',
            }}>
              <span>{loading ? 'Creating…' : 'Create account'}</span>
              {!loading && <span style={{ fontFamily: DS.serif, fontStyle: 'italic', fontSize: 16, textTransform: 'none' as const, letterSpacing: 0 }}>→</span>}
            </button>

            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <span style={{ ...mono, color: DS.inkSoft }}>
                Have an account?{' '}
                <Link to="/login" style={{ color: DS.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
