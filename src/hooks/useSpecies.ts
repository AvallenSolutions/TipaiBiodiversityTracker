import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cacheSpecies, getCachedSpecies } from '@/lib/offline'
import type { Species, SightingCategory } from '@/types'

export interface NewSpeciesInput {
  common_name: string
  scientific_name?: string | null
  category: SightingCategory
  description?: string | null
  habitat?: string | null
}

function filterCached(
  list: Species[],
  category?: SightingCategory,
  search?: string,
): Species[] {
  let out = list
  if (category) out = out.filter(s => s.category === category)
  if (search) {
    const q = search.toLowerCase()
    out = out.filter(s =>
      s.common_name.toLowerCase().includes(q) ||
      (s.scientific_name?.toLowerCase().includes(q) ?? false)
    )
  }
  return out.sort((a, b) => a.common_name.localeCompare(b.common_name))
}

export function useSpecies() {
  const [species, setSpecies] = useState<Species[]>([])
  const [loading, setLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const fetchSpecies = useCallback(async (category?: SightingCategory, search?: string) => {
    setLoading(true)
    try {
      // Offline: serve from the cached library so the user can still pick
      // species when logging sightings without signal.
      if (!navigator.onLine) {
        const cached = await getCachedSpecies()
        setSpecies(filterCached(cached, category, search))
        setFromCache(true)
        return
      }

      let query = (supabase.from('species') as any)
        .select('*')
        .order('common_name')

      if (category) query = query.eq('category', category)
      if (search) {
        query = query.or(`common_name.ilike.%${search}%,scientific_name.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      const list = (data || []) as Species[]
      setSpecies(list)
      setFromCache(false)

      // If this was an unfiltered fetch, refresh the offline cache so the
      // next offline session has the latest library entries.
      if (!category && !search) {
        cacheSpecies(list).catch(err => console.warn('species cache write failed', err))
      }
    } catch (err) {
      console.error('Failed to fetch species:', err)
      // Network failure mid-flight: degrade to the cache.
      try {
        const cached = await getCachedSpecies()
        if (cached.length > 0) {
          setSpecies(filterCached(cached, category, search))
          setFromCache(true)
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [])

  const createSpecies = useCallback(async (input: NewSpeciesInput): Promise<Species> => {
    const { data, error } = await (supabase.from('species') as any)
      .insert({
        common_name: input.common_name,
        scientific_name: input.scientific_name ?? null,
        category: input.category,
        description: input.description ?? null,
        habitat: input.habitat ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as Species
  }, [])

  return { species, loading, fromCache, fetchSpecies, createSpecies }
}
