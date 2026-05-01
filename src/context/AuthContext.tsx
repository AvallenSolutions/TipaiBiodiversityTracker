import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  // signUp creates a guest-level account. The server-side trigger forces
  // role='guest' on every new user; an admin promotes legitimate staff
  // and naturalists from the Admin page after signup. Callers don't
  // pass a role any more.
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInAsGuest: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data as Profile)
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signUp(email: string, password: string, displayName: string) {
    // We deliberately do NOT pass a role in user_metadata — the server
    // trigger ignores it anyway (and forces 'guest') but sending it
    // would imply the client controls the outcome. Promotion is admin-only.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    })
    if (error) throw error
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signInAsGuest(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: email.split('@')[0], role: 'guest' },
      },
    })
    if (error) throw error
  }

  async function signOut() {
    // Global scope: invalidates the refresh token on the server so the
    // session can't be silently rehydrated. Without this, Supabase's
    // default 'local' scope only clears localStorage on this device —
    // the underlying session stays valid and any stale token (service
    // worker cache, BFCache, second tab) can resurrect it.
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (err) {
      // Even if the server call fails (e.g. offline), still wipe local
      // state below so the user is at least logged out on this device.
      console.warn('Server-side signOut failed, clearing local state anyway', err)
    }

    // Belt and braces: nuke every Supabase auth key in storage. The SDK
    // should do this itself but we've seen stale tokens survive on PWAs.
    try {
      const keys = Object.keys(localStorage)
      for (const k of keys) {
        if (k.startsWith('sb-') || k.includes('supabase.auth')) {
          localStorage.removeItem(k)
        }
      }
      sessionStorage.clear()
    } catch {}

    // Reset React state immediately so any UI that re-renders before
    // the reload doesn't briefly show the old user.
    setUser(null)
    setProfile(null)
    setSession(null)

    // Hard reload to flush every other source of state: service worker
    // caches, in-memory React Query data, IndexedDB-backed Supabase
    // session, the auth listener's pending profile fetch. Replacing the
    // history entry means Back can't take you to the authenticated view.
    window.location.replace('/login')
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signUp, signIn, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
