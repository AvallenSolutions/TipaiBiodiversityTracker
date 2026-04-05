import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Species, SightingCategory } from '@/types'

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

  return { species, loading, fetchSpecies }
}
