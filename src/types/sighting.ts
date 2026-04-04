import { CategoryType } from './database'

export interface Sighting {
  id: string
  unique_hash: string
  user_id: string
  category: CategoryType
  species_name: string | null
  common_name: string | null
  latitude: number
  longitude: number
  location_accuracy: number | null
  photo_url: string | null
  audio_url: string | null
  notes: string | null
  ai_identification: AIIdentification | null
  ai_confidence: number | null
  sighted_at: string
  created_at: string
  synced: boolean
}

export interface AIIdentification {
  species?: string | null
  common_name?: string | null
  confidence?: number
  description?: string
  suggested_category?: CategoryType
}

export interface PendingSighting {
  id: string
  unique_hash: string
  category: CategoryType
  latitude: number
  longitude: number
  location_accuracy: number | null
  photo_blob: Blob | null
  audio_blob: Blob | null
  notes: string | null
  ai_identification: AIIdentification | null
  sighted_at: string
  created_at: string
}

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}
