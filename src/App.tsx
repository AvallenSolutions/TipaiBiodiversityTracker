import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SpeciesEditorProvider } from '@/context/SpeciesEditorContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import SignUpPage from '@/pages/SignUpPage'
import HomePage from '@/pages/HomePage'
import NewSightingPage from '@/pages/NewSightingPage'
import PendingSightingsPage from '@/pages/PendingSightingsPage'
import SightingDetailPage from '@/pages/SightingDetailPage'
import SpeciesLibraryPage from '@/pages/SpeciesLibraryPage'
import DashboardPage from '@/pages/DashboardPage'
import AdminPage from '@/pages/AdminPage'

export default function App() {
  const { user } = useAuth()

  return (
    <SpeciesEditorProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUpPage />} />

        {/* Ledger dashboard — full page, no AppShell chrome */}
        <Route path="dashboard" element={
          <ProtectedRoute roles={['naturalist', 'admin']}>
            <DashboardPage />
          </ProtectedRoute>
        } />

        {/* Protected routes inside AppShell */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="new" element={<NewSightingPage />} />
          <Route path="pending" element={<PendingSightingsPage />} />
          <Route path="sighting/:id" element={<SightingDetailPage />} />
          <Route path="species" element={<SpeciesLibraryPage />} />
          <Route path="admin" element={
            <ProtectedRoute roles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          } />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SpeciesEditorProvider>
  )
}
