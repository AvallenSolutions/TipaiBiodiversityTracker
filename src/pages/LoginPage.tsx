import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Leaf, Mail, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signInAsGuest, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'guest'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestSent, setGuestSent] = useState(false)

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGuestLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInAsGuest(email)
      setGuestSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-50 to-tipai-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <Leaf className="mx-auto h-14 w-14 text-tipai-700" />
          <h1 className="mt-4 text-3xl font-bold text-tipai-900">Tipai Biodiversity</h1>
          <p className="mt-1 text-tipai-700">Track and protect forest life</p>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-white rounded-lg shadow-sm p-1">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-tipai-700 text-white' : 'text-gray-600'
            }`}
          >
            Staff / Naturalist
          </button>
          <button
            onClick={() => { setMode('guest'); setError('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'guest' ? 'bg-tipai-700 text-white' : 'text-gray-600'
            }`}
          >
            Guest
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {mode === 'guest' && guestSent ? (
            <div className="text-center py-4">
              <Mail className="mx-auto h-12 w-12 text-tipai-600 mb-3" />
              <h3 className="font-semibold text-gray-900">Check your email</h3>
              <p className="text-sm text-gray-600 mt-2">
                We've sent a magic link to <strong>{email}</strong>. Click it to log in.
              </p>
            </div>
          ) : mode === 'guest' ? (
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <p className="text-sm text-gray-600">Enter your email to receive a login link — no password needed.</p>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-tipai-700 text-white py-2.5 rounded-lg font-semibold hover:bg-tipai-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Magic Link
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-tipai-700 text-white py-2.5 rounded-lg font-semibold hover:bg-tipai-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
              <p className="text-center text-sm text-gray-600">
                Don't have an account? <Link to="/signup" className="text-tipai-700 font-medium hover:underline">Sign Up</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
