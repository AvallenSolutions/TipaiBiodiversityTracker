import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import type { Species } from '@/types'

export interface SpeciesStats {
  sightingsCount: number
  territoriesCount: number
  firstSeenAt: string | null
  // Most recent linked sighting's first photo, if any. Used as a cover
  // fallback when the species library row has no reference_image_url —
  // so a folio added without a plate still shows something representative
  // pulled from the field.
  coverPhotoUrl: string | null
}

// Aggregates sightings for a species. Matches by species_id when set,
// falling back to a name match (common or scientific) so manual entries
// and AI-accepted entries that haven't been promoted to the library yet
// still count.
//   - sightingsCount: total rows
//   - territoriesCount: distinct rounded lat/lng buckets (~1km squares)
//   - firstSeenAt: earliest sighted_at
//   - coverPhotoUrl: photo from the latest matching sighting, if available
export function useSpeciesStats(species: Species | null) {
  const [stats, setStats] = useState<SpeciesStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!species) { setStats(null); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const orFilters: string[] = [`species_id.eq.${species.id}`]
        if (species.common_name) orFilters.push(`common_name.eq.${escapeOr(species.common_name)}`)
        if (species.scientific_name) orFilters.push(`scientific_name.eq.${escapeOr(species.scientific_name)}`)

        const { data, error } = await (supabase.from('sightings') as any)
          .select('id, sighted_at, latitude, longitude, media:sighting_media(storage_path, media_type)')
          .or(orFilters.join(','))
          .order('sighted_at', { ascending: false })
        if (error) throw error
        if (cancelled) return

        type Row = {
          id: string
          sighted_at: string | null
          latitude: number
          longitude: number
          media: { storage_path: string; media_type: string }[] | null
        }
        const rows = (data || []) as Row[]
        const territories = new Set<string>()
        let earliest: string | null = null
        let coverPhotoUrl: string | null = null
        for (const r of rows) {
          if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
            const key = `${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}`
            territories.add(key)
          }
          if (r.sighted_at && (!earliest || r.sighted_at < earliest)) earliest = r.sighted_at
          if (!coverPhotoUrl) {
            const photo = r.media?.find(m => m.media_type === 'photo')
            if (photo?.storage_path) coverPhotoUrl = getMediaUrl(photo.storage_path)
          }
        }
        setStats({
          sightingsCount: rows.length,
          territoriesCount: territories.size,
          firstSeenAt: earliest,
          coverPhotoUrl,
        })
      } catch (err) {
        console.error('Failed to fetch species stats:', err)
        if (!cancelled) setStats({
          sightingsCount: 0, territoriesCount: 0, firstSeenAt: null, coverPhotoUrl: null,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [species])

  return { stats, loading }
}

function escapeOr(value: string): string {
  // PostgREST .or() uses commas as separators and parens as grouping;
  // wrap values containing them in double quotes.
  if (/[(),]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`
  return value
}
