// Draft persistence for the species editor — keeps a partially filled-in
// "new species" form alive across navigations, tab switches, and reloads
// so the naturalist can pop out to look something up (Wikipedia, the
// gallery to grab a photo, etc.) without losing what they've typed.
//
// Drafts are scoped per user so two people on a shared device don't see
// each other's work.

import type { SightingCategory } from '@/types'

export type NativeFlag = 'unknown' | 'native' | 'non_native'

export interface SpeciesDraft {
  // A stable id we generate up front so any uploaded images live under a
  // path we can recover from after a navigation/reload.
  targetId: string
  common: string
  scientific: string
  category: SightingCategory
  subcategory: string
  family: string
  description: string
  habitat: string
  nativeFlag: NativeFlag
  isNotable: boolean
  coverUrl: string | null
  galleryUrls: string[]
  // ms timestamp; we discard drafts older than DRAFT_TTL_MS so an old
  // abandoned draft doesn't haunt the user forever.
  updatedAt: number
}

const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000  // 14 days
const DRAFT_VERSION = 1

function key(userId: string): string {
  return `species-editor:new:${userId}:v${DRAFT_VERSION}`
}

export function loadSpeciesDraft(userId: string | undefined): SpeciesDraft | null {
  if (!userId) return null
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SpeciesDraft
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.updatedAt !== 'number') return null
    if (Date.now() - parsed.updatedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key(userId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveSpeciesDraft(userId: string | undefined, draft: SpeciesDraft): void {
  if (!userId) return
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(userId), JSON.stringify({ ...draft, updatedAt: Date.now() }))
  } catch {
    // Quota or disabled storage — fail silently; the editor still works
    // for the current page lifetime.
  }
}

export function clearSpeciesDraft(userId: string | undefined): void {
  if (!userId) return
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(userId))
  } catch {
    // ignore
  }
}

export function hasSpeciesDraft(userId: string | undefined): boolean {
  return loadSpeciesDraft(userId) !== null
}
