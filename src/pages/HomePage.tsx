import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  PlusCircle,
  RefreshCw,
  Eye,
  CloudOff,
  Leaf,
  MapPin,
  Loader2,
  AlertCircle,
  Cat,
  Bird,
  Footprints,
  Bug,
  Flower2,
} from 'lucide-react'
import { format } from 'date-fns'
import { useSightings } from '@/hooks/useSightings'
import { getPendingCount } from '@/lib/offline'
import { getMediaUrl } from '@/lib/storage'
import { formatCoordinates } from '@/hooks/useGeolocation'
import type { SightingCategory } from '@/types'

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

// Warm, rich placeholder backgrounds for photo-less cards
const categoryPlaceholderBg: Record<SightingCategory, string> = {
  mammal: 'bg-gradient-to-br from-amber-200 to-amber-300',
  bird: 'bg-gradient-to-br from-sky-200 to-sky-300',
  reptile: 'bg-gradient-to-br from-lime-200 to-lime-300',
  amphibian: 'bg-gradient-to-br from-teal-200 to-teal-300',
  insect: 'bg-gradient-to-br from-orange-200 to-orange-300',
  plant: 'bg-gradient-to-br from-green-200 to-green-300',
  fungi: 'bg-gradient-to-br from-purple-200 to-purple-300',
  trace: 'bg-gradient-to-br from-stone-200 to-stone-300',
}

const categoryIconColor: Record<SightingCategory, string> = {
  mammal: 'text-amber-600',
  bird: 'text-sky-600',
  reptile: 'text-lime-600',
  amphibian: 'text-teal-600',
  insect: 'text-orange-600',
  plant: 'text-green-600',
  fungi: 'text-purple-600',
  trace: 'text-stone-600',
}

function CategoryPlaceholderIcon({ category }: { category: SightingCategory }) {
  const cls = `h-14 w-14 ${categoryIconColor[category]} opacity-70`
  switch (category) {
    case 'mammal': return <Cat className={cls} strokeWidth={1.5} />
    case 'bird': return <Bird className={cls} strokeWidth={1.5} />
    case 'trace': return <Footprints className={cls} strokeWidth={1.5} />
    case 'insect': return <Bug className={cls} strokeWidth={1.5} />
    case 'fungi': return <Flower2 className={cls} strokeWidth={1.5} />
    default: return <Leaf className={cls} strokeWidth={1.5} />
  }
}

export default function HomePage() {
  const { sightings, loading, error, fetchSightings } = useSightings()
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
      const count = await getPendingCount()
      setPendingCount(count)
    } finally {
      setRefreshing(false)
    }
  }

  const uniqueSpecies = new Set(
    sightings.filter(s => s.species_id).map(s => s.species_id)
  ).size

  const uniqueCategories = new Set(sightings.map(s => s.category)).size

  return (
    <div className="space-y-5">
      {/* Personal biodiversity summary */}
      <div className="rounded-2xl bg-tipai-700 p-5 text-white">
        <p className="text-tipai-200 text-xs font-medium uppercase tracking-widest mb-1">Your Tipai Record</p>
        <p className="font-heading text-3xl font-semibold leading-tight">
          {sightings.length} {sightings.length === 1 ? 'sighting' : 'sightings'}
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-tipai-200">
          <span className="flex items-center gap-1.5">
            <Leaf className="h-3.5 w-3.5" />
            {uniqueSpecies} species
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {uniqueCategories} {uniqueCategories === 1 ? 'category' : 'categories'}
          </span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-300">
              <CloudOff className="h-3.5 w-3.5" />
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold text-gray-900">Recent Sightings</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !refreshing && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tipai-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && sightings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Leaf className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-heading text-xl text-gray-400">No sightings yet</p>
          <p className="mt-1 text-sm text-gray-400">Head out and explore the forest!</p>
          <button
            onClick={() => navigate('/new')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-tipai-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-tipai-800 active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4" />
            Log First Sighting
          </button>
        </div>
      )}

      {/* Photo-first sighting cards */}
      <div className="space-y-4">
        {sightings.map(sighting => {
          const media = sighting.media?.[0]
          const thumbnailUrl = media ? getMediaUrl(media.storage_path) : null

          return (
            <Link
              key={sighting.id}
              to={`/sighting/${sighting.id}`}
              className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-lg active:scale-[0.99]"
            >
              {/* Photo / placeholder */}
              <div className="relative h-52 overflow-hidden">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={sighting.common_name || sighting.category}
                    className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center ${categoryPlaceholderBg[sighting.category]}`}>
                    <CategoryPlaceholderIcon category={sighting.category} />
                  </div>
                )}

                {/* Gradient scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* Overlay: category badge + name */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize backdrop-blur-sm ${categoryColors[sighting.category]} bg-opacity-90`}>
                    {sighting.category}
                  </span>
                  <p className="mt-1 font-heading text-xl font-semibold leading-snug text-white drop-shadow">
                    {sighting.common_name || 'Unidentified'}
                  </p>
                  {sighting.scientific_name && (
                    <p className="text-xs italic text-white/70">{sighting.scientific_name}</p>
                  )}
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500">
                <span>{format(new Date(sighting.sighted_at), 'MMMM d, yyyy')}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {formatCoordinates(sighting.latitude, sighting.longitude)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
