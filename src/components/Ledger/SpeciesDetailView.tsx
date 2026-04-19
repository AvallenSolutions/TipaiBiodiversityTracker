import { useMemo } from 'react'
import { format } from 'date-fns'
import { DS } from '../../lib/ledger-design'
import { Sighting } from '../../types/sighting'
import { Mono, PhotoPlaceholder, TrendChart } from './shared'
import { buildSpeciesLibrary } from './Desk'

export function SpeciesDetailView({ speciesName, sightings, onBack, onOpenSighting }: {
  speciesName: string
  sightings: Sighting[]
  onBack: () => void
  onOpenSighting: (s: Sighting) => void
}) {
  const library = useMemo(() => buildSpeciesLibrary(sightings), [sightings])
  const sp = library.find(s => s.common === speciesName) ?? library[0]

  const matching = useMemo(() =>
    sightings
      .filter(s => (s.common_name || s.species_name || `Unknown ${s.category}`) === speciesName)
      .sort((a, b) => new Date(b.sighted_at).getTime() - new Date(a.sighted_at).getTime()),
    [sightings, speciesName])

  if (!sp) {
    return (
      <div style={{ padding: '60px 40px', background: DS.paper, minHeight: '100vh' }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
          color: DS.ink, textTransform: 'uppercase',
        }}>← Front desk</button>
        <div style={{
          marginTop: 40, fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
          fontStyle: 'italic', color: DS.inkSoft,
        }}>No records for this species yet.</div>
      </div>
    )
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    return format(d, 'MMM').toUpperCase()
  })

  const firstSeen = matching.length > 0
    ? format(new Date(matching[matching.length - 1].sighted_at), 'd MMM yyyy')
    : '—'

  return (
    <div style={{ padding: '28px 40px 80px', background: DS.paper, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
          color: DS.ink, textTransform: 'uppercase',
        }}>← Front desk</button>
        <Mono size={9} color={DS.inkFaint}>
          / SPECIES / {sp.cat.toUpperCase()} / {sp.common.toUpperCase()}
        </Mono>
      </div>

      {/* Folio header */}
      <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}`, padding: '32px 36px', marginBottom: 36 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 40 }}>
          <div>
            <Mono size={9} color={DS.ochre}>◆ FOLIO · {sp.cat.toUpperCase()}</Mono>
            <div style={{
              fontFamily: DS.serif, fontSize: 72, fontWeight: 200, letterSpacing: '-0.04em',
              lineHeight: 0.95, margin: '14px 0 8px', wordBreak: 'break-word',
            }}>{sp.common}</div>
            {sp.sci && (
              <div style={{
                fontFamily: DS.serif, fontSize: 26, fontStyle: 'italic', fontWeight: 300,
                color: DS.inkSoft, marginBottom: 20,
              }}>{sp.sci}</div>
            )}
            <div style={{
              fontFamily: DS.serif, fontSize: 19, fontWeight: 300, lineHeight: 1.55,
              color: DS.ink, maxWidth: 560,
            }}>
              Recorded <strong style={{ fontWeight: 400 }}>{sp.sightings}</strong>
              {' '}time{sp.sightings !== 1 ? 's' : ''} in the Wildlife Luxuries field record.
              Last observed <em>{sp.last} ago</em>.
            </div>
          </div>
          <div style={{ borderLeft: `0.5px solid ${DS.inkHair}`, paddingLeft: 30 }}>
            <div style={{ height: 220, marginBottom: 16 }}>
              {matching[0]?.photo_url ? (
                <img src={matching[0].photo_url} alt={sp.common}
                     style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <PhotoPlaceholder hue="ochre" height="100%" label="PLATE · ILLUSTRATIVE" />
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {([
                ['SIGHTINGS', sp.sightings],
                ['FIRST SEEN', firstSeen],
              ] as [string, string | number][]).map(([k, v], i) => (
                <div key={k} style={{
                  padding: '14px 0',
                  borderRight: i % 2 === 0 ? `0.5px solid ${DS.inkHair}` : 'none',
                  paddingLeft: i % 2 === 0 ? 0 : 16,
                  paddingRight: i % 2 === 0 ? 16 : 0,
                }}>
                  <Mono size={8} letter={0.22} color={DS.inkSoft}>{k}</Mono>
                  <div style={{
                    fontFamily: DS.serif,
                    fontSize: typeof v === 'number' ? 28 : 20,
                    fontWeight: 200, letterSpacing: '-0.02em', color: DS.ink, marginTop: 4,
                  }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div style={{ marginBottom: 36 }}>
        <Mono size={9} color={DS.ochre}>◆ §01 · TWELVE MONTHS, IN FULL</Mono>
        <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14 }}>
          Monthly sightings
        </div>
        <div style={{ background: DS.ivory, border: `0.5px solid ${DS.ink}`, padding: 22 }}>
          <TrendChart data={sp.trend} height={160} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            {months.map((m, i) => <Mono key={i} size={8} letter={0.15} color={DS.inkFaint}>{m}</Mono>)}
          </div>
        </div>
      </div>

      {/* Recent sightings */}
      <div>
        <Mono size={9} color={DS.ochre}>◆ §02 · RECENT ENTRIES</Mono>
        <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14 }}>
          Last {Math.min(matching.length, 8)} sighting{matching.length !== 1 ? 's' : ''}
        </div>
        <div style={{
          background: DS.ivory, border: `1px solid ${DS.ink}`,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        }}>
          {matching.slice(0, 8).map((s, i) => (
            <button
              key={s.id}
              onClick={() => onOpenSighting(s)}
              style={{
                padding: 18, textAlign: 'left', background: 'transparent', cursor: 'pointer',
                border: 'none',
                borderRight: (i + 1) % 4 !== 0 ? `0.5px solid ${DS.inkHair}` : 'none',
                borderBottom: i < 4 && matching.length > 4 ? `0.5px solid ${DS.inkHair}` : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,147,90,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Mono size={9} letter={0.2} color={DS.ochre}>№ {s.id.slice(0, 4).toUpperCase()}</Mono>
              <div style={{
                fontFamily: DS.serif, fontSize: 18, fontStyle: 'italic', fontWeight: 300,
                color: DS.ink, marginTop: 6, lineHeight: 1.3,
              }}>{format(new Date(s.sighted_at), 'd MMM')}</div>
              <Mono size={9} letter={0.15} color={DS.inkSoft} style={{ marginTop: 4 }}>
                {format(new Date(s.sighted_at), 'HH:mm')} · {s.latitude.toFixed(3)}°N
              </Mono>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 10, alignItems: 'center',
              }}>
                <Mono size={9} color={DS.inkSoft}>{s.category.toUpperCase()}</Mono>
                <Mono size={9} color={DS.ochre}>→</Mono>
              </div>
            </button>
          ))}
          {matching.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', padding: 24,
              fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft,
            }}>No recent sightings.</div>
          )}
        </div>
      </div>
    </div>
  )
}
