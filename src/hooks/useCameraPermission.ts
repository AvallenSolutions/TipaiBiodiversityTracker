import { useState, useEffect, useCallback } from 'react'

export type CameraPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

const LS_KEY = 'tipai-camera-permission'

function persist(state: 'granted' | 'denied') {
  try { localStorage.setItem(LS_KEY, state) } catch {}
}

function readPersisted(): CameraPermissionState {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'granted' || v === 'denied') return v
  } catch {}
  return 'unknown'
}

/**
 * Tracks camera permission state using the Permissions API where available,
 * with a localStorage fallback so previously-granted permission is recognised
 * immediately on the next app open without waiting for a fresh API query.
 *
 * `request()` fires a silent getUserMedia probe to trigger the browser grant
 * dialog (if needed) before the user even reaches the camera step, so the
 * live viewfinder opens immediately the first time.
 */
export function useCameraPermission(skip = false) {
  const [state, setState] = useState<CameraPermissionState>(readPersisted)

  useEffect(() => {
    if (skip) return
    if (!('permissions' in navigator)) return

    let permStatus: PermissionStatus | null = null

    navigator.permissions
      .query({ name: 'camera' as PermissionName })
      .then(status => {
        permStatus = status
        const mapped = status.state as CameraPermissionState
        setState(mapped)
        if (mapped === 'granted') persist('granted')
        if (mapped === 'denied') persist('denied')

        // Stay in sync if the user changes permission in browser settings
        status.onchange = () => {
          const next = status.state as CameraPermissionState
          setState(next)
          if (next === 'granted') persist('granted')
          if (next === 'denied') persist('denied')
        }
      })
      .catch(() => {
        // Permissions API not supported or not allowed — use persisted state
      })

    return () => {
      if (permStatus) permStatus.onchange = null
    }
  }, [skip])

  /**
   * Attempt to acquire camera access now. On first call this shows the
   * browser permission dialog; on subsequent calls (state === 'granted')
   * the probe runs silently and the tracks are immediately released.
   */
  const request = useCallback(async (): Promise<CameraPermissionState> => {
    if (skip) return 'unknown'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      stream.getTracks().forEach(t => t.stop())
      setState('granted')
      persist('granted')
      return 'granted'
    } catch {
      const next: CameraPermissionState = state === 'prompt' ? 'denied' : state
      setState(next)
      if (next === 'denied') persist('denied')
      return next
    }
  }, [skip, state])

  return { state, request }
}
