import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

/**
 * Upsert a profile row for the given auth user, inserting with role='guest'
 * only when no row exists. Existing roles are never overwritten.
 *
 * Call this before any INSERT into sightings to prevent the FK violation
 * that occurs when handle_new_user() failed silently during sign-up.
 */
export async function ensureProfile(user: User): Promise<void> {
  const email = user.email ?? null
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ||
    (email ? email.split('@')[0] : null) ||
    'Observer'

  await (supabase.from('profiles') as any).upsert(
    { id: user.id, email, display_name: displayName, role: 'guest' },
    { onConflict: 'id', ignoreDuplicates: true }
  )
}
