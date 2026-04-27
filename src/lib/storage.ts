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

// Upload an image file for a species library entry. We reuse the
// sighting-media bucket (RLS already allows authenticated uploads + public
// reads) and root the path at the uploading user's id so the delete policy
// permits cleanup if the same user later removes the image.
export async function uploadSpeciesImage(
  userId: string,
  speciesId: string,
  blob: Blob,
): Promise<{ path: string; url: string }> {
  const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg'
  // crypto.randomUUID is available in evergreen browsers and Node 19+
  const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = `${userId}/species/${speciesId}/${id}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export function getMediaUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
