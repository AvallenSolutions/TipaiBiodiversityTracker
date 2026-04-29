import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { hasSpeciesDraft } from '@/lib/speciesDraft'
import { SpeciesEditorSheet } from '@/components/Ledger/SpeciesEditorSheet'
import type { Species } from '@/types'

// Lifted out of any specific page so the modal survives every in-app
// navigation: clicking another tab in the dashboard, jumping to the Feed
// or Library, or opening a different sighting in another window all leave
// the editor up where the naturalist last had it.

type Target = Species | 'new'

interface SpeciesEditorContextValue {
  editing: Target | null
  open: (target: Target) => void
  close: () => void
  // Bumps every time a save lands so list views can refresh.
  savedVersion: number
}

const Ctx = createContext<SpeciesEditorContextValue | null>(null)

export function SpeciesEditorProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const canEdit = profile?.role === 'naturalist' || profile?.role === 'admin'
  const [editing, setEditing] = useState<Target | null>(null)
  const [savedVersion, setSavedVersion] = useState(0)

  const open = useCallback((target: Target) => setEditing(target), [])
  const close = useCallback(() => setEditing(null), [])

  // Auto-resume an in-progress new-species draft as soon as a user lands.
  // The draft was already persisted to localStorage; this just brings the
  // modal back to the surface without forcing the naturalist to find the
  // Species tab and re-click the button.
  useEffect(() => {
    if (!user?.id || !canEdit) return
    if (editing) return
    if (hasSpeciesDraft(user.id)) setEditing('new')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canEdit])

  const value = useMemo<SpeciesEditorContextValue>(
    () => ({ editing, open, close, savedVersion }),
    [editing, open, close, savedVersion],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {editing && (
        <SpeciesEditorSheet
          species={editing === 'new' ? null : editing}
          onClose={close}
          onSaved={() => {
            setSavedVersion(v => v + 1)
            setEditing(null)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

export function useSpeciesEditor(): SpeciesEditorContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSpeciesEditor must be used inside SpeciesEditorProvider')
  return v
}
