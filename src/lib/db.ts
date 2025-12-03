import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { PendingSighting } from '../types/sighting'

interface TipaiDB extends DBSchema {
  pendingSightings: {
    key: string
    value: PendingSighting
    indexes: { 'by-created': string }
  }
  mediaBlobs: {
    key: string
    value: { id: string; blob: Blob; type: 'photo' | 'audio' }
  }
}

let dbPromise: Promise<IDBPDatabase<TipaiDB>> | null = null

export function getDB(): Promise<IDBPDatabase<TipaiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TipaiDB>('tipai-biodiversity', 1, {
      upgrade(db) {
        const sightingStore = db.createObjectStore('pendingSightings', {
          keyPath: 'id'
        })
        sightingStore.createIndex('by-created', 'created_at')

        db.createObjectStore('mediaBlobs', {
          keyPath: 'id'
        })
      }
    })
  }
  return dbPromise
}

export async function savePendingSighting(sighting: PendingSighting): Promise<void> {
  const db = await getDB()
  await db.put('pendingSightings', sighting)

  if (sighting.photo_blob) {
    await db.put('mediaBlobs', {
      id: `${sighting.id}-photo`,
      blob: sighting.photo_blob,
      type: 'photo'
    })
  }

  if (sighting.audio_blob) {
    await db.put('mediaBlobs', {
      id: `${sighting.id}-audio`,
      blob: sighting.audio_blob,
      type: 'audio'
    })
  }
}

export async function getPendingSightings(): Promise<PendingSighting[]> {
  const db = await getDB()
  return db.getAllFromIndex('pendingSightings', 'by-created')
}

export async function getMediaBlob(id: string, type: 'photo' | 'audio'): Promise<Blob | null> {
  const db = await getDB()
  const record = await db.get('mediaBlobs', `${id}-${type}`)
  return record?.blob || null
}

export async function deletePendingSighting(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pendingSightings', id)
  await db.delete('mediaBlobs', `${id}-photo`)
  await db.delete('mediaBlobs', `${id}-audio`)
}

export async function clearAllPendingSightings(): Promise<void> {
  const db = await getDB()
  await db.clear('pendingSightings')
  await db.clear('mediaBlobs')
}
