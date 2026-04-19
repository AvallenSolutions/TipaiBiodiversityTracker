import { format } from 'date-fns'
import { DS, normalizeConf } from '../../lib/ledger-design'
import type { Sighting } from '../../types'
import { Mono, PhotoPlaceholder } from './shared'

function confidenceWord(conf: number): string {
  if (conf >= 0.8) return 'certain'
  if (conf >= 0.5) return 'likely'
  if (conf > 0) return 'uncertain'
  return 'unidentified'
}

function getPhotoUrl(s: Sighting): string | null {
  return s.media?.find(m => m.media_type === 'photo')?.url ?? null
}

function getAudioUrl(s: Sighting): string | null {
  return s.media?.find(m => m.media_type === 'audio')?.url ?? null
}

export function SightingDetailView({ sighting, onBack, onOpenSpecies }: {
  sighting: Sighting
  onBack: () => void
  onOpenSpecies: () => void
}) {
  const conf = normalizeConf(sighting.ai_confidence)
  const topSuggestion = sighting.ai_suggestions?.[0] ?? null
  const sightedAt = new Date(sighting.sighted_at)
  const createdAt = new Date(sighting.created_at)
  const photoUrl = getPhotoUrl(sighting)
  const audioUrl = getAudioUrl(sighting)
  const isSynced = sighting.verification_status === 'verified'

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
                {format(sightedAt, 'HH:mm')} · {sighting.latitude.toFixed(4)}°N · {sighting.longitude.toFixed(4)}°E
              </Mono>
            </div>
            <div style={{ height: 380, position: 'relative' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Sighting"
                     style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                {sighting.latitude.toFixed(4)}°N, {sighting.longitude.toFixed(4)}°E
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
                ['LATITUDE', `${sighting.latitude.toFixed(6)}°`],
                ['LONGITUDE', `${sighting.longitude.toFixed(6)}°`],
                ['GPS ACCURACY', sighting.location_accuracy ? `±${Math.round(sighting.location_accuracy)}m` : '—'],
                ['LOGGED', format(createdAt, 'd MMM · HH:mm')],
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

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{
              padding: '18px 22px', background: DS.ink, color: DS.ivory, border: 'none', cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Verify &amp; seal the record</span>
              <span style={{ fontFamily: DS.serif, fontStyle: 'italic', fontSize: 16, textTransform: 'none', letterSpacing: 0 }}>⎘ Seal</span>
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button style={{
                padding: '14px 16px', background: 'transparent', color: DS.ink,
                border: `0.5px solid ${DS.ink}`, cursor: 'pointer',
                fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>Edit the record</button>
              <button style={{
                padding: '14px 16px', background: 'transparent', color: DS.rust,
                border: `0.5px solid ${DS.rust}`, cursor: 'pointer',
                fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>Reject · needs ID</button>
            </div>
            <Mono size={9} color={DS.inkFaint} style={{ textAlign: 'center', marginTop: 6 }}>
              VERIFY / REJECT ACTIONS · PENDING BACKEND SUPPORT
            </Mono>
          </div>
        </div>
      </div>
    </div>
  )
}
