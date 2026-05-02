import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import { useSpeciesStats } from '@/hooks/useSpeciesStats'
import type { Species } from '@/types'

interface Props {
  species: Species
  onClose: () => void
}

export default function SpeciesDetailSheet({ species, onClose }: Props) {
  const { stats, loading } = useSpeciesStats(species)
  // Cover priority: explicit library plate, else most recent linked sighting
  // photo (loaded by useSpeciesStats), else null → "No plate on file".
  const coverFallback = species.reference_image_url ?? stats?.coverPhotoUrl ?? null
  const [activeImage, setActiveImage] = useState<string | null>(coverFallback)

  // Reset cover when sheet opens for a different species, and pick up the
  // sighting-derived fallback once useSpeciesStats resolves.
  useEffect(() => {
    setActiveImage(species.reference_image_url ?? stats?.coverPhotoUrl ?? null)
  }, [species.id, species.reference_image_url, stats?.coverPhotoUrl])

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Image carousel: explicit gallery first; if neither library plate nor
  // gallery exist, fall back to the sighting-derived cover so users still
  // get a single thumbnail to look at.
  const allImages = [
    species.reference_image_url,
    ...(species.gallery_image_urls || []),
    ...(!species.reference_image_url && (!species.gallery_image_urls || species.gallery_image_urls.length === 0) && stats?.coverPhotoUrl
      ? [stats.coverPhotoUrl]
      : []),
  ].filter((u): u is string => !!u)

  const firstSeenLabel = stats?.firstSeenAt
    ? format(new Date(stats.firstSeenAt), 'd MMM yyyy')
    : '—'

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${species.common_name} details`}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        animation: 'fade-in 200ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 760,
          maxHeight: '95vh',
          background: DS.paper,
          borderTop: `3px double ${DS.ink}`,
          overflow: 'auto',
          animation: 'slide-up-fade 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Sticky close bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px',
          background: DS.paper,
          borderBottom: `0.5px solid ${DS.inkHair}`,
        }}>
          <Mono size={9} color={DS.ochre} letter={0.22}>◆ The Library · Folio</Mono>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, border: `0.5px solid ${DS.ink}`,
              background: 'transparent', color: DS.ink, cursor: 'pointer',
              fontFamily: DS.serif, fontSize: 18, lineHeight: '28px', padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Hero image */}
        {activeImage ? (
          <div style={{
            width: '100%', aspectRatio: '4 / 3',
            background: DS.bone, overflow: 'hidden',
            borderBottom: `0.5px solid ${DS.inkHair}`,
          }}>
            <img
              src={activeImage}
              alt={species.common_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <div style={{
            width: '100%', aspectRatio: '4 / 3', background: DS.bone,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderBottom: `0.5px solid ${DS.inkHair}`,
          }}>
            <Mono size={9} color={DS.inkFaint} letter={0.22}>No plate on file</Mono>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '20px 20px 24px' }}>
          {/* Breadcrumb */}
          <Mono size={9} color={DS.ochre} letter={0.22} style={{ marginBottom: 8 }}>
            ◆ FOLIO · {species.category.toUpperCase()}{species.family ? ` · ${species.family.toUpperCase()}` : ''}
          </Mono>

          {/* Title + scientific name */}
          <h2 style={{
            fontFamily: DS.serif, fontSize: 36, fontWeight: 300,
            letterSpacing: '-0.025em', lineHeight: 1.05,
            margin: '6px 0 6px', color: DS.ink,
          }}>
            {species.common_name}
          </h2>
          {species.scientific_name && (
            <p style={{
              fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic',
              fontWeight: 300, color: DS.inkSoft, margin: '0 0 12px',
            }}>
              {species.scientific_name}
            </p>
          )}

          {/* Pills */}
          {(species.is_notable || species.is_native != null) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {species.is_notable && (
                <Pill color={DS.rust} bg="rgba(160,80,60,0.08)">Notable</Pill>
              )}
              {species.is_native === true && (
                <Pill color={DS.forest} bg="rgba(63,80,72,0.08)">Native</Pill>
              )}
              {species.is_native === false && (
                <Pill color={DS.inkSoft} bg={DS.ivory}>Non-native</Pill>
              )}
            </div>
          )}

          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
            border: `0.5px solid ${DS.ink}`, marginBottom: 20,
          }}>
            <Stat label="Sightings" value={loading ? '…' : String(stats?.sightingsCount ?? 0)} />
            <Stat label="Territories" value={loading ? '…' : String(stats?.territoriesCount ?? 0)} divider />
            <Stat label="First seen" value={loading ? '…' : firstSeenLabel} divider />
          </div>

          {/* Description */}
          {species.description && (
            <Section label="Description">
              <p style={bodyText}>{species.description}</p>
            </Section>
          )}

          {/* Habitat */}
          {species.habitat && (
            <Section label="Habitat">
              <p style={bodyText}>{species.habitat}</p>
            </Section>
          )}

          {/* Gallery */}
          {allImages.length > 1 && (
            <Section label={`Plates · ${allImages.length}`}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 4,
              }}>
                {allImages.map((url) => (
                  <button
                    key={url}
                    onClick={() => setActiveImage(url)}
                    aria-label="View plate"
                    style={{
                      padding: 0, background: 'none', cursor: 'pointer',
                      border: activeImage === url
                        ? `1.5px solid ${DS.ink}`
                        : `0.5px solid ${DS.inkHair}`,
                      aspectRatio: '1 / 1', overflow: 'hidden',
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

const bodyText = {
  fontFamily: DS.serif, fontSize: 15, fontWeight: 300,
  lineHeight: 1.55, color: DS.ink, margin: 0,
} as const

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <Mono size={9} color={DS.ochre} letter={0.22} style={{ marginBottom: 6 }}>{label}</Mono>
      {children}
    </div>
  )
}

function Stat({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <div style={{
      padding: '12px 10px',
      borderLeft: divider ? `0.5px solid ${DS.inkHair}` : 'none',
      textAlign: 'center',
    }}>
      <Mono size={8} color={DS.inkFaint} letter={0.22} style={{ marginBottom: 4 }}>
        {label.toUpperCase()}
      </Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
        letterSpacing: '-0.02em', color: DS.ink, lineHeight: 1.1,
      }}>
        {value}
      </div>
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
