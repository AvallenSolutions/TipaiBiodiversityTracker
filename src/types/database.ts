export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'naturalist' | 'staff' | 'guest'

export type CategoryType = 'mammal' | 'bird' | 'lizard' | 'insect' | 'plant' | 'trace' | 'fungi'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          user_role: UserRole
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          user_role: UserRole
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          user_role?: UserRole
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sightings: {
        Row: {
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
          ai_identification: Json | null
          ai_confidence: number | null
          sighted_at: string
          created_at: string
          synced: boolean
        }
        Insert: {
          id?: string
          unique_hash: string
          user_id: string
          category: CategoryType
          species_name?: string | null
          common_name?: string | null
          latitude: number
          longitude: number
          location_accuracy?: number | null
          photo_url?: string | null
          audio_url?: string | null
          notes?: string | null
          ai_identification?: Json | null
          ai_confidence?: number | null
          sighted_at?: string
          created_at?: string
          synced?: boolean
        }
        Update: {
          id?: string
          unique_hash?: string
          user_id?: string
          category?: CategoryType
          species_name?: string | null
          common_name?: string | null
          latitude?: number
          longitude?: number
          location_accuracy?: number | null
          photo_url?: string | null
          audio_url?: string | null
          notes?: string | null
          ai_identification?: Json | null
          ai_confidence?: number | null
          sighted_at?: string
          created_at?: string
          synced?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      category_type: CategoryType
    }
  }
}
