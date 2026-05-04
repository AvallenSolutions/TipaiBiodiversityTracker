import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TigerIndividual } from '@/types'

/**
 * Heuristic — does this sighting look like a tiger? We use the same name
 * pattern the dashboard already uses (mammal + name contains "tiger" / sci
 * name "panthera tigris") so the in-flow tiger UI activates regardless of
 * whether the sighting was identified by AI, picked from the library, or
 * typed in by hand.
 */
export function isTigerSighting(input: {
  category?: string | null
  common_name?: string | null
  scientific_name?: string | null
}): boolean {
  if (input.category && input.category !== 'mammal') return false
  const c = (input.common_name || '').toLowerCase()
  const s = (input.scientific_name || '').toLowerCase()
  return c.includes('tiger') || s.includes('panthera tigris')
}

export function useTigerIndividuals() {
  const [tigers, setTigers] = useState<TigerIndividual[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTigers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await (supabase.from('tiger_individuals') as any)
        .select('*')
        .order('name')
      if (err) throw err
      setTigers((data || []) as TigerIndividual[])
    } catch (err: any) {
      setError(err?.message || 'Failed to load tigers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTigers() }, [fetchTigers])

  /**
   * Insert a new tiger by name (case-insensitive) and return the row.
   * If a tiger with the same name already exists we return the existing row
   * instead of creating a duplicate — the unique index on lower(name) would
   * reject the insert anyway, this just turns it into a clean lookup.
   */
  const createTiger = useCallback(async (
    name: string,
    notes?: string | null,
    createdBy?: string | null,
  ): Promise<TigerIndividual> => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Tiger name cannot be empty')

    const lower = trimmed.toLowerCase()
    const existing = tigers.find(t => t.name.toLowerCase() === lower)
    if (existing) return existing

    const { data, error: err } = await (supabase.from('tiger_individuals') as any)
      .insert({ name: trimmed, notes: notes ?? null, created_by: createdBy ?? null })
      .select('*')
      .single()
    if (err) {
      // Race: another client inserted the same name between our search and
      // our insert. Refresh and find it.
      if (err.code === '23505') {
        await fetchTigers()
        const again = (await (supabase.from('tiger_individuals') as any)
          .select('*')
          .ilike('name', trimmed)
          .single()).data as TigerIndividual | null
        if (again) return again
      }
      throw err
    }
    const row = data as TigerIndividual
    setTigers(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
    return row
  }, [tigers, fetchTigers])

  const updateTiger = useCallback(async (
    id: string,
    updates: Partial<Pick<TigerIndividual, 'name' | 'notes'>>,
  ): Promise<TigerIndividual> => {
    const { data, error: err } = await (supabase.from('tiger_individuals') as any)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    if (err) throw err
    const row = data as TigerIndividual
    setTigers(prev =>
      prev.map(t => t.id === id ? row : t).sort((a, b) => a.name.localeCompare(b.name)),
    )
    return row
  }, [])

  const deleteTiger = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await (supabase.from('tiger_individuals') as any)
      .delete()
      .eq('id', id)
    if (err) throw err
    setTigers(prev => prev.filter(t => t.id !== id))
  }, [])

  return { tigers, loading, error, fetchTigers, createTiger, updateTiger, deleteTiger }
}
