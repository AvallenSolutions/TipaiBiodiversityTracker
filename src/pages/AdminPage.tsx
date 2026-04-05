import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'
import { Shield, Save, Loader2 } from 'lucide-react'

const ROLES: UserRole[] = ['guest', 'staff', 'naturalist', 'admin']

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await (supabase.from('profiles') as any).select('*').order('created_at', { ascending: false })
    setUsers((data || []) as Profile[])
    setLoading(false)
  }

  async function updateRole(userId: string, newRole: UserRole) {
    setSaving(userId)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ role: newRole })
        .eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-tipai-700" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">{users.length} users</p>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-tipai-700 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map(user => (
              <div key={user.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{user.display_name || user.email}</p>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.role}
                    onChange={e => updateRole(user.id, e.target.value as UserRole)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-tipai-500"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                  {saving === user.id && <Loader2 className="w-4 h-4 animate-spin text-tipai-600" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
