import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sighting } from '../types/sighting'
import { syncPendingSightings } from '../services/syncService'
import { getPendingSightings } from '../lib/db'
import {
  Plus,
  LogOut,
  MapPin,
  Calendar,
  Filter,
  RefreshCw,
  Wifi,
  WifiOff,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { formatCoordinates } from '../utils/geolocation'

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [sightings, setSightings] = useState<Sighting[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    loadSightings()
    loadPendingCount()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      handleSync()
    }
  }, [isOnline])

  async function loadSightings() {
    try {
      let query = supabase
        .from('sightings')
        .select('*')
        .order('sighted_at', { ascending: false })

      if (profile?.user_role !== 'naturalist') {
        query = query.eq('user_id', profile?.id)
      }

      const { data, error } = await query

      if (error) throw error
      setSightings(data || [])
    } catch (error) {
      console.error('Error loading sightings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPendingCount() {
    const pending = await getPendingSightings()
    setPendingCount(pending.length)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncPendingSightings()
      if (result.synced > 0) {
        alert(`${result.synced} sighting(s) synced successfully!`)
        await loadSightings()
        await loadPendingCount()
      }
      if (result.failed > 0) {
        alert(`${result.failed} sighting(s) failed to sync. Will retry later.`)
      }
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const filteredSightings = filterCategory === 'all'
    ? sightings
    : sightings.filter(s => s.category === filterCategory)

  const categories = ['all', 'mammal', 'bird', 'lizard', 'insect', 'plant', 'trace', 'fungi']

  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100">
      {/* Header */}
      <div className="bg-tipai-green-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tipai Biodiversity</h1>
              <p className="text-tipai-green-100 text-sm">
                {profile?.full_name || profile?.email} • {profile?.user_role}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-green-300" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-300" />
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-tipai-green-600 hover:bg-tipai-green-800 px-4 py-2 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-tipai-green-700">
              {sightings.length}
            </div>
            <div className="text-gray-600">Total Sightings</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-orange-600">
              {pendingCount}
            </div>
            <div className="text-gray-600">Pending Sync</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-center">
            <button
              onClick={() => navigate('/new-sighting')}
              className="w-full bg-tipai-green-600 hover:bg-tipai-green-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Sighting
            </button>
          </div>
        </div>

        {/* Sync Button */}
        {pendingCount > 0 && isOnline && (
          <div className="mb-6">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : `Sync ${pendingCount} Pending Sighting(s)`}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-700">Filter by Category</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-tipai-green-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Sightings List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tipai-green-700 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sightings...</p>
          </div>
        ) : filteredSightings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No sightings yet</p>
            <p className="text-gray-500 text-sm mt-2">Start logging biodiversity!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSightings.map((sighting) => (
              <div
                key={sighting.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {sighting.photo_url && (
                  <img
                    src={sighting.photo_url}
                    alt="Sighting"
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-3 py-1 bg-tipai-green-100 text-tipai-green-800 text-sm font-medium rounded-full capitalize">
                      {sighting.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(sighting.sighted_at), 'MMM d, yyyy')}
                    </span>
                  </div>

                  {sighting.common_name && (
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {sighting.common_name}
                    </h3>
                  )}
                  {sighting.species_name && (
                    <p className="text-sm text-gray-600 italic mb-2">
                      {sighting.species_name}
                    </p>
                  )}

                  {sighting.notes && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {sighting.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{formatCoordinates(sighting.latitude, sighting.longitude)}</span>
                    </div>
                  </div>

                  {sighting.ai_confidence && (
                    <div className="mt-2 text-xs text-blue-600">
                      AI: {sighting.ai_confidence}% confidence
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
