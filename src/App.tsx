import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { SessionProvider } from './context/SessionContext'
import { supabase } from './lib/supabase'

// Components
import LoginPage from './components/LoginPage'
import RestaurantDashboard from './components/RestaurantDashboard'
import WaiterDashboard from './components/waiter/WaiterDashboard'
import CustomerMenu from './components/CustomerMenu'
import PublicReservationPage from './components/reservations/PublicReservationPage'

// Route Guard for Admin/Staff
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      setUser(user)
      setAuthorized(true)
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-emerald-500">Caricamento...</div>
  if (!authorized) return <Navigate to="/" replace />

  return React.cloneElement(children as React.ReactElement<any>, { user })
}

const AppContent = () => {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <Routes>
        {/* PUBLIC / ADMIN LOGIN */}
        <Route path="/" element={!user ? <LoginPage onLogin={() => { }} /> : <Navigate to="/dashboard" replace />} />

        {/* ADMIN DASHBOARD */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <RestaurantDashboard user={user} onLogout={() => supabase.auth.signOut()} />
            </ProtectedRoute>
          }
        />

        {/* WAITER DASHBOARD */}
        <Route
          path="/waiter/*"
          element={
            <ProtectedRoute>
              <WaiterDashboard user={user} onLogout={() => supabase.auth.signOut()} />
            </ProtectedRoute>
          }
        />

        {/* CUSTOMER ROUTES */}
        <Route path="/client/table/:tableId" element={<CustomerMenu />} />
        <Route path="/book/:restaurantId" element={<PublicReservationPage />} />

        {/* Fallback for unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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