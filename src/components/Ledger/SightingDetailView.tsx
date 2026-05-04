import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { DS, normalizeConf } from '../../lib/ledger-design'
import { supabase } from '../../lib/supabase'
import { getMediaUrl } from '../../lib/storage'
import { useSpecies } from '../../hooks/useSpecies'
import { useSightings } from '../../hooks/useSightings'
import { useAuth } from '../../context/AuthContext'
import { PARK_LABEL } from '../../types'
import type { Sighting, SightingCategory } from '../../types'
import { Mono, PhotoPlaceholder } from './shared'
import { TigerInlineEditor } from '../TigerInlineEditor'

function confidenceWord(conf: number): string {
  if (conf >= 0.8) return 'certain'
  if (conf >= 0.5) return 'likely'
  if (conf > 0) return 'uncertain'
  return 'unidentified'
}

function getPhotoUrl(s: Sighting): string | null {
  const photo = s.media?.find(m => m.media_type === 'photo')
  return photo ? getMediaUrl(photo.storage_path) : null
}

function getAudioUrl(s: Sighting): string | null {
  const audio = s.media?.find(m => m.media_type === 'audio')
  return audio ? getMediaUrl(audio.storage_path) : null
}

export function SightingDetailView({ sighting, onBack, onOpenSpecies, onChanged }: {
  sighting: Sighting
  onBack: () => void
  onOpenSpecies: () => void
  onChanged?: () => void
}) {
  const conf = normalizeConf(sighting.ai_confidence)
  const topSuggestion = sighting.ai_suggestions?.[0] ?? null
  const sightedAt = new Date(sighting.sighted_at)
  const createdAt = new Date(sighting.created_at)
  const photoUrl = getPhotoUrl(sighting)
  const audioUrl = getAudioUrl(sighting)
  const isSynced = sighting.verification_status === 'verified'

  const { profile } = useAuth()
  const canManage = profile?.role === 'naturalist' || profile?.role === 'admin'
  const isManualEntry = !!sighting.common_name && !sighting.species_id
  const [showPromote, setShowPromote] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { verifySighting, updateSighting, deleteSighting } = useSightings()

  async function handleVerify() {
    setActionError(null)
    setVerifying(true)
    try {
      await verifySighting(sighting.id)
      onChanged?.()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to verify sighting')
    } finally {
      setVerifying(false)
    }
  }

  async function handleDelete() {
    setActionError(null)
    setDeleting(true)
    try {
      await deleteSighting(sighting.id)
      setShowDelete(false)
      onChanged?.()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete sighting')
      setDeleting(false)
    }
  }

  return (
    <div style={{ padding: '28px 40px 80px', background: DS.paper, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
          color: DS.ink, textTransform: 'uppercase',
        }}>← Front desk</button>
        <Mono size={9} color={DS.inkFaint}>
          / SIGHTING / {sighting.id.slice(0, 8).toUpperCase()} / {format(sightedAt, 'dd MMM yyyy · HH:mm')}
        </Mono>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 40 }}>
        {/* Left — evidence */}
        <div>
          <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}`, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <Mono size={9} color={DS.ochre}>◆ PLATE I · THE EVIDENCE</Mono>
              <Mono size={9} color={DS.inkSoft}>
                {format(sightedAt, 'HH:mm')} · {sighting.latitude != null ? `${sighting.latitude.toFixed(4)}°N` : '— no GPS'} · {sighting.longitude != null ? `${sighting.longitude.toFixed(4)}°E` : ''}
              </Mono>
            </div>
            <div style={{
              position: 'relative', background: DS.bone,
              ...(photoUrl ? {} : { height: 380 }),
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Sighting"
                     style={{
                       display: 'block', width: '100%', height: 'auto',
                       maxHeight: '75vh', objectFit: 'contain',
                     }} />
              ) : audioUrl ? (
                <div style={{ position: 'relative', height: '100%' }}>
                  <PhotoPlaceholder hue="mist" height="100%" label="AUDIO ONLY · HEARD, NOT SEEN" />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <audio controls src={audioUrl} style={{ width: '80%' }} />
                  </div>
                </div>
              ) : (
                <PhotoPlaceholder hue="sage" height="100%" label="NO MEDIA · DESCRIPTION ONLY" />
              )}
              {photoUrl && (
                <div style={{
                  position: 'absolute', left: 16, bottom: 14, right: 16,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <Mono size={8} letter={0.22} color="rgba(244,238,226,0.9)">
                    ORIGINAL · {format(sightedAt, 'HH:mm:ss')}
                  </Mono>
                  <Mono size={8} letter={0.22} color="rgba(244,238,226,0.9)">
                    {sighting.location_accuracy ? `±${Math.round(sighting.location_accuracy)}m` : 'GPS'}
                  </Mono>
                </div>
              )}
            </div>
          </div>

          {/* AI reasoning */}
          <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}`, borderTop: 'none', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <Mono size={9} color={DS.ochre}>◆ PLATE II · THE TELEGRAM</Mono>
              <Mono size={9} color={DS.inkSoft}>RECEIVED {format(createdAt, 'HH:mm:ss')}</Mono>
            </div>
            <div style={{ fontFamily: DS.serif, fontSize: 26, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {sighting.common_name || topSuggestion?.common_name || '— unnamed —'}
              {' '}
              <em style={{ fontStyle: 'italic', fontWeight: 300, color: DS.inkSoft }}>
                {sighting.scientific_name || topSuggestion?.scientific_name || ''}
              </em>
            </div>

            {topSuggestion?.description ? (
              <div style={{
                padding: '14px 16px', background: DS.bone,
                borderLeft: `2px solid ${DS.ochre}`, margin: '12px 0 16px',
              }}>
                <div style={{ fontFamily: DS.serif, fontSize: 17, fontStyle: 'italic', fontWeight: 300, color: DS.ink, lineHeight: 1.5 }}>
                  "{topSuggestion.description}"
                </div>
                <Mono size={9} color={DS.inkSoft} style={{ marginTop: 10 }}>
                  FIELD GUIDE · CONFIDENCE {Math.round(conf * 100)}%
                </Mono>
              </div>
            ) : conf === 0 ? (
              <div style={{
                padding: '14px 16px', background: DS.bone,
                borderLeft: `2px solid ${DS.rust}`, margin: '12px 0 16px',
                fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic', color: DS.inkSoft,
              }}>
                No AI identification available. Manual review required.
              </div>
            ) : (
              <div style={{
                padding: '14px 16px', background: DS.bone,
                borderLeft: `2px solid ${DS.forest}`, margin: '12px 0 16px',
                fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic', color: DS.ink,
              }}>
                Identified with {Math.round(conf * 100)}% confidence. No detailed reasoning provided.
              </div>
            )}
          </div>
        </div>

        {/* Right — record + actions */}
        <div>
          <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}`, padding: 26 }}>
            <Mono size={9} color={DS.ochre}>◆ THE RECORD</Mono>

            <button onClick={onOpenSpecies} style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '14px 0', borderBottom: `0.5px solid ${DS.inkHair}`,
            }}>
              <div style={{
                fontFamily: DS.serif, fontSize: 40, fontWeight: 200,
                letterSpacing: '-0.025em', color: DS.ink, lineHeight: 1.05,
              }}>
                {sighting.common_name || sighting.scientific_name || 'Unknown species'}
              </div>
              <div style={{
                fontFamily: DS.serif, fontSize: 18, fontStyle: 'italic', fontWeight: 300,
                color: DS.inkSoft, marginTop: 4,
              }}>{sighting.scientific_name || '—'}</div>
              <Mono size={9} color={DS.ochre} style={{ marginTop: 8 }}>OPEN SPECIES PAGE →</Mono>
            </button>

            <div style={{
              padding: '18px 0', borderBottom: `0.5px solid ${DS.inkHair}`,
              fontFamily: DS.serif, fontSize: 17, fontWeight: 300, lineHeight: 1.75, color: DS.ink,
            }}>
              On <strong style={{ fontWeight: 400 }}>{format(sightedAt, 'd MMMM')}</strong>,
              at <strong style={{ fontWeight: 400 }}>{format(sightedAt, 'HH:mm')}</strong>,
              an observation of <em>{sighting.common_name || sighting.scientific_name || 'an unknown species'}</em>
              {' '}at{' '}
              <span style={{ fontFamily: DS.mono, fontSize: 14 }}>
                {sighting.latitude != null && sighting.longitude != null
                  ? `${sighting.latitude.toFixed(4)}°N, ${sighting.longitude.toFixed(4)}°E`
                  : 'an unrecorded location'}
              </span>.{' '}
              Confidence: <u style={{ textUnderlineOffset: 3 }}>{confidenceWord(conf)}</u>.
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px',
              padding: '18px 0', borderBottom: `0.5px solid ${DS.inkHair}`,
            }}>
              {([
                ['CATEGORY', sighting.category],
                ['CONFIDENCE', conf > 0 ? `${Math.round(conf * 100)}%` : '—'],
                ['LATITUDE', sighting.latitude != null ? `${sighting.latitude.toFixed(6)}°` : '—'],
                ['LONGITUDE', sighting.longitude != null ? `${sighting.longitude.toFixed(6)}°` : '—'],
                ['GPS ACCURACY', sighting.location_accuracy ? `±${Math.round(sighting.location_accuracy)}m` : '—'],
                ['LOGGED', format(createdAt, 'd MMM · HH:mm')],
                ['OBSERVER', sighting.profile?.display_name || sighting.profile?.email || '—'],
                ...(sighting.park ? [['PARK', PARK_LABEL[sighting.park]]] as [string, string][] : []),
              ] as [string, string | number][]).map(([k, v]) => (
                <div key={k} style={{ padding: '8px 0', borderBottom: `0.5px dashed ${DS.inkHair}` }}>
                  <Mono size={8} letter={0.22} color={DS.inkSoft}>{k}</Mono>
                  <div style={{
                    fontFamily: DS.serif, fontSize: 16, fontWeight: 400, color: DS.ink,
                    marginTop: 3, textTransform: 'capitalize',
                  }}>{v}</div>
                </div>
              ))}
            </div>

            {sighting.notes && (
              <div style={{ padding: '18px 0', borderBottom: `0.5px solid ${DS.inkHair}` }}>
                <Mono size={8} letter={0.22} color={DS.inkSoft}>NOTES FROM THE FIELD</Mono>
                <div style={{
                  fontFamily: DS.serif, fontSize: 16, fontWeight: 300, fontStyle: 'italic',
                  color: DS.ink, marginTop: 8, lineHeight: 1.6,
                }}>"{sighting.notes}"</div>
              </div>
            )}

            {/* Tiger naming — owner / naturalist / admin can backfill the
                named individual on a tiger sighting from this view, so a
                record logged before naming was supported still gets a name. */}
            <TigerInlineEditor sighting={sighting} onUpdated={() => onChanged?.()} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '18px 0' }}>
              <div style={{ textAlign: 'right' }}>
                <Mono size={8} letter={0.22} color={DS.inkSoft}>SUBMITTED</Mono>
                <div style={{ fontFamily: DS.mono, fontSize: 12, color: DS.ink, marginTop: 6 }}>
                  {format(createdAt, 'HH:mm:ss')}
                </div>
                <Mono size={8} letter={0.18}
                      color={isSynced ? DS.forest : DS.ochre} style={{ marginTop: 3 }}>
                  {isSynced ? '● VERIFIED' : `○ ${sighting.verification_status.replace('_', ' ').toUpperCase()}`}
                </Mono>
              </div>
            </div>
          </div>

          {canManage && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!isSynced && (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  style={{
                    padding: '18px 22px', background: DS.ink, color: DS.ivory,
                    border: 'none', cursor: verifying ? 'not-allowed' : 'pointer',
                    fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    opacity: verifying ? 0.5 : 1,
                  }}
                >
                  <span>{verifying ? 'Verifying…' : 'Verify & seal the record'}</span>
                  <span style={{ fontFamily: DS.serif, fontStyle: 'italic', fontSize: 16, textTransform: 'none', letterSpacing: 0 }}>⎘ Verify</span>
                </button>
              )}
              {isManualEntry && (
                <button
                  onClick={() => { setActionError(null); setShowPromote(true) }}
                  style={{
                    padding: '18px 22px', background: DS.ochre, color: DS.ink, border: 'none', cursor: 'pointer',
                    fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>Add to species library</span>
                  <span style={{ fontFamily: DS.serif, fontStyle: 'italic', fontSize: 16, textTransform: 'none', letterSpacing: 0 }}>+ Promote</span>
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  onClick={() => { setActionError(null); setShowEdit(true) }}
                  style={{
                    padding: '14px 16px', background: 'transparent', color: DS.ink,
                    border: `0.5px solid ${DS.ink}`, cursor: 'pointer',
                    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
                  }}
                >Edit the record</button>
                <button
                  onClick={() => { setActionError(null); setShowDelete(true) }}
                  style={{
                    padding: '14px 16px', background: 'transparent', color: DS.rust,
                    border: `0.5px solid ${DS.rust}`, cursor: 'pointer',
                    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
                  }}
                >Delete</button>
              </div>
              {actionError && (
                <div style={{
                  padding: '10px 14px', background: DS.rust, color: DS.ivory,
                  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                }}>{actionError}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPromote && (
        <PromoteToSpeciesSheet
          sighting={sighting}
          onClose={() => setShowPromote(false)}
          onError={setActionError}
          onPromoted={() => {
            setShowPromote(false)
            onChanged?.()
          }}
        />
      )}

      {showEdit && (
        <EditSightingSheet
          sighting={sighting}
          onClose={() => setShowEdit(false)}
          onError={setActionError}
          onSaved={async (updates) => {
            try {
              await updateSighting(sighting.id, updates)
              setShowEdit(false)
              onChanged?.()
            } catch (err: any) {
              setActionError(err?.message || 'Failed to save changes')
            }
          }}
        />
      )}

      {showDelete && (
        <DeleteConfirmSheet
          sighting={sighting}
          deleting={deleting}
          onCancel={() => setShowDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function PromoteToSpeciesSheet({
  sighting, onClose, onPromoted, onError,
}: {
  sighting: Sighting
  onClose: () => void
  onPromoted: () => void
  onError: (msg: string) => void
}) {
  const { createSpecies } = useSpecies()
  // Pre-fill from the sighting itself: the AI description (if any) and the
  // photo go straight into the new species folio so the naturalist doesn't
  // have to re-type the description or re-upload the image.
  const aiDescription = sighting.ai_suggestions?.[0]?.description ?? ''
  const sightingPhotoUrl = getPhotoUrl(sighting)
  const [common, setCommon] = useState(sighting.common_name ?? '')
  const [scientific, setScientific] = useState(sighting.scientific_name ?? '')
  const [category, setCategory] = useState<SightingCategory>(sighting.category)
  const [description, setDescription] = useState(aiDescription)
  const [habitat, setHabitat] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!common.trim()) {
      onError('Common name is required')
      return
    }
    setSubmitting(true)
    try {
      const created = await createSpecies({
        common_name: common.trim(),
        scientific_name: scientific.trim() || null,
        category,
        description: description.trim() || null,
        habitat: habitat.trim() || null,
        reference_image_url: sightingPhotoUrl,
      })
      const { error: updateError } = await (supabase.from('sightings') as any)
        .update({
          species_id: created.id,
          common_name: created.common_name,
          scientific_name: created.scientific_name,
          verification_status: 'verified',
        })
        .eq('id', sighting.id)
      if (updateError) throw updateError
      onPromoted()
    } catch (err: any) {
      onError(err?.message || 'Failed to promote species')
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
    fontFamily: DS.serif, fontSize: 16, fontWeight: 400,
    color: DS.ink, outline: 'none',
  }

  const CATEGORIES: SightingCategory[] = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace']

  return (
    <div
      onClick={onClose}
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
          background: DS.ivory, padding: '22px 24px',
          maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto',
          border: `1px solid ${DS.ink}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `1px solid ${DS.ink}` }}>
          <Mono size={10} letter={0.2} color={DS.ochre}>◆ Add to species library</Mono>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
            color: DS.inkSoft, textTransform: 'uppercase',
          }}>Cancel</button>
        </div>

        <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Common name *">
            <input value={common} onChange={(e) => setCommon(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Scientific name">
            <input value={scientific} onChange={(e) => setScientific(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Category">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '8px 12px',
                  background: category === c ? DS.ink : 'transparent',
                  color: category === c ? DS.ivory : DS.ink,
                  border: `0.5px solid ${category === c ? DS.ink : DS.inkFaint}`,
                  cursor: 'pointer',
                  fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
          </Field>
          <Field label="Habitat (optional)">
            <input value={habitat} onChange={(e) => setHabitat(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <button onClick={handleSubmit} disabled={submitting || !common.trim()}
          style={{
            marginTop: 22, width: '100%', padding: '16px 20px',
            background: submitting || !common.trim() ? DS.inkFaint : DS.ochre,
            color: DS.ink, border: 'none',
            cursor: submitting || !common.trim() ? 'not-allowed' : 'pointer',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em',
            textTransform: 'uppercase', fontWeight: 500,
          }}
        >
          {submitting ? 'Promoting…' : 'Add species & verify sighting'}
        </button>
        <Mono size={8} letter={0.2} color={DS.inkFaint} style={{ marginTop: 8, textAlign: 'center' }}>
          The sighting will be linked to this new species and marked verified
        </Mono>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>{label}</Mono>
      {children}
    </div>
  )
}

const SIGHTING_CATEGORIES: SightingCategory[] = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace']
const VERIFICATION_OPTIONS: { value: Sighting['verification_status']; label: string }[] = [
  { value: 'unverified',    label: 'Unverified' },
  { value: 'ai_suggested',  label: 'AI suggested' },
  { value: 'verified',      label: 'Verified' },
  { value: 'rejected',      label: 'Rejected' },
]

function EditSightingSheet({
  sighting, onClose, onSaved, onError,
}: {
  sighting: Sighting
  onClose: () => void
  onSaved: (updates: Partial<Sighting>) => void | Promise<void>
  onError: (msg: string) => void
}) {
  const [common, setCommon] = useState(sighting.common_name ?? '')
  const [scientific, setScientific] = useState(sighting.scientific_name ?? '')
  const [category, setCategory] = useState<SightingCategory>(sighting.category)
  const [linkedSpeciesId, setLinkedSpeciesId] = useState<string | null>(sighting.species_id)
  const [linkedSpeciesSnapshot, setLinkedSpeciesSnapshot] = useState<import('../../types').Species | null>(null)
  const [count, setCount] = useState<string>(sighting.individual_count != null ? String(sighting.individual_count) : '')
  const [notes, setNotes] = useState(sighting.notes ?? '')
  const [status, setStatus] = useState<Sighting['verification_status']>(sighting.verification_status)
  const [submitting, setSubmitting] = useState(false)

  const [librarySearch, setLibrarySearch] = useState('')
  const { species: librarySpecies, fetchSpecies, loading: libraryLoading } = useSpecies()

  // Debounced library search. Empty search returns the first page from the
  // backend so the picker still has something to scroll on first open.
  useEffect(() => {
    const t = setTimeout(() => fetchSpecies(undefined, librarySearch.trim() || undefined), 200)
    return () => clearTimeout(t)
  }, [librarySearch, fetchSpecies])

  // Hold onto the linked row from the most recent search result so the
  // confirmation chip still displays its name even after a new search
  // pages it out.
  useEffect(() => {
    if (!linkedSpeciesId) { setLinkedSpeciesSnapshot(null); return }
    const found = librarySpecies.find(s => s.id === linkedSpeciesId)
    if (found) setLinkedSpeciesSnapshot(found)
  }, [linkedSpeciesId, librarySpecies])

  const linkedSpecies = linkedSpeciesSnapshot

  function pickFromLibrary(sp: import('../../types').Species) {
    setLinkedSpeciesId(sp.id)
    setLinkedSpeciesSnapshot(sp)
    setCommon(sp.common_name)
    setScientific(sp.scientific_name ?? '')
    setCategory(sp.category)
    setLibrarySearch('')
  }

  function clearLink() {
    setLinkedSpeciesId(null)
    setLinkedSpeciesSnapshot(null)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const parsedCount = count.trim() === '' ? null : Math.max(0, Math.floor(Number(count) || 0))
      await onSaved({
        species_id: linkedSpeciesId,
        common_name: common.trim() || null,
        scientific_name: scientific.trim() || null,
        category,
        individual_count: parsedCount,
        notes: notes.trim() || null,
        verification_status: status,
      })
    } catch (err: any) {
      onError(err?.message || 'Failed to save changes')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
    fontFamily: DS.serif, fontSize: 16, fontWeight: 400,
    color: DS.ink, outline: 'none',
  }
  const lockedInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: DS.paper,
    color: DS.inkSoft,
  }

  const isLinked = !!linkedSpeciesId
  const visibleMatches = librarySpecies
    .filter(sp => sp.id !== linkedSpeciesId)
    .slice(0, 8)

  return (
    <div
      onClick={onClose}
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
          background: DS.ivory, padding: '22px 24px',
          maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto',
          border: `1px solid ${DS.ink}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `1px solid ${DS.ink}` }}>
          <Mono size={10} letter={0.2} color={DS.ochre}>◆ Edit the record</Mono>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
            color: DS.inkSoft, textTransform: 'uppercase',
          }}>Cancel</button>
        </div>

        <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Library picker — primary path */}
          <Field label="Species (from the library)">
            {isLinked && linkedSpecies ? (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                border: `0.5px solid ${DS.forest}`, background: DS.bone,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Mono size={8} letter={0.2} color={DS.forest} style={{ marginBottom: 4 }}>✓ Linked to library</Mono>
                  <div style={{
                    fontFamily: DS.serif, fontSize: 17, fontWeight: 400, color: DS.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{linkedSpecies.common_name}</div>
                  {linkedSpecies.scientific_name && (
                    <div style={{
                      fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic', fontWeight: 300, color: DS.inkSoft,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{linkedSpecies.scientific_name}</div>
                  )}
                </div>
                <button onClick={clearLink} style={{
                  background: 'transparent', border: `0.5px solid ${DS.inkFaint}`,
                  padding: '6px 12px', cursor: 'pointer',
                  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: DS.inkSoft,
                }}>× Clear</button>
              </div>
            ) : (
              <>
                <input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search the library by common or scientific name…"
                  style={inputStyle}
                />
                <div style={{
                  marginTop: 8, border: `0.5px solid ${DS.inkHair}`, background: DS.bone,
                  maxHeight: 220, overflowY: 'auto',
                }}>
                  {libraryLoading && visibleMatches.length === 0 ? (
                    <div style={{ padding: '14px 12px' }}>
                      <Mono size={9} color={DS.inkFaint}>⋯ Loading library</Mono>
                    </div>
                  ) : visibleMatches.length === 0 ? (
                    <div style={{ padding: '14px 12px' }}>
                      <Mono size={9} color={DS.inkFaint}>
                        No matches. If the species isn't in the library, close this modal and use "Add to species library".
                      </Mono>
                    </div>
                  ) : (
                    visibleMatches.map((sp, i) => (
                      <button
                        key={sp.id}
                        onClick={() => pickFromLibrary(sp)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                          padding: '10px 12px', textAlign: 'left', width: '100%',
                          background: 'transparent', border: 'none',
                          borderBottom: i < visibleMatches.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontFamily: DS.serif, fontSize: 15, fontWeight: 400, color: DS.ink,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{sp.common_name}</div>
                          {sp.scientific_name && (
                            <div style={{
                              fontFamily: DS.serif, fontSize: 12, fontStyle: 'italic', fontWeight: 300, color: DS.inkSoft,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{sp.scientific_name}</div>
                          )}
                        </div>
                        <Mono size={8} letter={0.18} color={DS.inkFaint}>{sp.category.toUpperCase()}</Mono>
                      </button>
                    ))
                  )}
                </div>
                <Mono size={8} letter={0.2} color={DS.inkFaint} style={{ marginTop: 6 }}>
                  Pick a library entry to auto-fill name, scientific name, and category. To save without a library link (manual entry), edit the fields below directly.
                </Mono>
              </>
            )}
          </Field>

          <Field label="Common name">
            <input
              value={common} onChange={(e) => setCommon(e.target.value)}
              style={isLinked ? lockedInputStyle : inputStyle}
              readOnly={isLinked}
            />
          </Field>
          <Field label="Scientific name">
            <input
              value={scientific} onChange={(e) => setScientific(e.target.value)}
              style={isLinked ? lockedInputStyle : inputStyle}
              readOnly={isLinked}
            />
          </Field>
          <Field label="Category">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SIGHTING_CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => !isLinked && setCategory(c)}
                  disabled={isLinked}
                  style={{
                    padding: '8px 12px',
                    background: category === c ? DS.ink : 'transparent',
                    color: category === c ? DS.ivory : DS.ink,
                    border: `0.5px solid ${category === c ? DS.ink : DS.inkFaint}`,
                    cursor: isLinked ? 'not-allowed' : 'pointer',
                    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    opacity: isLinked && category !== c ? 0.4 : 1,
                  }}
                >{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Individual count">
            <input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} />
          </Field>
          <Field label="Verification status">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {VERIFICATION_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setStatus(opt.value)} style={{
                  padding: '8px 12px',
                  background: status === opt.value ? DS.forest : 'transparent',
                  color: status === opt.value ? DS.ivory : DS.ink,
                  border: `0.5px solid ${status === opt.value ? DS.forest : DS.inkFaint}`,
                  cursor: 'pointer',
                  fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}>{opt.label}</button>
              ))}
            </div>
          </Field>
          <Mono size={8} letter={0.2} color={DS.inkFaint}>
            Coordinates, photos, and timestamp describe the field record itself and can't be edited.
          </Mono>
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{
            marginTop: 22, width: '100%', padding: '16px 20px',
            background: submitting ? DS.inkFaint : DS.ochre,
            color: DS.ink, border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em',
            textTransform: 'uppercase', fontWeight: 500,
          }}
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function DeleteConfirmSheet({
  sighting, deleting, onCancel, onConfirm,
}: {
  sighting: Sighting
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
          maxWidth: 460, width: '100%',
          border: `1px solid ${DS.rust}`,
        }}
      >
        <Mono size={10} letter={0.2} color={DS.rust}>◆ Delete this record?</Mono>
        <h2 style={{
          fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
          letterSpacing: '-0.01em', margin: '12px 0 6px', color: DS.ink,
        }}>
          {sighting.common_name || 'Unidentified sighting'}
        </h2>
        <p style={{
          fontFamily: DS.serif, fontSize: 15, fontWeight: 300, fontStyle: 'italic',
          color: DS.inkSoft, margin: '0 0 18px', lineHeight: 1.5,
        }}>
          This will permanently remove the sighting and any attached media. This action cannot be undone.
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
