import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Home, PlusCircle, BookOpen, BarChart3, Settings, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { getPendingCount } from '@/lib/offline'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/new', icon: PlusCircle, label: 'Log' },
  { path: '/species', icon: BookOpen, label: 'Species' },
]

const dashboardNav = { path: '/dashboard', icon: BarChart3, label: 'Dashboard' }
const adminNav = { path: '/admin', icon: Settings, label: 'Admin' }

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)
  const prevOnlineRef = useRef(navigator.onLine)
  const syncBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Poll pending count periodically
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
      // If we just came back online, show sync banner
      if (!prevOnlineRef.current) {
        getPendingCount().then(count => {
          if (count > 0) {
            setSyncedCount(count)
          } else {
            setSyncedCount(0)
          }
          setPendingCount(0)
          // Auto-hide after 3 seconds
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

  const allNav = [
    ...navItems,
    ...(profile?.role === 'naturalist' || profile?.role === 'admin' ? [dashboardNav] : []),
    ...(profile?.role === 'admin' ? [adminNav] : []),
  ]

  return (
    <div className="min-h-screen flex flex-col bg-tipai-stone-50">
      {/* Offline banner */}
      {!isOnline && (
        <div className="sticky top-0 z-[60] bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
          You're offline — sightings will sync when you reconnect
        </div>
      )}

      {/* Synced banner */}
      {isOnline && syncedCount !== null && (
        <div className="sticky top-0 z-[60] bg-tipai-600 px-4 py-2 text-center text-sm font-medium text-white animate-fade-in">
          {syncedCount > 0 ? `${syncedCount} sighting${syncedCount === 1 ? '' : 's'} synced ✓` : 'Back online ✓'}
        </div>
      )}

      {/* Top bar */}
      <header className="bg-tipai-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div>
          <h1 className="font-heading text-xl font-semibold">Tipai Biodiversity</h1>
          <p className="text-tipai-200 text-xs">{profile?.display_name} · {profile?.role}</p>
        </div>
        <div className="flex items-center gap-3">
          {isOnline ? <Wifi className="w-4 h-4 text-green-300" /> : <WifiOff className="w-4 h-4 text-amber-300" />}
          <button
            onClick={async () => { await signOut(); navigate('/login') }}
            className="p-2 rounded-lg hover:bg-tipai-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {allNav.map(item => {
            const active = location.pathname === item.path
            const isLog = item.path === '/new'
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  active ? 'text-tipai-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {isLog && pendingCount > 0 && (
                  <span className="absolute top-0 right-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" />
                )}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
