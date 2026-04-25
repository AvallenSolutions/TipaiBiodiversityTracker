import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabase'
import { uploadMedia } from './storage'
import type { PendingSighting } from '@/types'

interface TipaiDB extends DBSchema {
  pendingSightings: {
    key: string
    value: PendingSighting
    indexes: { 'by-created': string }
  }
}

let dbPromise: Promise<IDBPDatabase<TipaiDB>> | null = null

function getDB(): Promise<IDBPDatabase<TipaiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TipaiDB>('tipai-biodiversity-v2', 1, {
      upgrade(db) {
        const store = db.createObjectStore('pendingSightings', { keyPath: 'id' })
        store.createIndex('by-created', 'created_at')
      },
    })
  }
  return dbPromise
}

export async function savePendingSighting(sighting: PendingSighting): Promise<void> {
  const db = await getDB()
  await db.put('pendingSightings', sighting)
}

export async function getPendingSightings(): Promise<PendingSighting[]> {
  const db = await getDB()
  return db.getAllFromIndex('pendingSightings', 'by-created')
}

export async function deletePendingSighting(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pendingSightings', id)
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB()
  return db.count('pendingSightings')
}

export interface SyncResult {
  attempted: number
  synced: number
  failed: { id: string; error: string }[]
}

// Upload all pending sightings stored in IndexedDB to Supabase. For each
// pending record we (1) push the photo blobs to the sighting-media bucket,
// (2) insert the sighting row, (3) insert the sighting_media rows, then
// (4) remove the pending record from IndexedDB. Records that fail any
// step stay in IndexedDB and are reported in the failed list so the
// caller can display them; sync is safe to re-run.
export async function syncPendingSightings(userId: string): Promise<SyncResult> {
  const pending = await getPendingSightings()
  const result: SyncResult = { attempted: pending.length, synced: 0, failed: [] }

  for (const p of pending) {
    try {
      const mediaRecords: { path: string; type: PendingSighting['media'][number]['type']; mime: string; size: number }[] = []
      for (let i = 0; i < p.media.length; i++) {
        const m = p.media[i]!
        const { path } = await uploadMedia(userId, p.id, m.blob, m.type, i)
        mediaRecords.push({ path, type: m.type, mime: m.mime_type, size: m.blob.size })
      }

      const { error: sErr } = await (supabase.from('sightings') as any).insert({
        id: p.id,
        user_id: userId,
        species_id: p.species_id ?? null,
        category: p.category,
        common_name: p.common_name,
        scientific_name: p.scientific_name,
        notes: p.notes,
        latitude: p.latitude,
        longitude: p.longitude,
        location_accuracy: p.location_accuracy,
        sighted_at: p.sighted_at,
        verification_status: 'unverified',
        ai_confidence: p.ai_confidence,
        ai_suggestions: p.ai_suggestions,
        individual_count: p.individual_count,
      })
      if (sErr) throw sErr

      if (mediaRecords.length > 0) {
        const { error: mErr } = await (supabase.from('sighting_media') as any).insert(
          mediaRecords.map((m) => ({
            id: uuidv4(),
            sighting_id: p.id,
            media_type: m.type,
            storage_path: m.path,
            mime_type: m.mime,
            size_bytes: m.size,
          }))
        )
        if (mErr) throw mErr
      }

      await deletePendingSighting(p.id)
      result.synced++
    } catch (err: any) {
      result.failed.push({ id: p.id, error: err?.message || String(err) })
    }
  }

  return result
}
