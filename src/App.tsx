import { useState, useEffect } from 'react'

import LoginPage from './components/LoginPage'
import AdminDashboard from './components/AdminDashboard'
import RestaurantDashboard from './components/RestaurantDashboard'
import CustomerMenu from './components/CustomerMenu'
import { Toaster } from 'sonner'
import { User } from './services/types'
import { DataInitializer } from './services/DataInitializer'
import { ThemeProvider } from './components/theme-provider'

function App() {
  // We can keep using useState for local session state (persisting the logged in user in browser)
  // But we should rename the key to avoid confusion with the old DB_KEYS
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('session_user')
    return saved ? JSON.parse(saved) : null
  })
  const [currentTable, setCurrentTable] = useState<string | null>(() => {
    return localStorage.getItem('session_table')
  })

  // Persist session changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('session_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('session_user')
    }
  }, [currentUser])

  useEffect(() => {
    if (currentTable) {
      localStorage.setItem('session_table', currentTable)
    } else {
      localStorage.removeItem('session_table')
    }
  }, [currentTable])

  // Handle URL parameters for table access (QR code scan)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const tableId = urlParams.get('table')

    if (tableId) {
      setCurrentTable(tableId)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleLogin = (user: User) => {
    setCurrentUser(user)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setCurrentTable(null) // Also clear table on logout
    localStorage.removeItem('session_user')
    localStorage.removeItem('session_table')
  }

  const handleTableAccess = (tableId: string) => {
    setCurrentTable(tableId)
    setCurrentUser({ id: 'customer', email: 'customer@example.com', name: 'Customer', role: 'CUSTOMER' })
  }

  if (!currentUser) {
    return (
      <>
        <DataInitializer />
        <LoginPage
          onLogin={handleLogin}
          onTableAccess={handleTableAccess}
          customerMode={!!currentTable}
          presetTableId={currentTable || ''}
        />
        <Toaster position="top-center" />
      </>
    )
  }

  return (
    <>
      <DataInitializer />
      {currentUser.role === 'ADMIN' && (
        <AdminDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {(currentUser.role === 'OWNER' || currentUser.role === 'STAFF') && (
        <RestaurantDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {currentUser.role === 'CUSTOMER' && currentTable && (
        <CustomerMenu tableId={currentTable} onExit={handleLogout} />
      )}
      <Toaster position="top-center" />
    </>
  )
}

export default App