import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import AdminDashboard from './components/AdminDashboard'
import RestaurantDashboard from './components/RestaurantDashboard'
import CustomerMenu from './components/CustomerMenu'
import { Toaster } from 'sonner'
import { User, Table } from './services/types'
import { DataInitializer } from './services/DataInitializer'
import WaiterDashboard from './components/waiter/WaiterDashboard'

import ClientTableAccess from './components/ClientTableAccess'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('session_user')
    // No timeout check for customers anymore - session persists until manual logout or table closure
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
      localStorage.removeItem('session_timestamp')
    }
  }, [currentUser])

  useEffect(() => {
    if (currentTable) {
      localStorage.setItem('session_table', currentTable)
    } else {
      localStorage.removeItem('session_table')
    }
  }, [currentTable])

  // Session expiration check removed as requested.
  // Customers stay logged in until manual logout or table session closure.

  // Handle URL parameters for table access (QR code scan)
  useEffect(() => {
    const path = window.location.pathname

    // Check for /waiter/table/:tableId
    const waiterTableMatch = path.match(/\/waiter\/table\/([^/]+)/)
    if (waiterTableMatch && waiterTableMatch[1]) {
      // We are in waiter mode for a specific table
      // We need to ensure the user is logged in as staff/owner
      // If logged in, we set currentTable and maybe a flag for waiter mode
      // But App structure relies on roles.
      // Let's handle this in the render logic or a separate state
    }

    // Check for /client/table/:tableId
    const match = path.match(/\/client\/table\/([^/]+)/)
    let newTableId: string | null = null

    if (match && match[1]) {
      newTableId = match[1]
    } else {
      // Fallback for legacy query param ?table=...
      const urlParams = new URLSearchParams(window.location.search)
      const tableId = urlParams.get('table')
      if (tableId) {
        newTableId = tableId
      }
    }

    if (newTableId) {
      setClientAccessTableId(newTableId)

      // CRITICAL FIX: Prevent order mixing.
      // If the user is already logged in as a CUSTOMER and the table in the URL is different
      // from the current session table, we MUST clear the session WITHOUT calling handleLogout()
      // because handleLogout() changes the URL to '/' which breaks the new table access!
      if (currentUser && currentUser.role === 'CUSTOMER' && currentTable && currentTable !== newTableId) {
        console.log('Detected table switch from', currentTable, 'to', newTableId, '- Resetting session.')
        // Manual logout WITHOUT changing URL - this is critical!
        setCurrentUser(null)
        setCurrentTable(null)
        localStorage.removeItem('session_user')
        localStorage.removeItem('session_table')
        // Do NOT clear clientAccessTableId here, so the PIN screen appears for the new table.
        // Do NOT call handleLogout() because it changes the URL to '/'!
      }
    }
  }, [currentUser, currentTable]) // Added dependencies to check on change too

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

  // PRIORITY: If URL is /client/table/:id, ALWAYS show customer access flow
  // This ensures QR codes work COMPLETELY INDEPENDENTLY from any logged-in session
  // (whether restaurant owner OR customer on another table)
  const path = window.location.pathname
  const clientTableMatch = path.match(/\/client\/table\/([^/]+)/)

  if (clientTableMatch && clientTableMatch[1]) {
    const tableIdFromUrl = clientTableMatch[1]

    // If already logged in as CUSTOMER for THIS EXACT table, show CustomerMenu
    if (currentUser && currentUser.role === 'CUSTOMER' && currentTable === tableIdFromUrl) {
      return (
        <>
          <DataInitializer />
          <CustomerMenu tableId={currentTable} onExit={handleLogout} interfaceMode="customer" />
          <Toaster position="top-center" />
        </>
      )
    }

    // For ANY other case (no user, owner logged in, customer on different table):
    // ALWAYS show PIN entry for customer access to this table
    // This completely disconnects QR codes from restaurant login
    return (
      <>
        <DataInitializer />
        <ClientTableAccess
          tableId={tableIdFromUrl}
          onAccessGranted={(user) => {
            // Clear any existing session first, then set new customer session
            setCurrentUser(user)
            setCurrentTable(tableIdFromUrl)
          }}
        />
        <Toaster position="top-center" />
      </>
    )
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
      {/* Owner sees RestaurantDashboard, Staff sees WaiterDashboard unless on specific route */}
      {currentUser.role === 'OWNER' && !window.location.pathname.startsWith('/waiter') && (
        <RestaurantDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {(currentUser.role === 'STAFF' || (currentUser.role === 'OWNER' && window.location.pathname.startsWith('/waiter'))) && !window.location.pathname.includes('/table/') && (
        <WaiterDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {currentUser.role === 'CUSTOMER' && (
        <CustomerMenu tableId={currentTable || ''} onExit={handleLogout} interfaceMode="customer" />
      )}

      {/* Waiter Mode Routing - Basic Implementation */}
      {/* If user is STAFF/OWNER and URL is /waiter/table/:id, show CustomerMenu in waiter mode */}
      {/* This is a bit hacky without a proper router, but works for now */}
      {(() => {
        const path = window.location.pathname
        const waiterTableMatch = path.match(/\/waiter\/table\/([^/]+)/)
        if ((currentUser.role === 'STAFF' || currentUser.role === 'OWNER') && waiterTableMatch && waiterTableMatch[1]) {
          return (
            <div className="fixed inset-0 z-50 bg-background">
              <CustomerMenu
                tableId={waiterTableMatch[1]}
                onExit={() => window.history.back()}
                interfaceMode="waiter"
              />
            </div>
          )
        }
        // If user is STAFF and not in a specific table, show WaiterDashboard
        // Or if OWNER and explicitly navigating to /waiter (we can add a button in AdminDashboard)
        if (currentUser.role === 'STAFF' || (currentUser.role === 'OWNER' && path.startsWith('/waiter'))) {
          // If we are showing RestaurantDashboard above, we need to hide it or override it.
          // Since we return early in the map above, we can just return WaiterDashboard here if we want to force it.
          // But the logic above:
          // {(currentUser.role === 'OWNER' || currentUser.role === 'STAFF') && (<RestaurantDashboard ... />)}
          // This will render RestaurantDashboard for Staff too. We should change that.
          return null
        }
      })()}

      <Toaster position="top-center" />
    </>
  )
}

export default App