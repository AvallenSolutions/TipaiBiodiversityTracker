import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Species, SightingCategory } from '@/types'

export interface NewSpeciesInput {
  common_name: string
  scientific_name?: string | null
  category: SightingCategory
  description?: string | null
  habitat?: string | null
}

export function useSpecies() {
  const [species, setSpecies] = useState<Species[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSpecies = useCallback(async (category?: SightingCategory, search?: string) => {
    setLoading(true)
    try {
      let query = (supabase.from('species') as any)
        .select('*')
        .order('common_name')

      if (category) query = query.eq('category', category)
      if (search) {
        query = query.or(`common_name.ilike.%${search}%,scientific_name.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setSpecies((data || []) as Species[])
    } catch (err) {
      console.error('Failed to fetch species:', err)
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

  return { species, loading, fetchSpecies, createSpecies }
}
