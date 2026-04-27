import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { useSpecies } from '@/hooks/useSpecies'
import {
  getPendingSightings,
  savePendingSighting,
  syncPendingSightings,
} from '@/lib/offline'
import { identifySpecies, isGeminiAvailable } from '@/lib/gemini'
import { DS, normalizeConf } from '@/lib/ledger-design'
import { Mono, MonoIcon, ConfidenceDial } from '@/components/logger/shared'
import { formatCoordinates } from '@/hooks/useGeolocation'
import type { PendingSighting, AISuggestion, Species } from '@/types'

export default function PendingSightingsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [pending, setPending] = useState<PendingSighting[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getPendingSightings()
      setPending(all)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const needsFinalization = useMemo(
    () => pending.filter(p => p.needs_finalization),
    [pending],
  )
  const readyToSync = useMemo(
    () => pending.filter(p => !p.needs_finalization),
    [pending],
  )

  const active = pending.find(p => p.id === activeId) ?? null

  async function handleFinalize(updated: PendingSighting) {
    await savePendingSighting({ ...updated, needs_finalization: false })
    await refresh()
    setActiveId(null)
  }

  async function handleSyncNow() {
    if (!profile?.id || !isOnline) return
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await syncPendingSightings(profile.id)
      const lines: string[] = []
      if (result.synced > 0) lines.push(`${result.synced} synced`)
      if (result.failed.length > 0) lines.push(`${result.failed.length} failed`)
      if (result.skipped > 0) lines.push(`${result.skipped} still need finalization`)
      setSyncMessage(lines.join(' · ') || 'Nothing to sync')
      await refresh()
    } catch (err: any) {
      setSyncMessage(err?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 20px 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <Mono size={10} letter={0.25} color={DS.ochre}>§ Reconnect · Finalize</Mono>
        <h1 style={{
          fontFamily: DS.serif, fontSize: 40, fontWeight: 200,
          letterSpacing: '-0.03em', lineHeight: 1.05,
          margin: '10px 0 14px', color: DS.ink,
        }}>
          Held <em style={{ fontWeight: 300 }}>sightings</em>.
        </h1>
        <p style={{
          fontFamily: DS.serif, fontSize: 16, fontWeight: 300,
          fontStyle: 'italic', color: DS.inkSoft, maxWidth: 540,
          lineHeight: 1.5, margin: 0,
        }}>
          Sightings you logged without signal. Confirm a species — using AI on
          the photo or picking from the library — and they'll join the logbook.
        </p>
      </div>

      {!isOnline && (
        <div style={{
          padding: '12px 14px', marginBottom: 18,
          background: DS.rust, color: DS.ivory,
        }}>
          <Mono size={10} color={DS.ivory} letter={0.2}>● Offline</Mono>
          <div style={{
            fontFamily: DS.serif, fontSize: 14, fontWeight: 300,
            fontStyle: 'italic', lineHeight: 1.5, marginTop: 4,
          }}>
            You can still pick species from the cached library, but AI
            identification needs a connection.
          </div>
        </div>
      )}

      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        border: `1px solid ${DS.ink}`, marginBottom: 28, background: DS.ivory,
      }}>
        <Stat label="Held" value={pending.length} sub="on device" />
        <Stat label="To finalize" value={needsFinalization.length} sub="awaiting species" />
        <Stat label="Ready" value={readyToSync.length} sub="will auto-sync" last />
      </div>

      {/* Sync now button */}
      {readyToSync.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', marginBottom: 22,
          border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
        }}>
          <div>
            <Mono size={10} color={DS.inkSoft} letter={0.2}>Ready to sync</Mono>
            <div style={{
              fontFamily: DS.serif, fontSize: 16, fontWeight: 400,
              color: DS.ink, marginTop: 2,
            }}>
              {readyToSync.length} entr{readyToSync.length === 1 ? 'y' : 'ies'} can upload now
            </div>
          </div>
          <button
            onClick={handleSyncNow}
            disabled={syncing || !isOnline}
            style={{
              background: isOnline ? DS.ochre : DS.inkFaint, color: DS.ink,
              border: 'none', padding: '12px 18px',
              cursor: syncing || !isOnline ? 'not-allowed' : 'pointer',
              fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.25em',
              textTransform: 'uppercase', fontWeight: 500,
              opacity: syncing ? 0.5 : 1,
            }}
          >
            {syncing ? 'Syncing…' : 'Sync now →'}
          </button>
        </div>
      )}

      {syncMessage && (
        <div style={{
          padding: '8px 12px', marginBottom: 18,
          background: DS.forest, color: DS.ivory,
        }}>
          <Mono size={10} color={DS.ivory} letter={0.2}>{syncMessage}</Mono>
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Mono size={10} color={DS.inkFaint} letter={0.25}>⋯ Reading the device</Mono>
        </div>
      )}

      {!loading && pending.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          border: `0.5px dashed ${DS.inkFaint}`,
        }}>
          <h3 style={{
            fontFamily: DS.serif, fontSize: 24, fontWeight: 300,
            fontStyle: 'italic', color: DS.ink, margin: 0,
          }}>Nothing held.</h3>
          <p style={{
            fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic',
            color: DS.inkSoft, margin: '10px 0 22px', fontWeight: 300,
          }}>
            All your sightings have been entered into the logbook.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent', color: DS.ink,
              border: `0.5px solid ${DS.ink}`, padding: '10px 20px', cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.25em',
              textTransform: 'uppercase',
            }}
          >Back to the feed</button>
        </div>
      )}

      {!loading && pending.length > 0 && (
        <div style={{ display: 'grid', gap: 0 }}>
          {pending.map((p, i) => (
            <PendingRow
              key={p.id}
              pending={p}
              num={pending.length - i}
              onClick={() => setActiveId(p.id)}
            />
          ))}
        </div>
      )}

      {active && (
        <FinalizeSheet
          pending={active}
          isOnline={isOnline}
          onClose={() => setActiveId(null)}
          onFinalize={handleFinalize}
        />
      )}
    </div>
  )
}

function Stat({ label, value, sub, last }: { label: string; value: number; sub?: string; last?: boolean }) {
  return (
    <div style={{
      padding: '14px 14px',
      borderRight: last ? 'none' : `0.5px solid ${DS.inkHair}`,
    }}>
      <Mono size={9} letter={0.22} color={DS.inkSoft}>{label}</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
        letterSpacing: '-0.03em', color: DS.ink, lineHeight: 1.1,
        margin: '4px 0 2px',
      }}>{value}</div>
      {sub && <Mono size={8} letter={0.18} color={DS.inkFaint}>{sub}</Mono>}
    </div>
  )
}

function usePhotoUrl(media: PendingSighting['media']): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const photo = media.find(m => m.type === 'photo')
    if (!photo) { setUrl(null); return }
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [media])
  return url
}

function PendingRow({
  pending, num, onClick,
}: {
  pending: PendingSighting
  num: number
  onClick: () => void
}) {
  const url = usePhotoUrl(pending.media)
  const when = format(new Date(pending.sighted_at), 'd MMM · HH:mm')
  const needs = pending.needs_finalization

  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '96px 1fr auto',
        gap: 16, alignItems: 'stretch',
        background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        padding: '14px 6px', borderTop: `0.5px solid ${DS.inkHair}`,
        color: DS.ink, width: '100%',
      }}
    >
      <div style={{
        width: 96, height: 96,
        background: url ? undefined : DS.bone,
        position: 'relative', overflow: 'hidden',
      }}>
        {url ? (
          <img src={url} alt="Held sighting"
               style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: DS.inkFaint,
          }}>
            <MonoIcon category={pending.category} size={32} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <Mono size={9} letter={0.2} color={DS.inkSoft}>
          № {String(num).padStart(4, '0')} · {when}
        </Mono>
        <div style={{
          fontFamily: DS.serif, fontSize: 18, fontWeight: 400,
          letterSpacing: '-0.01em', lineHeight: 1.15, color: DS.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pending.common_name || (needs ? 'Needs identification' : 'Unidentified')}
        </div>
        {pending.scientific_name && (
          <div style={{
            fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
            fontWeight: 300, color: DS.inkSoft,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{pending.scientific_name}</div>
        )}
        <Mono size={9} letter={0.12} color={DS.inkFaint} style={{ marginTop: 2 }}>
          {formatCoordinates(pending.latitude, pending.longitude)}
        </Mono>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{
          padding: '4px 8px',
          background: needs ? DS.rust : DS.forest,
          color: DS.ivory,
          fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          {needs ? 'Finalize' : 'Ready'}
        </span>
      </div>
    </button>
  )
}

// ─── Finalize bottom sheet ─────────────────────────────────────────────

function FinalizeSheet({
  pending, isOnline, onClose, onFinalize,
}: {
  pending: PendingSighting
  isOnline: boolean
  onClose: () => void
  onFinalize: (updated: PendingSighting) => void | Promise<void>
}) {
  const url = usePhotoUrl(pending.media)
  const { species, fetchSpecies } = useSpecies()

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>(pending.ai_suggestions ?? [])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [commonName, setCommonName] = useState<string>(pending.common_name ?? '')
  const [scientificName, setScientificName] = useState<string>(pending.scientific_name ?? '')
  const [linkedSpeciesId, setLinkedSpeciesId] = useState<string | null>(pending.species_id)
  const [confidence, setConfidence] = useState<number | null>(pending.ai_confidence)

  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => fetchSpecies(undefined, search.trim() || undefined), 200)
    return () => clearTimeout(t)
  }, [search, fetchSpecies])

  async function runAI() {
    const photo = pending.media.find(m => m.type === 'photo')
    if (!photo) {
      setAiError('No photo on this sighting — pick a species manually.')
      return
    }
    if (!isGeminiAvailable()) {
      setAiError('AI is not configured.')
      return
    }
    if (!isOnline) {
      setAiError('Offline — connect to use AI identification.')
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const suggestions = await identifySpecies(photo.blob, pending.category)
      setAiSuggestions(suggestions)
    } catch (err: any) {
      setAiError(err?.message || String(err))
    } finally {
      setAiLoading(false)
    }
  }

  function pickSuggestion(s: AISuggestion) {
    setCommonName(s.common_name ?? '')
    setScientificName(s.scientific_name ?? '')
    setConfidence(s.confidence)
    setLinkedSpeciesId(null)
  }

  function pickLibrary(sp: Species) {
    setCommonName(sp.common_name)
    setScientificName(sp.scientific_name ?? '')
    setLinkedSpeciesId(sp.id)
    setConfidence(1)
  }

  function clearSelection() {
    setCommonName('')
    setScientificName('')
    setLinkedSpeciesId(null)
    setConfidence(null)
  }

  const matches = search.trim()
    ? species.slice(0, 8)
    : species.slice(0, 6)

  const canFinalize = !!commonName.trim()

  function submit() {
    if (!canFinalize) return
    onFinalize({
      ...pending,
      common_name: commonName.trim() || null,
      scientific_name: scientificName.trim() || null,
      species_id: linkedSpeciesId,
      ai_suggestions: aiSuggestions.length > 0 ? aiSuggestions : pending.ai_suggestions,
      ai_confidence: confidence,
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(11,14,12,0.55)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: DS.ivory, padding: '16px 20px max(40px, env(safe-area-inset-bottom))',
          maxHeight: '92vh', overflowY: 'auto', borderRadius: '14px 14px 0 0',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 10, borderBottom: `1px solid ${DS.ink}`,
        }}>
          <Mono size={10} letter={0.22} color={DS.ochre}>◆ Finalize entry</Mono>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
            color: DS.inkSoft, textTransform: 'uppercase',
          }}>Close</button>
        </div>

        {/* Photo */}
        {url && (
          <div style={{
            margin: '14px 0', background: DS.bone,
            display: 'flex', justifyContent: 'center',
          }}>
            <img src={url} alt="Sighting"
                 style={{ width: '100%', height: 'auto', maxHeight: '34vh', objectFit: 'contain' }} />
          </div>
        )}

        {/* Current pick */}
        <div style={{
          padding: '10px 12px', marginBottom: 14,
          border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
        }}>
          <Mono size={9} letter={0.2} color={DS.inkSoft}>Current identification</Mono>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{
              fontFamily: DS.serif, fontSize: 20, fontWeight: 400, color: DS.ink,
            }}>
              {commonName || <em style={{ fontWeight: 300, color: DS.inkSoft }}>Not yet identified</em>}
            </span>
            {confidence != null && commonName && (
              <ConfidenceDial value={normalizeConf(confidence)} size={28} stroke={1.2} />
            )}
          </div>
          {scientificName && (
            <div style={{
              fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
              fontWeight: 300, color: DS.inkSoft, marginTop: 2,
            }}>{scientificName}</div>
          )}
          {commonName && (
            <button onClick={clearSelection} style={{
              marginTop: 8, background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.18em',
              color: DS.rust, textTransform: 'uppercase', padding: 0,
            }}>Clear</button>
          )}
        </div>

        {/* AI section */}
        <div style={{ paddingBottom: 12, borderBottom: `0.5px solid ${DS.inkHair}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Mono size={9} letter={0.2} color={DS.inkSoft}>① Identify with AI</Mono>
            <button
              onClick={runAI}
              disabled={aiLoading || !isOnline}
              style={{
                background: isOnline ? DS.ink : DS.inkFaint, color: DS.ivory,
                border: 'none', padding: '8px 14px',
                cursor: aiLoading || !isOnline ? 'not-allowed' : 'pointer',
                fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em',
                textTransform: 'uppercase', fontWeight: 500,
                opacity: aiLoading ? 0.6 : 1,
              }}
            >
              {aiLoading ? 'Reading…' : aiSuggestions.length > 0 ? 'Run again' : 'Run AI'}
            </button>
          </div>

          {aiError && (
            <div style={{ marginTop: 8 }}>
              <Mono size={9} color={DS.rust} letter={0.15} style={{ lineHeight: 1.5 }}>
                {aiError}
              </Mono>
            </div>
          )}

          {aiSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
              {aiSuggestions.map((s, i) => {
                const pct = Math.round(normalizeConf(s.confidence) * 100)
                const picked = commonName === s.common_name && !linkedSpeciesId
                return (
                  <button
                    key={`${s.common_name}-${i}`}
                    onClick={() => pickSuggestion(s)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 10, padding: '10px 0', textAlign: 'left',
                      background: 'transparent', border: 'none',
                      borderBottom: `0.5px solid ${DS.inkHair}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontFamily: DS.serif, fontSize: 16, fontWeight: 400,
                        color: DS.ink, letterSpacing: '-0.01em',
                      }}>
                        {s.common_name}
                        {picked && <span style={{ marginLeft: 8, color: DS.ochre, fontFamily: DS.mono, fontSize: 9 }}>✓ picked</span>}
                      </div>
                      {s.scientific_name && (
                        <div style={{
                          fontFamily: DS.serif, fontSize: 12, fontStyle: 'italic',
                          fontWeight: 300, color: DS.inkSoft,
                        }}>{s.scientific_name}</div>
                      )}
                    </div>
                    {pct > 0 && (
                      <Mono size={9} color={DS.inkSoft} letter={0.18}>{pct}%</Mono>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Library section */}
        <div style={{ paddingTop: 14 }}>
          <Mono size={9} letter={0.2} color={DS.inkSoft}>② Or pick from the library</Mono>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search species…"
            style={{
              width: '100%', padding: '10px 12px', marginTop: 8,
              border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
              fontFamily: DS.serif, fontSize: 15, fontWeight: 400,
              color: DS.ink, outline: 'none',
            }}
          />
          {matches.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {matches.map(sp => {
                const picked = linkedSpeciesId === sp.id
                return (
                  <button
                    key={sp.id}
                    onClick={() => pickLibrary(sp)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 10, padding: '10px 0', textAlign: 'left',
                      borderBottom: `0.5px solid ${DS.inkHair}`,
                      background: 'transparent', border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontFamily: DS.serif, fontSize: 15, fontWeight: 400, color: DS.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {sp.common_name}
                        {picked && <span style={{ marginLeft: 6, color: DS.ochre, fontFamily: DS.mono, fontSize: 9 }}>✓</span>}
                      </div>
                      {sp.scientific_name && (
                        <div style={{
                          fontFamily: DS.serif, fontSize: 12, fontStyle: 'italic',
                          fontWeight: 300, color: DS.inkSoft,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{sp.scientific_name}</div>
                      )}
                    </div>
                    <Mono size={8} letter={0.18} color={DS.inkFaint}>{sp.category.toUpperCase()}</Mono>
                  </button>
                )
              })}
            </div>
          ) : (
            <Mono size={9} color={DS.inkFaint} letter={0.18} style={{ display: 'block', marginTop: 10 }}>
              {search.trim() ? 'No matches in the library' : 'Type to search the library'}
            </Mono>
          )}
        </div>

        {/* Manual entry */}
        <div style={{ paddingTop: 18 }}>
          <Mono size={9} letter={0.2} color={DS.inkSoft}>③ Or write the species by hand</Mono>
          <input
            value={commonName}
            onChange={(e) => { setCommonName(e.target.value); setLinkedSpeciesId(null) }}
            placeholder="Common name"
            style={{
              width: '100%', padding: '10px 12px', marginTop: 8,
              border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
              fontFamily: DS.serif, fontSize: 15, fontWeight: 400,
              color: DS.ink, outline: 'none',
            }}
          />
          <input
            value={scientificName}
            onChange={(e) => setScientificName(e.target.value)}
            placeholder="Scientific name (optional)"
            style={{
              width: '100%', padding: '10px 12px', marginTop: 8,
              border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
              fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic',
              fontWeight: 300, color: DS.ink, outline: 'none',
            }}
          />
        </div>

        <button
          onClick={submit}
          disabled={!canFinalize}
          style={{
            marginTop: 22, width: '100%', padding: '16px 18px',
            background: canFinalize ? DS.ochre : DS.inkFaint, color: DS.ink, border: 'none',
            cursor: canFinalize ? 'pointer' : 'not-allowed',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em',
            textTransform: 'uppercase', fontWeight: 500,
          }}
        >
          Finalize · queue for sync
        </button>
        <Mono size={8} letter={0.2} color={DS.inkFaint} style={{
          display: 'block', marginTop: 8, textAlign: 'center',
        }}>
          Finalized entries upload automatically when you sync.
        </Mono>
      </div>
    </div>
  )
}
