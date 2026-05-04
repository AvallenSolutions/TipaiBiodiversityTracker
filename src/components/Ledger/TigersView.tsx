import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { DS } from '../../lib/ledger-design'
import { getMediaUrl } from '../../lib/storage'
import { useTigerIndividuals } from '../../hooks/useTigerIndividuals'
import { useAuth } from '../../context/AuthContext'
import { PARK_LABEL } from '../../types'
import type { Sighting, TigerIndividual } from '../../types'
import { Mono } from './shared'
import { ReserveMap } from './ReserveMap'

// Top-level Tigers tab in the Ledger. Lists every named tiger with its
// sighting count, last seen and a thumbnail; clicking through opens a
// per-tiger record with the full timeline, a small map, and the photos.
//
// Naturalists and admins can also rename or delete a tiger here. The
// rename flow is the easy fix-up for typos and casing; deleting clears
// the FK on linked sightings (ON DELETE SET NULL) so no records are lost,
// they just become "unidentified individual" again.

interface Stats {
  count: number
  firstSeen: Date | null
  lastSeen: Date | null
  lastObserver: string | null
  coverPhoto: string | null
}

function statsForTiger(tigerId: string, sightings: Sighting[]): Stats {
  const matching = sightings.filter(s => s.tiger_id === tigerId)
  if (matching.length === 0) {
    return { count: 0, firstSeen: null, lastSeen: null, lastObserver: null, coverPhoto: null }
  }
  const sorted = [...matching].sort(
    (a, b) => new Date(b.sighted_at).getTime() - new Date(a.sighted_at).getTime(),
  )
  const last = sorted[0]!
  const first = sorted[sorted.length - 1]!
  // Pick the cover photo from the most recent sighting that has one.
  let cover: string | null = null
  for (const s of sorted) {
    const photo = s.media?.find(m => m.media_type === 'photo')
    if (photo) { cover = getMediaUrl(photo.storage_path); break }
  }
  return {
    count: matching.length,
    firstSeen: new Date(first.sighted_at),
    lastSeen: new Date(last.sighted_at),
    lastObserver: last.profile?.display_name || last.profile?.email || null,
    coverPhoto: cover,
  }
}

export function TigersView({
  sightings, onOpenSighting, selectedTiger, onSelectTiger, onBack,
}: {
  sightings: Sighting[]
  onOpenSighting: (s: Sighting) => void
  selectedTiger: TigerIndividual | null
  onSelectTiger: (t: TigerIndividual | null) => void
  onBack: () => void
}) {
  const { profile } = useAuth()
  const { tigers, loading, updateTiger, deleteTiger } = useTigerIndividuals()
  const canManage = profile?.role === 'naturalist' || profile?.role === 'admin'

  if (selectedTiger) {
    return (
      <TigerRecord
        tiger={selectedTiger}
        sightings={sightings}
        canManage={canManage}
        onOpenSighting={onOpenSighting}
        onBack={() => onSelectTiger(null)}
        onRename={async name => {
          const updated = await updateTiger(selectedTiger.id, { name })
          onSelectTiger(updated)
        }}
        onDelete={async () => {
          await deleteTiger(selectedTiger.id)
          onSelectTiger(null)
        }}
      />
    )
  }

  const enriched = tigers.map(t => ({ tiger: t, stats: statsForTiger(t.id, sightings) }))
    .sort((a, b) => b.stats.count - a.stats.count)

  return (
    <div style={{
      padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 40px) clamp(40px, 8vw, 80px)',
      background: DS.paper, minHeight: '100vh',
    }}>
      <button onClick={onBack} style={backBtn}>← Front desk</button>

      <div style={{ marginTop: 18, marginBottom: 24 }}>
        <Mono size={9} color={DS.ochre}>◆ §00 · NAMED INDIVIDUALS</Mono>
        <h2 style={{
          fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
          letterSpacing: '-0.02em', margin: '6px 0 4px', color: DS.ink,
        }}>{tigers.length} tiger{tigers.length === 1 ? '' : 's'} on record</h2>
        <p style={{
          fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic',
          color: DS.inkSoft, margin: 0, maxWidth: 540, lineHeight: 1.5,
        }}>
          Each tiger is built from sightings where an observer matched the
          individual. Tap a card for the full timeline, location map and photos.
        </p>
      </div>

      {loading && (
        <Mono size={10} color={DS.inkFaint} letter={0.22}>⋯ Loading tigers</Mono>
      )}

      {!loading && tigers.length === 0 && (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          border: `0.5px dashed ${DS.inkFaint}`, background: DS.ivory,
        }}>
          <h3 style={{
            fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
            fontStyle: 'italic', color: DS.ink, margin: 0,
          }}>No tigers named yet.</h3>
          <p style={{
            fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic',
            color: DS.inkSoft, margin: '10px 0 0',
          }}>
            When an observer logs a tiger sighting and gives the individual a
            name, it'll appear here.
          </p>
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14,
      }}>
        {enriched.map(({ tiger, stats }) => (
          <button
            key={tiger.id}
            onClick={() => onSelectTiger(tiger)}
            style={{
              background: DS.ivory, border: `0.5px solid ${DS.ink}`,
              cursor: 'pointer', textAlign: 'left', padding: 0,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              width: '100%', aspectRatio: '4 / 3', background: DS.bone,
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {stats.coverPhoto ? (
                <img
                  src={stats.coverPhoto}
                  alt={tiger.name}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Mono size={9} color={DS.inkFaint} letter={0.22}>No photo on file</Mono>
              )}
            </div>
            <div style={{ padding: '14px 16px 16px' }}>
              <Mono size={8} color={DS.ochre} letter={0.22}>◆ TIGER</Mono>
              <div style={{
                fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
                color: DS.ink, letterSpacing: '-0.01em', margin: '4px 0 6px',
              }}>{tiger.name}</div>
              <Mono size={9} color={DS.inkSoft} letter={0.12}>
                {stats.count} sighting{stats.count === 1 ? '' : 's'}
                {stats.lastSeen && ` · last ${format(stats.lastSeen, 'd MMM yyyy')}`}
              </Mono>
              {stats.lastObserver && (
                <Mono size={9} color={DS.inkFaint} letter={0.12} style={{ marginTop: 2 }}>
                  by {stats.lastObserver}
                </Mono>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function TigerRecord({
  tiger, sightings, canManage, onOpenSighting, onBack, onRename, onDelete,
}: {
  tiger: TigerIndividual
  sightings: Sighting[]
  canManage: boolean
  onOpenSighting: (s: Sighting) => void
  onBack: () => void
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const matching = useMemo(() =>
    sightings
      .filter(s => s.tiger_id === tiger.id)
      .sort((a, b) => new Date(b.sighted_at).getTime() - new Date(a.sighted_at).getTime()),
    [sightings, tiger.id],
  )

  const stats = useMemo(() => statsForTiger(tiger.id, sightings), [tiger.id, sightings])

  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(tiger.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleRename() {
    if (!newName.trim() || newName.trim() === tiger.name) {
      setEditing(false); return
    }
    setBusy(true); setError(null)
    try {
      await onRename(newName.trim())
      setEditing(false)
    } catch (err: any) {
      setError(err?.message || 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${tiger.name}? Linked sightings stay but their tiger field will be cleared.`)) return
    setBusy(true); setError(null)
    try {
      await onDelete()
    } catch (err: any) {
      setError(err?.message || 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <div style={{
      padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 40px) clamp(40px, 8vw, 80px)',
      background: DS.paper, minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={backBtn}>← All tigers</button>
        {canManage && !editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setNewName(tiger.name); setEditing(true) }} style={editBtn}>Rename →</button>
            <button onClick={handleDelete} disabled={busy} style={deleteBtn}>× Delete</button>
          </div>
        )}
      </div>

      <Mono size={9} color={DS.ochre}>◆ TIGER · INDIVIDUAL RECORD</Mono>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, marginBottom: 18 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            style={{
              fontFamily: DS.serif, fontSize: 36, fontWeight: 200,
              letterSpacing: '-0.02em', color: DS.ink, padding: '4px 8px',
              border: `0.5px solid ${DS.ink}`, background: DS.ivory, outline: 'none',
            }}
          />
          <button onClick={handleRename} disabled={busy} style={editBtn}>Save</button>
          <button onClick={() => setEditing(false)} disabled={busy} style={cancelBtn}>Cancel</button>
        </div>
      ) : (
        <h1 style={{
          fontFamily: DS.serif, fontSize: 44, fontWeight: 200,
          letterSpacing: '-0.025em', margin: '6px 0 18px', color: DS.ink,
        }}>{tiger.name}</h1>
      )}

      {error && (
        <div style={{
          padding: '10px 14px', background: DS.rust, color: DS.ivory,
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em', marginBottom: 18,
        }}>{error}</div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        background: DS.ivory, border: `0.5px solid ${DS.ink}`, marginBottom: 28,
      }}>
        {[
          ['SIGHTINGS', String(stats.count)],
          ['FIRST SEEN', stats.firstSeen ? format(stats.firstSeen, 'd MMM yyyy') : '—'],
          ['LAST SEEN', stats.lastSeen ? format(stats.lastSeen, 'd MMM yyyy') : '—'],
        ].map(([k, v], i, arr) => (
          <div key={k} style={{
            padding: '16px 18px',
            borderRight: i < arr.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
          }}>
            <Mono size={9} color={DS.inkSoft} letter={0.18}>{k}</Mono>
            <div style={{
              fontFamily: DS.serif, fontSize: 24, fontWeight: 300,
              color: DS.ink, letterSpacing: '-0.01em', marginTop: 4,
            }}>{v}</div>
          </div>
        ))}
      </div>

      {matching.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <Mono size={9} color={DS.ochre}>◆ §02 · TERRITORY</Mono>
          <ReserveMap sightings={matching} onOpenSighting={onOpenSighting} />
        </div>
      )}

      <Mono size={9} color={DS.ochre}>◆ §03 · TIMELINE</Mono>
      <div style={{
        background: DS.ivory, border: `0.5px solid ${DS.ink}`, marginTop: 10,
      }}>
        {matching.length === 0 && (
          <div style={{ padding: '24px 28px', fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft }}>
            No sightings linked to this tiger yet.
          </div>
        )}
        {matching.map((s, i) => {
          const photo = s.media?.find(m => m.media_type === 'photo')
          const photoUrl = photo ? getMediaUrl(photo.storage_path) : null
          const observer = s.profile?.display_name || s.profile?.email || 'Observer'
          return (
            <button
              key={s.id}
              onClick={() => onOpenSighting(s)}
              style={{
                display: 'grid', gridTemplateColumns: '64px 1fr auto',
                gap: 14, alignItems: 'center', width: '100%', textAlign: 'left',
                background: 'transparent', cursor: 'pointer', border: 'none',
                borderBottom: i < matching.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                padding: '14px 18px',
              }}
            >
              <div style={{ width: 64, height: 64, background: DS.bone, overflow: 'hidden' }}>
                {photoUrl && <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: DS.serif, fontSize: 17, fontWeight: 300, color: DS.ink }}>
                  {format(new Date(s.sighted_at), 'd MMM yyyy · HH:mm')}
                </div>
                <Mono size={9} letter={0.12} color={DS.inkSoft} style={{ marginTop: 2 }}>
                  by {observer.toUpperCase()}
                  {s.park && ` · ${PARK_LABEL[s.park]}`}
                  {s.latitude != null && s.longitude != null
                    && ` · ${s.latitude.toFixed(4)}°N · ${s.longitude.toFixed(4)}°E`}
                </Mono>
                {s.notes && (
                  <div style={{
                    fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
                    color: DS.inkSoft, marginTop: 4, lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.notes}</div>
                )}
              </div>
              <Mono size={9} color={DS.ochre}>→</Mono>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const backBtn: React.CSSProperties = {
  background: 'transparent', color: DS.ink, border: `0.5px solid ${DS.inkFaint}`,
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  padding: '6px 12px', cursor: 'pointer',
}
const editBtn: React.CSSProperties = {
  background: DS.ochre, color: DS.ink, border: 'none',
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
  padding: '8px 14px', cursor: 'pointer',
}
const deleteBtn: React.CSSProperties = {
  background: 'transparent', color: DS.rust, border: `0.5px solid ${DS.rust}`,
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
  padding: '8px 14px', cursor: 'pointer',
}
const cancelBtn: React.CSSProperties = {
  background: 'transparent', color: DS.inkSoft, border: `0.5px solid ${DS.inkFaint}`,
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
  padding: '8px 14px', cursor: 'pointer',
}
