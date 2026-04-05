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

  const speciesCount = new Set(
    sightings.filter(s => s.species_id).map(s => s.species_id)
  ).size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recent Sightings</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Sightings</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{sightings.length}</p>
        </div>

        <div className="rounded-xl bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <CloudOff className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pending</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-800">{pendingCount}</p>
        </div>

        <div className="rounded-xl bg-sky-50 p-4">
          <div className="flex items-center gap-2 text-sky-600">
            <Leaf className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Species</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-sky-800">{speciesCount}</p>
        </div>
      </div>

      {/* Log Sighting CTA */}
      <button
        onClick={() => navigate('/new')}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.98]"
      >
        <PlusCircle className="h-5 w-5" />
        Log Sighting
      </button>

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
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Sightings feed */}
      {!loading && sightings.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <Leaf className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No sightings yet. Go explore!</p>
        </div>
      )}

      <div className="space-y-3">
        {sightings.map(sighting => {
          const media = sighting.media?.[0]
          const thumbnailUrl = media ? getMediaUrl(media.storage_path) : null

          return (
            <Link
              key={sighting.id}
              to={`/sighting/${sighting.id}`}
              className="flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md active:scale-[0.99]"
            >
              {/* Thumbnail */}
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={sighting.common_name || 'Sighting'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <Leaf className="h-8 w-8" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[sighting.category]}`}
                    >
                      {sighting.category}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
                    {sighting.common_name || 'Unidentified'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{format(new Date(sighting.sighted_at), 'MMM d, yyyy')}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {formatCoordinates(sighting.latitude, sighting.longitude)}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
