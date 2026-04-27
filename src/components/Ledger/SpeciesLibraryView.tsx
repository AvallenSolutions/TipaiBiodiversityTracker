import { useEffect, useMemo, useState } from 'react'
import { DS } from '../../lib/ledger-design'
import { useSpecies } from '../../hooks/useSpecies'
import { useAuth } from '../../context/AuthContext'
import { hasSpeciesDraft } from '../../lib/speciesDraft'
import type { Species, SightingCategory } from '../../types'
import { Mono, CatDot } from './shared'
import { MonoIcon } from '../logger/shared'
import { SpeciesEditorSheet } from './SpeciesEditorSheet'

const CATEGORY_OPTIONS: ('all' | SightingCategory)[] = [
  'all', 'mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace',
]

export function SpeciesLibraryView() {
  const { user } = useAuth()
  const { species, loading, fetchSpecies, deleteSpecies } = useSpecies()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | SightingCategory>('all')
  // Auto-resume an in-progress new-species draft so navigating away and
  // coming back picks up where the naturalist left off.
  const [editing, setEditing] = useState<Species | 'new' | null>(
    () => (hasSpeciesDraft(user?.id) ? 'new' : null),
  )
  const [deleteTarget, setDeleteTarget] = useState<Species | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If the user landed on this page before auth resolved, reopen the
  // draft as soon as the user id arrives.
  useEffect(() => {
    if (editing) return
    if (hasSpeciesDraft(user?.id)) setEditing('new')
  }, [user?.id, editing])

  // Initial + on-mount fetch. The editor sheet calls back into refresh()
  // after save/delete so changes appear immediately.
  useEffect(() => { fetchSpecies() }, [fetchSpecies])

  // Debounced search refetch (server-side ilike match).
  useEffect(() => {
    const t = setTimeout(() => fetchSpecies(undefined, search.trim() || undefined), 220)
    return () => clearTimeout(t)
  }, [search, fetchSpecies])

  // Client-side category filter on top of the server search result.
  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return species
    return species.filter(s => s.category === categoryFilter)
  }, [species, categoryFilter])

  async function handleDelete() {
    if (!deleteTarget) return
    setError(null)
    setDeleting(true)
    try {
      await deleteSpecies(deleteTarget.id)
      setDeleteTarget(null)
      fetchSpecies(undefined, search.trim() || undefined)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete species')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ padding: '28px 40px 80px', background: DS.paper, minHeight: '100vh' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        gap: 16, flexWrap: 'wrap', marginBottom: 20,
      }}>
        <div>
          <Mono size={9} color={DS.ochre}>◆ THE LIBRARY · ADMIN</Mono>
          <div style={{
            fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
            letterSpacing: '-0.025em', marginTop: 4, color: DS.ink,
          }}>
            {species.length} species on file
          </div>
          <div style={{
            fontFamily: DS.serif, fontSize: 15, fontWeight: 300, fontStyle: 'italic',
            color: DS.inkSoft, marginTop: 4,
          }}>
            Add new entries, edit names and descriptions, manage plates.
          </div>
        </div>
        <button
          onClick={() => { setError(null); setEditing('new') }}
          style={{
            background: DS.ochre, color: DS.ink, border: 'none',
            padding: '14px 22px', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em',
            textTransform: 'uppercase', fontWeight: 500,
          }}
        >
          {hasSpeciesDraft(user?.id) ? 'Resume draft →' : '+ Add new species'}
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'grid', gap: 16, marginBottom: 24,
        gridTemplateColumns: 'minmax(220px, 1fr) auto',
        alignItems: 'flex-end',
      }}>
        <div>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Search</Mono>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Common or scientific name…"
            style={{
              width: '100%', padding: '10px 12px',
              border: `0.5px solid ${DS.ink}`, background: DS.ivory,
              fontFamily: DS.serif, fontSize: 15, fontWeight: 400, color: DS.ink,
              outline: 'none',
            }}
          />
        </div>
        <div>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Category</Mono>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | SightingCategory)}
            style={{
              padding: '10px 12px', border: `0.5px solid ${DS.ink}`,
              background: DS.ivory, color: DS.ink,
              fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.15em',
              textTransform: 'uppercase', cursor: 'pointer', minWidth: 200,
            }}
          >
            {CATEGORY_OPTIONS.map(c => (
              <option key={c} value={c}>
                {c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: DS.rust, color: DS.ivory,
          fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.15em',
          marginBottom: 16, textTransform: 'uppercase',
        }}>{error}</div>
      )}

      {loading && species.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Mono size={10} color={DS.inkFaint} letter={0.25}>⋯ Loading the library</Mono>
        </div>
      )}

      <div style={{
        background: DS.ivory, border: `1px solid ${DS.ink}`,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}>
        {filtered.map(sp => (
          <SpeciesCard
            key={sp.id}
            species={sp}
            onEdit={() => { setError(null); setEditing(sp) }}
            onDelete={() => { setError(null); setDeleteTarget(sp) }}
          />
        ))}
        {filtered.length === 0 && !loading && (
          <div style={{
            gridColumn: '1 / -1', padding: '40px 28px', textAlign: 'center',
            fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft,
          }}>
            No species match these filters.
          </div>
        )}
      </div>

      {editing && (
        <SpeciesEditorSheet
          species={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchSpecies(undefined, search.trim() || undefined)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmSheet
          species={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function SpeciesCard({
  species, onEdit, onDelete,
}: {
  species: Species
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div style={{
      borderRight: `0.5px solid ${DS.inkHair}`,
      borderBottom: `0.5px solid ${DS.inkHair}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <button
        onClick={onEdit}
        style={{
          width: '100%', textAlign: 'left', padding: 0,
          background: 'transparent', border: 'none', cursor: 'pointer',
          flex: 1, display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          width: '100%', aspectRatio: '4 / 3', background: DS.bone, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {species.reference_image_url ? (
            <img
              src={species.reference_image_url}
              alt={species.common_name}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ color: DS.inkFaint, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <MonoIcon category={species.category} size={36} />
              <Mono size={8} color={DS.inkFaint} letter={0.22}>No plate</Mono>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px 8px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <CatDot cat={species.category} />
            <Mono size={8} letter={0.18} color={DS.inkSoft}>{species.category.toUpperCase()}</Mono>
            {species.is_notable && (
              <span style={{
                marginLeft: 4, padding: '1px 6px',
                fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.16em',
                color: DS.rust, border: `0.5px solid ${DS.rust}`,
                background: 'rgba(160,80,60,0.06)', textTransform: 'uppercase',
              }}>Notable</span>
            )}
          </div>
          <div style={{
            fontFamily: DS.serif, fontSize: 18, fontWeight: 400,
            color: DS.ink, letterSpacing: '-0.01em', marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{species.common_name}</div>
          {species.scientific_name && (
            <div style={{
              fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
              fontWeight: 300, color: DS.inkSoft,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{species.scientific_name}</div>
          )}
        </div>
      </button>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', borderTop: `0.5px solid ${DS.inkHair}`,
      }}>
        <button
          onClick={onEdit}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em',
            color: DS.ink, textTransform: 'uppercase', padding: '4px 0',
          }}
        >Edit →</button>
        <button
          onClick={onDelete}
          aria-label="Delete species"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em',
            color: DS.rust, textTransform: 'uppercase', padding: '4px 0',
          }}
        >× Delete</button>
      </div>
    </div>
  )
}

function DeleteConfirmSheet({
  species, deleting, onCancel, onConfirm,
}: {
  species: Species
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(11,14,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: DS.ivory, padding: '24px 26px',
          maxWidth: 460, width: '100%', border: `1px solid ${DS.rust}`,
        }}
      >
        <Mono size={10} letter={0.2} color={DS.rust}>◆ Delete species?</Mono>
        <h2 style={{
          fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
          letterSpacing: '-0.01em', margin: '12px 0 6px', color: DS.ink,
        }}>{species.common_name}</h2>
        <p style={{
          fontFamily: DS.serif, fontSize: 15, fontWeight: 300, fontStyle: 'italic',
          color: DS.inkSoft, margin: '0 0 18px', lineHeight: 1.5,
        }}>
          The library entry will be removed. Existing sightings keep their
          recorded names but lose the link to this species.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting} style={{
            padding: '14px 16px', background: 'transparent', color: DS.ink,
            border: `0.5px solid ${DS.ink}`, cursor: deleting ? 'not-allowed' : 'pointer',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{
            padding: '14px 16px', background: DS.rust, color: DS.ivory,
            border: 'none', cursor: deleting ? 'not-allowed' : 'pointer',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
            opacity: deleting ? 0.6 : 1,
          }}>{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}
