import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { DS, normalizeConf, getFlag } from '../../lib/ledger-design'
import { Sighting } from '../../types/sighting'
import { Mono, Sparkline, TrendChart, StatBlock, CatDot, ConfPill, FlagTag } from './shared'

interface SpeciesAgg {
  common: string
  sci: string | null
  cat: string
  sightings: number
  last: string
  trend: number[]
}

export function buildSpeciesLibrary(sightings: Sighting[]): SpeciesAgg[] {
  const map = new Map<string, { common: string; sci: string | null; cat: string; dates: Date[] }>()
  sightings.forEach(s => {
    const key = s.common_name || s.species_name || `Unknown ${s.category}`
    if (!map.has(key)) {
      map.set(key, {
        common: s.common_name || (s.species_name ?? key),
        sci: s.species_name,
        cat: s.category,
        dates: [],
      })
    }
    map.get(key)!.dates.push(new Date(s.sighted_at))
  })

  const now = Date.now()
  return Array.from(map.values())
    .map(v => {
      const sorted = v.dates.slice().sort((a, b) => b.getTime() - a.getTime())
      const lastMs = now - sorted[0].getTime()
      const last =
        lastMs < 3600_000 ? `${Math.max(1, Math.round(lastMs / 60_000))}m` :
        lastMs < 86_400_000 ? `${Math.round(lastMs / 3_600_000)}h` :
        `${Math.round(lastMs / 86_400_000)}d`
      const trend = Array.from({ length: 12 }, (_, i) => {
        const target = new Date()
        target.setMonth(target.getMonth() - (11 - i))
        return v.dates.filter(d =>
          d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear()
        ).length
      })
      return { common: v.common, sci: v.sci, cat: v.cat, sightings: v.dates.length, last, trend }
    })
    .sort((a, b) => b.sightings - a.sightings)
}

function buildDailyTrend(sightings: Sighting[]): number[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dateStr = d.toISOString().split('T')[0]
    return sightings.filter(s => s.sighted_at.startsWith(dateStr)).length
  })
}

function ReviewQueue({ sightings, onOpen }: { sightings: Sighting[]; onOpen: (s: Sighting) => void }) {
  const [filter, setFilter] = useState<'all' | 'flagged'>('all')

  const enriched = useMemo(() =>
    sightings.map(s => {
      const conf = normalizeConf(s.ai_confidence)
      const flag = getFlag(conf, !s.species_name && !s.common_name)
      return { s, conf, flag }
    }), [sightings])

  const rows = filter === 'all' ? enriched : enriched.filter(r => r.flag)
  const flaggedCount = enriched.filter(r => r.flag).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <Mono size={9} color={DS.ochre}>◆ §01 · The Review Queue</Mono>
          <h2 style={{ fontFamily: DS.serif, fontSize: 32, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            {sightings.length === 0 ? 'No entries yet — ' : (sightings.length === 1 ? 'One entry ' : `${sightings.length} entries `)}
            <em style={{ fontStyle: 'italic' }}>{sightings.length > 0 ? 'await your hand.' : 'begin logging.'}</em>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['all', 'flagged'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 14px',
              background: filter === f ? DS.ink : 'transparent',
              color: filter === f ? DS.ivory : DS.ink,
              border: `0.5px solid ${DS.ink}`, marginLeft: -0.5, cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>{f === 'all' ? `All · ${sightings.length}` : `Flagged · ${flaggedCount}`}</button>
          ))}
        </div>
      </div>

      <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}` }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '70px 60px 32px 1fr 150px 130px 100px 80px',
          padding: '10px 16px', borderBottom: `1px solid ${DS.ink}`,
          background: DS.bone, alignItems: 'center', gap: 12,
        }}>
          {['№', 'Time', '', 'Species', 'Location', 'Confidence', 'Category', ''].map((h, i) => (
            <Mono key={i} size={9} letter={0.22} color={DS.ink} style={{ fontWeight: 500 }}>{h}</Mono>
          ))}
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', fontFamily: DS.serif, fontSize: 18, fontStyle: 'italic', color: DS.inkSoft }}>
            {filter === 'flagged' ? 'No flagged entries.' : 'No entries yet. Start logging in the field.'}
          </div>
        ) : rows.map(({ s, conf, flag }, i) => (
          <div
            key={s.id} onClick={() => onOpen(s)}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 60px 32px 1fr 150px 130px 100px 80px',
              padding: '14px 16px',
              borderBottom: i < rows.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
              alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 120ms',
              background: i % 2 === 0 ? 'transparent' : 'rgba(184,147,90,0.04)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,147,90,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(184,147,90,0.04)')}
          >
            <Mono size={11} letter={0.05} color={DS.ink}>{s.id.slice(0, 4).toUpperCase()}</Mono>
            <Mono size={11} letter={0.05} color={DS.inkSoft}>{format(new Date(s.sighted_at), 'HH:mm')}</Mono>
            <CatDot cat={s.category} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: DS.serif, fontSize: 17, fontWeight: 400, color: DS.ink,
                letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{s.common_name || s.species_name || '—'}</div>
              {s.species_name && s.common_name && (
                <div style={{
                  fontFamily: DS.serif, fontSize: 12, fontStyle: 'italic', fontWeight: 300,
                  color: DS.inkSoft, marginTop: 1,
                }}>{s.species_name}</div>
              )}
            </div>
            <Mono size={10} letter={0.05} color={DS.inkSoft}>
              {s.latitude.toFixed(3)}°, {s.longitude.toFixed(3)}°
            </Mono>
            {conf > 0 ? <ConfPill value={conf} /> : <FlagTag flag="needs-id" />}
            <Mono size={10} letter={0.15} color={DS.ink} style={{ textTransform: 'uppercase' }}>{s.category}</Mono>
            <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              {flag && conf > 0 && <FlagTag flag={flag} />}
              <Mono size={9} letter={0.2} color={DS.ochre}>→</Mono>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpeciesLibrary({ sightings, onOpenSpecies }: {
  sightings: Sighting[]; onOpenSpecies: (name: string) => void
}) {
  const library = useMemo(() => buildSpeciesLibrary(sightings).slice(0, 6), [sightings])
  return (
    <div>
      <Mono size={9} color={DS.ochre}>◆ §05 · The Library</Mono>
      <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14 }}>
        Most seen this season
      </div>
      <div style={{ background: DS.ivory, border: `0.5px solid ${DS.ink}` }}>
        {library.length === 0 ? (
          <div style={{ padding: 24, fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft }}>
            No species recorded yet.
          </div>
        ) : library.map((sp, i) => (
          <button
            key={sp.common}
            onClick={() => onOpenSpecies(sp.common)}
            style={{
              display: 'grid', gridTemplateColumns: '32px 1fr auto 60px',
              gap: 12, padding: '12px 16px', width: '100%',
              background: 'transparent', textAlign: 'left', cursor: 'pointer',
              border: 'none',
              borderBottom: i < library.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,147,90,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <CatDot cat={sp.cat} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: DS.serif, fontSize: 14, fontWeight: 400, color: DS.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{sp.common}</div>
              <Mono size={8} letter={0.15} color={DS.inkFaint} style={{ marginTop: 2 }}>
                {sp.last.toUpperCase()} AGO · {sp.cat.toUpperCase()}
              </Mono>
            </div>
            <Sparkline data={sp.trend} width={54} height={18} color={DS.forest} />
            <Mono size={13} letter={0.05} color={DS.ink} style={{ textAlign: 'right' }}>
              {sp.sightings}
            </Mono>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReserveMap({ sightings }: { sightings: Sighting[] }) {
  return (
    <div style={{ background: DS.ivory, border: `0.5px solid ${DS.ink}`, padding: 20, position: 'relative' }}>
      <Mono size={9} color={DS.ochre}>◆ §03 · The Terrain</Mono>
      <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14 }}>
        Sightings · plotted
      </div>
      <div style={{
        position: 'relative', aspectRatio: '1.6',
        background: 'repeating-linear-gradient(45deg, transparent 0 8px, rgba(63,80,72,0.04) 8px 9px)',
        border: `0.5px solid ${DS.inkHair}`, overflow: 'hidden',
      }}>
        {sightings.length === 0 ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontFamily: DS.serif, fontSize: 18, fontStyle: 'italic', fontWeight: 300, color: DS.inkSoft, lineHeight: 1.6 }}>
                No sightings to plot
              </div>
              <Mono size={9} color={DS.inkFaint} style={{ marginTop: 6 }}>BEGIN LOGGING TO POPULATE THE TERRAIN</Mono>
            </div>
          </div>
        ) : (
          <PlotPoints sightings={sightings} />
        )}
        <div style={{ position: 'absolute', bottom: 10, right: 10, textAlign: 'center' }}>
          <div style={{ fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic', color: DS.inkSoft }}>N</div>
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2L13 14L10 12L7 14Z" fill={DS.ink} /></svg>
        </div>
      </div>
    </div>
  )
}

function PlotPoints({ sightings }: { sightings: Sighting[] }) {
  if (sightings.length === 0) return null
  const lats = sightings.map(s => s.latitude)
  const lngs = sightings.map(s => s.longitude)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const latRange = maxLat - minLat || 0.01
  const lngRange = maxLng - minLng || 0.01
  return (
    <>
      {sightings.map(s => {
        const x = ((s.longitude - minLng) / lngRange) * 90 + 5
        const y = 95 - ((s.latitude - minLat) / latRange) * 90
        return (
          <div key={s.id} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: 6, height: 6, borderRadius: 3, background: DS.ochre,
            transform: 'translate(-50%,-50%)', opacity: 0.75,
          }} />
        )
      })}
    </>
  )
}

export function Desk({ sightings, onOpenSighting, onOpenSpecies }: {
  sightings: Sighting[]
  onOpenSighting: (s: Sighting) => void
  onOpenSpecies: (name: string) => void
}) {
  const flaggedCount = sightings.filter(s => {
    const conf = normalizeConf(s.ai_confidence)
    return getFlag(conf, !s.species_name && !s.common_name) !== null
  }).length
  const speciesSet = new Set(sightings.map(s => s.common_name || s.species_name).filter(Boolean))
  const tigerCount = sightings.filter(s =>
    (s.common_name || '').toLowerCase().includes('tiger') ||
    (s.species_name || '').toLowerCase().includes('tigris')
  ).length

  const dailyTrend = useMemo(() => buildDailyTrend(sightings), [sightings])
  const maxDay = Math.max(...dailyTrend, 0)
  const today = dailyTrend[dailyTrend.length - 1]

  return (
    <div style={{ padding: '28px 40px 80px', background: DS.paper, minHeight: '100vh' }}>
      <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}`, display: 'flex', marginBottom: 36, flexWrap: 'wrap' }}>
        <StatBlock label="Total Sightings" value={sightings.length} sub="in the record" />
        <StatBlock label="Flagged" value={flaggedCount} sub="needing attention" accent={flaggedCount > 0 ? DS.rust : undefined} />
        <StatBlock label="Species" value={speciesSet.size} sub="distinct, logged" />
        <StatBlock label="Today" value={today} sub="sightings since sunrise" accent={DS.ochre} />
        <StatBlock label="Tigers" value={tigerCount || '—'} sub="Panthera tigris" accent={tigerCount > 0 ? DS.ochre : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 36, marginBottom: 40 }}>
        <ReviewQueue sightings={sightings} onOpen={onOpenSighting} />

        <div>
          <Mono size={9} color={DS.ochre}>◆ §02 · The Almanac</Mono>
          <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14 }}>
            30 days of sightings
          </div>
          <div style={{ background: DS.ivory, border: `0.5px solid ${DS.ink}`, padding: 18 }}>
            <TrendChart data={dailyTrend} height={150} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <Mono size={8} letter={0.2} color={DS.inkFaint}>
                {format(new Date(Date.now() - 29 * 86_400_000), 'dd MMM').toUpperCase()}
              </Mono>
              <Mono size={8} letter={0.2} color={DS.inkFaint}>
                {format(new Date(Date.now() - 14 * 86_400_000), 'dd MMM').toUpperCase()}
              </Mono>
              <Mono size={8} letter={0.2} color={DS.inkFaint}>
                {format(new Date(), 'dd MMM').toUpperCase()}
              </Mono>
            </div>
            {maxDay > 0 && (
              <div style={{ borderTop: `0.5px solid ${DS.inkHair}`, marginTop: 16, paddingTop: 14 }}>
                <div style={{ fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic', fontWeight: 300, color: DS.ink, lineHeight: 1.5 }}>
                  A <strong style={{ fontStyle: 'normal', fontWeight: 400, color: DS.ochre }}>{maxDay}-sighting day</strong>
                  {' '}— the highest of the past thirty.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 36 }}>
        <ReserveMap sightings={sightings} />
        <SpeciesLibrary sightings={sightings} onOpenSpecies={onOpenSpecies} />
      </div>
    </div>
  )
}
