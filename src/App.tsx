import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import AdminDashboard from './components/AdminDashboard'
import RestaurantDashboard from './components/RestaurantDashboard'
import CustomerMenu from './components/CustomerMenu'
import { Toaster } from 'sonner'
import { User, Table } from './services/types'
import { DataInitializer } from './services/DataInitializer'

function App() {
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
      // If table ID is present, we might want to auto-login as customer?
      // For now, let's just set the table ID.
      // The user said: "ordinare nel menu bisogna accedere solamente scannerizzando il QR code"
      // So if QR code is scanned, we should probably show the menu directly?
      // But we need a user session.
      // Let's create a temp customer user if table is present.
      const tempUser: User = { id: 'customer-temp', name: 'Cliente', role: 'CUSTOMER', email: 'customer@temp.com' }
      setCurrentUser(tempUser)
      window.history.replaceState({}, document.title, window.location.pathname)
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
    localStorage.removeItem('session_user')
    localStorage.removeItem('session_table')
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