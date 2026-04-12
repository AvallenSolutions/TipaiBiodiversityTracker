import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  PlusCircle,
  RefreshCw,
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

// Dark, dramatic placeholder gradients — like NatGeo field cards
const categoryDarkBg: Record<SightingCategory, string> = {
  mammal:    'bg-gradient-to-br from-amber-950 via-amber-900 to-amber-800',
  bird:      'bg-gradient-to-br from-sky-950 via-sky-900 to-sky-800',
  reptile:   'bg-gradient-to-br from-lime-950 via-lime-900 to-lime-800',
  amphibian: 'bg-gradient-to-br from-teal-950 via-teal-900 to-teal-800',
  insect:    'bg-gradient-to-br from-orange-950 via-orange-900 to-orange-800',
  plant:     'bg-gradient-to-br from-tipai-900 via-tipai-800 to-tipai-700',
  fungi:     'bg-gradient-to-br from-purple-950 via-purple-900 to-purple-800',
  trace:     'bg-gradient-to-br from-stone-900 via-stone-800 to-stone-700',
}

// Mounted image component with fallback on load error
function SightingPhoto({
  src,
  alt,
  category,
}: {
  src: string | null
  alt: string
  category: SightingCategory
}) {
  const [error, setError] = useState(false)
  const showPlaceholder = !src || error

  if (showPlaceholder) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center ${categoryDarkBg[category]}`}>
        <PlaceholderIcon category={category} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      loading="lazy"
    />
  )
}

function PlaceholderIcon({ category }: { category: SightingCategory }) {
  const cls = 'h-16 w-16 text-white opacity-20 stroke-[1]'
  switch (category) {
    case 'mammal':    return <Cat       className={cls} />
    case 'bird':      return <Bird      className={cls} />
    case 'trace':     return <Footprints className={cls} />
    case 'insect':    return <Bug       className={cls} />
    case 'fungi':     return <Flower2   className={cls} />
    default:          return <Leaf      className={cls} />
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
    <div className="min-h-screen bg-tipai-stone-50">

      {/* ── Editorial expedition header ─────────────────────── */}
      <div className="bg-tipai-900 px-5 pt-5 pb-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-tipai-400">
              Tipai Wildlife Reserve
            </p>
            <h1 className="mt-0.5 font-heading text-5xl font-semibold leading-none text-white">
              Your Expedition
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-1 rounded-full p-2 text-tipai-400 transition hover:text-white disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-5 border-t border-white/10 pt-4 text-sm text-tipai-300">
          <span>
            <span className="font-heading text-2xl font-semibold text-white">{sightings.length}</span>
            {' '}
            <span className="text-xs uppercase tracking-wider">sighting{sightings.length !== 1 ? 's' : ''}</span>
          </span>
          <span className="text-tipai-600">·</span>
          <span>
            <span className="font-heading text-2xl font-semibold text-white">{uniqueSpecies}</span>
            {' '}
            <span className="text-xs uppercase tracking-wider">species</span>
          </span>
          <span className="text-tipai-600">·</span>
          <span>
            <span className="font-heading text-2xl font-semibold text-white">{uniqueCategories}</span>
            {' '}
            <span className="text-xs uppercase tracking-wider">group{uniqueCategories !== 1 ? 's' : ''}</span>
          </span>
          {pendingCount > 0 && (
            <>
              <span className="text-tipai-600">·</span>
              <span className="flex items-center gap-1 text-amber-400">
                <CloudOff className="h-3.5 w-3.5" />
                <span className="text-xs uppercase tracking-wider">{pendingCount} pending</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Section header ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pb-3 pt-6">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">From the Field</p>
          <h2 className="font-heading text-3xl font-semibold text-tipai-900">Recent Sightings</h2>
        </div>
        <button
          onClick={() => navigate('/new')}
          className="flex items-center gap-1.5 rounded-full bg-tipai-700 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-tipai-800 active:scale-[0.97]"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Log
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && !refreshing && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-tipai-600" />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!loading && sightings.length === 0 && (
        <div className="mx-4 rounded-2xl border border-dashed border-tipai-200 py-16 text-center">
          <Leaf className="mx-auto h-10 w-10 text-tipai-200" strokeWidth={1} />
          <p className="mt-4 font-heading text-2xl text-tipai-300">No sightings yet</p>
          <p className="mt-1 text-sm text-tipai-400">Head out and explore the forest</p>
          <button
            onClick={() => navigate('/new')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-tipai-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-tipai-800 active:scale-[0.97]"
          >
            <PlusCircle className="h-4 w-4" />
            Log Your First Sighting
          </button>
        </div>
      )}

      {/* ── Sighting cards ──────────────────────────────────── */}
      <div className="space-y-5 px-4 pb-6">
        {sightings.map(sighting => {
          const media = sighting.media?.[0]
          const src = media ? getMediaUrl(media.storage_path) : null

          return (
            <Link
              key={sighting.id}
              to={`/sighting/${sighting.id}`}
              className="group block"
            >
              {/* Photo card */}
              <div className="relative h-64 overflow-hidden rounded-2xl shadow-lg">
                <SightingPhoto
                  src={src}
                  alt={sighting.common_name || sighting.category}
                  category={sighting.category}
                />

                {/* Gradient scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />

                {/* Text overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/50">
                    {sighting.category}
                  </p>
                  <p className="font-heading text-[1.85rem] font-semibold leading-tight text-white">
                    {sighting.common_name || 'Unidentified Species'}
                  </p>
                  {sighting.scientific_name && (
                    <p className="mt-0.5 text-sm italic text-white/55">
                      {sighting.scientific_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Meta row */}
              <div className="mt-2 flex items-center justify-between px-1 text-xs text-tipai-stone-500">
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
