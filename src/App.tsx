import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import AdminDashboard from './components/AdminDashboard'
import RestaurantDashboard from './components/RestaurantDashboard'
import CustomerMenu from './components/CustomerMenu'
import { Toaster } from 'sonner'
import { User, Table } from './services/types'
import { DataInitializer } from './services/DataInitializer'

import ClientTableAccess from './components/ClientTableAccess'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('session_user')
    return saved ? JSON.parse(saved) : null
  })
  const [currentTable, setCurrentTable] = useState<string | null>(() => {
    return localStorage.getItem('session_table')
  })

  // New state for client access route
  const [clientAccessTableId, setClientAccessTableId] = useState<string | null>(null)

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
    const path = window.location.pathname
    // Check for /client/table/:tableId
    const match = path.match(/\/client\/table\/([^/]+)/)

    if (match && match[1]) {
      setClientAccessTableId(match[1])
    } else {
      // Fallback for legacy query param ?table=...
      const urlParams = new URLSearchParams(window.location.search)
      const tableId = urlParams.get('table')
      if (tableId) {
        setClientAccessTableId(tableId)
      }
    }
  }, [])

  const handleLogin = (user: User, table?: Table) => {
    setCurrentUser(user)
    if (table) {
      setCurrentTable(table.id)
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setCurrentTable(null)
    setClientAccessTableId(null) // Reset client access on logout
    localStorage.removeItem('session_user')
    localStorage.removeItem('session_table')
    // Clear URL to avoid re-triggering client access
    window.history.replaceState({}, document.title, '/')
  }

  // If we have a table ID from URL but no user, show Client Access (PIN entry)
  if (clientAccessTableId && !currentUser) {
    return (
      <>
        <DataInitializer />
        <ClientTableAccess
          tableId={clientAccessTableId}
          onAccessGranted={(user) => {
            setCurrentUser(user)
            setCurrentTable(clientAccessTableId)
          }}
        />
        <Toaster position="top-center" />
      </>
    )
  }

  if (!currentUser) {
    return (
      <>
        <DataInitializer />
        <LoginPage onLogin={handleLogin} />
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
      {currentUser.role === 'CUSTOMER' && (
        <CustomerMenu tableId={currentTable || ''} onExit={handleLogout} />
      )}
      <Toaster position="top-center" />
    </>
  )
}

export default App