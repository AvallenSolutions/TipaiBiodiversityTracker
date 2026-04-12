import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Home, PlusCircle, BookOpen, BarChart3, Settings, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'

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

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const allNav = [
    ...navItems,
    ...(profile?.role === 'naturalist' || profile?.role === 'admin' ? [dashboardNav] : []),
    ...(profile?.role === 'admin' ? [adminNav] : []),
  ]

  return (
    <div className="min-h-screen flex flex-col bg-tipai-stone-50">
      {/* Top bar */}
      <header className="bg-tipai-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div>
          <h1 className="font-heading text-xl font-semibold">Tipai Biodiversity</h1>
          <p className="text-tipai-200 text-xs">{profile?.display_name} · {profile?.role}</p>
        </div>
        <div className="flex items-center gap-3">
          {isOnline ? <Wifi className="w-4 h-4 text-green-300" /> : <WifiOff className="w-4 h-4 text-red-300" />}
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
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  active ? 'text-tipai-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
