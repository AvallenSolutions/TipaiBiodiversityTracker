import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SpeciesEditorProvider } from '@/context/SpeciesEditorContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import StaffLoginPage from '@/pages/StaffLoginPage'
import StaffSignUpPage from '@/pages/StaffSignUpPage'
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
        <Route path="/staff/login" element={user ? <Navigate to="/" replace /> : <StaffLoginPage />} />
        <Route path="/staff/signup" element={user ? <Navigate to="/" replace /> : <StaffSignUpPage />} />

        {/* Legacy redirects — old links keep working but never surface
            the role-picker form again. */}
        <Route path="/signup" element={<Navigate to="/staff/signup" replace />} />
        <Route path="/staff" element={<Navigate to="/staff/login" replace />} />

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
