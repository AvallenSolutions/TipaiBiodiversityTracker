import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Leaf, UserCircle, Users, Mail } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp, guestSignIn } = useAuth()
  const [mode, setMode] = useState<'choice' | 'naturalist' | 'staff' | 'guest'>('choice')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'guest') {
        await guestSignIn(email)
        alert('A magic link has been sent to your email. Click it to log in and start logging sightings.')
      } else if (isSignUp) {
        const userRole = mode === 'naturalist' ? 'naturalist' : 'staff'
        await signUp(email, password, fullName, userRole)
        alert('Account created! Check your email to verify your account.')
      } else {
        await signIn(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Leaf className="mx-auto h-16 w-16 text-tipai-green-700" />
            <h1 className="mt-6 text-4xl font-bold text-tipai-green-900">
              Tipai Biodiversity
            </h1>
            <p className="mt-2 text-lg text-tipai-green-700">
              Track and protect forest life
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode('naturalist')}
              className="w-full bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-2 border-tipai-green-200 hover:border-tipai-green-400"
            >
              <UserCircle className="mx-auto h-12 w-12 text-tipai-green-700 mb-3" />
              <h2 className="text-xl font-semibold text-tipai-green-900">Naturalist</h2>
              <p className="text-sm text-gray-600 mt-2">
                Full access with admin control
              </p>
            </button>

            <button
              onClick={() => setMode('staff')}
              className="w-full bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-2 border-tipai-green-200 hover:border-tipai-green-400"
            >
              <Users className="mx-auto h-12 w-12 text-tipai-green-700 mb-3" />
              <h2 className="text-xl font-semibold text-tipai-green-900">Staff</h2>
              <p className="text-sm text-gray-600 mt-2">
                Log sightings and view your history
              </p>
            </button>

            <button
              onClick={() => setMode('guest')}
              className="w-full bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-2 border-tipai-green-200 hover:border-tipai-green-400"
            >
              <Mail className="mx-auto h-12 w-12 text-tipai-green-700 mb-3" />
              <h2 className="text-xl font-semibold text-tipai-green-900">Guest</h2>
              <p className="text-sm text-gray-600 mt-2">
                Quick login to log sightings during your visit
              </p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'guest') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <button
            onClick={() => setMode('choice')}
            className="mb-4 text-tipai-green-700 hover:text-tipai-green-900 flex items-center"
          >
            ← Back
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <Mail className="mx-auto h-12 w-12 text-tipai-green-700" />
              <h2 className="mt-4 text-2xl font-bold text-tipai-green-900">Guest Login</h2>
              <p className="mt-2 text-sm text-gray-600">
                Enter your email to start logging sightings
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-tipai-green-700 text-white py-3 rounded-lg font-semibold hover:bg-tipai-green-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Continue as Guest'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => setMode('choice')}
          className="mb-4 text-tipai-green-700 hover:text-tipai-green-900 flex items-center"
        >
          ← Back
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            {mode === 'naturalist' ? (
              <UserCircle className="mx-auto h-12 w-12 text-tipai-green-700" />
            ) : (
              <Users className="mx-auto h-12 w-12 text-tipai-green-700" />
            )}
            <h2 className="mt-4 text-2xl font-bold text-tipai-green-900">
              {mode === 'naturalist' ? 'Naturalist' : 'Staff'} {isSignUp ? 'Sign Up' : 'Login'}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                  placeholder="Your full name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-tipai-green-700 text-white py-3 rounded-lg font-semibold hover:bg-tipai-green-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Login'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-tipai-green-700 hover:text-tipai-green-900"
            >
              {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
