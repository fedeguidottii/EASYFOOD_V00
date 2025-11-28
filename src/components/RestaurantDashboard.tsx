import { useState, useEffect } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import QRCodeGenerator from './QRCodeGenerator'
import {
  Clock,
  Plus,
  Trash,
  PencilSimple,
  Gear,
  MapPin,
  List,
  BookOpen,
  ClockCounterClockwise,
  Check,
  CheckCircle,
  Eye,
  EyeSlash,
  QrCode,
  ForkKnife,
  Receipt,
  ChefHat,
  Calendar,
  ChartBar,
  SignOut,
  WarningCircle,
  X,
  CaretDown,
  CaretUp
} from '@phosphor-icons/react'
import type { User, Table, Dish, Order, Restaurant, Booking, Category, OrderItem, TableSession } from '../services/types'
import TimelineReservations from './TimelineReservations'
import ReservationsManager from './ReservationsManager'
import AnalyticsCharts from './AnalyticsCharts'
import { useRestaurantLogic } from '../hooks/useRestaurantLogic'
import { ModeToggle } from './mode-toggle'

interface RestaurantDashboardProps {
  user: User
  onLogout: () => void
}

const RestaurantDashboard = ({ user, onLogout }: RestaurantDashboardProps) => {
  const [activeSection, setActiveSection] = useState('orders')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState('orders')

  // We need to determine the restaurant ID. 
  // Assuming user.owner_id is the restaurant ID if role is OWNER, or we fetch it.
  // For now, let's assume we fetch restaurants and find the one owned by this user.
  // Or simpler: useSupabaseData filters by user.id if we set up RLS correctly, but here we filter client side.
  const [restaurants] = useSupabaseData<Restaurant>('restaurants', [])
  const currentRestaurant = restaurants?.find(r => r.owner_id === user.id)
  // Ensure restaurantId is a string, default to empty string if not found
  const restaurantId = currentRestaurant?.id ? String(currentRestaurant.id) : ''

  // Only fetch data if we have a valid restaurant ID
  const [tables] = useSupabaseData<Table>('tables', [], { column: 'restaurant_id', value: restaurantId })
  const [dishes, , , setDishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId })
  const [orders] = useSupabaseData<Order>('orders', [], { column: 'restaurant_id', value: restaurantId })
  const [bookings, , refreshBookings] = useSupabaseData<Booking>('bookings', [], { column: 'restaurant_id', value: restaurantId })
  const [categories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId })
  const [sessions] = useSupabaseData<TableSession>('table_sessions', [], { column: 'restaurant_id', value: restaurantId })

  // Helper to get table ID from order
  const getTableIdFromOrder = (order: Order) => {
    const session = sessions?.find(s => s.id === order.table_session_id)
    return session?.table_id
  }

  const [newTableName, setNewTableName] = useState('')
  const [newDish, setNewDish] = useState<{
    name: string
    description: string
    price: string
    categoryId: string
    image: string
    is_ayce: boolean
    allergens?: string[]
    imageFile?: File
  }>({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    image: '',
    is_ayce: false,
    allergens: [],
    imageFile: undefined
  })
  const [newCategory, setNewCategory] = useState('')
  const [draggedCategory, setDraggedCategory] = useState<Category | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showMenuDialog, setShowMenuDialog] = useState(false)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [editTableName, setEditTableName] = useState('')
  const [editingDish, setEditingDish] = useState<Dish | null>(null)
  const [editDishData, setEditDishData] = useState<{
    name: string
    description: string
    price: string
    categoryId: string
    image: string
    is_ayce: boolean
    allergens?: string[]
    imageFile?: File
  }>({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    image: '',
    is_ayce: false,
    allergens: [],
    imageFile: undefined
  })
  const [orderViewMode, setOrderViewMode] = useState<'table' | 'dish'>('table')
  const [showCompletedOrders, setShowCompletedOrders] = useState(false)
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [customerCount, setCustomerCount] = useState('')
  const [selectedOrderHistory, setSelectedOrderHistory] = useState<any | null>(null) // Placeholder type
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [orderSortMode, setOrderSortMode] = useState<'oldest' | 'newest'>('oldest')
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [currentSessionPin, setCurrentSessionPin] = useState<string>('')
  const [allergenInput, setAllergenInput] = useState('')
  const [showTableQrDialog, setShowTableQrDialog] = useState(false)
  const [showTableBillDialog, setShowTableBillDialog] = useState(false)
  const [selectedTableForActions, setSelectedTableForActions] = useState<Table | null>(null)

  // AYCE and Coperto Settings
  const [ayceEnabled, setAyceEnabled] = useState(false)
  const [aycePrice, setAycePrice] = useState(0)
  const [ayceMaxOrders, setAyceMaxOrders] = useState(5)
  const [copertoEnabled, setCopertoEnabled] = useState(false)
  const [copertoPrice, setCopertoPrice] = useState(0)
  const [settingsInitialized, setSettingsInitialized] = useState(false)
  const [ayceDirty, setAyceDirty] = useState(false)
  const [copertoDirty, setCopertoDirty] = useState(false)

  // Reservations Date Filter
  const [reservationsDateFilter, setReservationsDateFilter] = useState<'today' | 'tomorrow' | 'all'>('today')

  const restaurantDishes = dishes || []
  const restaurantTables = tables || []
  const restaurantOrders = orders?.filter(order =>
    order.status !== 'completed' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'PAID'
  ) || []
  const restaurantCompletedOrders = orders?.filter(order => order.status === 'completed' || order.status === 'PAID') || []
  const restaurantBookings = bookings || []
  const restaurantCategories = categories || []

  // Sidebar hover auto-expand
  useEffect(() => {
    const sidebar = document.getElementById('sidebar')
    if (!sidebar) return

    const handleMouseEnter = () => setSidebarExpanded(true)
    const handleMouseLeave = () => setSidebarExpanded(false)

    sidebar.addEventListener('mouseenter', handleMouseEnter)
    sidebar.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      sidebar.removeEventListener('mouseenter', handleMouseEnter)
      sidebar.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Load AYCE and Coperto settings from restaurant
  useEffect(() => {
    if (currentRestaurant) {
      const ayce = currentRestaurant.all_you_can_eat || currentRestaurant.allYouCanEat
      if (ayce) {
        setAyceEnabled(ayce.enabled || false)
        setAycePrice(ayce.pricePerPerson || 0)
        setAyceMaxOrders(ayce.maxOrders || 5)
      }
      const coverCharge = currentRestaurant.cover_charge_per_person ?? currentRestaurant.coverChargePerPerson
      if (coverCharge !== undefined) {
        setCopertoPrice(coverCharge)
        setCopertoEnabled(coverCharge > 0)
      }
      setSettingsInitialized(true)
    }
  }, [currentRestaurant])

  const { updateOrderItemStatus, updateOrderStatus } = useRestaurantLogic(restaurantId)

  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString()

  const generateQrCode = (tableId: string) => {
    // Direct link to menu with table ID using root path to avoid platform auth screens
    return `${window.location.origin}/?table=${tableId}`
  }

  const handleCreateTable = () => {
    if (!newTableName.trim()) {
      toast.error('Inserisci un nome per il tavolo')
      return
    }

    if (!restaurantId) {
      toast.error('Errore: Ristorante non trovato')
      return
    }

    const newTable: Partial<Table> = {
      restaurant_id: restaurantId,
      number: newTableName, // Using 'number' field for name/number
      // capacity: 4 // Default capacity removed as it's not in Table type
    }

    DatabaseService.createTable(newTable)
      .then(() => {
        setNewTableName('')
        toast.success('Tavolo creato con successo')
      })
      .catch(err => toast.error('Errore nella creazione del tavolo'))
  }

  const getOpenSessionForTable = (tableId: string) =>
    sessions?.find(s => s.table_id === tableId && s.status === 'OPEN')

  const handleToggleTable = async (tableId: string) => {
    const openSession = getOpenSessionForTable(tableId)
    if (openSession) {
      try {
        await DatabaseService.markOrdersPaidForSession(openSession.id)
        await DatabaseService.closeSession(openSession.id)
        toast.success('Tavolo liberato')
      } catch (error) {
        console.error('Error freeing table:', error)
        toast.error('Errore durante la liberazione del tavolo')
      }
      return
    }

    const table = tables?.find(t => t.id === tableId)
    if (!table) return

    // Check settings
    const isAyceEnabled = ayceEnabled
    const isCopertoEnabled = copertoEnabled && copertoPrice > 0

    if (!isAyceEnabled && !isCopertoEnabled) {
      // Activate directly with default 1 person
      handleActivateTable(tableId, 1)
    } else {
      // Show dialog for customer count
      setSelectedTable(table)
      setShowTableDialog(true)
    }
  }

  const handleActivateTable = async (tableId: string, customerCount: number) => {
    if (!customerCount || customerCount <= 0) {
      toast.error('Inserisci un numero valido di clienti')
      return
    }

    const tableToUpdate = tables?.find(t => t.id === tableId)
    if (!tableToUpdate) return

    try {
      const session = await DatabaseService.createSession({
        restaurant_id: restaurantId,
        table_id: tableId,
        status: 'OPEN',
        opened_at: new Date().toISOString(),
        session_pin: generatePin()
      })

      toast.success(`Tavolo attivato per ${customerCount} persone`)
      setCustomerCount('')
      setSelectedTable({ ...tableToUpdate })
      setCurrentSessionPin(session.session_pin || '')
      setShowQrDialog(true)
    } catch (err) {
      console.error('Error activating table:', err)
      toast.error('Errore durante l\'attivazione del tavolo')
    }
  }

  const handleDeleteTable = (tableId: string) => {
    DatabaseService.deleteTable(tableId)
      .then(() => toast.success('Tavolo eliminato'))
      .catch((error) => {
        console.error('Error deleting table:', error)
        toast.error('Errore nell\'eliminare il tavolo')
      })
  }

  const saveAyceSettings = async () => {
    if (!restaurantId || !settingsInitialized) return

    if (ayceEnabled) {
      if (!aycePrice || aycePrice <= 0) {
        toast.error('Inserisci un prezzo valido per persona')
        return
      }
      if (!ayceMaxOrders || ayceMaxOrders <= 0) {
        toast.error('Imposta un numero massimo di ordini valido')
        return
      }
    }

    try {
      await DatabaseService.updateRestaurant({
        id: restaurantId,
        allYouCanEat: {
          enabled: ayceEnabled,
          pricePerPerson: ayceEnabled ? aycePrice : 0,
          maxOrders: ayceEnabled ? ayceMaxOrders : 0
        }
      })
      if (ayceDirty) {
        toast.success(ayceEnabled ? 'All You Can Eat attivato' : 'All You Can Eat disattivato')
        setAyceDirty(false)
      }
    } catch (error) {
      toast.error('Errore nel salvare le impostazioni')
    }
  }

  const saveCopertoSettings = async () => {
    if (!restaurantId || !settingsInitialized) return

    if (copertoEnabled && (!copertoPrice || copertoPrice <= 0)) {
      toast.error('Inserisci un importo valido per il coperto')
      return
    }

    try {
      await DatabaseService.updateRestaurant({
        id: restaurantId,
        coverChargePerPerson: copertoEnabled ? copertoPrice : 0
      })
      if (copertoDirty) {
        toast.success(copertoEnabled ? 'Coperto attivato' : 'Coperto disattivato')
        setCopertoDirty(false)
      }
    } catch (error) {
      toast.error('Errore nel salvare le impostazioni')
    }
  }

  // Auto-persist settings when the user changes them
  useEffect(() => {
    if (!settingsInitialized || !ayceDirty) return

    const timeout = setTimeout(() => {
      saveAyceSettings()
    }, 400)

    return () => clearTimeout(timeout)
  }, [ayceEnabled, aycePrice, ayceMaxOrders, settingsInitialized, ayceDirty])

  useEffect(() => {
    if (!settingsInitialized || !copertoDirty) return

    const timeout = setTimeout(() => {
      saveCopertoSettings()
    }, 400)

    return () => clearTimeout(timeout)
  }, [copertoEnabled, copertoPrice, settingsInitialized, copertoDirty])

  const handleEditTable = (table: Table) => {
    setEditingTable(table)
    setEditTableName(table.number)
  }

  const handleSaveTableName = () => {
    if (!editingTable || !editTableName.trim()) {
      toast.error('Inserisci un nome valido')
      return
    }

    const updatedTable = { ...editingTable, number: editTableName.trim() }
    DatabaseService.updateTable(updatedTable.id, updatedTable)
      .then(() => {
        setEditingTable(null)
        setEditTableName('')
        toast.success('Nome tavolo modificato')
      })
  }

  const handleCancelTableEdit = () => {
    setEditingTable(null)
    setEditTableName('')
  }

  const handleCreateDish = async () => {
    if (!newDish.name.trim() || !newDish.price || !newDish.categoryId) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    let imageUrl = newDish.image
    if (newDish.imageFile) {
      try {
        imageUrl = await DatabaseService.uploadImage(newDish.imageFile, 'dishes')
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error('Errore durante il caricamento dell\'immagine')
        return
      }
    }

    const newItem: Partial<Dish> = {
      restaurant_id: restaurantId,
      name: newDish.name,
      description: newDish.description,
      price: parseFloat(newDish.price),
      category_id: newDish.categoryId,
      image_url: imageUrl,
      is_active: true,
      is_ayce: newDish.is_ayce,
      excludeFromAllYouCanEat: !newDish.is_ayce,
      allergens: newDish.allergens || []
    }

    DatabaseService.createDish(newItem)
      .then(() => {
        setNewDish({ name: '', description: '', price: '', categoryId: '', image: '', is_ayce: false, allergens: [] })
        setAllergenInput('')
        setIsAddItemDialogOpen(false)
        toast.success('Piatto aggiunto al menu')
      })
      .catch((error) => {
        console.error('Error creating dish:', error)
        toast.error('Errore durante la creazione del piatto')
      })
  }

  const handleToggleDish = (dishId: string) => {
    const item = dishes?.find(i => i.id === dishId)
    if (item) {
      const previousStatus = item.is_active ?? true
      const updatedItem = { ...item, is_active: !(item.is_active ?? true) }

      setDishes((prev) => prev.map(dish => dish.id === dishId ? updatedItem : dish))

      DatabaseService.updateDish(updatedItem)
        .catch((error) => {
          console.error('Error updating dish:', error)
          toast.error('Errore durante l\'aggiornamento del piatto')
          setDishes((prev) => prev.map(dish => dish.id === dishId ? { ...dish, is_active: previousStatus } : dish))
        })
    }
  }

  const handleDeleteDish = (dishId: string) => {
    DatabaseService.deleteDish(dishId)
      .then(() => toast.success('Piatto eliminato'))
      .catch((error) => {
        console.error('Error deleting dish:', error)
        toast.error('Errore durante l\'eliminazione del piatto')
      })
  }

  const handleEditDish = (item: Dish) => {
    setEditingDish(item)
    setEditDishData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      categoryId: item.category_id,
      image: item.image_url || '',
      is_ayce: item.is_ayce || false,
      allergens: item.allergens || []
    })
    setAllergenInput(item.allergens?.join(', ') || '')
  }

  const handleSaveDish = async () => {
    if (!editingDish || !editDishData.name.trim() || !editDishData.price || !editDishData.categoryId) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    let imageUrl = editDishData.image
    if (editDishData.imageFile) {
      try {
        imageUrl = await DatabaseService.uploadImage(editDishData.imageFile, 'dishes')
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error('Errore durante il caricamento dell\'immagine')
        return
      }
    }

    const updatedItem = {
      ...editingDish,
      name: editDishData.name.trim(),
      description: editDishData.description.trim(),
      price: parseFloat(editDishData.price),
      category_id: editDishData.categoryId,
      image_url: imageUrl,
      is_ayce: editDishData.is_ayce,
      excludeFromAllYouCanEat: !editDishData.is_ayce,
      allergens: editDishData.allergens || []
    }

    DatabaseService.updateDish(updatedItem)
      .then(() => {
        setEditingDish(null)
        setEditDishData({ name: '', description: '', price: '', categoryId: '', image: '', is_ayce: false, allergens: [] })
        setAllergenInput('')
        toast.success('Piatto modificato')
      })
  }

  const handleCancelDishEdit = () => {
    setEditingDish(null)
    setEditDishData({ name: '', description: '', price: '', categoryId: '', image: '', is_ayce: false, allergens: [], imageFile: undefined })
  }

  const handleToggleAllYouCanEatExclusion = (dishId: string) => {
    const item = dishes?.find(i => i.id === dishId)
    if (item) {
      DatabaseService.updateDish({ ...item, excludeFromAllYouCanEat: !item.excludeFromAllYouCanEat })
        .then(() => {
          toast.success(
            !item.excludeFromAllYouCanEat
              ? 'Piatto escluso da All You Can Eat'
              : 'Piatto incluso in All You Can Eat'
          )
        })
    }
  }

  const handleCompleteOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'completed')
    toast.success('Ordine completato')
  }

  const handleCompleteDish = (orderId: string, itemId: string) => {
    // Logic to mark specific item as served/completed
    // In EASYFOOD_V00, OrderItem has status.
    updateOrderItemStatus(orderId, itemId, 'SERVED')
    toast.success('Piatto servito')
  }

  const handleCreateCategory = () => {
    if (!newCategory.trim()) {
      toast.error('Inserisci un nome per la categoria')
      return
    }

    if (categories?.some(cat => cat.name === newCategory)) {
      toast.error('Categoria già esistente')
      return
    }

    const newCategoryObj: Partial<Category> = {
      restaurant_id: restaurantId,
      name: newCategory,
      // order: (restaurantCategories?.length || 0) + 1 // Add order field if supported
    }

    DatabaseService.createCategory(newCategoryObj)
      .then(() => {
        setNewCategory('')
        toast.success('Categoria aggiunta')
      })
  }

  const handleDeleteCategory = (categoryId: string) => {
    DatabaseService.deleteCategory(categoryId)
      .then(() => toast.success('Categoria eliminata'))
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setEditCategoryName(category.name)
  }

  const handleSaveCategory = () => {
    if (!editingCategory || !editCategoryName.trim()) return

    const nameExists = categories?.some(cat =>
      cat.name.toLowerCase() === editCategoryName.trim().toLowerCase() &&
      cat.id !== editingCategory.id
    )

    if (nameExists) {
      toast.error('Esiste già una categoria con questo nome')
      return
    }

    const updatedCategory = { ...editingCategory, name: editCategoryName.trim() }
    DatabaseService.updateCategory(updatedCategory)
      .then(() => {
        setEditingCategory(null)
        setEditCategoryName('')
        toast.success('Categoria modificata')
      })
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditCategoryName('')
  }

  const getTimeAgo = (timestamp: string) => {
    const now = Date.now()
    const time = new Date(timestamp).getTime()
    const diff = now - time
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours >= 1) {
      return `${hours}h ${minutes % 60}min`
    } else if (minutes < 1) {
      return 'Ora'
    }
    return `${minutes}min`
  }

  const getTimeColor = (timestamp: string) => {
    const now = Date.now()
    const time = new Date(timestamp).getTime()
    const diff = now - time
    const minutes = Math.floor(diff / 60000)

    if (minutes < 10) return 'text-green-600 bg-green-50 border-green-200'
    if (minutes < 20) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  // Handle sidebar auto-expand on hover - REMOVED to keep it expanded or manual toggle
  // useEffect(() => {
  //   let timeoutId: NodeJS.Timeout
  //
  //   const handleMouseEnter = () => {
  //     timeoutId = setTimeout(() => {
  //       setSidebarExpanded(true)
  //     }, 500)
  //   }
  //
  //   const handleMouseLeave = () => {
  //     clearTimeout(timeoutId)
  //     setSidebarExpanded(false)
  //   }
  //
  //   const sidebar = document.getElementById('sidebar')
  //   if (sidebar) {
  //     sidebar.addEventListener('mouseenter', handleMouseEnter)
  //     sidebar.addEventListener('mouseleave', handleMouseLeave)
  //
  //     return () => {
  //       sidebar.removeEventListener('mouseenter', handleMouseEnter)
  //       sidebar.removeEventListener('mouseleave', handleMouseLeave)
  //       clearTimeout(timeoutId)
  //     }
  //   }
  // }, [])

  // Auto-switch tabs based on activeSection
  useEffect(() => {
    if (activeSection === 'tables') setActiveTab('tables')
    else if (activeSection === 'menu') setActiveTab('menu')
    else if (activeSection === 'reservations') setActiveTab('reservations')
    else if (activeSection === 'analytics') setActiveTab('analytics')
    else if (activeSection === 'settings') setActiveTab('settings')
    else setActiveTab('orders')
  }, [activeSection])

  if (!restaurantId) {
    return <div className="flex items-center justify-center h-screen">Caricamento ristorante...</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Fixed Sidebar */}
      <div
        id="sidebar"
        className={`${sidebarExpanded ? 'w-64' : 'w-20'
          } glass border-r border-border/20 flex flex-col fixed h-full z-50 transition-all duration-300 ease-in-out bg-card/80 backdrop-blur-md`}
      >
        <div className="p-6 border-b border-border/10 flex items-center justify-center">
          {sidebarExpanded ? (
            <div className="text-center w-full">
              <h1 className="font-bold text-xl text-primary truncate px-2">{currentRestaurant?.name || 'EASYFOOD'}</h1>
              <p className="text-xs text-muted-foreground mt-1">Dashboard</p>
            </div>
          ) : (
            <ChefHat size={24} className="text-primary" weight="duotone" />
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-white/5 ${activeSection === 'orders' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground'
              }`}
            onClick={() => {
              setActiveSection('orders')
              if (sidebarExpanded) setSidebarExpanded(false)
            }}
          >
            <Clock size={24} weight={activeSection === 'orders' ? 'fill' : 'regular'} />
            {sidebarExpanded && <span className="ml-3 font-medium">Ordini</span>}
          </Button>

          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-white/5 ${activeSection === 'tables' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground'
              }`}
            onClick={() => {
              setActiveSection('tables')
              if (sidebarExpanded) setSidebarExpanded(false)
            }}
          >
            <MapPin size={24} weight={activeSection === 'tables' ? 'fill' : 'regular'} />
            {sidebarExpanded && <span className="ml-3 font-medium">Tavoli</span>}
          </Button>

          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-white/5 ${activeSection === 'menu' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground'
              }`}
            onClick={() => {
              setActiveSection('menu')
              if (sidebarExpanded) setSidebarExpanded(false)
            }}
          >
            <BookOpen size={24} weight={activeSection === 'menu' ? 'fill' : 'regular'} />
            {sidebarExpanded && <span className="ml-3 font-medium">Menu</span>}
          </Button>

          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-white/5 ${activeSection === 'reservations' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground'
              }`}
            onClick={() => {
              setActiveSection('reservations')
              if (sidebarExpanded) setSidebarExpanded(false)
            }}
          >
            <Calendar size={24} weight={activeSection === 'reservations' ? 'fill' : 'regular'} />
            {sidebarExpanded && <span className="ml-3 font-medium">Prenotazioni</span>}
          </Button>

          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-white/5 ${activeSection === 'analytics' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground'
              }`}
            onClick={() => {
              setActiveSection('analytics')
              if (sidebarExpanded) setSidebarExpanded(false)
            }}
          >
            <ChartBar size={24} weight={activeSection === 'analytics' ? 'fill' : 'regular'} />
            {sidebarExpanded && <span className="ml-3 font-medium">Analitiche</span>}
          </Button>

          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-white/5 ${activeSection === 'settings' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground'
              }`}
            onClick={() => {
              setActiveSection('settings')
              if (sidebarExpanded) setSidebarExpanded(false)
            }}
          >
            <Gear size={24} weight={activeSection === 'settings' ? 'fill' : 'regular'} />
            {sidebarExpanded && <span className="ml-3 font-medium">Impostazioni</span>}
          </Button>
        </nav>

        <div className="p-4 border-t border-border/10">
          <Button
            variant="ghost"
            onClick={onLogout}
            className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors`}
          >
            <SignOut size={24} />
            {sidebarExpanded && <span className="ml-3 font-medium">Esci</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-6 transition-all duration-300 ${sidebarExpanded ? 'ml-64' : 'ml-16'
        }`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-gold">
                  <Clock size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Gestione Ordini</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Gestisci gli ordini in tempo reale</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-card rounded-lg p-1 shadow-sm border border-border/30">
                  <Button
                    variant={orderViewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrderViewMode('table')}
                    className="h-8 px-3 whitespace-nowrap"
                  >
                    <MapPin size={14} className="mr-1.5" />
                    <span className="text-xs font-medium">Tavoli</span>
                  </Button>
                  <Button
                    variant={orderViewMode === 'dish' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrderViewMode('dish')}
                    className="h-8 px-3 whitespace-nowrap"
                  >
                    <List size={14} className="mr-1.5" />
                    <span className="text-xs font-medium">Piatti</span>
                  </Button>
                </div>
                {orderViewMode === 'dish' && (
                  <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                    <SelectTrigger className="w-[200px] h-8 shadow-sm hover:shadow-md border hover:border-primary/30 transition-all duration-200">
                      <SelectValue placeholder="Tutte le categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} />
                          <span className="text-sm whitespace-nowrap">Tutte le categorie</span>
                        </div>
                      </SelectItem>
                      {restaurantCategories
                        .map(category => (
                          <SelectItem key={category.id} value={category.name}>
                            <span className="text-sm whitespace-nowrap">{category.name}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={orderSortMode} onValueChange={(value: 'oldest' | 'newest') => setOrderSortMode(value)}>
                  <SelectTrigger className="w-[160px] h-8 shadow-sm hover:shadow-md border hover:border-primary/30 transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oldest">
                      <div className="flex items-center gap-2">
                        <ClockCounterClockwise size={14} />
                        <span className="text-sm whitespace-nowrap">Meno recenti</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="newest">
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span className="text-sm whitespace-nowrap">Più recenti</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 shadow-sm">
                  <Clock size={16} className="text-primary" weight="duotone" />
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">{restaurantOrders.length}</div>
                    <div className="text-[10px] text-muted-foreground font-medium leading-none whitespace-nowrap">
                      {restaurantOrders.length === 1 ? 'ordine' : 'ordini'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {restaurantOrders.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} className="text-muted-foreground/40" weight="duotone" />
                </div>
                <p className="text-lg font-semibold text-muted-foreground">Nessun ordine attivo</p>
                <p className="text-xs text-muted-foreground mt-1">Gli ordini appariranno qui non appena arrivano</p>
              </div>
            ) : orderViewMode === 'table' ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {restaurantOrders
                  .sort((a, b) => orderSortMode === 'oldest' ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(order => {
                    const tableId = getTableIdFromOrder(order)
                    const table = restaurantTables.find(t => t.id === tableId)
                    const items = order.items || []
                    const totalDishes = items.reduce((sum, item) => sum + item.quantity, 0)
                    const completedDishes = items.reduce((sum, item) => sum + (item.status === 'SERVED' ? item.quantity : 0), 0)
                    const progressPercent = totalDishes > 0 ? (completedDishes / totalDishes) * 100 : 0

                    return (
                      <div
                        key={order.id}
                        className="group bg-card rounded-xl shadow-md border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                      >
                        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 p-3.5 border-b border-border/10">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-base shadow-md group-hover:scale-105 transition-transform duration-200">
                                {table?.number || '?'}
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-foreground">{table?.number ? `Tavolo ${table.number}` : 'Tavolo'}</h3>
                                <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md border ${getTimeColor(order.created_at)}`}>
                                  <Clock size={12} weight="fill" />
                                  <span>{getTimeAgo(order.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleCompleteOrder(order.id)}
                              className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-8 px-3"
                            >
                              <CheckCircle size={14} className="mr-1.5" weight="fill" />
                              Completa
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                              <span>Avanzamento</span>
                              <span>{Math.round(progressPercent)}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5" />
                          </div>
                        </div>

                        <div className="p-3.5 space-y-3 max-h-[300px] overflow-y-auto">
                          {items.map((item, index) => {
                            const dish = dishes?.find(d => d.id === item.dish_id)
                            return (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50 hover:border-primary/30 transition-all">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-6 h-6 rounded-md flex items-center justify-center p-0 font-bold bg-background border-primary/20 text-primary">
                                    {item.quantity}x
                                  </Badge>
                                  <div>
                                    <span className={`text-sm font-medium ${item.status === 'SERVED' ? 'text-muted-foreground line-through decoration-primary/30' : 'text-foreground'}`}>
                                      {dish?.name || 'Piatto sconosciuto'}
                                    </span>
                                    {item.note && (
                                      <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium mt-0.5 bg-orange-50 px-1.5 py-0.5 rounded w-fit">
                                        <WarningCircle size={10} weight="fill" />
                                        {item.note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {item.status !== 'SERVED' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-green-600 hover:bg-green-50 opacity-0 group-hover/item:opacity-100 transition-all"
                                    onClick={() => handleCompleteDish(order.id, item.id)}
                                  >
                                    <Check size={14} weight="bold" />
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              // Dish View Mode
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Vista per piatti in arrivo...
              </div>
            )}
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-gold">
                  <MapPin size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Gestione Tavoli</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Gestisci la sala e i tavoli</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome tavolo..."
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-48"
                  />
                  <Button onClick={handleCreateTable} className="shadow-gold">
                    <Plus size={16} className="mr-2" />
                    Aggiungi
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {restaurantTables.map(table => {
                const session = getOpenSessionForTable(table.id)
                const isActive = session?.status === 'OPEN'
                const activeOrder = restaurantOrders.find(o => getTableIdFromOrder(o) === table.id)

                return (
                  <Card key={table.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg group ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:border-primary/30'}`}>
                    <CardContent className="p-4 flex flex-col items-center justify-center min-h-[160px] relative z-10">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 ${isActive
                        ? 'bg-muted text-foreground border-2 border-primary shadow-lg scale-110'
                        : 'bg-muted text-foreground group-hover:scale-105'
                        }`}>
                        <span className="text-2xl font-bold">{table.number}</span>
                      </div>

                      <div className="text-center space-y-1">
                        <Badge variant={isActive ? 'default' : 'secondary'} className="mb-2">
                          {isActive ? 'Attivo' : 'Libero'}
                        </Badge>
                        {isActive && (
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {activeOrder ? `${activeOrder.items?.length || 0} piatti` : 'In attesa'}
                            </p>
                            {session?.session_pin && (
                              <Badge variant="outline" className="font-mono text-xs tracking-widest">
                                PIN: {session.session_pin}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTable(table)}>
                          <PencilSimple size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTable(table.id)}>
                          <Trash size={14} />
                        </Button>
                      </div>

                      <div className="mt-4 w-full space-y-2">
                        {isActive ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTableForActions(table)
                                  setShowTableQrDialog(true)
                                }}
                              >
                                <QrCode size={14} className="mr-1" />
                                QR/PIN
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTableForActions(table)
                                  setShowTableBillDialog(true)
                                }}
                              >
                                <Receipt size={14} className="mr-1" />
                                Conto
                              </Button>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() => handleToggleTable(table.id)}
                            >
                              <Check size={14} className="mr-1" />
                              Segna Pagato
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={() => handleToggleTable(table.id)}
                          >
                            Attiva
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-gold">
                  <BookOpen size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Gestione Menu</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Gestisci piatti e categorie</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-gold">
                      <Plus size={16} className="mr-2" />
                      Nuovo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Aggiungi Piatto</DialogTitle>
                      <DialogDescription>
                        Compila i dettagli del piatto e carica un\'immagine facoltativa.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Nome Piatto</Label>
                        <Input
                          value={newDish.name}
                          onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrizione</Label>
                        <Textarea
                          value={newDish.description}
                          onChange={(e) => setNewDish({ ...newDish, description: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Prezzo (€)</Label>
                          <Input
                            type="number"
                            value={newDish.price}
                            onChange={(e) => setNewDish({ ...newDish, price: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select
                            value={newDish.categoryId}
                            onValueChange={(value) => setNewDish({ ...newDish, categoryId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                            <SelectContent>
                              {restaurantCategories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Foto Piatto</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onloadend = () => {
                                setNewDish({ ...newDish, image: reader.result as string, imageFile: file })
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                        />
                        {newDish.image && (
                          <div className="mt-2">
                            <img
                              src={newDish.image}
                              alt="Preview"
                              className="w-full h-32 object-cover rounded-lg border-2 border-border"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Allergeni (separati da virgola)</Label>
                        <Input
                          value={allergenInput}
                          onChange={(e) => {
                            setAllergenInput(e.target.value)
                            setNewDish({ ...newDish, allergens: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })
                          }}
                          placeholder="Glutine, Lattosio, etc."
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-4">
                        <input
                          type="checkbox"
                          id="new_is_ayce"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={newDish.is_ayce}
                          onChange={(e) => setNewDish({ ...newDish, is_ayce: e.target.checked })}
                        />
                        <Label htmlFor="new_is_ayce">Incluso in All You Can Eat</Label>
                      </div>
                      <Button onClick={handleCreateDish} className="w-full">Aggiungi Piatto</Button>
                    </div>
                  </DialogContent>
                </Dialog>


                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <List size={16} className="mr-2" />
                      Categorie
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Gestione Categorie</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nuova categoria..."
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <Button onClick={handleCreateCategory}>Aggiungi</Button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {restaurantCategories.map(cat => (
                          <div key={cat.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                            <span>{cat.name}</span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCategory(cat)}>
                                <PencilSimple size={14} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                                <Trash size={14} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div >
            </div >

            <div className="space-y-8">
              {restaurantCategories.map(category => {
                const categoryDishes = restaurantDishes.filter(d => d.id && d.category_id === category.id)
                if (categoryDishes.length === 0) return null

                return (
                  <div key={category.id} className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <div className="w-1 h-6 bg-primary rounded-full"></div>
                      {category.name}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryDishes.map(dish => (
                        <Card key={dish.id} className={`group hover:shadow-md transition-all ${!dish.is_active ? 'opacity-40' : 'opacity-100'
                          }`}>
                          <CardContent className="p-0">
                            {dish.image_url && (
                              <div className="relative h-48 w-full overflow-hidden">
                                <img
                                  src={dish.image_url}
                                  alt={dish.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-white font-bold">
                                  €{dish.price.toFixed(2)}
                                </div>
                              </div>
                            )}
                            <div className="p-4">
                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-lg">{dish.name}</h4>
                                    {!dish.image_url && <span className="font-bold text-primary text-lg">€{dish.price.toFixed(2)}</span>}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{dish.description}</p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {category.name}
                                  </Badge>
                                  {dish.is_ayce && (
                                    <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">
                                      🍽️ AYCE
                                    </Badge>
                                  )}
                                </div>

                                {dish.allergens && dish.allergens.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {dish.allergens.map((allergen, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs bg-red-100 text-red-700">
                                        ⚠️ {allergen}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/10">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditDish(dish)}
                                  >
                                    <PencilSimple size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${!dish.is_active ? 'text-muted-foreground' : 'text-green-600'}`}
                                    onClick={() => handleToggleDish(dish.id)}
                                  >
                                    {dish.is_active ? <Eye size={14} /> : <EyeSlash size={14} />}
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteDish(dish.id)}
                                >
                                  <Trash size={14} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent >

          {/* Reservations Tab */}
          < TabsContent value="reservations" className="space-y-6 p-6" >
            {/* Date Filter */}
            < div className="flex gap-2 mb-4" >
              <Button
                variant={reservationsDateFilter === 'today' ? 'default' : 'outline'}
                onClick={() => setReservationsDateFilter('today')}
                size="sm"
              >
                <Calendar size={16} className="mr-2" />
                Oggi
              </Button>
              <Button
                variant={reservationsDateFilter === 'tomorrow' ? 'default' : 'outline'}
                onClick={() => setReservationsDateFilter('tomorrow')}
                size="sm"
              >
                <Calendar size={16} className="mr-2" />
                Domani
              </Button>
              <Button
                variant={reservationsDateFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setReservationsDateFilter('all')}
                size="sm"
              >
                Tutte
              </Button>
            </div >
            <ReservationsManager
              user={user}
              restaurantId={restaurantId}
              tables={restaurantTables}
              bookings={bookings || []}
              dateFilter={reservationsDateFilter}
              onRefresh={refreshBookings}
            />
          </TabsContent >

          {/* Analytics Tab */}
          < TabsContent value="analytics" className="space-y-6" >
            <AnalyticsCharts
              orders={restaurantOrders}
              completedOrders={restaurantCompletedOrders}
              dishes={restaurantDishes}
              categories={restaurantCategories}
            />
          </TabsContent >

          {/* Orders Tab */}
          < TabsContent value="orders" className="space-y-6" >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-gold">
                  <Clock size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Ordini Attivi</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{restaurantOrders.length} ordini in cucina</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={orderViewMode} onValueChange={(v: 'table' | 'dish') => setOrderViewMode(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">📍 Per Tavolo</SelectItem>
                    <SelectItem value="dish">🍽️ Per Piatto</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={showCompletedOrders ? "default" : "outline"}
                  onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                >
                  <ClockCounterClockwise size={16} className="mr-2" />
                  Storico
                </Button>
              </div>
            </div>

            {
              !showCompletedOrders ? (
                <div className="space-y-4">
                  {restaurantOrders.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <ChefHat size={48} className="text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">Nessun ordine attivo</p>
                      </CardContent>
                    </Card>
                  ) : (
                    orderViewMode === 'table' ? (
                      // View by Table
                      restaurantOrders.map(order => {
                        const table = restaurantTables.find(t => t.id === getTableIdFromOrder(order))
                        const orderTime = new Date(order.created_at || Date.now())
                        const elapsed = Math.floor((Date.now() - orderTime.getTime()) / 1000 / 60)
                        const isUrgent = elapsed > 20
                        const isCritical = elapsed > 30

                        return (
                          <Card key={order.id} className={`border-l-4 ${isCritical ? 'border-l-red-500 bg-red-50/50' :
                            isUrgent ? 'border-l-orange-500 bg-orange-50/50' :
                              'border-l-green-500'
                            }`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${isCritical ? 'bg-red-500 text-white' :
                                    isUrgent ? 'bg-orange-500 text-white' :
                                      'bg-green-500 text-white'
                                    }`}>
                                    {table?.number || '?'}
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-lg">Tavolo {table?.number || '?'}</h3>
                                    <div className="flex items-center gap-2 text-sm">
                                      <Badge variant={isCritical ? 'destructive' : isUrgent ? 'default' : 'secondary'}>
                                        ⏱️ {elapsed} min
                                      </Badge>
                                      <span className="text-muted-foreground">{order.items?.length || 0} piatti</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                    onClick={() => updateOrderStatus(order.id, 'ready')}
                                  >
                                    <Check size={14} className="mr-1" />
                                    Pronto
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => updateOrderStatus(order.id, 'completed')}
                                  >
                                    <CheckCircle size={14} className="mr-1" />
                                    Completato
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {order.items?.map((item: any) => {
                                  const dish = restaurantDishes.find(d => d.id === item.dish_id)
                                  return (
                                    <div key={item.id} className="flex items-center justify-between p-2 bg-background/50 rounded">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-primary">{item.quantity}x</span>
                                        <span>{dish?.name || 'Unknown'}</span>
                                        {item.note && (
                                          <Badge variant="outline" className="text-xs">
                                            📝 {item.note}
                                          </Badge>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateOrderItemStatus(order.id, item.id, 'SERVED')}
                                      >
                                        ✓
                                      </Button>
                                    </div>
                                  )
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })
                    ) : (
                      // View by Dish
                      (() => {
                        const dishGroups: { [key: string]: { dish: Dish, orders: Array<{ orderId: string, tableNumber: string, quantity: number, elapsed: number, note?: string }> } } = {}

                        restaurantOrders.forEach(order => {
                          const table = restaurantTables.find(t => t.id === getTableIdFromOrder(order))
                          const orderTime = new Date(order.created_at || Date.now())
                          const elapsed = Math.floor((Date.now() - orderTime.getTime()) / 1000 / 60)

                          order.items?.forEach((item: any) => {
                            const dish = restaurantDishes.find(d => d.id === item.dish_id)
                            if (!dish) return

                            if (!dishGroups[dish.id]) {
                              dishGroups[dish.id] = { dish, orders: [] }
                            }

                            dishGroups[dish.id].orders.push({
                              orderId: order.id,
                              tableNumber: table?.number || '?',
                              quantity: item.quantity,
                              elapsed,
                              note: item.note
                            })
                          })
                        })

                        return Object.values(dishGroups).map(({ dish, orders }) => {
                          const totalQty = orders.reduce((sum, o) => sum + o.quantity, 0)
                          const maxElapsed = Math.max(...orders.map(o => o.elapsed))
                          const isUrgent = maxElapsed > 20
                          const isCritical = maxElapsed > 30

                          return (
                            <Card key={dish.id} className={`border-l-4 ${isCritical ? 'border-l-red-500 bg-red-50/50' :
                              isUrgent ? 'border-l-orange-500 bg-orange-50/50' :
                                'border-l-green-500'
                              }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex gap-3 items-start">
                                    {dish.image_url && (
                                      <img
                                        src={dish.image_url}
                                        alt={dish.name}
                                        className="w-16 h-16 rounded-lg object-cover border"
                                      />
                                    )}
                                    <div>
                                      <h3 className="font-bold text-lg">{dish.name}</h3>
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-primary">🍽️ {totalQty}x totali</Badge>
                                        <Badge variant={isCritical ? 'destructive' : isUrgent ? 'default' : 'secondary'}>
                                          ⏱️ max {maxElapsed} min
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Check size={14} className="mr-1" />
                                    Segna tutto pronto
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {orders.map((orderInfo, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-background/50 rounded text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold">Tavolo {orderInfo.tableNumber}:</span>
                                        <span>{orderInfo.quantity}x</span>
                                        <span className="text-muted-foreground">({orderInfo.elapsed} min)</span>
                                        {orderInfo.note && (
                                          <Badge variant="outline" className="text-xs">
                                            📝 {orderInfo.note}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })
                      })()
                    )
                  )}
                </div>
              ) : (
                // Storico Ordini
                <div className="space-y-4">
                  {restaurantCompletedOrders.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <ClockCounterClockwise size={48} className="text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">Nessun ordine completato</p>
                      </CardContent>
                    </Card>
                  ) : (
                    restaurantCompletedOrders.map(order => {
                      const table = restaurantTables.find(t => t.id === getTableIdFromOrder(order))
                      return (
                        <Card key={order.id} className="opacity-60 hover:opacity-100 transition-opacity">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-bold">
                                  {table?.number || '?'}
                                </div>
                                <div>
                                  <h3 className="font-bold">Tavolo {table?.number || '?'}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(order.created_at || Date.now()).toLocaleString('it-IT')}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary">
                                <CheckCircle size={14} className="mr-1" />
                                Completato
                              </Badge>
                            </div>
                            <div className="mt-3 text-sm text-muted-foreground">
                              {order.items?.length || 0} piatti
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              )
            }
          </TabsContent >

          {/* Settings Tab */}
          < TabsContent value="settings" className="space-y-6" >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-gold">
                  <Gear size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Impostazioni</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Configura il tuo ristorante</p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Aspetto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Tema Scuro</Label>
                    <p className="text-sm text-muted-foreground">Attiva o disattiva il tema scuro</p>
                  </div>
                  <ModeToggle />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All You Can Eat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${ayceEnabled ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}>
                      <Check size={18} />
                    </div>
                    <div className="space-y-1">
                      <Label>Abilita Modalità AYCE</Label>
                      <p className="text-sm text-muted-foreground">Attiva il menu fisso per il ristorante</p>
                    </div>
                  </div>
                  <Switch
                    checked={ayceEnabled}
                    onCheckedChange={(checked) => {
                      setAyceEnabled(checked)
                      setAyceDirty(true)
                    }}
                  />
                </div>
                {ayceEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <Label>Prezzo a Persona (€)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={aycePrice}
                        onChange={(e) => {
                          setAycePrice(parseFloat(e.target.value) || 0)
                          setAyceDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Limite round (ordini)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={ayceMaxOrders}
                        onChange={(e) => {
                          setAyceMaxOrders(parseInt(e.target.value) || 0)
                          setAyceDirty(true)
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coperto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${copertoEnabled && copertoPrice > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}>
                      <Check size={18} />
                    </div>
                    <div className="space-y-1">
                      <Label>Abilita Coperto</Label>
                      <p className="text-sm text-muted-foreground">Applica un costo fisso per persona</p>
                    </div>
                  </div>
                  <Switch
                    checked={copertoEnabled}
                    onCheckedChange={(checked) => {
                      setCopertoEnabled(checked)
                      setCopertoDirty(true)
                    }}
                  />
                </div>
                {copertoEnabled && (
                  <div className="space-y-2 pt-4">
                    <Label>Costo Coperto (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.50"
                      value={copertoPrice}
                      onChange={(e) => {
                        setCopertoPrice(parseFloat(e.target.value) || 0)
                        setCopertoDirty(true)
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>


          </TabsContent >
        </Tabs >
      </div >

      {/* Table Activation Dialog */}
      < Dialog open={!!selectedTable && !showQrDialog} onOpenChange={(open) => { if (!open) setSelectedTable(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attiva Tavolo {selectedTable?.number}</DialogTitle>
            <DialogDescription>
              Inserisci il numero di clienti per attivare il tavolo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Numero Clienti</Label>
              <Input
                type="number"
                min="1"
                value={customerCount}
                onChange={(e) => setCustomerCount(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={() => selectedTable && handleActivateTable(selectedTable.id, parseInt(customerCount))}
            >
              Attiva Tavolo
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* QR Code Dialog */}
      < Dialog open={showQrDialog} onOpenChange={(open) => setShowQrDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tavolo Attivato!</DialogTitle>
            <DialogDescription>
              Scansiona il QR code per accedere al menu
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {selectedTable && (
              <QRCodeGenerator
                value={generateQrCode(selectedTable.id)}
                size={200}
              />
            )}
            <div className="text-center">
              <p className="text-sm font-medium">PIN Tavolo</p>
              <p className="text-3xl font-bold tracking-widest font-mono mt-1">
                {currentSessionPin || '----'}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowQrDialog(false)} className="w-full">
            Chiudi
          </Button>
        </DialogContent>
      </Dialog >

      {/* Edit Category Dialog */}
      < Dialog open={!!editingCategory} onOpenChange={(open) => { if (!open) handleCancelEdit() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome Categoria</Label>
              <Input
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveCategory} className="w-full">Salva Modifiche</Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* Edit Dish Dialog */}
      < Dialog open={!!editingDish} onOpenChange={(open) => { if (!open) handleCancelDishEdit() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Piatto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome Piatto</Label>
              <Input
                value={editDishData.name}
                onChange={(e) => setEditDishData({ ...editDishData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={editDishData.description}
                onChange={(e) => setEditDishData({ ...editDishData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prezzo (€)</Label>
                <Input
                  type="number"
                  value={editDishData.price}
                  onChange={(e) => setEditDishData({ ...editDishData, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={editDishData.categoryId}
                  onValueChange={(value) => setEditDishData({ ...editDishData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurantCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Foto Piatto</Label>
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        setEditDishData({ ...editDishData, image: reader.result as string, imageFile: file })
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                {editDishData.image && (
                  <div className="relative group">
                    <img
                      src={editDishData.image}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border-2 border-border"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditDishData({ ...editDishData, image: '', imageFile: undefined })}
                      >
                        Rimuovi
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Allergeni (separati da virgola)</Label>
              <Input
                value={editDishData.allergens?.join(', ') || ''}
                onChange={(e) => setEditDishData({ ...editDishData, allergens: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="Glutine, Lattosio, etc."
              />
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <input
                type="checkbox"
                id="edit_is_ayce"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={editDishData.is_ayce}
                onChange={(e) => setEditDishData({ ...editDishData, is_ayce: e.target.checked })}
              />
              <Label htmlFor="edit_is_ayce">Incluso in All You Can Eat</Label>
            </div>
            <Button onClick={handleSaveDish} className="w-full">Salva Modifiche</Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* Table QR & PIN Dialog */}
      < Dialog open={showTableQrDialog} onOpenChange={(open) => setShowTableQrDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code & PIN - Tavolo {selectedTableForActions?.number}</DialogTitle>
            <DialogDescription>
              Mostra questo QR al cliente oppure comunica il PIN
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {selectedTableForActions && (
              <>
                <QRCodeGenerator
                  value={generateQrCode(selectedTableForActions.id)}
                  size={200}
                />
                <div className="text-center">
                  <p className="text-sm font-medium">PIN Tavolo</p>
                  <p className="text-4xl font-bold tracking-widest font-mono mt-1 text-primary">
                    {(() => {
                      const activeSession = sessions?.find(s => s.table_id === selectedTableForActions.id && s.status === 'OPEN')
                      return activeSession?.session_pin || 'N/A'
                    })()}
                  </p>
                </div>
              </>
            )}
          </div>
          <Button onClick={() => setShowTableQrDialog(false)} className="w-full">
            Chiudi
          </Button>
        </DialogContent>
      </Dialog >

      {/* Table Bill Dialog */}
      < Dialog open={showTableBillDialog} onOpenChange={(open) => setShowTableBillDialog(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conto - Tavolo {selectedTableForActions?.number}</DialogTitle>
            <DialogDescription>
              Riepilogo ordini e totale
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTableForActions && (() => {
              const tableOrders = restaurantOrders.filter(o => getTableIdFromOrder(o) === selectedTableForActions.id)
              const completedOrders = restaurantCompletedOrders.filter(o => getTableIdFromOrder(o) === selectedTableForActions.id)
              const allOrders = [...tableOrders, ...completedOrders]

              let subtotal = 0
              const coverCharge = currentRestaurant?.cover_charge_per_person || 0
              const ayceCharge = currentRestaurant?.all_you_can_eat?.enabled ? (currentRestaurant.all_you_can_eat.pricePerPerson || 0) : 0

              return (
                <>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {allOrders.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">Nessun ordine per questo tavolo</p>
                    ) : (
                      allOrders.map(order => {
                        const orderItems = order.items || []
                        return orderItems.map((item: any) => {
                          const dish = restaurantDishes.find(d => d.id === item.dish_id)
                          if (!dish) return null

                          const itemTotal = dish.is_ayce && currentRestaurant?.all_you_can_eat?.enabled ? 0 : dish.price * item.quantity
                          subtotal += itemTotal

                          return (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.quantity}x {dish?.name}</span>
                              <span>€{itemTotal.toFixed(2)}</span>
                            </div>
                          )
                        })
                      })
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotale:</span>
                      <span>€{subtotal.toFixed(2)}</span>
                    </div>
                    {coverCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Coperto:</span>
                        <span>€{coverCharge.toFixed(2)}</span>
                      </div>
                    )}
                    {ayceCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>All You Can Eat:</span>
                        <span>€{ayceCharge.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Totale:</span>
                      <span>€{(subtotal + coverCharge + ayceCharge).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
          <Button onClick={() => setShowTableBillDialog(false)} className="w-full">
            Chiudi
          </Button>
        </DialogContent>
      </Dialog >

    </div >
  )
}

export default RestaurantDashboard