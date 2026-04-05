import { supabase } from './supabase'

const BUCKET = 'sighting-media'

export async function uploadMedia(
  userId: string,
  sightingId: string,
  blob: Blob,
  mediaType: 'photo' | 'video' | 'audio',
  index: number = 0
): Promise<{ path: string; url: string }> {
  const ext = blob.type.split('/')[1] || (mediaType === 'audio' ? 'webm' : 'jpg')
  const path = `${userId}/${sightingId}/${mediaType}-${index}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export function getMediaUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
