import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, ChevronDown, ChevronUp, Leaf } from 'lucide-react'
import { useSpecies } from '@/hooks/useSpecies'
import type { SightingCategory } from '@/types'

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

const categoryColors: Record<SightingCategory, string> = {
  mammal: 'bg-amber-100 text-amber-700',
  bird: 'bg-sky-100 text-sky-700',
  reptile: 'bg-lime-100 text-lime-700',
  amphibian: 'bg-teal-100 text-teal-700',
  insect: 'bg-orange-100 text-orange-700',
  plant: 'bg-green-100 text-green-700',
  fungi: 'bg-purple-100 text-purple-700',
  trace: 'bg-stone-100 text-stone-700',
}

export default function SpeciesLibraryPage() {
  const { species, loading, fetchSpecies } = useSpecies()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<SightingCategory | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const doFetch = useCallback(() => {
    fetchSpecies(activeCategory || undefined, search || undefined)
  }, [fetchSpecies, activeCategory, search])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSpecies(activeCategory || undefined, search || undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, activeCategory, fetchSpecies])

  function toggleExpand(id: string) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Species Library</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value as SightingCategory | '')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeCategory === cat.value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && species.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <Leaf className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No species found</p>
        </div>
      )}

      {/* Species grid */}
      {!loading && species.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {species.map(sp => {
            const isExpanded = expandedId === sp.id

            return (
              <div
                key={sp.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
              >
                {/* Image */}
                <div className="h-40 bg-gray-100">
                  {sp.image_url ? (
                    <img
                      src={sp.image_url}
                      alt={sp.common_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <Leaf className="h-12 w-12" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {sp.common_name}
                      </p>
                      {sp.scientific_name && (
                        <p className="truncate text-xs italic text-gray-500">
                          {sp.scientific_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[sp.category]}`}
                    >
                      {sp.category}
                    </span>
                  </div>

                  {/* Expand toggle */}
                  {(sp.description || sp.habitat) && (
                    <button
                      onClick={() => toggleExpand(sp.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Less info
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          More info
                        </>
                      )}
                    </button>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                      {sp.description && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Description
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600">{sp.description}</p>
                        </div>
                      )}
                      {sp.habitat && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Habitat
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600">{sp.habitat}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
