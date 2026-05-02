import { useMemo } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { DS } from '../../lib/ledger-design'
import { getMediaUrl } from '../../lib/storage'
import { getBundledSpeciesImage } from '../../lib/speciesImages'
import type { Sighting, Species } from '../../types'
import { Mono, PhotoPlaceholder, TrendChart } from './shared'
import { buildSpeciesLibrary } from './Desk'
import { ReserveMap } from './ReserveMap'

function getPhotoUrl(s: Sighting): string | null {
  const photo = s.media?.find(m => m.media_type === 'photo')
  return photo ? getMediaUrl(photo.storage_path) : null
}

// Match a sighting to a library species: prefer the persisted FK link,
// fall back to a name match so older sightings (logged before the
// species was added to the library, or via manual entry) still appear.
function matchesSpecies(s: Sighting, species: Species | null, name: string): boolean {
  if (species && s.species_id === species.id) return true
  const heading = s.common_name || s.scientific_name || `Unknown ${s.category}`
  return heading === name
}

export function SpeciesDetailView({
  speciesName, species, sightings, onBack, onOpenSighting, onEdit,
}: {
  speciesName: string
  species?: Species | null   // optional library row — when present we render extra detail and the Edit button
  sightings: Sighting[]
  onBack: () => void
  onOpenSighting: (s: Sighting) => void
  onEdit?: () => void
}) {
  const library = useMemo(() => buildSpeciesLibrary(sightings), [sightings])
  const sp = library.find(s => s.common === speciesName) ?? library[0]

  // The species' sightings, newest first.
  const matching = useMemo(() => {
    return sightings
      .filter(s => matchesSpecies(s, species ?? null, speciesName))
      .sort((a, b) => new Date(b.sighted_at).getTime() - new Date(a.sighted_at).getTime())
  }, [sightings, species, speciesName])

  // Extended stats derived directly from the species' sightings — these
  // are what the naturalist actually wants when looking at a folio:
  // counts, recency, spread of dates, total individuals, sites.
  const stats = useMemo(() => {
    if (matching.length === 0) {
      return {
        total: 0,
        distinctDays: 0,
        individuals: 0,
        firstSeen: null as Date | null,
        lastSeen: null as Date | null,
        located: 0,
      }
    }
    const dayKeys = new Set<string>()
    let individuals = 0
    let located = 0
    for (const s of matching) {
      dayKeys.add(format(new Date(s.sighted_at), 'yyyy-MM-dd'))
      if (typeof s.individual_count === 'number') individuals += s.individual_count
      if (s.latitude != null && s.longitude != null) located++
    }
    return {
      total: matching.length,
      distinctDays: dayKeys.size,
      individuals,
      firstSeen: new Date(matching[matching.length - 1]!.sighted_at),
      lastSeen: new Date(matching[0]!.sighted_at),
      located,
    }
  }, [matching])

  // Trend: prefer the species' actual sightings (so the chart is
  // accurate even when the library row exists but Desk's library cache
  // didn't), fall back to the Desk-derived trend for the orphan case.
  const trend = useMemo(() => {
    if (matching.length > 0) return buildMonthlyTrend(matching, 12)
    return sp?.trend ?? Array(12).fill(0)
  }, [matching, sp])

  if (!sp && !species) {
    return (
      <div style={{ padding: '60px 40px', background: DS.paper, minHeight: '100vh' }}>
        <button onClick={onBack} style={backBtn}>← Back</button>
        <div style={{
          marginTop: 40, fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
          fontStyle: 'italic', color: DS.inkSoft,
        }}>No records for this species yet.</div>
      </div>
    )
  }

  // Display fields prefer the persisted library row when we have it.
  const display = {
    common: species?.common_name ?? sp?.common ?? speciesName,
    scientific: species?.scientific_name ?? sp?.sci ?? null,
    category: species?.category ?? (sp?.cat as Species['category']) ?? 'mammal',
    family: species?.family ?? null,
    description: species?.description ?? null,
    habitat: species?.habitat ?? null,
    isNative: species?.is_native ?? null,
    isNotable: species?.is_notable ?? false,
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    return format(d, 'MMM').toUpperCase()
  })

  // Hero photo priority: explicit library plate, then a curated bundled
  // reference photo, then the most recent FK-matched sighting photo.
  const heroPhoto = species?.reference_image_url
    ?? getBundledSpeciesImage(display.common)
    ?? matching.map(getPhotoUrl).find(Boolean)
    ?? null

  return (
    <div style={{
      padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 40px) clamp(40px, 8vw, 80px)',
      background: DS.paper, minHeight: '100vh',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onBack} style={backBtn}>← Back</button>
          <Mono size={9} color={DS.inkFaint}>
            / SPECIES / {display.category.toUpperCase()} / {display.common.toUpperCase()}
          </Mono>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              background: DS.ochre, color: DS.ink, border: 'none',
              padding: '10px 18px', cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.25em',
              textTransform: 'uppercase', fontWeight: 500,
            }}
          >
            Edit species →
          </button>
        )}
      </div>

      {/* Folio header — auto-stacks below ~720px so the title doesn't get
          squeezed into a column too narrow for serif words. */}
      <div style={{
        background: DS.ivory, border: `1px solid ${DS.ink}`,
        padding: 'clamp(20px, 5vw, 36px)', marginBottom: 32,
      }}>
        <div style={{
          display: 'grid', gap: 'clamp(20px, 4vw, 40px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
        }}>
          <div style={{ minWidth: 0 }}>
            <Mono size={9} color={DS.ochre}>◆ FOLIO · {display.category.toUpperCase()}{display.family ? ` · ${display.family.toUpperCase()}` : ''}</Mono>
            <div style={{
              fontFamily: DS.serif,
              fontSize: 'clamp(34px, 8vw, 64px)',
              fontWeight: 200, letterSpacing: '-0.04em',
              lineHeight: 1.0, margin: '14px 0 8px',
              overflowWrap: 'normal',
            }}>{display.common}</div>
            {display.scientific && (
              <div style={{
                fontFamily: DS.serif,
                fontSize: 'clamp(16px, 3.6vw, 24px)',
                fontStyle: 'italic', fontWeight: 300,
                color: DS.inkSoft, marginBottom: 16,
              }}>{display.scientific}</div>
            )}

            {(display.isNotable || display.isNative != null) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {display.isNotable && (
                  <Pill color={DS.rust} bg="rgba(160,80,60,0.08)">Notable</Pill>
                )}
                {display.isNative === true && (
                  <Pill color={DS.forest} bg="rgba(63,80,72,0.08)">Native</Pill>
                )}
                {display.isNative === false && (
                  <Pill color={DS.inkSoft} bg={DS.ivory}>Non-native</Pill>
                )}
              </div>
            )}

            {display.description ? (
              <p style={{
                fontFamily: DS.serif,
                fontSize: 'clamp(14px, 3vw, 17px)',
                fontWeight: 300, fontStyle: 'italic',
                color: DS.ink, lineHeight: 1.55, maxWidth: 580, margin: '0 0 12px',
              }}>{display.description}</p>
            ) : null}
            {display.habitat && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <Mono size={8} letter={0.22} color={DS.inkSoft}>HABITAT</Mono>
                <span style={{
                  fontFamily: DS.serif, fontSize: 15, fontWeight: 300, color: DS.ink,
                }}>{display.habitat}</span>
              </div>
            )}
          </div>
          <div style={{
            // Border-left only when the columns are side-by-side. When
            // stacked the inset becomes a top rule for visual continuity.
            borderLeft: `0.5px solid ${DS.inkHair}`,
            paddingLeft: 'clamp(0px, 2vw, 30px)',
            minWidth: 0,
          }}>
            <div style={{ height: 220, marginBottom: 16, background: DS.bone, overflow: 'hidden' }}>
              {heroPhoto ? (
                <img src={heroPhoto} alt={display.common}
                     style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <PhotoPlaceholder hue="ochre" height="100%" label="PLATE · ILLUSTRATIVE" />
              )}
            </div>
            <div style={{
              fontFamily: DS.serif,
              fontSize: 'clamp(14px, 3vw, 16px)',
              fontWeight: 300, color: DS.inkSoft, lineHeight: 1.5,
            }}>
              {stats.total === 0 ? (
                <em>No sightings recorded yet.</em>
              ) : (
                <>
                  Recorded <strong style={{ fontWeight: 400, color: DS.ink }}>
                    {stats.total}
                  </strong> time{stats.total !== 1 ? 's' : ''} across{' '}
                  <strong style={{ fontWeight: 400, color: DS.ink }}>
                    {stats.distinctDays}
                  </strong> day{stats.distinctDays !== 1 ? 's' : ''}.{' '}
                  Last observed{' '}
                  <em>{stats.lastSeen ? formatDistanceToNow(stats.lastSeen, { addSuffix: false }) : '—'} ago</em>.
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat strip — wraps on narrow screens instead of squashing five
          columns into a phone-width band. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        background: DS.ivory, border: `1px solid ${DS.ink}`, marginBottom: 32,
      }}>
        <Stat label="Sightings" value={String(stats.total)} />
        <Stat label="Distinct days" value={String(stats.distinctDays)} />
        <Stat label="Individuals" value={stats.individuals > 0 ? String(stats.individuals) : '—'} />
        <Stat label="First seen" value={stats.firstSeen ? format(stats.firstSeen, 'd MMM yyyy') : '—'} />
        <Stat label="Last seen" value={stats.lastSeen ? format(stats.lastSeen, 'd MMM yyyy') : '—'} />
      </div>

      {/* 12-month trend */}
      <div style={{ marginBottom: 32 }}>
        <Mono size={9} color={DS.ochre}>◆ §01 · TWELVE MONTHS, IN FULL</Mono>
        <div style={{
          fontFamily: DS.serif, fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 300,
          letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14,
        }}>
          Monthly sightings
        </div>
        <div style={{
          background: DS.ivory, border: `0.5px solid ${DS.ink}`,
          padding: 'clamp(14px, 3vw, 22px)',
        }}>
          <TrendChart data={trend} height={160} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            {months.map((m, i) => <Mono key={i} size={8} letter={0.15} color={DS.inkFaint}>{m}</Mono>)}
          </div>
        </div>
      </div>

      {/* Map of sighting locations */}
      <div style={{ marginBottom: 32 }}>
        <Mono size={9} color={DS.ochre}>◆ §02 · WHERE</Mono>
        <div style={{
          fontFamily: DS.serif, fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 300,
          letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14,
        }}>
          Sighting locations
        </div>
        {stats.located > 0 ? (
          <ReserveMap sightings={matching} onOpenSighting={onOpenSighting} />
        ) : (
          <div style={{
            background: DS.ivory, border: `0.5px solid ${DS.ink}`, padding: '40px 28px',
            textAlign: 'center', color: DS.inkSoft, fontFamily: DS.serif,
            fontSize: 15, fontStyle: 'italic',
          }}>
            None of this species' sightings have GPS coordinates yet.
          </div>
        )}
      </div>

      {/* Sightings history */}
      <div>
        <Mono size={9} color={DS.ochre}>◆ §03 · SIGHTINGS HISTORY</Mono>
        <div style={{
          fontFamily: DS.serif, fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 300,
          letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14,
        }}>
          {matching.length} entr{matching.length === 1 ? 'y' : 'ies'}, most recent first
        </div>

        <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}` }}>
          {matching.length === 0 ? (
            <div style={{
              padding: '40px 28px', textAlign: 'center',
              fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft,
            }}>No sightings on record.</div>
          ) : (
            matching.map((s, i) => {
              const photo = getPhotoUrl(s)
              return (
                <button
                  key={s.id}
                  onClick={() => onOpenSighting(s)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px minmax(0, 1fr) auto',
                    gap: 12, alignItems: 'center', width: '100%', textAlign: 'left',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderBottom: i < matching.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                    padding: 'clamp(10px, 2.5vw, 14px) clamp(12px, 3vw, 18px)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `rgba(184,147,90,0.06)`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 56, height: 56, background: DS.bone, overflow: 'hidden' }}>
                    {photo ? (
                      <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontFamily: DS.mono, fontSize: 14, color: DS.inkFaint,
                      }}>{s.category.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Mono size={9} letter={0.18} color={DS.ochre}>№ {s.id.slice(0, 4).toUpperCase()}</Mono>
                      <Mono size={9} letter={0.12} color={DS.inkSoft}>
                        {format(new Date(s.sighted_at), 'd MMM yyyy · HH:mm')}
                      </Mono>
                      {s.verification_status === 'verified' && (
                        <span style={{
                          padding: '2px 6px', background: DS.forest, color: DS.ivory,
                          fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                        }}>● Verified</span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: DS.serif, fontSize: 15, fontWeight: 300,
                      color: DS.inkSoft, marginTop: 4, fontStyle: 'italic',
                    }}>
                      {s.notes ? `"${s.notes.slice(0, 100)}${s.notes.length > 100 ? '…' : ''}"` : 'No notes recorded.'}
                    </div>
                    {s.latitude != null && s.longitude != null && (
                      <Mono size={9} letter={0.1} color={DS.inkFaint} style={{ marginTop: 4 }}>
                        {s.latitude.toFixed(4)}°N · {s.longitude.toFixed(4)}°E
                        {typeof s.individual_count === 'number' && s.individual_count > 0 ? ` · ×${s.individual_count}` : ''}
                      </Mono>
                    )}
                  </div>
                  <Mono size={10} color={DS.ochre}>→</Mono>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Footer Edit button — also reachable for naturalists who scrolled past the top */}
      {onEdit && (
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onEdit}
            style={{
              background: 'transparent', color: DS.ink,
              border: `0.5px solid ${DS.ink}`,
              padding: '12px 22px', cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.25em',
              textTransform: 'uppercase',
            }}
          >Edit species →</button>
        </div>
      )}
    </div>
  )
}

const backBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
  color: DS.ink, textTransform: 'uppercase', padding: 0,
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRight: `0.5px solid ${DS.inkHair}`,
      borderBottom: `0.5px solid ${DS.inkHair}`,
    }}>
      <Mono size={9} letter={0.22} color={DS.inkSoft}>{label}</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 'clamp(18px, 3.5vw, 22px)', fontWeight: 200,
        letterSpacing: '-0.02em', color: DS.ink, lineHeight: 1.15,
        marginTop: 4, overflowWrap: 'anywhere',
      }}>{value}</div>
    </div>
  )
}

function Pill({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      padding: '3px 10px',
      fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.18em',
      textTransform: 'uppercase', color, background: bg,
      border: `0.5px solid ${color}`,
    }}>
      {children}
    </span>
  )
}

// Twelve-month rolling sighting trend, oldest bucket first. Mirrors the
// shape produced by Desk.buildSpeciesLibrary so TrendChart renders it the
// same way for both this page and the Desk's species library cards.
function buildMonthlyTrend(sightings: Sighting[], months: number): number[] {
  const now = new Date()
  const buckets = Array(months).fill(0)
  for (const s of sightings) {
    const d = new Date(s.sighted_at)
    const monthsBack = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (monthsBack >= 0 && monthsBack < months) {
      buckets[months - 1 - monthsBack]++
    }
  }
  return buckets
}
