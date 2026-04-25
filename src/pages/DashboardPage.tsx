import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSightings } from '@/hooks/useSightings'
import { getPendingCount } from '@/lib/offline'
import { DS } from '@/lib/ledger-design'
import type { LedgerView } from '@/components/Ledger/Masthead'
import { Masthead } from '@/components/Ledger/Masthead'
import { Mono } from '@/components/Ledger/shared'
import { Desk } from '@/components/Ledger/Desk'
import { SightingDetailView } from '@/components/Ledger/SightingDetailView'
import { SpeciesDetailView } from '@/components/Ledger/SpeciesDetailView'
import type { Sighting } from '@/types'

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
  const navigate = useNavigate()
  const { profile, user, signOut } = useAuth()
  const { sightings, loading, fetchSightings } = useSightings()

  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [view, setView] = useState<LedgerView>('desk')
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)

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

  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/login')
  }, [signOut, navigate])

  function openSighting(s: Sighting) {
    setSelectedSighting(s)
    setView('sighting')
  }

  function openSpecies(name: string) {
    setSelectedSpecies(name)
    setView('species')
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
          onBack={() => setView('desk')}
          onOpenSpecies={() => openSpecies(
            selectedSighting.common_name
            || selectedSighting.scientific_name
            || `Unknown ${selectedSighting.category}`
          )}
        />
      )}

      {view === 'sighting' && !selectedSighting && (
        <div style={{
          padding: '60px 40px', fontFamily: DS.serif, fontSize: 22,
          fontStyle: 'italic', color: DS.inkSoft,
        }}>
          Select an entry from the Front Desk to view its full record.
        </div>
      )}

      {view === 'species' && selectedSpecies && (
        <SpeciesDetailView
          speciesName={selectedSpecies}
          sightings={sightings}
          onBack={() => setView('desk')}
          onOpenSighting={openSighting}
        />
      )}

      {view === 'species' && !selectedSpecies && (
        <div style={{
          padding: '60px 40px', fontFamily: DS.serif, fontSize: 22,
          fontStyle: 'italic', color: DS.inkSoft,
        }}>
          Open the Library on the Front Desk to pick a species folio.
        </div>
      )}
    </div>
  )
}
