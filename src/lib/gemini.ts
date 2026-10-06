// Client for the identify-species edge function. The Gemini key and all
// prompting live on the server; this module only shrinks photos, sends
// them, and turns failures into short messages a ranger can act on.

import { supabase } from './supabase'
import { downloadMedia } from './storage'
import type { AISuggestion, Park, Sighting, SightingCategory, UserRole } from '@/types'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify-species`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Long edge for photos sent for identification. Phone photos are often
// 5 to 8 MB; sending them whole over a weak signal is what caused the
// "Load failed" errors. 1600px keeps every field mark the model can use.
const IDENTIFY_EDGE = 1600
// Long edge for the thumbnail stored as a learned example.
const EXAMPLE_EDGE = 768

export interface IdentifyContext {
  latitude?: number | null
  longitude?: number | null
  park?: Park | null
  sighted_at?: string | null
  // Habitat the observer noted (only known when re-identifying a saved record).
  habitat?: string | null
  // Leave this sighting out of the photo memory (used by the accuracy test).
  exclude_sighting_id?: string | null
}

export class AiError extends Error {
  constructor(message: string, public code: string, public retryable: boolean) {
    super(message)
  }
}

/** AI identification runs on the server, so it only needs a connection. */
export function isAiAvailable(): boolean {
  return navigator.onLine
}

/** Naturalists and admins confirm species; their records teach the AI. */
export function canTeachAi(role: UserRole | null | undefined): boolean {
  return role === 'naturalist' || role === 'admin'
}

export async function identifySpecies(
  photos: Blob | Blob[],
  category: SightingCategory | null,
  context: IdentifyContext = {},
): Promise<AISuggestion[]> {
  if (!navigator.onLine) return []
  const list = (Array.isArray(photos) ? photos : [photos]).slice(0, 3)
  const images = await Promise.all(list.map(async p => toInline(await shrinkImage(p, IDENTIFY_EDGE, 0.85))))

  const result = await callFunction({
    action: 'identify',
    images,
    category,
    latitude: context.latitude ?? null,
    longitude: context.longitude ?? null,
    park: context.park ?? null,
    sighted_at: context.sighted_at ?? null,
    habitat: context.habitat ?? null,
    exclude_sighting_id: context.exclude_sighting_id ?? null,
  }, 130_000)

  console.debug('[identify] result', result)
  return (result?.suggestions ?? []) as AISuggestion[]
}

/**
 * Teach the AI from a confirmed sighting. Sends a small thumbnail; the
 * server reads the species name from the database, never from the client.
 * If the sighting is unnamed or rejected, the server removes the example.
 */
export async function learnFromSighting(sightingId: string, photo: Blob): Promise<boolean> {
  const thumb = await shrinkImage(photo, EXAMPLE_EDGE, 0.8)
  const result = await callFunction({ action: 'learn', sighting_id: sightingId, image: await toInline(thumb) }, 60_000)
  return !!result?.learned
}

/** Teach from a saved sighting record (uses its first photo). */
export async function learnFromSightingRecord(s: Pick<Sighting, 'id' | 'media'>): Promise<boolean> {
  const photo = s.media?.find(m => m.media_type === 'photo')
  if (!photo) return false
  const blob = await downloadMedia(photo.storage_path).catch(() => {
    throw new AiError('Could not load the sighting photo.', 'photo', true)
  })
  return learnFromSighting(s.id, blob)
}

// ─── Internals ────────────────────────────────────────────────────────

async function callFunction(body: unknown, timeoutMs: number): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new AiError('Please sign in to use AI identification.', 'unauthorised', false)

  const payload = JSON.stringify(body)
  // Network drops ("Load failed" on iPhone) are retried here. Busy errors
  // are already retried on the server, so we report those straight away.
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: ANON_KEY,
        },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err: any) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      console.warn('[identify] network error', attempt + 1, err)
      if (!timedOut && attempt < 2 && navigator.onLine) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      throw timedOut
        ? new AiError('The AI took too long to answer. Try again.', 'timeout', true)
        : new AiError('Could not reach the AI. Check your signal and try again.', 'network', true)
    }

    const data = await res.json().catch(() => null)
    if (res.ok) return data
    console.warn('[identify] server error', res.status, data)
    throw new AiError(
      data?.error || `AI request failed (${res.status}). Try again.`,
      data?.code || 'failed',
      res.status >= 500 || res.status === 429,
    )
  }
}

async function toInline(blob: Blob): Promise<{ mime_type: string; data: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  return { mime_type: blob.type || 'image/jpeg', data: dataUrl.split(',')[1] ?? '' }
}

/**
 * Downscale a photo to `maxEdge` pixels on the long side as JPEG. Returns
 * the original blob if the browser cannot decode it (the server still
 * accepts it, just more slowly).
 */
export async function shrinkImage(src: Blob, maxEdge: number, quality: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(src)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && src.type === 'image/jpeg' && src.size < 900_000) {
      bitmap.close()
      return src
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality))
    return out ?? src
  } catch (err) {
    console.warn('[identify] could not shrink photo, sending original', err)
    return src
  }
}
