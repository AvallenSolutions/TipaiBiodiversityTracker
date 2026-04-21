import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { getPendingCount } from '@/lib/offline'
import { format } from 'date-fns'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import InstallPromptSheet from '@/components/InstallPromptSheet'
import { isStandalone, isMobile } from '@/hooks/useInstallPrompt'

type NavItem = { path: string; label: string; short: string }

const navItems: NavItem[] = [
  { path: '/',        label: 'The Feed',    short: 'Feed' },
  { path: '/new',     label: 'New Entry',   short: 'Log' },
  { path: '/species', label: 'The Library', short: 'Library' },
]

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

  const allNav: NavItem[] = [
    ...navItems,
    ...(profile?.role === 'naturalist' || profile?.role === 'admin'
      ? [{ path: '/dashboard', label: 'The Ledger', short: 'Ledger' }]
      : []),
  ]

  const today = format(new Date(), 'd MMM yyyy').toUpperCase()
  const initials = (profile?.display_name || profile?.email || 'N')
    .split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()

  // Hide masthead on the camera capture step — NewSightingPage renders its own
  // full-bleed chrome. Driven by data attribute set on <body>.
  const isFullBleed = useFullBleed()

  // First-visit install prompt for signed-in mobile users
  const [showInstall, setShowInstall] = useState(false)
  useEffect(() => {
    if (!profile) return
    if (isStandalone()) return
    if (!isMobile()) return
    const key = `install-prompt-dismissed-${profile.id}`
    if (localStorage.getItem(key)) return
    const timer = setTimeout(() => setShowInstall(true), 1800)
    return () => clearTimeout(timer)
  }, [profile])

  function dismissInstall() {
    if (profile) localStorage.setItem(`install-prompt-dismissed-${profile.id}`, String(Date.now()))
    setShowInstall(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: DS.paper, color: DS.ink }}>
      {/* Offline / synced banner */}
      {!isOnline && (
        <div style={bannerStyle(DS.rust)}>
          <Mono size={10} color={DS.ivory} letter={0.22}>
            Offline · entries will sync when signal returns
          </Mono>
        </div>
      )}
      {isOnline && syncedCount !== null && (
        <div style={bannerStyle(DS.forest)}>
          <Mono size={10} color={DS.ivory} letter={0.22}>
            {syncedCount > 0
              ? `${syncedCount} entr${syncedCount === 1 ? 'y' : 'ies'} synced`
              : 'Back online'}
          </Mono>
        </div>
      )}

      {/* Masthead */}
      {!isFullBleed && (
        <header style={{
          background: DS.paper,
          padding: 'max(14px, env(safe-area-inset-top)) 20px 0',
          position: 'sticky', top: 0, zIndex: 40,
          borderBottom: `1px solid ${DS.ink}`,
        }}>
          <div style={{
            borderTop: `3px double ${DS.ink}`,
            paddingTop: 12, paddingBottom: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/wildlife-luxuries-logo.png"
                alt="Wildlife Luxuries"
                style={{ height: 30, width: 'auto', display: 'block' }}
              />
              <div style={{ borderLeft: `0.5px solid ${DS.inkFaint}`, height: 22 }} />
              <Mono size={9} color={DS.inkSoft} letter={0.22}>The Field Journal</Mono>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mono size={9} color={DS.inkSoft} letter={0.22}>{today}</Mono>
              <button
                onClick={async () => { await signOut(); navigate('/login') }}
                title="Sign out"
                style={{
                  width: 28, height: 28, borderRadius: 14, background: DS.forest,
                  color: DS.ivory, border: 'none', cursor: 'pointer',
                  fontFamily: DS.mono, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >{initials}</button>
            </div>
          </div>
        </header>
      )}

      {/* Content */}
      <main style={{ paddingBottom: isFullBleed ? 0 : 'calc(88px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      {!isFullBleed && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: DS.ivory, borderTop: `1px solid ${DS.ink}`,
          zIndex: 40,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0 14px' }}>
            {allNav.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              const isLog = item.path === '/new'
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 4, padding: '4px 10px', position: 'relative', minWidth: 60,
                  }}
                >
                  <span style={{
                    fontFamily: DS.serif, fontSize: 16, fontWeight: active ? 400 : 300,
                    fontStyle: active ? 'italic' : 'normal',
                    letterSpacing: '-0.01em', color: active ? DS.ink : DS.inkSoft,
                  }}>
                    {item.short}
                  </span>
                  <div style={{
                    width: 24, height: 1,
                    background: active ? DS.ochre : 'transparent',
                  }} />
                  {isLog && pendingCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 0, right: 8,
                      width: 6, height: 6, borderRadius: 3, background: DS.ochre,
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {showInstall && <InstallPromptSheet onClose={dismissInstall} />}
    </div>
  )
}

function bannerStyle(color: string): React.CSSProperties {
  return {
    position: 'sticky', top: 0, zIndex: 50,
    background: color, padding: '8px 16px',
    display: 'flex', justifyContent: 'center',
  }
}

// Detect full-bleed mode via the body attribute — the Log flow sets this when
// it's in the camera / sealing steps to get rid of all chrome.
function useFullBleed() {
  const [full, setFull] = useState(
    typeof document !== 'undefined' && document.body.dataset.fullBleed === 'true'
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setFull(document.body.dataset.fullBleed === 'true')
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-full-bleed'] })
    return () => observer.disconnect()
  }, [])
  return full
}
