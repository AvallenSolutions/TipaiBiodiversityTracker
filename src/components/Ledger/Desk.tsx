import { useMemo, useState } from 'react'
import { formatDistanceToNow, format, subMonths, startOfMonth } from 'date-fns'
import { DS, normalizeConf, getFlag, catLetter } from '../../lib/ledger-design'
import { getMediaUrl } from '../../lib/storage'
import type { Sighting } from '../../types'
import { Mono, StatBlock, CatDot, ConfPill, FlagTag, Sparkline } from './shared'
import { ReserveMap } from './ReserveMap'

export interface SpeciesEntry {
  common: string
  sci: string | null
  cat: string
  sightings: number
  last: string
  trend: number[]
  flagged: boolean
}

export function buildSpeciesLibrary(sightings: Sighting[]): SpeciesEntry[] {
  const map = new Map<string, Sighting[]>()
  for (const s of sightings) {
    const key = s.common_name || s.scientific_name || `Unknown ${s.category}`
    const arr = map.get(key) ?? []
    arr.push(s)
    map.set(key, arr)
  }

  const now = new Date()
  return Array.from(map.entries()).map(([common, ss]) => {
    const sorted = [...ss].sort((a, b) =>
      new Date(b.sighted_at).getTime() - new Date(a.sighted_at).getTime())
    const latest = sorted[0]!
    const last = formatDistanceToNow(new Date(latest.sighted_at), { addSuffix: false })
    const trend = buildMonthlyTrend(ss, 12)
    const conf = normalizeConf(latest.ai_confidence)
    const flagged = !!getFlag(conf, !latest.common_name)
    return {
      common,
      sci: latest.scientific_name ?? null,
      cat: latest.category,
      sightings: ss.length,
      last,
      trend,
      flagged,
    }
  }).sort((a, b) => b.sightings - a.sightings)
}

function buildMonthlyTrend(sightings: Sighting[], months: number): number[] {
  const now = new Date()
  const buckets = Array(months).fill(0)
  for (const s of sightings) {
    const d = new Date(s.sighted_at)
    for (let i = 0; i < months; i++) {
      const start = startOfMonth(subMonths(now, months - 1 - i))
      const end = startOfMonth(subMonths(now, months - 2 - i))
      if (d >= start && d < end) { buckets[i]++; break }
    }
  }
  return buckets
}

export function buildDailyTrend(sightings: Sighting[], days = 30): number[] {
  const now = new Date()
  const buckets = Array(days).fill(0)
  for (const s of sightings) {
    const diff = Math.floor((now.getTime() - new Date(s.sighted_at).getTime()) / 86400000)
    if (diff >= 0 && diff < days) buckets[days - 1 - diff]++
  }
  return buckets
}

function getPhotoUrl(s: Sighting): string | null {
  const photo = s.media?.find(m => m.media_type === 'photo')
  return photo ? getMediaUrl(photo.storage_path) : null
}

// ─── Review Queue ───────────────────────────────────────────────────────────

function ReviewQueue({
  sightings, onOpenSighting,
}: {
  sightings: Sighting[]
  onOpenSighting: (s: Sighting) => void
}) {
  const [showFlagged, setShowFlagged] = useState(false)

  const flagged = useMemo(() =>
    sightings.filter(s => {
      const conf = normalizeConf(s.ai_confidence)
      const isManual = !!s.common_name && !s.species_id
      return !!getFlag(conf, !s.common_name)
        || s.verification_status === 'unverified'
        || isManual
    }), [sightings])

  const displayed = showFlagged ? flagged : sightings.slice(0, 20)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <Mono size={9} color={DS.ochre}>◆ §01 · REVIEW QUEUE</Mono>
          <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4 }}>
            {showFlagged ? `${flagged.length} flagged record${flagged.length !== 1 ? 's' : ''}` : 'Recent sightings'}
          </div>
        </div>
        <button onClick={() => setShowFlagged(f => !f)} style={{
          background: showFlagged ? DS.rust : 'transparent',
          border: `0.5px solid ${showFlagged ? DS.rust : DS.inkHair}`,
          color: showFlagged ? DS.ivory : DS.inkSoft,
          cursor: 'pointer', fontFamily: DS.mono, fontSize: 9,
          letterSpacing: '0.18em', textTransform: 'uppercase', padding: '6px 14px',
        }}>
          {showFlagged ? '← All records' : `▲ ${flagged.length} flagged`}
        </button>
      </div>

      <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}` }}>
        {displayed.length === 0 && (
          <div style={{
            padding: '24px 28px', fontFamily: DS.serif,
            fontSize: 16, fontStyle: 'italic', color: DS.inkSoft,
          }}>No records to display.</div>
        )}
        {displayed.map((s, i) => {
          const conf = normalizeConf(s.ai_confidence)
          const flag = getFlag(conf, !s.common_name)
          const photo = getPhotoUrl(s)
          return (
            <button
              key={s.id}
              onClick={() => onOpenSighting(s)}
              style={{
                display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 16,
                width: '100%', textAlign: 'left', background: 'transparent', cursor: 'pointer',
                border: 'none', borderBottom: i < displayed.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                padding: '14px 20px', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `rgba(184,147,90,0.06)`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 44, height: 44, flexShrink: 0, position: 'relative' }}>
                {photo ? (
                  <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', background: DS.bone,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: DS.mono, fontSize: 14, color: DS.inkFaint,
                  }}>{catLetter(s.category)}</div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{
                    fontFamily: DS.serif, fontSize: 17, fontWeight: 300,
                    color: DS.ink, lineHeight: 1.2,
                  }}>{s.common_name || <em style={{ color: DS.inkSoft }}>Unidentified</em>}</span>
                  {flag && <FlagTag label={flag} />}
                  {s.common_name && !s.species_id && <FlagTag label="MANUAL" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CatDot cat={s.category} />
                  <Mono size={9} letter={0.12} color={DS.inkSoft}>
                    {s.category.toUpperCase()} · {format(new Date(s.sighted_at), 'd MMM · HH:mm')}
                  </Mono>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {conf > 0 && <ConfPill conf={conf} />}
                <Mono size={9} color={DS.ochre}>→</Mono>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Species Library ────────────────────────────────────────────────────────

function SpeciesLibrary({
  library, onOpenSpecies,
}: {
  library: SpeciesEntry[]
  onOpenSpecies: (name: string) => void
}) {
  return (
    <div>
      <Mono size={9} color={DS.ochre}>◆ §02 · THE LIBRARY</Mono>
      <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14 }}>
        {library.length} species on record
      </div>
      <div style={{
        background: DS.ivory, border: `1px solid ${DS.ink}`,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      }}>
        {library.map((sp, i) => (
          <button
            key={sp.common}
            onClick={() => onOpenSpecies(sp.common)}
            style={{
              padding: '18px 20px', textAlign: 'left', background: 'transparent',
              cursor: 'pointer', border: 'none',
              borderRight: (i + 1) % 3 !== 0 ? `0.5px solid ${DS.inkHair}` : 'none',
              borderBottom: i < library.length - (library.length % 3 || 3)
                ? `0.5px solid ${DS.inkHair}` : 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `rgba(184,147,90,0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <CatDot cat={sp.cat} />
              <Mono size={8} letter={0.18} color={DS.inkSoft}>{sp.cat.toUpperCase()}</Mono>
            </div>
            <div style={{
              fontFamily: DS.serif, fontSize: 18, fontWeight: 300,
              color: DS.ink, lineHeight: 1.25, marginBottom: 2,
            }}>{sp.common}</div>
            {sp.sci && (
              <div style={{
                fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
                fontWeight: 300, color: DS.inkSoft,
              }}>{sp.sci}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mono size={8} letter={0.12} color={DS.inkFaint}>
                  {sp.sightings}× · {sp.last} ago
                </Mono>
              </div>
              <Sparkline data={sp.trend} height={20} />
            </div>
          </button>
        ))}
        {library.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', padding: 32,
            fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft,
          }}>No species recorded yet.</div>
        )}
      </div>
    </div>
  )
}

// ─── Desk ────────────────────────────────────────────────────────────────────

export function Desk({
  sightings, onOpenSighting, onOpenSpecies,
}: {
  sightings: Sighting[]
  onOpenSighting: (s: Sighting) => void
  onOpenSpecies: (name: string) => void
}) {
  const library = useMemo(() => buildSpeciesLibrary(sightings), [sightings])
  const trend = useMemo(() => buildDailyTrend(sightings, 30), [sightings])

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    return sightings.filter(s => new Date(s.sighted_at) >= d).length
  }, [sightings])

  const flaggedCount = useMemo(() =>
    sightings.filter(s => {
      const conf = normalizeConf(s.ai_confidence)
      const isManual = !!s.common_name && !s.species_id
      return !!getFlag(conf, !s.common_name)
        || s.verification_status === 'unverified'
        || isManual
    }).length, [sightings])

  const tigers = useMemo(() =>
    sightings.filter(s =>
      s.category === 'mammal' &&
      (s.common_name?.toLowerCase().includes('tiger') || s.scientific_name?.toLowerCase().includes('panthera tigris'))
    ).length, [sightings])

  return (
    <div style={{ padding: '28px 40px 80px', background: DS.paper, minHeight: '100vh' }}>
      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        background: DS.ivory, border: `1px solid ${DS.ink}`,
        marginBottom: 36,
      }}>
        <StatBlock label="Total Sightings" value={sightings.length} />
        <StatBlock label="Flagged" value={flaggedCount} />
        <StatBlock label="Species" value={library.length} />
        <StatBlock label="Today" value={today} />
        <StatBlock label="Tiger Sightings" value={tigers} accent />
      </div>

      {/* 30-day trend */}
      <div style={{ marginBottom: 40 }}>
        <Mono size={9} color={DS.ochre}>◆ §00 · ACTIVITY · LAST 30 DAYS</Mono>
        <div style={{
          background: DS.ivory, border: `0.5px solid ${DS.ink}`,
          padding: '16px 20px', marginTop: 10,
        }}>
          <svg width="100%" height={48} viewBox="0 0 300 48" preserveAspectRatio="none">
            {trend.map((v, i) => {
              const max = Math.max(...trend, 1)
              const bh = (v / max) * 40
              return (
                <rect
                  key={i}
                  x={(i / 30) * 300}
                  y={48 - bh}
                  width={300 / 30 - 1}
                  height={bh}
                  fill={DS.ochre}
                  opacity={0.65}
                />
              )
            })}
          </svg>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <ReviewQueue sightings={sightings} onOpenSighting={onOpenSighting} />
          <ReserveMap sightings={sightings} onOpenSighting={onOpenSighting} />
        </div>
        <SpeciesLibrary library={library} onOpenSpecies={onOpenSpecies} />
      </div>
    </div>
  )
}
