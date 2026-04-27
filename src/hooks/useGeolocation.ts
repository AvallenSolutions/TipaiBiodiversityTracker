import { useState, useCallback } from 'react'
import type { LocationData } from '@/types'

export function useGeolocation() {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Permission denied is permanent for the session — once it's set we stop
  // calling getCurrentPosition so we don't generate console noise (and on
  // iOS Safari, won't repeatedly trigger the system "denied" path).
  const [deniedPermanent, setDeniedPermanent] = useState(false)

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    if (deniedPermanent) return

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
        // PERMISSION_DENIED (1) sticks for the session — likely set in
        // browser/site settings rather than a one-off dismissal. Surface a
        // friendlier message and stop retrying.
        if (err.code === err.PERMISSION_DENIED) {
          setDeniedPermanent(true)
          setError(
            'Location access is blocked for this site. ' +
            'You can save the sighting without GPS, or enable Location ' +
            'Services in your browser settings to attach coordinates.'
          )
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('GPS unavailable — your device couldn\'t get a fix.')
        } else if (err.code === err.TIMEOUT) {
          setError('GPS timed out — try again, or save without location.')
        } else {
          setError(`Location error: ${err.message}`)
        }
        setLoading(false)
      },
      // 60s timeout because cold-start GPS without A-GPS (i.e. offline)
      // can legitimately take 30+ seconds outdoors; maximumAge: 60000
      // accepts a recent cached fix so the picker isn't blocked while
      // the receiver re-locks for a fresh reading.
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 60000 }
    )
  }, [deniedPermanent])

  return { location, loading, error, deniedPermanent, getLocation }
}

export function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '— no GPS —'
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`
}
