// ============================================================
// Core application types
// ============================================================

export type UserRole = 'guest' | 'staff' | 'naturalist' | 'admin'
export type SightingCategory = 'mammal' | 'bird' | 'reptile' | 'amphibian' | 'insect' | 'plant' | 'fungi' | 'trace'
export type VerificationStatus = 'unverified' | 'ai_suggested' | 'verified' | 'rejected'
export type ExportStatus = 'not_exported' | 'pending' | 'exported' | 'excluded' | 'failed'
export type MediaType = 'photo' | 'video' | 'audio'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Species {
  id: string
  common_name: string
  scientific_name: string | null
  category: SightingCategory
  subcategory: string | null
  family: string | null
  description: string | null
  habitat: string | null
  reference_image_url: string | null
  gallery_image_urls: string[]
  is_native: boolean | null
  is_notable: boolean | null
  inaturalist_taxon_id: number | null
  ebird_species_code: string | null
  created_at: string
}

export interface Sighting {
  id: string
  user_id: string
  species_id: string | null
  category: SightingCategory
  common_name: string | null
  scientific_name: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  location_accuracy: number | null
  sighted_at: string
  verification_status: VerificationStatus
  ai_confidence: number | null
  ai_suggestions: AISuggestion[] | null
  inaturalist_status: ExportStatus
  ebird_status: ExportStatus
  individual_count: number | null
  created_at: string
  updated_at: string
  // Joined data
  media?: SightingMedia[]
  profile?: Profile
}

export interface SightingMedia {
  id: string
  sighting_id: string
  media_type: MediaType
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  url?: string
}

export interface SightingEdit {
  id: string
  sighting_id: string
  edited_by: string
  changes: Record<string, { old: unknown; new: unknown }>
  edit_reason: string | null
  created_at: string
  editor?: Profile
}

export interface AISuggestion {
  species: string | null
  common_name: string | null
  scientific_name: string | null
  confidence: number
  description: string | null
  category?: SightingCategory
}

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

export interface PendingSighting {
  id: string
  user_id: string
  species_id: string | null
  category: SightingCategory
  common_name: string | null
  scientific_name: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  location_accuracy: number | null
  sighted_at: string
  ai_suggestions: AISuggestion[] | null
  ai_confidence: number | null
  individual_count: number | null
  media: { blob: Blob; type: MediaType; mime_type: string }[]
  created_at: string
}
