import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSightings } from '@/hooks/useSightings'
import { useSpeciesEditor } from '@/context/SpeciesEditorContext'
import { getPendingCount } from '@/lib/offline'
import { DS } from '@/lib/ledger-design'
import type { LedgerView } from '@/components/Ledger/Masthead'
import { Masthead } from '@/components/Ledger/Masthead'
import { Mono } from '@/components/Ledger/shared'
import { Desk } from '@/components/Ledger/Desk'
import { SightingDetailView } from '@/components/Ledger/SightingDetailView'
import { SightingsListView } from '@/components/Ledger/SightingsListView'
import { SpeciesDetailView } from '@/components/Ledger/SpeciesDetailView'
import { SpeciesLibraryView } from '@/components/Ledger/SpeciesLibraryView'
import type { Sighting, Species } from '@/types'

function deriveInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    if (parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'WL'
}

export default function DashboardPage() {
  const { profile, user, signOut } = useAuth()
  const { sightings, loading, fetchSightings } = useSightings()

  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [view, setView] = useState<LedgerView>('desk')
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  // When the user opens a species *from the Library admin* we have the
  // full library row. Carry it through so the detail view can render the
  // cover, description, family, native/notable flags — and the Edit
  // button. Calls coming in from Desk or SightingDetailView only have a
  // name; the detail view falls back to name-based rendering there.
  const [selectedSpeciesEntry, setSelectedSpeciesEntry] = useState<Species | null>(null)
  const { open: openEditor } = useSpeciesEditor()

  useEffect(() => {
    fetchSightings()
    getPendingCount().then(setPendingCount).catch(() => {})

    const onOnline = () => {
      setIsOnline(true)
      fetchSightings()
      getPendingCount().then(setPendingCount).catch(() => {})
    }
    const onOffline = () => {
      setIsOnline(false)
      getPendingCount().then(setPendingCount).catch(() => {})
    }
    const onFocus = () => fetchSightings()
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchSightings() }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchSightings])

  const handleSignOut = useCallback(() => {
    signOut()
  }, [signOut])

  function openSighting(s: Sighting) {
    setSelectedSighting(s)
    setView('sighting')
  }

  function openSpecies(name: string) {
    setSelectedSpecies(name)
    setSelectedSpeciesEntry(null)
    setView('species')
  }

  function openSpeciesEntry(entry: Species) {
    setSelectedSpecies(entry.common_name)
    setSelectedSpeciesEntry(entry)
    setView('species')
  }

  function closeSpecies() {
    setSelectedSpecies(null)
    setSelectedSpeciesEntry(null)
  }

  const userInitials = deriveInitials(profile?.display_name, user?.email)

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: DS.paper, fontFamily: DS.sans,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: DS.serif, fontSize: 32, fontWeight: 200,
            letterSpacing: '-0.02em', color: DS.ink, fontStyle: 'italic',
          }}>Reading the field…</div>
          <Mono size={10} color={DS.inkSoft} style={{ marginTop: 12 }}>Loading records</Mono>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: DS.paper, fontFamily: DS.sans, color: DS.ink }}>
      <Masthead
        view={view}
        onNav={setView}
        selectedSighting={selectedSighting}
        selectedSpecies={selectedSpecies}
        onSignOut={handleSignOut}
        userInitials={userInitials}
      />

      {(pendingCount > 0 || !isOnline) && (
        <div style={{
          background: isOnline ? DS.ochre : DS.rust,
          padding: '10px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Mono size={10} color={DS.ivory} letter={0.18}>
            {!isOnline
              ? `● OFFLINE · ${pendingCount} sighting${pendingCount !== 1 ? 's' : ''} held locally`
              : `${pendingCount} sighting${pendingCount !== 1 ? 's' : ''} pending sync`}
          </Mono>
        </div>
      )}

      {view === 'desk' && (
        <Desk sightings={sightings} onOpenSighting={openSighting} onOpenSpecies={openSpecies} />
      )}

      {view === 'sighting' && selectedSighting && (
        <SightingDetailView
          sighting={selectedSighting}
          onBack={() => { setSelectedSighting(null) }}
          onOpenSpecies={() => openSpecies(
            selectedSighting.common_name
            || selectedSighting.scientific_name
            || `Unknown ${selectedSighting.category}`
          )}
          onChanged={() => { fetchSightings(); setSelectedSighting(null) }}
        />
      )}

      {view === 'sighting' && !selectedSighting && (
        <SightingsListView
          sightings={sightings}
          onOpenSighting={openSighting}
          onChanged={fetchSightings}
        />
      )}

      {view === 'species' && selectedSpecies && (
        <SpeciesDetailView
          speciesName={selectedSpecies}
          species={selectedSpeciesEntry}
          sightings={sightings}
          onBack={closeSpecies}
          onOpenSighting={openSighting}
          onEdit={selectedSpeciesEntry && (profile?.role === 'naturalist' || profile?.role === 'admin')
            ? () => openEditor(selectedSpeciesEntry)
            : undefined}
        />
      )}

      {view === 'species' && !selectedSpecies && (
        <SpeciesLibraryView onOpen={openSpeciesEntry} />
      )}
    </div>
  )
}
