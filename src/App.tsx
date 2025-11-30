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
    const saved = sessionStorage.getItem('session_user')
    return saved ? JSON.parse(saved) : null
  })
  const [currentTable, setCurrentTable] = useState<string | null>(() => {
    return sessionStorage.getItem('session_table')
  })

  // New state for client access route
  const [clientAccessTableId, setClientAccessTableId] = useState<string | null>(null)

  // Persist session changes
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('session_user', JSON.stringify(currentUser))
    } else {
      sessionStorage.removeItem('session_user')
    }
  }, [currentUser])

  useEffect(() => {
    if (currentTable) {
      sessionStorage.setItem('session_table', currentTable)
    } else {
      sessionStorage.removeItem('session_table')
    }
  }, [currentTable])

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
    sessionStorage.removeItem('session_user')
    sessionStorage.removeItem('session_table')
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