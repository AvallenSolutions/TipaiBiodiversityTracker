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
        .select('*, media:sighting_media(*), profile:profiles!sightings_user_id_fkey(*)')
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
      // Belt-and-braces post-filter: even if the server-side .eq() were
      // somehow stripped (stale bundle, RLS misconfig), we never let a
      // sighting belonging to another user leak into a user-scoped feed.
      const list = (data || []) as Sighting[]
      const final = filters?.userId
        ? list.filter(s => s.user_id === filters.userId)
        : list
      setSightings(final)
    } catch (err: any) {
      setError(err.message)
      console.error('Failed to fetch sightings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Clear the in-memory list — used by callers that need to wipe data
  // when the active user changes, so stale rows from the previous account
  // don't flash on screen before the new fetch resolves.
  const clearSightings = useCallback(() => {
    setSightings([])
  }, [])

  const deleteSighting = useCallback(async (id: string) => {
    const { error } = await (supabase.from('sightings') as any).delete().eq('id', id)
    if (error) throw error
    setSightings(prev => prev.filter(s => s.id !== id))
  }, [])

  const updateSighting = useCallback(async (id: string, updates: Partial<Sighting>) => {
    const { data, error } = await (supabase.from('sightings') as any)
      .update(updates)
      .eq('id', id)
      .select('*, media:sighting_media(*), profile:profiles!sightings_user_id_fkey(*)')
      .single()
    if (error) throw error
    const updated = data as Sighting
    setSightings(prev => prev.map(s => s.id === id ? updated : s))
    return updated
  }, [])

  const verifySighting = useCallback(async (id: string) => {
    return updateSighting(id, { verification_status: 'verified' })
  }, [updateSighting])

  return { sightings, loading, error, fetchSightings, clearSightings, deleteSighting, updateSighting, verifySighting }
}
