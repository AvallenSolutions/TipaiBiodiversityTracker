import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { DS, normalizeConf, getFlag, catLetter } from '../../lib/ledger-design'
import { getMediaUrl } from '../../lib/storage'
import { useSightings } from '../../hooks/useSightings'
import type { Sighting, SightingCategory, VerificationStatus } from '../../types'
import { Mono, CatDot, ConfPill, FlagTag } from './shared'

type StatusFilter = 'all' | VerificationStatus | 'manual'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'unverified',   label: 'Unverified' },
  { value: 'ai_suggested', label: 'AI suggested' },
  { value: 'verified',     label: 'Verified' },
  { value: 'rejected',     label: 'Rejected' },
  { value: 'manual',       label: 'Manual' },
]

const CATEGORY_OPTIONS: ('all' | SightingCategory)[] = [
  'all', 'mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace',
]

function getPhotoUrl(s: Sighting): string | null {
  const photo = s.media?.find(m => m.media_type === 'photo')
  return photo ? getMediaUrl(photo.storage_path) : null
}

export function SightingsListView({
  sightings, onOpenSighting, onChanged,
}: {
  sightings: Sighting[]
  onOpenSighting: (s: Sighting) => void
  onChanged: () => void
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | SightingCategory>('all')
  const [search, setSearch] = useState('')
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { verifySighting } = useSightings()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sightings.filter(s => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
      if (statusFilter !== 'all') {
        if (statusFilter === 'manual') {
          if (!(!!s.common_name && !s.species_id)) return false
        } else if (s.verification_status !== statusFilter) {
          return false
        }
      }
      if (q) {
        const hay = [
          s.common_name, s.scientific_name, s.notes, s.category,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    // sightings already arrive sorted desc by sighted_at from the hook
  }, [sightings, statusFilter, categoryFilter, search])

  const counts = useMemo(() => {
    const total = sightings.length
    const unverified = sightings.filter(s => s.verification_status === 'unverified').length
    const verified = sightings.filter(s => s.verification_status === 'verified').length
    const manual = sightings.filter(s => !!s.common_name && !s.species_id).length
    return { total, unverified, verified, manual }
  }, [sightings])

  async function quickVerify(s: Sighting, e: React.MouseEvent) {
    e.stopPropagation()
    setActionError(null)
    setVerifyingId(s.id)
    try {
      await verifySighting(s.id)
      onChanged()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to verify sighting')
    } finally {
      setVerifyingId(null)
    }
  }

  return (
    <div style={{ padding: '28px 40px 80px', background: DS.paper, minHeight: '100vh' }}>
      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        background: DS.ivory, border: `1px solid ${DS.ink}`, marginBottom: 28,
      }}>
        <Stat label="All entries" value={counts.total} />
        <Stat label="Unverified" value={counts.unverified} accent={counts.unverified > 0} />
        <Stat label="Verified" value={counts.verified} />
        <Stat label="Manual" value={counts.manual} last />
      </div>

      {/* Filters */}
      <div style={{
        display: 'grid', gap: 16, marginBottom: 22,
        gridTemplateColumns: 'minmax(220px, 1fr) auto auto',
        alignItems: 'flex-end',
      }}>
        <div>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Search</Mono>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Common name, scientific name, notes…"
            style={{
              width: '100%', padding: '10px 12px',
              border: `0.5px solid ${DS.ink}`, background: DS.ivory,
              fontFamily: DS.serif, fontSize: 15, fontWeight: 400, color: DS.ink,
              outline: 'none',
            }}
          />
        </div>
        <div>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Status</Mono>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Category</Mono>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | SightingCategory)}
            style={selectStyle}
          >
            {CATEGORY_OPTIONS.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <div style={{
          padding: '10px 14px', background: DS.rust, color: DS.ivory,
          fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.15em',
          marginBottom: 16, textTransform: 'uppercase',
        }}>{actionError}</div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 12,
      }}>
        <div>
          <Mono size={9} color={DS.ochre}>◆ ENTRIES, MOST RECENT FIRST</Mono>
          <div style={{
            fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
            letterSpacing: '-0.02em', marginTop: 4,
          }}>
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div style={{ background: DS.ivory, border: `1px solid ${DS.ink}` }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '40px 28px', textAlign: 'center',
            fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft,
          }}>
            No sightings match these filters.
          </div>
        ) : (
          filtered.map((s, i) => {
            const conf = normalizeConf(s.ai_confidence)
            const flag = getFlag(conf, !s.common_name)
            const photo = getPhotoUrl(s)
            const isManual = !!s.common_name && !s.species_id
            const isVerified = s.verification_status === 'verified'
            const isRejected = s.verification_status === 'rejected'
            const verifying = verifyingId === s.id
            return (
              <button
                key={s.id}
                onClick={() => onOpenSighting(s)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr auto auto',
                  gap: 16, alignItems: 'center',
                  width: '100%', textAlign: 'left',
                  background: 'transparent', cursor: 'pointer',
                  border: 'none',
                  borderBottom: i < filtered.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                  padding: '14px 20px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `rgba(184,147,90,0.06)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Thumbnail */}
                <div style={{ width: 64, height: 64, position: 'relative', flexShrink: 0 }}>
                  {photo ? (
                    <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', background: DS.bone,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: DS.mono, fontSize: 16, color: DS.inkFaint,
                    }}>{catLetter(s.category)}</div>
                  )}
                </div>

                {/* Title + meta */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: DS.serif, fontSize: 18, fontWeight: 400,
                      color: DS.ink, lineHeight: 1.2,
                    }}>
                      {s.common_name || <em style={{ color: DS.inkSoft, fontWeight: 300 }}>Unidentified</em>}
                    </span>
                    {flag && <FlagTag label={flag} />}
                    {isManual && <FlagTag label="MANUAL" />}
                    {isVerified && (
                      <span style={{
                        padding: '2px 8px', background: DS.forest, color: DS.ivory,
                        fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}>● Verified</span>
                    )}
                    {isRejected && (
                      <span style={{
                        padding: '2px 8px', background: DS.rust, color: DS.ivory,
                        fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}>× Rejected</span>
                    )}
                  </div>
                  {s.scientific_name && (
                    <div style={{
                      fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
                      fontWeight: 300, color: DS.inkSoft, marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.scientific_name}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <CatDot cat={s.category} />
                    <Mono size={9} letter={0.12} color={DS.inkSoft}>
                      {s.category.toUpperCase()} · {format(new Date(s.sighted_at), 'd MMM yyyy · HH:mm')}
                    </Mono>
                    {(s.profile?.display_name || s.profile?.email) && (
                      <Mono size={9} letter={0.12} color={DS.inkSoft}>
                        BY {(s.profile?.display_name || s.profile?.email || '').toUpperCase()}
                      </Mono>
                    )}
                    {s.latitude != null && s.longitude != null && (
                      <Mono size={9} letter={0.1} color={DS.inkFaint}>
                        {s.latitude.toFixed(4)}°N · {s.longitude.toFixed(4)}°E
                      </Mono>
                    )}
                  </div>
                </div>

                {/* Confidence */}
                <div>
                  {conf > 0 ? <ConfPill conf={conf} /> : (
                    <Mono size={9} color={DS.inkFaint} letter={0.18}>—</Mono>
                  )}
                </div>

                {/* Quick verify */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!isVerified && (
                    <button
                      onClick={(e) => quickVerify(s, e)}
                      disabled={verifying}
                      style={{
                        background: DS.ink, color: DS.ivory,
                        border: 'none', padding: '6px 10px',
                        cursor: verifying ? 'not-allowed' : 'pointer',
                        fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        opacity: verifying ? 0.5 : 1,
                      }}
                    >
                      {verifying ? '⋯' : '✓ Verify'}
                    </button>
                  )}
                  <Mono size={10} color={DS.ochre}>→</Mono>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent, last }: { label: string; value: number; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRight: last ? 'none' : `0.5px solid ${DS.inkHair}`,
    }}>
      <Mono size={9} letter={0.22} color={DS.inkSoft}>{label}</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
        letterSpacing: '-0.03em', color: accent ? DS.rust : DS.ink, lineHeight: 1.1,
        margin: '4px 0 0',
      }}>{value}</div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '10px 12px', border: `0.5px solid ${DS.ink}`,
  background: DS.ivory, color: DS.ink,
  fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.15em',
  textTransform: 'uppercase', cursor: 'pointer', minWidth: 160,
}
