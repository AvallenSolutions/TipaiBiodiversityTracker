import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { getPendingCount } from '@/lib/offline'
import { DS } from '@/lib/ledger-design'

const monoStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: DS.mono,
  fontSize: 9,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  ...extra,
})

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)
  const prevOnlineRef = useRef(navigator.onLine)
  const syncBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function refreshPending() {
      getPendingCount().then(setPendingCount).catch(() => {})
    }
    refreshPending()
    const interval = setInterval(refreshPending, 15_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (!prevOnlineRef.current) {
        getPendingCount().then(count => {
          setSyncedCount(count > 0 ? count : 0)
          setPendingCount(0)
          if (syncBannerTimerRef.current) clearTimeout(syncBannerTimerRef.current)
          syncBannerTimerRef.current = setTimeout(() => setSyncedCount(null), 3000)
        }).catch(() => {})
      }
      prevOnlineRef.current = true
    }
    const handleOffline = () => {
      setIsOnline(false)
      setSyncedCount(null)
      prevOnlineRef.current = false
      getPendingCount().then(setPendingCount).catch(() => {})
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (syncBannerTimerRef.current) clearTimeout(syncBannerTimerRef.current)
    }
  }, [])

  const canSeeDashboard = profile?.role === 'naturalist' || profile?.role === 'admin'
  const canSeeAdmin = profile?.role === 'admin'

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/new', label: 'Log' },
    { path: '/species', label: 'Species' },
    ...(canSeeDashboard ? [{ path: '/dashboard', label: 'Ledger' }] : []),
    ...(canSeeAdmin ? [{ path: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: DS.paper }}>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 60,
          background: DS.rust, padding: '9px 20px', textAlign: 'center',
        }}>
          <span style={{ ...monoStyle({ fontSize: 9, color: DS.ivory, letterSpacing: '0.18em' }) }}>
            ● Offline — sightings will sync when you reconnect
          </span>
        </div>
      )}

      {/* Synced banner */}
      {isOnline && syncedCount !== null && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 60,
          background: DS.forest, padding: '9px 20px', textAlign: 'center',
        }}>
          <span style={{ ...monoStyle({ fontSize: 9, color: DS.ivory, letterSpacing: '0.18em' }) }}>
            {syncedCount > 0
              ? `● ${syncedCount} sighting${syncedCount === 1 ? '' : 's'} synced`
              : '● Back online'}
          </span>
        </div>
      )}

      {/* Top bar */}
      <header style={{
        background: DS.paper, borderBottom: `1px solid ${DS.ink}`,
        padding: '14px 20px 0',
        position: 'sticky', top: 0, zIndex: 50,
        flexShrink: 0,
      }}>
        <div style={{
          borderTop: `3px double ${DS.ink}`, paddingTop: 12, paddingBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/wildlife-luxuries-logo.png" alt="Wildlife Luxuries"
                 style={{ height: 34, width: 'auto', display: 'block' }} />
            <div style={{ borderLeft: `0.5px solid ${DS.inkFaint}`, height: 24 }} />
            <span style={{ ...monoStyle({ color: DS.inkSoft, letterSpacing: '0.15em' }) }}>
              {profile?.display_name ?? 'Field Log'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ ...monoStyle({ fontSize: 8, color: isOnline ? DS.forest : DS.rust, letterSpacing: '0.18em' }) }}>
              {isOnline ? '● Online' : '○ Offline'}
            </span>
            <button
              onClick={async () => { await signOut(); navigate('/login') }}
              style={{
                background: 'transparent', border: `0.5px solid ${DS.inkHair}`,
                cursor: 'pointer', ...monoStyle({ fontSize: 8, color: DS.inkSoft }),
                padding: '5px 10px', letterSpacing: '0.18em',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, paddingBottom: 72 }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: DS.ivory, borderTop: `1px solid ${DS.ink}`,
        zIndex: 50, display: 'flex',
      }}>
        {navItems.map((item, i) => {
          const active = location.pathname === item.path
          const isLog = item.path === '/new'
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1, padding: '12px 4px 16px', position: 'relative',
                background: active ? DS.ink : 'transparent',
                border: 'none',
                borderRight: i < navItems.length - 1 ? `0.5px solid ${DS.inkHair}` : 'none',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              {isLog && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: 8, right: '50%', marginRight: -16,
                  width: 6, height: 6, borderRadius: 3, background: DS.ochre,
                  border: `1.5px solid ${active ? DS.ink : DS.ivory}`,
                }} />
              )}
              <span style={{
                ...monoStyle({ fontSize: 9, letterSpacing: '0.18em', color: active ? DS.ivory : DS.inkSoft }),
              }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
