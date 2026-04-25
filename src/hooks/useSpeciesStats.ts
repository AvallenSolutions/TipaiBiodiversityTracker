import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface SpeciesStats {
  sightingsCount: number
  territoriesCount: number
  firstSeenAt: string | null
}

// Aggregates verified-or-better sightings for a species:
//   - sightingsCount: total rows
//   - territoriesCount: distinct location_name values (NULLs ignored)
//   - firstSeenAt: earliest observed_at
export function useSpeciesStats(speciesId: string | null) {
  const [stats, setStats] = useState<SpeciesStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!speciesId) { setStats(null); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { data, error } = await (supabase.from('sightings') as any)
          .select('observed_at, location_name')
          .eq('species_id', speciesId)
        if (error) throw error
        if (cancelled) return
        const rows = (data || []) as { observed_at: string | null; location_name: string | null }[]
        const territories = new Set<string>()
        let earliest: string | null = null
        for (const r of rows) {
          if (r.location_name) territories.add(r.location_name)
          if (r.observed_at && (!earliest || r.observed_at < earliest)) earliest = r.observed_at
        }
        setStats({
          sightingsCount: rows.length,
          territoriesCount: territories.size,
          firstSeenAt: earliest,
        })
      } catch (err) {
        console.error('Failed to fetch species stats:', err)
        if (!cancelled) setStats({ sightingsCount: 0, territoriesCount: 0, firstSeenAt: null })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [speciesId])

  return { stats, loading }
}
