import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { DS, normalizeConf } from '../../lib/ledger-design'
import { getMediaUrl } from '../../lib/storage'
import { useSightings } from '../../hooks/useSightings'
import { learnFromSightingRecord } from '../../lib/gemini'
import { PARK_LABEL } from '../../types'
import type { AISuggestion, Sighting } from '../../types'
import { Mono, PhotoPlaceholder } from './shared'
import { PlateCompare, PlateThumb, plateTargetFor, type PlateTarget } from '../sighting/PlateCompare'

// The naturalist review list: every record not yet checked by a
// naturalist, most important first, with one-tap actions. Every
// confirmation, correction or rejection here also teaches the AI.

export function needsReview(s: Sighting): boolean {
  return s.verification_status === 'unverified' || s.verification_status === 'ai_suggested'
}

interface Reason { label: string; weight: number; tone: 'danger' | 'warn' | 'info' }

const VENOMOUS = /krait|bungarus|cobra|\bnaja\b|russell.?s viper|daboia|saw.?scaled|echis|pit ?viper|trimeresurus|coral ?snake|calliophis/i

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

/** Why a record needs a naturalist's eye, most serious first. */
export function reviewReasons(s: Sighting, knownNames: Set<string>): Reason[] {
  const out: Reason[] = []
  const top = s.ai_suggestions?.[0]
  if (s.ai_suggestions?.some(x => x.venomous || x.warning) || VENOMOUS.test(`${s.common_name ?? ''} ${s.scientific_name ?? ''}`)) {
    out.push({ label: 'Venomous or look-alike', weight: 5, tone: 'danger' })
  }
  if (!s.common_name) {
    out.push({ label: 'No species named', weight: 4, tone: 'danger' })
  } else if (!knownNames.has(norm(s.common_name)) && !knownNames.has(norm(s.scientific_name))) {
    out.push({ label: 'First record for Tipai', weight: 3, tone: 'warn' })
  }
  if (top && s.common_name && norm(top.common_name) !== norm(s.common_name) && norm(top.scientific_name) !== norm(s.scientific_name)) {
    out.push({ label: `Differs from AI (${top.common_name ?? 'unknown'})`, weight: 2, tone: 'warn' })
  }
  if (top && normalizeConf(top.confidence) < 0.6) {
    out.push({ label: `AI unsure (${Math.round(normalizeConf(top.confidence) * 100)}%)`, weight: 2, tone: 'warn' })
  }
  if (s.common_name && !s.species_id) {
    out.push({ label: 'Not linked to library', weight: 1, tone: 'info' })
  }
  if (out.length === 0) out.push({ label: 'Routine check', weight: 0, tone: 'info' })
  return out
}

export function ReviewView({ sightings, onOpenSighting, onChanged }: {
  sightings: Sighting[]
  onOpenSighting: (s: Sighting) => void
  onChanged: () => void
}) {
  const queue = useMemo(() => {
    // Species already confirmed at Tipai, by common and scientific name.
    const known = new Set<string>()
    for (const s of sightings) {
      if (s.verification_status !== 'verified') continue
      if (s.common_name) known.add(norm(s.common_name))
      if (s.scientific_name) known.add(norm(s.scientific_name))
    }
    return sightings
      .filter(needsReview)
      .map(s => {
        const reasons = reviewReasons(s, known)
        return { s, reasons, score: reasons.reduce((n, r) => n + r.weight, 0) }
      })
      .sort((a, b) => b.score - a.score || b.s.created_at.localeCompare(a.s.created_at))
  }, [sightings])

  const urgent = queue.filter(q => q.score >= 3).length

  return (
    <div style={{ padding: '28px clamp(16px, 4vw, 40px) 80px', background: DS.paper, minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ Waiting for a naturalist</Mono>
        <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, color: DS.ink, marginTop: 6 }}>
          {queue.length === 0
            ? 'Nothing to check. Every record has been reviewed.'
            : `${queue.length} record${queue.length === 1 ? '' : 's'} to check${urgent ? ` · ${urgent} important` : ''}.`}
        </div>
        <p style={{ fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic', color: DS.inkSoft, margin: '6px 0 0', maxWidth: 640 }}>
          Most important first. Confirm, pick a better AI answer, or reject. Each decision also teaches the AI.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {queue.map(({ s, reasons }) => (
          <ReviewCard key={s.id} sighting={s} reasons={reasons} onOpen={() => onOpenSighting(s)} onChanged={onChanged} />
        ))}
      </div>
    </div>
  )
}

function ReviewCard({ sighting: s, reasons, onOpen, onChanged }: {
  sighting: Sighting
  reasons: Reason[]
  onOpen: () => void
  onChanged: () => void
}) {
  const { updateSighting } = useSightings()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [compare, setCompare] = useState<PlateTarget | null>(null)

  const photo = s.media?.find(m => m.media_type === 'photo')
  const photoUrl = photo ? getMediaUrl(photo.storage_path) : null
  const top = s.ai_suggestions?.[0]
  const alternatives = (s.ai_suggestions ?? [])
    .filter(x => x.common_name && norm(x.common_name) !== norm(s.common_name))
    .slice(0, 3)
  const ownPlate = plateTargetFor(s.common_name, s.scientific_name)

  async function decide(updates: Partial<Sighting>) {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSighting(s.id, updates)
      // Teach (or, for a rejection, un-teach) in the background.
      learnFromSightingRecord(updated).catch(err => console.warn('[learn] could not teach AI from review', err))
      onChanged()
    } catch (err: any) {
      setError(err?.message || 'Could not save. Try again.')
      setBusy(false)
    }
  }

  function applySuggestion(x: AISuggestion) {
    decide({
      common_name: x.common_name,
      scientific_name: x.scientific_name ?? null,
      species_id: x.species_id ?? null,
      category: x.category ?? s.category,
      verification_status: 'verified',
    })
  }

  const toneColour = { danger: DS.rust, warn: DS.ochre, info: DS.forest }
  const btn: React.CSSProperties = {
    padding: '10px 14px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  }
  const where = s.park
    ? PARK_LABEL[s.park]
    : s.latitude != null && s.longitude != null
      ? `${s.latitude.toFixed(4)}°N ${s.longitude.toFixed(4)}°E`
      : 'no location'
  const notes = [s.sex_age, s.behaviour, s.habitat, s.weather].filter(Boolean).join(' · ')

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(110px, 180px) 1fr', gap: 16,
      background: DS.ivory, border: `1px solid ${DS.ink}`, padding: 14,
    }}>
      <button onClick={onOpen} aria-label="Open the full record" style={{
        padding: 0, border: 'none', background: DS.bone, cursor: 'pointer', alignSelf: 'start',
        aspectRatio: '1 / 1', overflow: 'hidden',
      }}>
        {photoUrl
          ? <img src={photoUrl} alt="Sighting" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <PhotoPlaceholder hue="sage" height="100%" label="NO PHOTO" />}
      </button>

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {reasons.map(r => (
            <span key={r.label} style={{
              padding: '3px 8px', border: `0.5px solid ${toneColour[r.tone]}`,
              color: r.tone === 'danger' ? DS.ivory : toneColour[r.tone],
              background: r.tone === 'danger' ? DS.rust : 'transparent',
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>{r.label}</span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: DS.serif, fontSize: 24, fontWeight: 300, color: DS.ink, lineHeight: 1.15 }}>
              {s.common_name || <em style={{ color: DS.inkSoft }}>Unnamed</em>}
            </div>
            {s.scientific_name && (
              <div style={{ fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic', color: DS.inkSoft }}>{s.scientific_name}</div>
            )}
          </div>
          {ownPlate && <PlateThumb target={ownPlate} size={60} onOpen={setCompare} />}
        </div>

        <Mono size={9} letter={0.12} color={DS.inkSoft} style={{ lineHeight: 1.6 }}>
          {s.profile?.display_name || s.profile?.email || 'Unknown observer'} · {format(new Date(s.sighted_at), 'd MMM yyyy, HH:mm')} · {where}
          {top ? ` · AI ${Math.round(normalizeConf(top.confidence) * 100)}%` : ''}
        </Mono>
        {(notes || s.notes) && (
          <div style={{ fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic', color: DS.ink, lineHeight: 1.45 }}>
            {[notes, s.notes].filter(Boolean).join(' · ')}
          </div>
        )}
        {top?.warning && (
          <div style={{ fontFamily: DS.serif, fontSize: 13, color: DS.rust, lineHeight: 1.45 }}>⚠ {top.warning}</div>
        )}

        {alternatives.length > 0 && (
          <div style={{ borderTop: `0.5px solid ${DS.inkHair}`, paddingTop: 6 }}>
            <Mono size={8} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 2 }}>Other AI answers</Mono>
            {alternatives.map((x, i) => {
              const plate = plateTargetFor(x.common_name, x.scientific_name)
              return (
                <div key={`${x.common_name}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                  borderBottom: `0.5px dashed ${DS.inkHair}`,
                }}>
                  {plate && <PlateThumb target={plate} size={40} onOpen={setCompare} />}
                  <div style={{ flex: 1, minWidth: 0, fontFamily: DS.serif, fontSize: 15, color: DS.ink }}>
                    {x.common_name}
                    {x.scientific_name && <em style={{ color: DS.inkSoft, fontSize: 13 }}> {x.scientific_name}</em>}
                    <span style={{ fontFamily: DS.mono, fontSize: 9, color: DS.inkSoft }}> · {Math.round(normalizeConf(x.confidence) * 100)}%</span>
                  </div>
                  <button disabled={busy} onClick={() => applySuggestion(x)} style={{
                    ...btn, padding: '6px 10px', background: 'transparent', color: DS.forest, border: `0.5px solid ${DS.forest}`,
                  }}>Use this ✓</button>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <button
            disabled={busy || !s.common_name}
            onClick={() => decide({ verification_status: 'verified' })}
            title={s.common_name ? undefined : 'Name the species first (open the record)'}
            style={{ ...btn, background: DS.forest, color: DS.ivory, border: 'none', opacity: busy || !s.common_name ? 0.5 : 1 }}
          >Confirm ✓</button>
          <button disabled={busy} onClick={onOpen} style={{ ...btn, background: 'transparent', color: DS.ink, border: `0.5px solid ${DS.ink}` }}>
            Open to edit
          </button>
          {confirmReject ? (
            <>
              <button disabled={busy} onClick={() => decide({ verification_status: 'rejected' })}
                style={{ ...btn, background: DS.rust, color: DS.ivory, border: 'none' }}>Yes, reject</button>
              <button disabled={busy} onClick={() => setConfirmReject(false)}
                style={{ ...btn, background: 'transparent', color: DS.inkSoft, border: `0.5px solid ${DS.inkFaint}` }}>Keep</button>
            </>
          ) : (
            <button disabled={busy} onClick={() => setConfirmReject(true)}
              style={{ ...btn, background: 'transparent', color: DS.rust, border: `0.5px solid ${DS.rust}` }}>Reject</button>
          )}
        </div>
        {error && <Mono size={9} color={DS.rust} letter={0.12}>{error}</Mono>}
      </div>

      {compare && <PlateCompare photoUrl={photoUrl} target={compare} onClose={() => setCompare(null)} />}
    </div>
  )
}
