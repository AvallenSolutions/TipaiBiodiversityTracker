import { useEffect, useState, useCallback } from 'react'
import { useSpecies } from '@/hooks/useSpecies'
import { DS } from '@/lib/ledger-design'
import { Mono, MonoIcon } from '@/components/logger/shared'
import SpeciesDetailSheet from '@/components/SpeciesDetailSheet'
import type { Species, SightingCategory } from '@/types'

const CATEGORIES: { value: SightingCategory | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'mammal', label: 'Mammals' },
  { value: 'bird', label: 'Birds' },
  { value: 'reptile', label: 'Reptiles' },
  { value: 'amphibian', label: 'Amphibians' },
  { value: 'insect', label: 'Insects' },
  { value: 'plant', label: 'Plants' },
  { value: 'fungi', label: 'Fungi' },
  { value: 'trace', label: 'Traces' },
]

export default function SpeciesLibraryPage() {
  const { species, loading, fetchSpecies } = useSpecies()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<SightingCategory | ''>('')
  const [selected, setSelected] = useState<Species | null>(null)

  const doFetch = useCallback(() => {
    fetchSpecies(activeCategory || undefined, search || undefined)
  }, [fetchSpecies, activeCategory, search])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSpecies(activeCategory || undefined, search || undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, activeCategory, fetchSpecies])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 20px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Mono size={10} letter={0.25} color={DS.ochre}>§02 · The Library</Mono>
        <h1 style={{
          fontFamily: DS.serif, fontSize: 44, fontWeight: 200,
          letterSpacing: '-0.03em', lineHeight: 1.0,
          margin: '10px 0 14px', color: DS.ink,
        }}>
          A <em style={{ fontWeight: 300 }}>field guide</em>.
        </h1>
        <p style={{
          fontFamily: DS.serif, fontSize: 17, fontWeight: 300,
          fontStyle: 'italic', color: DS.inkSoft, maxWidth: 540,
          lineHeight: 1.45, margin: 0,
        }}>
          Every species recorded so far. Search or browse by category.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          style={{
            width: '100%', padding: '10px 12px', border: `1px solid ${DS.ink}`,
            fontFamily: DS.serif, fontSize: 15, background: DS.ivory,
            color: DS.ink,
          }}
        />
      </div>

      {/* Category filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value as SightingCategory | '')}
            style={{
              padding: '6px 12px', border: `0.5px solid ${activeCategory === cat.value ? DS.ink : DS.inkFaint}`,
              background: activeCategory === cat.value ? DS.ink : 'transparent',
              color: activeCategory === cat.value ? DS.ivory : DS.ink,
              cursor: 'pointer', fontFamily: DS.serif, fontSize: 13,
              letterSpacing: '-0.01em', transition: 'all 150ms',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Mono size={10} color={DS.inkFaint} letter={0.25}>⋯ Loading the library</Mono>
        </div>
      )}

      {/* Empty state */}
      {!loading && species.length === 0 && (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          border: `0.5px dashed ${DS.inkFaint}`,
        }}>
          <h3 style={{
            fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
            fontStyle: 'italic', color: DS.ink, margin: 0,
          }}>No species found</h3>
        </div>
      )}

      {/* Species list */}
      {!loading && species.length > 0 && (
        <div style={{ display: 'grid', gap: 0 }}>
          {species.map((sp, idx) => (
            <div
              key={sp.id}
              style={{
                padding: '16px 0',
                borderTop: idx === 0 ? `1px solid ${DS.ink}` : `0.5px solid ${DS.inkHair}`,
                borderBottom: idx === species.length - 1 ? `1px solid ${DS.ink}` : 'none',
              }}
            >
              <button
                onClick={() => setSelected(sp)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  display: 'grid', gridTemplateColumns: 'auto 1fr',
                  gap: 12, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 56, height: 56, border: `0.5px solid ${DS.ink}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: DS.forest, flexShrink: 0, overflow: 'hidden',
                  background: DS.ivory,
                }}>
                  {sp.reference_image_url ? (
                    <img
                      src={sp.reference_image_url}
                      alt={sp.common_name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <MonoIcon category={sp.category} size={24} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{
                    fontFamily: DS.serif, fontSize: 18, fontWeight: 400,
                    letterSpacing: '-0.01em', margin: '0 0 2px', color: DS.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {sp.common_name}
                  </h3>
                  {sp.scientific_name && (
                    <p style={{
                      fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
                      fontWeight: 300, color: DS.inkSoft, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {sp.scientific_name}
                    </p>
                  )}
                  <Mono size={8} letter={0.18} color={DS.inkFaint} style={{ marginTop: 4 }}>
                    {sp.category.toUpperCase()}
                  </Mono>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && <SpeciesDetailSheet species={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
