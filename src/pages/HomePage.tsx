import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useSightings } from '@/hooks/useSightings'
import { getPendingCount } from '@/lib/offline'
import { getMediaUrl } from '@/lib/storage'
import { formatCoordinates } from '@/hooks/useGeolocation'
import { DS, normalizeConf } from '@/lib/ledger-design'
import { Mono, MonoIcon, CAT_COLOR, ConfidenceDial } from '@/components/logger/shared'
import type { Sighting } from '@/types'

export default function HomePage() {
  const { sightings, loading, error, fetchSightings } = useSightings()
  const [pendingCount, setPendingCount] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    fetchSightings()
    getPendingCount().then(setPendingCount).catch(() => {})

    const refresh = () => {
      fetchSightings()
      getPendingCount().then(setPendingCount).catch(() => {})
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchSightings])

  const uniqueSpecies = new Set(
    sightings.filter(s => s.species_id).map(s => s.species_id)
  ).size
  const uniqueCategories = new Set(sightings.map(s => s.category)).size

  return (
    <div style={{ padding: '20px 20px 40px', maxWidth: 760, margin: '0 auto' }}>
      {/* Editorial heading */}
      <div style={{ marginBottom: 28 }}>
        <Mono size={10} letter={0.25} color={DS.ochre}>◆ Chapter 01 · The Feed</Mono>
        <h1 style={{
          fontFamily: DS.serif, fontSize: 44, fontWeight: 200,
          letterSpacing: '-0.03em', lineHeight: 1.0,
          margin: '10px 0 14px', color: DS.ink,
        }}>
          Your <em style={{ fontWeight: 300 }}>logbook</em>.
        </h1>
        <p style={{
          fontFamily: DS.serif, fontSize: 17, fontWeight: 300,
          fontStyle: 'italic', color: DS.inkSoft, maxWidth: 540,
          lineHeight: 1.45, margin: 0,
        }}>
          Every sighting you've entered, in the order it happened. Tap an entry to read the full record.
        </p>
      </div>

      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        border: `1px solid ${DS.ink}`, background: DS.ivory,
        marginBottom: 36,
      }}>
        <StatCell label="Entries" value={sightings.length} sub="total" />
        <StatCell label="Species" value={uniqueSpecies} sub="distinct" />
        <StatCell
          label="Pending"
          value={pendingCount}
          sub={pendingCount === 0 ? 'all synced' : 'awaiting sync'}
          last
        />
      </div>

      {/* Section mark */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        paddingBottom: 10, marginBottom: 18, borderBottom: `1px solid ${DS.ink}`,
      }}>
        <div>
          <Mono size={10} letter={0.22} color={DS.ochre}>§01</Mono>
          <h2 style={{
            fontFamily: DS.serif, fontSize: 26, fontWeight: 300,
            letterSpacing: '-0.02em', margin: '4px 0 0', color: DS.ink,
          }}>
            Recent <em style={{ fontWeight: 300 }}>entries</em>
          </h2>
        </div>
        <button
          onClick={() => fetchSightings()}
          style={{
            background: 'transparent', border: `0.5px solid ${DS.inkFaint}`,
            padding: '6px 10px', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: DS.ink,
          }}
        >Refresh</button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', background: DS.rust, color: DS.ivory,
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 18,
        }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Mono size={10} color={DS.inkFaint} letter={0.25}>⋯ Loading the journal</Mono>
        </div>
      )}

      {/* Empty state */}
      {!loading && sightings.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          border: `0.5px dashed ${DS.inkFaint}`,
        }}>
          <h3 style={{
            fontFamily: DS.serif, fontSize: 26, fontWeight: 300,
            fontStyle: 'italic', color: DS.ink, margin: 0,
          }}>The page is blank.</h3>
          <p style={{
            fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic',
            color: DS.inkSoft, margin: '10px 0 22px', fontWeight: 300,
          }}>
            Head out into the forest and make your first entry.
          </p>
          <button
            onClick={() => navigate('/new')}
            style={{
              background: DS.ochre, color: DS.ink, border: 'none',
              padding: '14px 22px', cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.3em',
              textTransform: 'uppercase', fontWeight: 500,
            }}
          >Begin the journal →</button>
        </div>
      )}

      {/* Entry list */}
      {!loading && sightings.length > 0 && (
        <div style={{ display: 'grid', gap: 0 }}>
          {sightings.map((s, i) => (
            <EntryCard key={s.id} sighting={s} num={sightings.length - i} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCell({
  label, value, sub, last,
}: { label: string; value: number; sub?: string; last?: boolean }) {
  return (
    <div style={{
      padding: '16px 16px',
      borderRight: last ? 'none' : `0.5px solid ${DS.inkHair}`,
    }}>
      <Mono size={9} letter={0.22} color={DS.inkSoft}>{label}</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 38, fontWeight: 200,
        letterSpacing: '-0.03em', color: DS.ink, lineHeight: 1.1,
        margin: '4px 0 2px',
      }}>{value}</div>
      {sub && <Mono size={8} letter={0.18} color={DS.inkFaint}>{sub}</Mono>}
    </div>
  )
}

function EntryCard({ sighting, num }: { sighting: Sighting; num: number }) {
  const media = sighting.media?.[0]
  const thumbnailUrl = media ? getMediaUrl(media.storage_path) : null
  const when = format(new Date(sighting.sighted_at), 'd MMM · HH:mm')
  const conf = normalizeConf(sighting.ai_confidence ?? 0)
  const catColor = CAT_COLOR[sighting.category]

  return (
    <Link
      to={`/sighting/${sighting.id}`}
      style={{
        display: 'grid', gridTemplateColumns: '96px 1fr auto',
        gap: 16, alignItems: 'stretch', textDecoration: 'none',
        color: DS.ink, padding: '14px 6px',
        borderTop: `0.5px solid ${DS.inkHair}`,
      }}
    >
      {/* Cover */}
      <div style={{
        width: 96, height: 96,
        background: thumbnailUrl ? undefined : DS.bone,
        position: 'relative', overflow: 'hidden',
      }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={sighting.common_name || sighting.category}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: DS.inkFaint,
          }}>
            <MonoIcon category={sighting.category} size={32} />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: 3,
            background: catColor, flexShrink: 0,
          }} />
          <Mono size={9} letter={0.2} color={DS.inkSoft}>
            № {String(num).padStart(4, '0')} · {when}
          </Mono>
        </div>
        <div style={{
          fontFamily: DS.serif, fontSize: 20, fontWeight: 400,
          letterSpacing: '-0.01em', lineHeight: 1.15, color: DS.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sighting.common_name || 'Unidentified'}
        </div>
        {sighting.scientific_name && (
          <div style={{
            fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
            fontWeight: 300, color: DS.inkSoft,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {sighting.scientific_name}
          </div>
        )}
        <div style={{
          fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.12em',
          color: DS.inkFaint, marginTop: 2,
        }}>
          {formatCoordinates(sighting.latitude, sighting.longitude)}
          {sighting.individual_count && sighting.individual_count > 0 && (
            <> · ×{String(sighting.individual_count).padStart(2, '0')}</>
          )}
        </div>
      </div>

      {/* Confidence dial */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {conf > 0 ? <ConfidenceDial value={conf} size={32} stroke={1.2} /> : (
          <Mono size={9} color={DS.inkFaint} letter={0.2}>—</Mono>
        )}
      </div>
    </Link>
  )
}
