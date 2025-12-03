import { supabase } from '../lib/supabase'
import {
  savePendingSighting,
  getPendingSightings,
  deletePendingSighting,
  getMediaBlob
} from '../lib/db'
import { PendingSighting } from '../types/sighting'
import { generateUniqueHash } from '../utils/crypto'

export async function saveSightingOffline(sighting: Omit<PendingSighting, 'id' | 'unique_hash' | 'created_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const timestamp = new Date().toISOString()
  const { id, hash } = await generateUniqueHash(
    user.id,
    timestamp,
    sighting.latitude,
    sighting.longitude
  )

  const pendingSighting: PendingSighting = {
    id,
    unique_hash: hash,
    category: sighting.category,
    latitude: sighting.latitude,
    longitude: sighting.longitude,
    location_accuracy: sighting.location_accuracy,
    photo_blob: sighting.photo_blob,
    audio_blob: sighting.audio_blob,
    notes: sighting.notes,
    sighted_at: sighting.sighted_at,
    created_at: timestamp
  }

  await savePendingSighting(pendingSighting)
  return pendingSighting
}

export async function syncPendingSightings(): Promise<{ synced: number; failed: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { synced: 0, failed: 0 }
  }

  if (!navigator.onLine) {
    return { synced: 0, failed: 0 }
  }

  const pendingSightings = await getPendingSightings()
  let synced = 0
  let failed = 0

  for (const pending of pendingSightings) {
    try {
      let photoUrl: string | null = null
      let audioUrl: string | null = null

      if (pending.photo_blob) {
        const photoBlob = await getMediaBlob(pending.id, 'photo')
        if (photoBlob) {
          const photoPath = `${user.id}/${pending.id}-photo.${photoBlob.type.split('/')[1]}`
          const { error: photoError } = await supabase.storage
            .from('sighting-photos')
            .upload(photoPath, photoBlob)

          if (!photoError) {
            const { data: { publicUrl } } = supabase.storage
              .from('sighting-photos')
              .getPublicUrl(photoPath)
            photoUrl = publicUrl
          }
        }
      }

      if (pending.audio_blob) {
        const audioBlob = await getMediaBlob(pending.id, 'audio')
        if (audioBlob) {
          const audioPath = `${user.id}/${pending.id}-audio.webm`
          const { error: audioError } = await supabase.storage
            .from('sighting-audio')
            .upload(audioPath, audioBlob)

          if (!audioError) {
            const { data: { publicUrl } } = supabase.storage
              .from('sighting-audio')
              .getPublicUrl(audioPath)
            audioUrl = publicUrl
          }
        }
      }

      const { error: insertError } = await supabase
        .from('sightings')
        .insert({
          id: pending.id,
          unique_hash: pending.unique_hash,
          user_id: user.id,
          category: pending.category,
          latitude: pending.latitude,
          longitude: pending.longitude,
          location_accuracy: pending.location_accuracy,
          photo_url: photoUrl,
          audio_url: audioUrl,
          notes: pending.notes,
          sighted_at: pending.sighted_at,
          created_at: pending.created_at,
          synced: true
        })

      if (insertError) {
        console.error('Failed to sync sighting:', insertError)
        failed++
      } else {
        await deletePendingSighting(pending.id)
        synced++
      }
    } catch (error) {
      console.error('Error syncing sighting:', error)
      failed++
    }
  }

  return { synced, failed }
}

export async function saveSightingOnline(
  category: string,
  latitude: number,
  longitude: number,
  locationAccuracy: number | null,
  photoBlob: Blob | null,
  audioBlob: Blob | null,
  notes: string | null,
  aiIdentification: any | null,
  sightedAt: string
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const timestamp = new Date().toISOString()
  const { id, hash } = await generateUniqueHash(user.id, timestamp, latitude, longitude)

  let photoUrl: string | null = null
  let audioUrl: string | null = null

  if (photoBlob) {
    const photoPath = `${user.id}/${id}-photo.${photoBlob.type.split('/')[1]}`
    const { error: photoError } = await supabase.storage
      .from('sighting-photos')
      .upload(photoPath, photoBlob)

    if (photoError) throw photoError

    const { data: { publicUrl } } = supabase.storage
      .from('sighting-photos')
      .getPublicUrl(photoPath)
    photoUrl = publicUrl
  }

  if (audioBlob) {
    const audioPath = `${user.id}/${id}-audio.webm`
    const { error: audioError } = await supabase.storage
      .from('sighting-audio')
      .upload(audioPath, audioBlob)

    if (audioError) throw audioError

    const { data: { publicUrl } } = supabase.storage
      .from('sighting-audio')
      .getPublicUrl(audioPath)
    audioUrl = publicUrl
  }

  const { error: insertError } = await supabase
    .from('sightings')
    .insert({
      id,
      unique_hash: hash,
      user_id: user.id,
      category,
      species_name: aiIdentification?.species || null,
      common_name: aiIdentification?.common_name || null,
      latitude,
      longitude,
      location_accuracy: locationAccuracy,
      photo_url: photoUrl,
      audio_url: audioUrl,
      notes,
      ai_identification: aiIdentification,
      ai_confidence: aiIdentification?.confidence || null,
      sighted_at: sightedAt,
      synced: true
    })

  if (insertError) throw insertError

  return { id, hash }
}
