import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
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
