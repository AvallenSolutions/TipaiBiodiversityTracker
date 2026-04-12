import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Loader2,
  X,
  PlusCircle,
  Calendar,
  Leaf,
  Cat,
  Bird,
  Footprints,
  Bug,
  Flower2,
} from 'lucide-react'
import { format } from 'date-fns'
import { useSpecies } from '@/hooks/useSpecies'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import type { SightingCategory, Species } from '@/types'

// ── Category config ────────────────────────────────────────────

const CATEGORIES: { value: SightingCategory | ''; label: string }[] = [
  { value: '',          label: 'All' },
  { value: 'mammal',    label: 'Mammals' },
  { value: 'bird',      label: 'Birds' },
  { value: 'reptile',   label: 'Reptiles' },
  { value: 'amphibian', label: 'Amphibians' },
  { value: 'insect',    label: 'Insects' },
  { value: 'plant',     label: 'Plants' },
  { value: 'fungi',     label: 'Fungi' },
  { value: 'trace',     label: 'Traces' },
]

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

function PlaceholderIcon({ category, className }: { category: SightingCategory; className?: string }) {
  const cls = className ?? 'h-20 w-20 text-white opacity-20 stroke-[1]'
  switch (category) {
    case 'mammal':    return <Cat        className={cls} />
    case 'bird':      return <Bird       className={cls} />
    case 'trace':     return <Footprints className={cls} />
    case 'insect':    return <Bug        className={cls} />
    case 'fungi':     return <Flower2    className={cls} />
    default:          return <Leaf       className={cls} />
  }
}

// ── Species card — isolated to handle img error ────────────────

function SpeciesCard({ sp, onClick }: { sp: Species; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false)
  const noPhoto = !sp.image_url || imgErr

  return (
    <button
      onClick={onClick}
      className="group w-full text-left"
      aria-label={`View ${sp.common_name}`}
    >
      <article className="relative h-[260px] overflow-hidden rounded-2xl shadow-lg">
        {noPhoto ? (
          <div className={`absolute inset-0 flex items-center justify-center ${categoryDarkBg[sp.category]}`}>
            <PlaceholderIcon category={sp.category} />
          </div>
        ) : (
          <img
            src={sp.image_url!}
            alt={sp.common_name}
            onError={() => setImgErr(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />
        )}

        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

        {/* Text */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/50">
            {sp.category}
          </p>
          <h2 className="font-heading text-[1.85rem] font-semibold leading-tight text-white">
            {sp.common_name}
          </h2>
          {sp.scientific_name && (
            <p className="mt-0.5 text-sm italic text-white/55">{sp.scientific_name}</p>
          )}
        </div>
      </article>
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────

export default function SpeciesLibraryPage() {
  const { species, loading, fetchSpecies } = useSpecies()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<SightingCategory | ''>('')
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null)

  const doFetch = useCallback(() => {
    fetchSpecies(activeCategory || undefined, search || undefined)
  }, [fetchSpecies, activeCategory, search])

  useEffect(() => { doFetch() }, [doFetch])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      fetchSpecies(activeCategory || undefined, search || undefined)
    }, 300)
    return () => clearTimeout(t)
  }, [search, activeCategory, fetchSpecies])

  return (
    <div className="min-h-screen bg-tipai-stone-50">

      {/* ── Editorial header ───────────────────────────────── */}
      <div className="bg-tipai-900 px-5 pt-5 pb-7">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-tipai-400">
          Tipai Wildlife Reserve
        </p>
        <h1 className="mt-0.5 font-heading text-5xl font-semibold leading-none text-white">
          Field Guide
        </h1>
        {!loading && species.length > 0 && (
          <p className="mt-2 text-sm text-tipai-300">
            {species.length} documented species
          </p>
        )}

        {/* Search */}
        <div className="relative mt-5">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full rounded-xl border border-white/10 bg-white/10 py-3 pl-11 pr-10 text-sm text-white placeholder-white/35 transition focus:border-white/20 focus:bg-white/15 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category pills ─────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto bg-tipai-800 px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value as SightingCategory | '')}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              activeCategory === cat.value
                ? 'bg-white text-tipai-900'
                : 'text-tipai-400 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Loading ────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-tipai-600" />
        </div>
      )}

      {/* ── Empty ──────────────────────────────────────────── */}
      {!loading && species.length === 0 && (
        <div className="px-5 py-20 text-center">
          <Leaf className="mx-auto h-12 w-12 text-tipai-200" strokeWidth={1} />
          <p className="mt-4 font-heading text-2xl text-tipai-300">No species found</p>
          <p className="mt-1 text-sm text-tipai-400">Try adjusting your search</p>
        </div>
      )}

      {/* ── Species cards ──────────────────────────────────── */}
      {!loading && species.length > 0 && (
        <div className="space-y-5 px-4 py-5">
          {species.map(sp => (
            <SpeciesCard
              key={sp.id}
              sp={sp}
              onClick={() => setSelectedSpecies(sp)}
            />
          ))}
        </div>
      )}

      {/* ── Detail bottom sheet ────────────────────────────── */}
      {selectedSpecies && (
        <SpeciesDetailSheet
          species={selectedSpecies}
          onClose={() => setSelectedSpecies(null)}
        />
      )}
    </div>
  )
}

// ── Species detail sheet ───────────────────────────────────────

interface SpeciesSighting {
  id: string
  sighted_at: string
  notes: string | null
  sighting_media: { storage_path: string }[]
}

function SpeciesDetailSheet({
  species,
  onClose,
}: {
  species: Species
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [imgErr, setImgErr] = useState(false)
  const [sightings, setSightings] = useState<SpeciesSighting[]>([])
  const [loadingSightings, setLoadingSightings] = useState(true)
  const noPhoto = !species.image_url || imgErr

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingSightings(true)
      try {
        const { data } = await (supabase.from('sightings') as any)
          .select('id, sighted_at, notes, sighting_media(storage_path)')
          .eq('species_id', species.id)
          .order('sighted_at', { ascending: false })
          .limit(10)
        if (!cancelled) setSightings((data || []) as SpeciesSighting[])
      } catch {
        // graceful failure
      } finally {
        if (!cancelled) setLoadingSightings(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [species.id])

  return (
    <div className="fixed inset-0 z-[70]" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="animate-slide-up-fade absolute bottom-0 left-0 right-0 max-h-[93vh] overflow-y-auto rounded-t-3xl bg-white">

        {/* Pull handle */}
        <div className="absolute left-1/2 top-3 z-10 h-1 w-12 -translate-x-1/2 rounded-full bg-black/10" />

        {/* Hero photo */}
        <div className="relative h-72 overflow-hidden rounded-t-3xl flex-shrink-0">
          {noPhoto ? (
            <div className={`absolute inset-0 flex items-center justify-center ${categoryDarkBg[species.category]}`}>
              <PlaceholderIcon
                category={species.category}
                className="h-28 w-28 text-white opacity-20 stroke-[0.75]"
              />
            </div>
          ) : (
            <img
              src={species.image_url!}
              alt={species.common_name}
              onError={() => setImgErr(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/25" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.3em] text-white/50">
              {species.category}
            </p>
            <h2 className="font-heading text-[2.2rem] font-semibold leading-tight text-white">
              {species.common_name}
            </h2>
            {species.scientific_name && (
              <p className="mt-1 text-base italic text-white/60">
                {species.scientific_name}
              </p>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="px-5 pb-10 pt-7 space-y-8">

          {/* About */}
          {species.description && (
            <section>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">
                Natural History
              </p>
              <h3 className="mt-0.5 font-heading text-2xl font-semibold text-tipai-900">
                About This Species
              </h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-gray-600">
                {species.description}
              </p>
            </section>
          )}

          {/* Habitat */}
          {species.habitat && (
            <section>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">
                Where to Find It
              </p>
              <h3 className="mt-0.5 font-heading text-2xl font-semibold text-tipai-900">
                Habitat
              </h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-gray-600">
                {species.habitat}
              </p>
            </section>
          )}

          {/* Divider */}
          {(species.description || species.habitat) && (
            <div className="border-t border-gray-100" />
          )}

          {/* Sighting history */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">
              In the Field
            </p>
            <h3 className="mt-0.5 font-heading text-2xl font-semibold text-tipai-900">
              Sighting History
            </h3>

            <div className="mt-3">
              {loadingSightings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-tipai-500" />
                </div>
              ) : sightings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-tipai-100 py-10 text-center">
                  <Leaf className="mx-auto h-8 w-8 text-tipai-200" strokeWidth={1} />
                  <p className="mt-2 text-sm text-gray-400">No sightings recorded yet</p>
                  <p className="mt-0.5 text-xs text-gray-300">Be the first to spot this species</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sightings.map(s => {
                    const thumb = s.sighting_media?.[0]
                    return (
                      <Link
                        key={s.id}
                        to={`/sighting/${s.id}`}
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl bg-tipai-stone-50 p-3 transition hover:bg-tipai-stone-100 active:scale-[0.99]"
                      >
                        {/* Thumbnail */}
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                          {thumb ? (
                            <img
                              src={getMediaUrl(thumb.storage_path)}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center ${categoryDarkBg[species.category]}`}>
                              <Leaf className="h-5 w-5 text-white opacity-30" />
                            </div>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(s.sighted_at), 'MMMM d, yyyy')}
                          </div>
                          {s.notes ? (
                            <p className="mt-0.5 truncate text-sm text-gray-600">{s.notes}</p>
                          ) : (
                            <p className="mt-0.5 text-xs italic text-gray-300">No field notes</p>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Log CTA */}
          <button
            onClick={() => { onClose(); navigate('/new') }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-tipai-700 py-4 text-sm font-semibold text-white shadow-lg shadow-tipai-900/15 transition hover:bg-tipai-800 active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4" />
            Log a Sighting of This Species
          </button>

          {/* iOS safe area padding */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}
