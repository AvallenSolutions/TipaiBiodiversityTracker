import { useState, useCallback } from 'react'
import type { LocationData } from '@/types'

export function useGeolocation() {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLoading(false)
      },
      (err) => {
        setError(`Location error: ${err.message}`)
        setLoading(false)
      },
      // 60s timeout because cold-start GPS without A-GPS (i.e. offline)
      // can legitimately take 30+ seconds outdoors; maximumAge: 60000
      // accepts a recent cached fix so the picker isn't blocked while
      // the receiver re-locks for a fresh reading.
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 60000 }
    )
  }, [])

  return { location, loading, error, getLocation }
}

export function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '— no GPS —'
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`
}
