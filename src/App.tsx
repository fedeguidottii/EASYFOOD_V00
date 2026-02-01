import React, { useEffect, useState, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { SessionProvider } from './context/SessionContext'
import { supabase } from './lib/supabase'

// Lazy loaded components for code splitting
const LoginPage = lazy(() => import('./components/LoginPage'))
const RestaurantDashboard = lazy(() => import('./components/RestaurantDashboard'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const WaiterDashboard = lazy(() => import('./components/waiter/WaiterDashboard'))
const WaiterOrderPage = lazy(() => import('./components/waiter/WaiterOrderPage'))
const CustomerMenu = lazy(() => import('./components/CustomerMenu'))
const PublicReservationPage = lazy(() => import('./components/reservations/PublicReservationPage'))

// Loading spinner component
const LoadingSpinner = () => (
  <div className="h-screen flex items-center justify-center bg-zinc-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      <p className="text-zinc-500 text-sm animate-pulse">Caricamento...</p>
    </div>
  </div>
)

// Route Guard for Admin/Staff
const ProtectedRoute = ({ children, user, loading }: { children: React.ReactNode, user: any, loading: boolean }) => {
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-emerald-500">Caricamento...</div>
  if (!user) return <Navigate to="/" replace />

  return React.cloneElement(children as React.ReactElement<any>, { user })
}

const AppContent = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for saved user first
    const savedUser = localStorage.getItem('easyfood_user')
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        setUser(parsedUser)
        setLoading(false)
        return
      } catch (e) {
        localStorage.removeItem('easyfood_user')
      }
    }

    // Fallback to Supabase auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('easyfood_user')
    supabase.auth.signOut()
    setUser(null)
  }

  const getRedirectPath = (user: any) => {
    if (!user) return '/'
    if (user.role === 'ADMIN') return '/admin'
    if (user.role === 'STAFF') return '/waiter'
    return '/dashboard'
  }

  return (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* PUBLIC / ADMIN LOGIN */}
          <Route
            path="/"
            element={
              !user
                ? <LoginPage onLogin={(u) => setUser(u)} />
                : <Navigate to={getRedirectPath(user)} replace />
            }
          />

          {/* ADMIN DASHBOARD (for ADMIN role - manages all restaurants) */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute user={user} loading={loading}>
                <AdminDashboard user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* RESTAURANT DASHBOARD (for OWNER role - single restaurant) */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute user={user} loading={loading}>
                <RestaurantDashboard user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* WAITER DASHBOARD */}
          <Route
            path="/waiter/*"
            element={
              <ProtectedRoute user={user} loading={loading}>
                <WaiterDashboard user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiter/table/:tableId/order"
            element={
              <ProtectedRoute user={user} loading={loading}>
                <WaiterOrderPage />
              </ProtectedRoute>
            }
          />

          {/* CUSTOMER ROUTES */}
          <Route path="/client/table/:tableId" element={<CustomerMenu />} />
          <Route path="/book/:restaurantId" element={<PublicReservationPage />} />

          {/* Fallback for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <Toaster position="top-right" expand={true} richColors />
    </>
  )
}

function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}

export default App