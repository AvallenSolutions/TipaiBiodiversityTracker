import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTigerIndividuals, isTigerSighting } from '@/hooks/useTigerIndividuals'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import type { Sighting, TigerIndividual } from '@/types'

interface Props {
  sighting: Sighting
  // Called after a successful update with the new tiger_id and the joined
  // tiger record (or null when "unnamed" is picked). Parent uses this to
  // refresh its local copy without a round-trip refetch.
  onUpdated: (patch: { tiger_id: string | null; tiger: TigerIndividual | null }) => void
}

/**
 * Renders the "Individual tiger" row on a sighting detail page and lets
 * the owner (or any naturalist / admin) backfill or change the named
 * individual after the sighting was already logged. Hidden entirely
 * when the sighting isn't a tiger.
 */
export function TigerInlineEditor({ sighting, onUpdated }: Props) {
  const { user, profile } = useAuth()
  const { tigers, createTiger } = useTigerIndividuals()

  const [editing, setEditing] = useState(false)
  const [pickedTigerId, setPickedTigerId] = useState<string | null>(sighting.tiger_id)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isTigerSighting({
    category: sighting.category,
    common_name: sighting.common_name,
    scientific_name: sighting.scientific_name,
  })) {
    return null
  }

  // RLS allows owner-update + naturalist/admin-update-any. Hide the edit
  // affordance for guests viewing someone else's sighting so they don't
  // see a "Change" button that would just error.
  const canEdit =
    user?.id === sighting.user_id ||
    profile?.role === 'naturalist' ||
    profile?.role === 'admin'

  const currentName = sighting.tiger?.name ?? null

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      let tigerIdToSet: string | null = pickedTigerId
      let tigerObj: TigerIndividual | null = null

      if (addingNew) {
        if (!newName.trim()) {
          throw new Error('Type a name for the new tiger or pick an existing one.')
        }
        const tiger = await createTiger(newName.trim(), null, user?.id ?? null)
        tigerIdToSet = tiger.id
        tigerObj = tiger
      } else if (pickedTigerId) {
        tigerObj = tigers.find(t => t.id === pickedTigerId) ?? null
      }

      const { error: updateError } = await (supabase.from('sightings') as any)
        .update({ tiger_id: tigerIdToSet })
        .eq('id', sighting.id)
      if (updateError) throw updateError

      onUpdated({ tiger_id: tigerIdToSet, tiger: tigerObj })
      setEditing(false)
      setAddingNew(false)
      setNewName('')
    } catch (err: any) {
      setError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setEditing(false)
    setAddingNew(false)
    setNewName('')
    setPickedTigerId(sighting.tiger_id)
    setError(null)
  }

  if (!editing) {
    return (
      <div style={{ padding: '12px 0', borderBottom: `1px solid ${DS.ink}`, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <Mono size={9} letter={0.22} color={DS.ochre}>Individual tiger</Mono>
          {canEdit && (
            <button onClick={() => setEditing(true)} style={editLink}>
              {currentName ? 'Change' : '＋ Add name'}
            </button>
          )}
        </div>
        <div style={{
          fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
          margin: '4px 0 0', color: DS.ink, letterSpacing: '-0.01em',
        }}>
          {currentName ?? <em style={{ fontSize: 16, color: DS.inkSoft }}>Not named</em>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${DS.ink}`, marginBottom: 24 }}>
      <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 8 }}>
        Individual tiger
      </Mono>
      <select
        value={addingNew ? '__new__' : (pickedTigerId ?? '')}
        onChange={e => {
          const v = e.target.value
          if (v === '__new__') { setAddingNew(true); setPickedTigerId(null) }
          else { setAddingNew(false); setPickedTigerId(v || null) }
        }}
        style={{
          width: '100%', padding: '10px 8px', marginBottom: 10,
          border: `0.5px solid ${DS.inkFaint}`, background: 'transparent',
          fontFamily: DS.serif, fontSize: 16, color: DS.ink, outline: 'none',
        }}
      >
        <option value="">— Unnamed —</option>
        {tigers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        <option value="__new__">＋ Name a new tiger…</option>
      </select>
      {addingNew && (
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Name this tiger (e.g. Maya)"
          autoFocus
          style={{
            width: '100%', padding: '8px 0', marginBottom: 10,
            border: 'none', borderBottom: `0.5px solid ${DS.ink}`,
            background: 'transparent',
            fontFamily: DS.serif, fontSize: 16, color: DS.ink, outline: 'none',
          }}
        />
      )}
      {error && (
        <div style={{
          padding: '8px 12px', marginBottom: 10,
          background: DS.rust, color: DS.ivory,
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.1em',
        }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving || (addingNew && !newName.trim())}
          style={{
            flex: 1, padding: '10px 0',
            background: (saving || (addingNew && !newName.trim())) ? DS.inkFaint : DS.ochre,
            color: DS.ink, border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            flex: 1, padding: '10px 0',
            background: 'transparent', color: DS.inkSoft,
            border: `0.5px solid ${DS.inkFaint}`,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          }}
        >Cancel</button>
      </div>
    </div>
  )
}

const editLink: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
  fontWeight: 600, color: DS.ochre, padding: 0,
}
