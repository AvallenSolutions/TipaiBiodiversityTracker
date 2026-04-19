import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sighting } from '../types/sighting'
import { syncPendingSightings } from '../services/syncService'
import { getPendingSightings } from '../lib/db'
import { DS } from '../lib/ledger-design'
import { Masthead, LedgerView } from '../components/Ledger/Masthead'
import { Mono } from '../components/Ledger/shared'
import { Desk } from '../components/Ledger/Desk'
import { SightingDetailView } from '../components/Ledger/SightingDetailView'
import { SpeciesDetailView } from '../components/Ledger/SpeciesDetailView'

function deriveInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'WL'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const [sightings, setSightings] = useState<Sighting[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [view, setView] = useState<LedgerView>('desk')
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)

  const loadSightings = useCallback(async () => {
    try {
      let query = supabase
        .from('sightings')
        .select('*')
        .order('sighted_at', { ascending: false })

      if (profile?.user_role !== 'naturalist' && profile?.id) {
        query = query.eq('user_id', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setSightings(data || [])
    } catch (e) {
      console.error('Error loading sightings:', e)
    } finally {
      setLoading(false)
    }
  }, [profile])

  const loadPendingCount = useCallback(async () => {
    const pending = await getPendingSightings()
    setPendingCount(pending.length)
  }, [])

  const runSync = useCallback(async () => {
    setSyncing(true)
    try {
      await syncPendingSightings()
      await loadSightings()
      await loadPendingCount()
    } catch (e) {
      console.error('Sync error:', e)
    } finally {
      setSyncing(false)
    }
  }, [loadSightings, loadPendingCount])

  useEffect(() => {
    loadSightings()
    loadPendingCount()
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadSightings, loadPendingCount])

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      runSync()
    }
  }, [isOnline, pendingCount, syncing, runSync])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function openSighting(s: Sighting) {
    setSelectedSighting(s)
    setView('sighting')
  }

  function openSpecies(name: string) {
    setSelectedSpecies(name)
    setView('species')
  }

  const userInitials = deriveInitials(profile?.full_name, profile?.email)

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
              : `${pendingCount} sighting${pendingCount !== 1 ? 's' : ''} pending sync${syncing ? ' — syncing now…' : ''}`}
          </Mono>
          {isOnline && !syncing && pendingCount > 0 && (
            <button onClick={runSync} style={{
              background: 'transparent', border: `0.5px solid ${DS.ivory}`, cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: DS.ivory, padding: '4px 10px',
            }}>Sync now</button>
          )}
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
            || selectedSighting.species_name
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
