import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'

export default function AccountSettingsPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) throw err
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Observer'
  const email = user?.email || profile?.email || ''
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>
      {/* Header */}
      <div style={{
        borderTop: `3px double ${DS.ink}`,
        paddingTop: 12,
        marginBottom: 28,
      }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ Account</Mono>
        <h1 style={{
          fontFamily: DS.serif,
          fontSize: 28,
          fontWeight: 300,
          letterSpacing: '-0.02em',
          margin: '6px 0 2px',
          color: DS.ink,
        }}>
          {displayName}
        </h1>
        {roleLabel && (
          <p style={{
            fontFamily: DS.mono,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: DS.inkSoft,
            margin: 0,
          }}>
            {roleLabel}
          </p>
        )}
      </div>

      {/* Account info */}
      <div style={{
        padding: '12px 0',
        borderTop: `1px solid ${DS.ink}`,
        borderBottom: `1px solid ${DS.inkHair}`,
        marginBottom: 28,
      }}>
        <Mono size={9} letter={0.22} color={DS.inkSoft}>Email</Mono>
        <p style={{
          fontFamily: DS.mono,
          fontSize: 12,
          letterSpacing: '0.05em',
          color: DS.ink,
          margin: '4px 0 0',
        }}>
          {email || '—'}
        </p>
      </div>

      {/* Change password */}
      <div style={{ marginBottom: 32 }}>
        <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 14, display: 'block' }}>
          Change Password
        </Mono>

        {success && (
          <div style={{
            padding: '8px 12px',
            background: DS.forest,
            color: DS.ivory,
            fontFamily: DS.mono,
            fontSize: 10,
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}>
            Password updated successfully.
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px',
            background: DS.rust,
            color: DS.ivory,
            fontFamily: DS.mono,
            fontSize: 10,
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 4, display: 'block' }}>
              New password
            </Mono>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
          <div>
            <Mono size={9} letter={0.22} color={DS.inkSoft} style={{ marginBottom: 4, display: 'block' }}>
              Confirm new password
            </Mono>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newPassword || !confirmPassword}
            style={{
              fontFamily: DS.serif,
              fontSize: 14,
              fontStyle: 'italic',
              fontWeight: 300,
              color: DS.ivory,
              background: saving ? DS.inkSoft : DS.ink,
              border: 'none',
              padding: '11px 0',
              cursor: saving ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {saving ? '⋯ Saving' : 'Update password'}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div style={{ borderTop: `1px solid ${DS.inkHair}`, paddingTop: 24 }}>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            width: '100%',
            fontFamily: DS.serif,
            fontSize: 14,
            fontStyle: 'italic',
            fontWeight: 300,
            color: DS.rust,
            background: 'transparent',
            border: `1px solid ${DS.rust}`,
            padding: '11px 0',
            cursor: signingOut ? 'not-allowed' : 'pointer',
          }}
        >
          {signingOut ? '⋯ Signing out' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  fontSize: 14,
  padding: '9px 12px',
  border: `1px solid ${DS.ink}`,
  background: DS.paper,
  color: DS.ink,
  outline: 'none',
}
