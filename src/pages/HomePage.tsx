import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useSightings } from '@/hooks/useSightings'
import { getPendingCount } from '@/lib/offline'
import { getMediaUrl } from '@/lib/storage'
import { DS, normalizeConf, catLetter } from '@/lib/ledger-design'
import type { SightingCategory } from '@/types'

const mono = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, ...extra,
})

const catColor: Record<SightingCategory, string> = {
  mammal: DS.ochre, bird: '#4A7FA5', reptile: DS.forest,
  amphibian: '#5E8A8A', insect: DS.rust, plant: DS.forest,
  fungi: '#7B5E8A', trace: DS.inkSoft,
}

export default function HomePage() {
  const { sightings, loading, fetchSightings } = useSightings()
  const [pendingCount, setPendingCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchSightings()
    getPendingCount().then(setPendingCount).catch(() => {})
  }, [fetchSightings])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetchSightings()
      setPendingCount(await getPendingCount())
    } finally {
      setRefreshing(false)
    }
  }

  const uniqueSpecies = new Set(sightings.filter(s => s.species_id).map(s => s.species_id)).size
  const todayCount = sightings.filter(s => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    return new Date(s.sighted_at) >= d
  }).length

  if (loading && !refreshing) {
    return (
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: DS.paper,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: DS.serif, fontSize: 24, fontWeight: 200, fontStyle: 'italic', color: DS.ink }}>
            Reading the field…
          </div>
          <div style={{ ...mono({ color: DS.inkSoft, marginTop: 10 }) }}>Loading records</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: DS.paper, minHeight: '100vh', fontFamily: DS.sans }}>

      {/* Stats header */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{
          background: DS.ivory, border: `1px solid ${DS.ink}`,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        }}>
          {[
            { label: 'Sightings', value: sightings.length },
            { label: 'Species', value: uniqueSpecies },
            { label: 'Today', value: todayCount },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '16px 14px',
              borderRight: i < 2 ? `0.5px solid ${DS.inkHair}` : 'none',
            }}>
              <div style={{ ...mono({ color: DS.inkSoft, fontSize: 8 }) }}>{s.label}</div>
              <div style={{ fontFamily: DS.serif, fontSize: 28, fontWeight: 200, letterSpacing: '-0.02em', color: DS.ink, marginTop: 2 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {pendingCount > 0 && (
          <div style={{ background: DS.ochre, padding: '8px 14px', marginTop: -1, border: `1px solid ${DS.ink}`, borderTop: 'none' }}>
            <span style={{ ...mono({ color: DS.ivory, fontSize: 8, letterSpacing: '0.18em' }) }}>
              ○ {pendingCount} sighting{pendingCount !== 1 ? 's' : ''} pending sync
            </span>
          </div>
        )}
      </div>

      {/* Section header */}
      <div style={{ padding: '28px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ ...mono({ color: DS.ochre }) }}>◆ Recent entries</div>
          <div style={{ fontFamily: DS.serif, fontSize: 26, fontWeight: 300, letterSpacing: '-0.02em', color: DS.ink, marginTop: 3 }}>
            {sightings.length > 0 ? `${sightings.length} in the field record` : 'No entries yet'}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: 'transparent', border: `0.5px solid ${DS.inkHair}`,
            cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1,
            ...mono({ color: DS.inkSoft, letterSpacing: '0.18em', padding: '6px 12px' }),
          }}
        >
          {refreshing ? 'Reading…' : 'Refresh'}
        </button>
      </div>

      {/* Empty state */}
      {!loading && sightings.length === 0 && (
        <div style={{ margin: '0 20px', padding: '40px 24px', background: DS.ivory, border: `1px solid ${DS.ink}`, textAlign: 'center' }}>
          <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, fontStyle: 'italic', color: DS.inkSoft, marginBottom: 20 }}>
            Head out and make the first entry.
          </div>
          <button
            onClick={() => navigate('/new')}
            style={{
              padding: '14px 24px', background: DS.ink, color: DS.ivory, border: 'none',
              cursor: 'pointer', ...mono({ letterSpacing: '0.25em' }),
            }}
          >
            Log a sighting →
          </button>
        </div>
      )}

      {/* Sighting feed */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ border: `1px solid ${DS.ink}`, background: DS.ivory }}>
          {sightings.map((s, i) => {
            const media = s.media?.[0]
            const thumbUrl = media ? getMediaUrl(media.storage_path) : null
            const conf = normalizeConf(s.ai_confidence)

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/sighting/${s.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 14, alignItems: 'center',
                  width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                  borderBottom: i < sightings.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                  padding: '14px 16px', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,147,90,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Thumbnail */}
                <div style={{ width: 60, height: 60, flexShrink: 0, position: 'relative' }}>
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `linear-gradient(165deg, rgba(63,80,72,0.15) 0%, rgba(63,80,72,0.3) 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: DS.mono, fontSize: 18, fontWeight: 500,
                        color: catColor[s.category] ?? DS.ochre, opacity: 0.7,
                      }}>{catLetter(s.category)}</span>
                    </div>
                  )}
                  {/* Category colour tab */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, width: 3, height: '100%',
                    background: catColor[s.category] ?? DS.ochre,
                  }} />
                </div>

                {/* Info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: DS.serif, fontSize: 17, fontWeight: 300, color: DS.ink, lineHeight: 1.2, marginBottom: 3 }}>
                    {s.common_name || <em style={{ color: DS.inkSoft }}>Unidentified</em>}
                  </div>
                  {s.scientific_name && (
                    <div style={{ fontFamily: DS.serif, fontSize: 12, fontStyle: 'italic', color: DS.inkSoft, marginBottom: 3 }}>
                      {s.scientific_name}
                    </div>
                  )}
                  <div style={{ ...mono({ fontSize: 8, color: DS.inkSoft, letterSpacing: '0.15em' }) }}>
                    {format(new Date(s.sighted_at), 'd MMM · HH:mm')} · {s.category}
                  </div>
                </div>

                {/* Right */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {conf > 0 && (
                    <span style={{
                      ...mono({ fontSize: 8 }),
                      color: conf >= 0.8 ? DS.forest : conf >= 0.5 ? DS.ochre : DS.rust,
                    }}>
                      {Math.round(conf * 100)}%
                    </span>
                  )}
                  <span style={{ ...mono({ fontSize: 9, color: DS.ochre }) }}>→</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Log CTA */}
      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={() => navigate('/new')}
          style={{
            width: '100%', padding: '18px 20px', background: DS.ochre, color: DS.ink, border: 'none',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            ...mono({ letterSpacing: '0.25em' }),
          }}
        >
          <span>Log a sighting</span>
          <span style={{ fontFamily: DS.serif, fontStyle: 'italic', fontSize: 18, textTransform: 'none', letterSpacing: 0 }}>⊕</span>
        </button>
      </div>
    </div>
  )
}
