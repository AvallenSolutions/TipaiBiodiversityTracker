import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Sighting, SightingCategory, VerificationStatus } from '@/types'

interface Filters {
  category?: SightingCategory
  search?: string
  dateFrom?: string
  dateTo?: string
  verificationStatus?: VerificationStatus
  userId?: string
}

export function useSightings() {
  const [sightings, setSightings] = useState<Sighting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSightings = useCallback(async (filters?: Filters) => {
    setLoading(true)
    setError(null)

    try {
      let query = (supabase.from('sightings') as any)
        .select('*, sighting_media(*), profile:profiles!sightings_user_id_fkey(*)')
        .order('sighted_at', { ascending: false })

      if (filters?.category) query = query.eq('category', filters.category)
      if (filters?.verificationStatus) query = query.eq('verification_status', filters.verificationStatus)
      if (filters?.userId) query = query.eq('user_id', filters.userId)
      if (filters?.dateFrom) query = query.gte('sighted_at', filters.dateFrom)
      if (filters?.dateTo) query = query.lte('sighted_at', filters.dateTo + 'T23:59:59')
      if (filters?.search) {
        query = query.or(`common_name.ilike.%${filters.search}%,scientific_name.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setSightings((data || []) as Sighting[])
    } catch (err: any) {
      setError(err.message)
      console.error('Failed to fetch sightings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteSighting = useCallback(async (id: string) => {
    const { error } = await (supabase.from('sightings') as any).delete().eq('id', id)
    if (error) throw error
    setSightings(prev => prev.filter(s => s.id !== id))
  }, [])

  return { sightings, loading, error, fetchSightings, deleteSighting }
}
