import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Profile, UserRole } from '@/types'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'

const ROLES: UserRole[] = ['guest', 'staff', 'naturalist', 'admin']

export default function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await (supabase.from('profiles') as any)
      .select('*')
      .order('created_at', { ascending: false })
    setUsers((data || []) as Profile[])
    setLoading(false)
  }

  async function updateRole(userId: string, newRole: UserRole) {
    setSaving(userId)
    setError(null)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ role: newRole })
        .eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      const { error } = await (supabase.rpc as any)('admin_delete_user', {
        target_user_id: deleteTarget.id,
      })
      if (error) throw error
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const roleColor: Record<UserRole, string> = {
    guest: DS.inkSoft,
    staff: DS.forest,
    naturalist: DS.ochre,
    admin: DS.rust,
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>

      <div style={{
        borderTop: `3px double ${DS.ink}`,
        paddingTop: 12,
        marginBottom: 28,
      }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ Wildlife Luxuries / Admin</Mono>
        <h1 style={{
          fontFamily: DS.serif,
          fontSize: 28,
          fontWeight: 300,
          letterSpacing: '-0.02em',
          margin: '6px 0 2px',
          color: DS.ink,
        }}>
          User Management
        </h1>
        <p style={{
          fontFamily: DS.serif,
          fontSize: 13,
          fontStyle: 'italic',
          color: DS.inkSoft,
          margin: 0,
        }}>
          {users.length} account{users.length === 1 ? '' : 's'} — assign roles or remove users
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

      {loading ? (
        <Mono size={10} letter={0.22} color={DS.inkSoft}>Loading…</Mono>
      ) : (
        <div style={{ border: `1px solid ${DS.inkHair}`, borderBottom: 'none' }}>
          {users.map(u => {
            const isSelf = u.id === user?.id
            return (
              <div key={u.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderBottom: `1px solid ${DS.inkHair}`,
                background: isSelf ? `${DS.ochre}18` : 'transparent',
              }}>
                {/* Role indicator dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                  background: roleColor[u.role],
                }} />

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: DS.serif,
                    fontSize: 15,
                    fontWeight: 300,
                    color: DS.ink,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {u.display_name || u.email}
                    {isSelf && (
                      <span style={{
                        fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.15em',
                        color: DS.ochre, marginLeft: 8,
                      }}>YOU</span>
                    )}
                  </p>
                  <p style={{
                    fontFamily: DS.mono,
                    fontSize: 10,
                    letterSpacing: '0.05em',
                    color: DS.inkSoft,
                    margin: 0,
                  }}>
                    {u.email}
                  </p>
                </div>

                {/* Role selector */}
                <select
                  value={u.role}
                  onChange={e => updateRole(u.id, e.target.value as UserRole)}
                  disabled={!!saving}
                  style={{
                    fontFamily: DS.mono,
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    padding: '5px 8px',
                    border: `1px solid ${DS.ink}`,
                    background: DS.paper,
                    color: DS.ink,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {saving === u.id && (
                  <Mono size={9} letter={0.22} color={DS.inkSoft}>saving…</Mono>
                )}

                {/* Delete — not available for your own account */}
                {!isSelf && (
                  <button
                    onClick={() => setDeleteTarget(u)}
                    style={{
                      fontFamily: DS.mono,
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: DS.rust,
                      background: 'transparent',
                      border: `1px solid ${DS.rust}`,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: DS.paper,
            border: `1px solid ${DS.ink}`,
            maxWidth: 380, width: '100%',
            padding: 28,
          }}>
            <Mono size={9} letter={0.22} color={DS.rust} style={{ marginBottom: 12 }}>
              ◆ Confirm removal
            </Mono>
            <p style={{
              fontFamily: DS.serif,
              fontSize: 16,
              fontWeight: 300,
              lineHeight: 1.5,
              color: DS.ink,
              margin: '0 0 6px',
            }}>
              Remove <strong style={{ fontWeight: 400 }}>{deleteTarget.display_name || deleteTarget.email}</strong>?
            </p>
            <p style={{
              fontFamily: DS.serif,
              fontSize: 13,
              fontStyle: 'italic',
              color: DS.inkSoft,
              margin: '0 0 24px',
            }}>
              This permanently deletes their account and all associated data. It cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  flex: 1,
                  fontFamily: DS.serif,
                  fontSize: 14,
                  fontStyle: 'italic',
                  fontWeight: 300,
                  color: DS.ink,
                  background: 'transparent',
                  border: `1px solid ${DS.ink}`,
                  padding: '10px 0',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  fontFamily: DS.serif,
                  fontSize: 14,
                  fontStyle: 'italic',
                  fontWeight: 300,
                  color: DS.ivory,
                  background: deleting ? DS.inkSoft : DS.rust,
                  border: 'none',
                  padding: '10px 0',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? '⋯ Removing' : 'Remove permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
