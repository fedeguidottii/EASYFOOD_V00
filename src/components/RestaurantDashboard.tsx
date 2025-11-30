import { useState, useEffect } from 'react'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { supabase } from '../lib/supabase'
import { DatabaseService } from '../services/DatabaseService'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Minus,
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
  CaretUp,
  Tag,
  MagnifyingGlass,
  ArrowUp,
  ArrowDown,
} from '@phosphor-icons/react'
import type { User, Table, Dish, Order, Restaurant, Booking, Category, OrderItem, TableSession } from '../services/types'
import TimelineReservations from './TimelineReservations'
import ReservationsManager from './ReservationsManager'
import AnalyticsCharts from './AnalyticsCharts'
import { useRestaurantLogic } from '../hooks/useRestaurantLogic'
import { ModeToggle } from './mode-toggle'
import { KitchenView } from './KitchenView'

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
  const [restaurants, , refreshRestaurants] = useSupabaseData<Restaurant>('restaurants', [])
  const currentRestaurant = restaurants?.find(r => r.owner_id === user.id || r.id === user.restaurant_id)
  // Ensure restaurantId is a string, default to empty string if not found
  const restaurantId = currentRestaurant?.id ? String(currentRestaurant.id) : ''
  const restaurantSlug = currentRestaurant?.name.toLowerCase().replace(/\s+/g, '-') || ''

  // Only fetch data if we have a valid restaurant ID
  const [tables, , , setTables] = useSupabaseData<Table>('tables', [], { column: 'restaurant_id', value: restaurantId })
  const [dishes, , , setDishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId })


  // Custom Orders Fetching with Relations and Realtime
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!restaurantId) return

    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', restaurantId)
        // We fetch all orders to support Analytics and History
        // Filtering for active orders happens in the render logic
        .order('created_at', { ascending: false })

      if (data) setOrders(data as Order[])
    }

    fetchOrders()

    const channel = supabase
      .channel(`dashboard_orders_${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        fetchOrders()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        // We can't filter order_items by restaurant_id directly, but RLS should handle visibility.
        // Re-fetching is safe.
        fetchOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  const [bookings, , refreshBookings] = useSupabaseData<Booking>('bookings', [], { column: 'restaurant_id', value: restaurantId })
  const [categories, , , setCategories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId })
  const [sessions, , refreshSessions] = useSupabaseData<TableSession>('table_sessions', [], { column: 'restaurant_id', value: restaurantId })

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
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false)
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
  const [showCompletedOrders, setShowCompletedOrders] = useState(false)
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [customerCount, setCustomerCount] = useState('')
  const [selectedOrderHistory, setSelectedOrderHistory] = useState<any | null>(null) // Placeholder type
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('')

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [orderSortMode, setOrderSortMode] = useState<'oldest' | 'newest'>('oldest')
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [currentSessionPin, setCurrentSessionPin] = useState<string>('')
  const [allergenInput, setAllergenInput] = useState('')
  const [showTableQrDialog, setShowTableQrDialog] = useState(false)
  const [showTableBillDialog, setShowTableBillDialog] = useState(false)
  const [selectedTableForActions, setSelectedTableForActions] = useState<Table | null>(null)
  const [kitchenViewMode, setKitchenViewMode] = useState<'table' | 'dish'>('table')
  const [kitchenColumns, setKitchenColumns] = useState(3)

  // AYCE and Coperto Settings
  const [ayceEnabled, setAyceEnabled] = useState(false)
  const [aycePrice, setAycePrice] = useState(0)
  const [ayceMaxOrders, setAyceMaxOrders] = useState(5)
  const [copertoEnabled, setCopertoEnabled] = useState(false)
  const [copertoPrice, setCopertoPrice] = useState(0)
  const [settingsInitialized, setSettingsInitialized] = useState(false)
  const [ayceDirty, setAyceDirty] = useState(false)
  const [copertoDirty, setCopertoDirty] = useState(false)

  // Operating Hours State
  const [openingTime, setOpeningTime] = useState('10:00')
  const [closingTime, setClosingTime] = useState('23:00')


  // Waiter Mode Settings
  const [waiterModeEnabled, setWaiterModeEnabled] = useState(false)
  const [allowWaiterPayments, setAllowWaiterPayments] = useState(false)
  const [waiterPassword, setWaiterPassword] = useState('')
  const [waiterCredentialsDirty, setWaiterCredentialsDirty] = useState(false)

  // Reservations Date Filter
  const [selectedReservationDate, setSelectedReservationDate] = useState<Date>(new Date())

  const [tableSearchTerm, setTableSearchTerm] = useState('')

  const restaurantDishes = dishes || []
  const restaurantCategories = (categories || []).sort((a, b) => {
    const orderA = a.order ?? 9999
    const orderB = b.order ?? 9999
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name)
  })
  const restaurantTables = (tables || []).filter(t =>
    t.number.toLowerCase().includes(tableSearchTerm.toLowerCase())
  )
  const restaurantOrders = orders?.filter(order =>
    order.status !== 'completed' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'PAID'
  ) || []
  const restaurantCompletedOrders = orders?.filter(order => order.status === 'completed' || order.status === 'PAID') || []
  const restaurantBookings = bookings || []


  const sortedActiveOrders = [...restaurantOrders].sort((a, b) => {
    if (orderSortMode === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const dishQueue = sortedActiveOrders.flatMap(order => {
    const tableId = getTableIdFromOrder(order)
    const tableNumber = restaurantTables.find(t => t.id === tableId)?.number || 'N/D'
    return (order.items || []).map(item => ({
      orderId: order.id,
      itemId: item.id,
      createdAt: order.created_at,
      tableId: tableId || 'unknown',
      tableNumber,
      dish: restaurantDishes.find(d => d.id === item.dish_id),
      quantity: item.quantity,
      note: item.note,
      status: item.status,
      categoryId: restaurantDishes.find(d => d.id === item.dish_id)?.category_id || ''
    }))
  }).filter(entry => entry.dish)

  type DishTicket = (typeof dishQueue)[number]

  const dishGroups = dishQueue.reduce<Record<string, DishTicket[]>>((acc, entry) => {
    if (!entry.dish) return acc

    // Filter by selected categories (multi-select)
    if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(entry.categoryId)) {
      return acc
    }

    acc[entry.dish.id] = acc[entry.dish.id] || []
    acc[entry.dish.id].push(entry)
    return acc
  }, {})

  const tableGroups = dishQueue.reduce<Record<string, DishTicket[]>>((acc, entry) => {
    if (!entry.dish) return acc

    // Filter by selected categories (multi-select)
    if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(entry.categoryId)) {
      return acc
    }

    const tableKey = entry.tableId
    acc[tableKey] = acc[tableKey] || []
    acc[tableKey].push(entry)
    return acc
  }, {})

  const totalPendingDishes = dishQueue.reduce((sum, entry) => sum + entry.quantity, 0)

  // Dynamic Grid and Font Size Logic based on Zoom Level (1-5)
  // 1 = Smallest (Most columns, smallest text) -> "Zoom Out"
  // 5 = Largest (Fewest columns, largest text) -> "Zoom In"



  // Sidebar hover auto-expand handled via onMouseEnter/onMouseLeave directly on the element
  // to avoid issues with element references and cleanup


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

      // Waiter Mode
      setWaiterModeEnabled(currentRestaurant.waiter_mode_enabled || false)
      setAllowWaiterPayments(currentRestaurant.allow_waiter_payments || false)
      setWaiterPassword(currentRestaurant.waiter_password || '')
    }
  }, [currentRestaurant])

  const { updateOrderItemStatus, updateOrderStatus } = useRestaurantLogic(restaurantId)

  // Refresh sessions when switching to tables tab to ensure PINs are up to date
  useEffect(() => {
    if (activeTab === 'tables') {
      refreshSessions()
    }
  }, [activeTab, refreshSessions])

  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString()

  const generateQrCode = (tableId: string) => {
    // Direct link to menu with table ID using the new client route
    return `${window.location.origin}/client/table/${tableId}`
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
      .then((created) => {
        setTables?.((prev = []) => [...prev, created as Table])
        setNewTableName('')
        setShowCreateTableDialog(false)
        toast.success('Tavolo creato con successo')
      })
      .catch(err => {
        console.error('Create table error', err)
        toast.error('Errore nella creazione del tavolo')
      })
  }

  const getOpenSessionForTable = (tableId: string) =>
    sessions?.find(s => s.table_id === tableId && s.status === 'OPEN')

  const handleCloseTable = async (tableId: string, markPaid: boolean) => {
    const openSession = getOpenSessionForTable(tableId)
    if (openSession) {
      try {
        // Close session in DB
        await DatabaseService.closeSession(openSession.id)
        if (markPaid) {
          await DatabaseService.markOrdersPaidForSession(openSession.id)
        }

        toast.success(markPaid ? 'Tavolo pagato e liberato' : 'Tavolo svuotato e liberato')
        refreshSessions() // Update sessions list immediately
        setSelectedTable(null)
        setSelectedTableForActions(null)
        setShowTableDialog(false)
        setShowQrDialog(false)
        setShowTableBillDialog(false)
      } catch (error) {
        console.error('Error freeing table:', error)
        toast.error('Errore durante la chiusura del tavolo')
      }
    }
  }

  const handleToggleTable = async (tableId: string) => {
    const openSession = getOpenSessionForTable(tableId)
    if (openSession) {
      // If session is open, we default to closing and marking paid (legacy behavior if called directly)
      // But now we primarily use the dialog.
      handleCloseTable(tableId, true)
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
        session_pin: generatePin(),
        customer_count: customerCount
      })

      if (ayceEnabled) {
        toast.success(`Tavolo attivato per ${customerCount} persone`)
      } else {
        toast.success('Tavolo attivato')
      }
      setCustomerCount('')
      setSelectedTable({ ...tableToUpdate })
      setCurrentSessionPin(session.session_pin || '')
      refreshSessions() // Ensure sessions are updated
      setShowTableDialog(false)
      // QR code is fixed on the table: keep the modal closed by default
      setShowQrDialog(false)
    } catch (err) {
      console.error('Error activating table:', err)
      toast.error('Errore durante l\'attivazione del tavolo')
    }
  }

  const handleShowTableQr = async (table: Table) => {
    setSelectedTableForActions(table)
    setShowTableQrDialog(true)
    setCurrentSessionPin('Caricamento...') // Show loading state

    try {
      const session = await DatabaseService.getActiveSession(table.id)
      if (session && session.session_pin) {
        setCurrentSessionPin(session.session_pin)
      } else {
        setCurrentSessionPin('N/A')
        // Try to refresh global sessions as fallback/side-effect
        refreshSessions()
      }
    } catch (error) {
      console.error('Error fetching session for PIN:', error)
      setCurrentSessionPin('Errore')
    }
  }



  const handleDeleteTable = (tableId: string) => {
    // Optimistic update
    // We can't easily setTables because it comes from useSupabaseData hook which might not expose setter for this specific call or it's complex.
    // However, looking at line 75: const [dishes, , , setDishes] = useSupabaseData...
    // We should update the hook usage for tables to get setTables.
    // But for now, let's assume we can't change the hook easily without seeing it.
    // Wait, I can change the hook usage in line 74.
    // Let's do that in a separate edit or assume I can force a re-fetch.
    // Actually, the user asked for "Optimistic UI Update".
    // I need to change line 74 to: const [tables, , , setTables] = useSupabaseData...
    // Then I can use setTables here.

    // For this chunk, I will implement the logic assuming setTables is available.
    // I will update line 74 in another chunk.
    setTables(prev => prev.filter(t => t.id !== tableId))

    DatabaseService.deleteTable(tableId)
      .then(() => toast.success('Tavolo eliminato'))
      .catch((error) => {
        console.error('Error deleting table:', error)
        toast.error('Errore nell\'eliminare il tavolo')
        // Revert if failed (optional but good practice)
        // refreshTables() // If we had it
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

    // Optimistic update
    setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t))
    setEditingTable(null)
    setEditTableName('')

    DatabaseService.updateTable(updatedTable.id, updatedTable)
      .then(() => {
        toast.success('Nome tavolo modificato')
      })
      .catch(err => {
        toast.error('Errore modifica tavolo')
        // Revert?
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
    // Optimistic update
    setDishes(prev => prev.filter(d => d.id !== dishId))

    DatabaseService.deleteDish(dishId)
      .then(() => toast.success('Piatto eliminato'))
      .catch((error) => {
        console.error('Error deleting dish:', error)
        toast.error('Errore durante l\'eliminazione del piatto')
        // Revert if needed, but for deletion usually fine to just show error
        // To be safe we could re-fetch or revert state
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
        setDishes?.((prev = []) =>
          prev.map(d => d.id === updatedItem.id ? { ...d, ...updatedItem } : d)
        )
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

  const handleCompleteOrder = async (orderId: string) => {
    const targetOrder = orders?.find(o => o.id === orderId)

    if (targetOrder?.items?.length) {
      await Promise.all(
        targetOrder.items.map(item => updateOrderItemStatus(orderId, item.id, 'SERVED'))
      )
    }

    await updateOrderStatus(orderId, 'completed')
    toast.success('Ordine completato e spostato nello storico')
  }

  const handleCompleteDish = async (orderId: string, itemId: string, showToast = true) => {
    await updateOrderItemStatus(orderId, itemId, 'SERVED')

    const targetOrder = orders?.find(o => o.id === orderId)
    if (targetOrder?.items) {
      const updatedItems = targetOrder.items.map(item =>
        item.id === itemId ? { ...item, status: 'SERVED' } : item
      )
      const allServed = updatedItems.every(item => item.status === 'SERVED')
      if (allServed) {
        await updateOrderStatus(orderId, 'completed')
      }
    }

    if (showToast) {
      toast.success('Piatto segnato come pronto')
    }
  }

  const handleCompleteDishGroup = async (tickets: DishTicket[]) => {
    await Promise.all(
      tickets.map(ticket => handleCompleteDish(ticket.orderId, ticket.itemId, false))
    )
    toast.success('Piatti segnati come pronti')
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

    const nextOrder = restaurantCategories.length

    const newCategoryObj: Partial<Category> = {
      restaurant_id: restaurantId,
      name: newCategory,
      order: nextOrder
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      if (isEdit) {
        setEditDishData(prev => ({ ...prev, image: previewUrl, imageFile: file }))
      } else {
        setNewDish(prev => ({ ...prev, image: previewUrl, imageFile: file }))
      }
    }
  }

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    if (!restaurantCategories) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= restaurantCategories.length) return

    const reordered = [...restaurantCategories]
    const [movedCategory] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, movedCategory)

    const orderedCategories = reordered.map((cat, idx) => ({ ...cat, order: idx }))
    setCategories?.(orderedCategories)

    try {
      await Promise.all(
        orderedCategories.map(cat => DatabaseService.updateCategory({ id: cat.id, order: cat.order }))
      )
      toast.success('Ordine aggiornato')
    } catch (e) {
      toast.error('Errore nel riordinare')
      setCategories?.(restaurantCategories)
    }
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
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`${sidebarExpanded ? 'w-64' : 'w-20'
          } glass border-r border-border/20 flex flex-col fixed h-full z-50 transition-all duration-300 ease-in-out bg-card/80 backdrop-blur-md shadow-2xl`}
      >
        <div className="p-6 border-b border-border/10 flex items-center justify-center">
          {sidebarExpanded ? (
            <div className="text-center w-full">
              <h1 className="font-bold text-xl text-primary truncate px-2">{currentRestaurant?.name || 'EASYFOOD'}</h1>
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-gold">
                  <Clock size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Gestione Ordini</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Gestisci gli ordini in tempo reale</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-muted p-1 rounded-lg mr-2">
                  <Button
                    variant={kitchenViewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setKitchenViewMode('table')}
                    className="h-7 text-xs font-bold"
                  >
                    Tavoli
                  </Button>
                  <Button
                    variant={kitchenViewMode === 'dish' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setKitchenViewMode('dish')}
                    className="h-7 text-xs font-bold"
                  >
                    Piatti
                  </Button>
                </div>

                <div className="flex items-center gap-2 bg-muted p-1 rounded-lg mr-2">
                  <Button variant="ghost" size="sm" onClick={() => setKitchenColumns(prev => Math.max(1, prev - 1))} className="h-7 w-7 p-0">
                    <Minus size={14} />
                  </Button>
                  <span className="w-4 text-center text-xs font-bold">{kitchenColumns}</span>
                  <Button variant="ghost" size="sm" onClick={() => setKitchenColumns(prev => prev + 1)} className="h-7 w-7 p-0">
                    <Plus size={14} />
                  </Button>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 border-dashed">
                      <Plus size={14} className="mr-1" />
                      Categorie ({selectedCategoryIds.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Filtra per Categoria</DialogTitle>
                      <DialogDescription>Seleziona le categorie da visualizzare in cucina.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4 max-h-[60vh] overflow-y-auto">
                      <div className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-lg cursor-pointer" onClick={() => setSelectedCategoryIds([])}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedCategoryIds.length === 0 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                          {selectedCategoryIds.length === 0 && <Check size={10} />}
                        </div>
                        <span className="text-sm font-medium">Tutte le categorie</span>
                      </div>
                      {restaurantCategories.map((category) => {
                        const isSelected = selectedCategoryIds.includes(category.id)
                        return (
                          <div
                            key={category.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-lg cursor-pointer"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedCategoryIds(prev => prev.filter(id => id !== category.id))
                              } else {
                                setSelectedCategoryIds(prev => [...prev, category.id])
                              }
                            }}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                              {isSelected && <Check size={10} />}
                            </div>
                            <span className="text-sm">{category.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </DialogContent>
                </Dialog>


                <Select value={orderSortMode} onValueChange={(value: 'oldest' | 'newest') => setOrderSortMode(value)}>
                  <SelectTrigger className="w-[140px] h-9 shadow-sm hover:shadow-md border hover:border-primary/30 transition-all duration-200">
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



                <Button
                  variant={showOrderHistory ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOrderHistory(!showOrderHistory)}
                  className="ml-2"
                >
                  <ClockCounterClockwise size={16} className="mr-2" />
                  Storico
                </Button>
              </div>
            </div>

            {showOrderHistory ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Storico Ordini Completati</h3>
                {restaurantCompletedOrders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Nessun ordine completato
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {restaurantCompletedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(order => (
                      <Card key={order.id} className="bg-muted/20">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-base">Ordine #{order.id.slice(0, 8)}</CardTitle>
                            <Badge variant="outline">{new Date(order.created_at).toLocaleString()}</Badge>
                          </div>
                          <CardDescription>Tavolo {restaurantTables.find(t => t.id === getTableIdFromOrder(order))?.number || 'N/D'}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <div className="space-y-2">
                            {order.items?.map(item => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.quantity}x {restaurantDishes.find(d => d.id === item.dish_id)?.name}</span>
                                <Badge variant="secondary" className="text-xs">Completato</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : sortedActiveOrders.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} className="text-muted-foreground/40" weight="duotone" />
                </div>
                <p className="text-lg font-semibold text-muted-foreground">Nessun ordine attivo</p>
                <p className="text-xs text-muted-foreground mt-1">Gli ordini appariranno qui non appena arrivano</p>
              </div>
            ) : (
              <KitchenView
                orders={orders}
                tables={tables || []}
                dishes={dishes || []}
                selectedCategoryIds={selectedCategoryIds}
                viewMode={kitchenViewMode}
                columns={kitchenColumns}
                onCompleteDish={(orderId, itemId) => handleCompleteDish(orderId, itemId)}
                onCompleteOrder={handleCompleteOrder}
              />
            )}
          </TabsContent >

          {/* Tables Tab */}
          < TabsContent value="tables" className="space-y-6" >
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
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="Cerca tavolo..."
                    value={tableSearchTerm}
                    onChange={(e) => setTableSearchTerm(e.target.value)}
                    className="pl-8 h-9 w-[150px] lg:w-[200px]"
                  />
                </div>
                <Button onClick={() => setShowCreateTableDialog(true)} size="sm">
                  <Plus size={16} className="mr-2" />
                  Nuovo Tavolo
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ClockCounterClockwise size={16} className="mr-2" />
                      Storico Tavoli
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Storico Tavoli Chiusi</DialogTitle>
                      <DialogDescription>Visualizza le sessioni dei tavoli concluse.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      {sessions?.filter(s => s.status === 'CLOSED').sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime()).map(session => {
                        const sessionOrders = restaurantCompletedOrders.filter(o => o.table_session_id === session.id)
                        const totalSessionAmount = sessionOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

                        return (
                          <div key={session.id} className="border rounded-lg p-4 bg-muted/20 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-lg">Tavolo {restaurantTables.find(t => t.id === session.table_id)?.number || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Aperto: {new Date(session.opened_at || session.created_at).toLocaleString()} <br />
                                  Chiuso: {new Date(session.closed_at!).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant="secondary" className="mb-1">Chiuso</Badge>
                                <p className="font-bold text-primary">€{totalSessionAmount.toFixed(2)}</p>
                              </div>
                            </div>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                  <List size={14} className="mr-2" />
                                  Vedi Dettagli Ordine
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Dettaglio Sessione Tavolo {restaurantTables.find(t => t.id === session.table_id)?.number}</DialogTitle>
                                  <DialogDescription>
                                    Lista degli ordini effettuati durante questa sessione.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                  {sessionOrders.length === 0 ? (
                                    <p className="text-center text-muted-foreground">Nessun ordine registrato.</p>
                                  ) : (
                                    sessionOrders.map(order => (
                                      <div key={order.id} className="border rounded p-3">
                                        <div className="flex justify-between text-sm font-semibold mb-2">
                                          <span>Ordine #{order.id.slice(0, 8)}</span>
                                          <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="space-y-1">
                                          {order.items?.map(item => (
                                            <div key={item.id} className="flex justify-between text-xs">
                                              <span>{item.quantity}x {restaurantDishes.find(d => d.id === item.dish_id)?.name}</span>
                                              <span>€{(restaurantDishes.find(d => d.id === item.dish_id)?.price || 0) * item.quantity}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )
                      })}
                      {(!sessions || sessions.filter(s => s.status === 'CLOSED').length === 0) && (
                        <p className="text-center text-muted-foreground py-8">Nessuna sessione chiusa trovata.</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {restaurantTables.map(table => {
                const session = getOpenSessionForTable(table.id)
                const isActive = session?.status === 'OPEN'
                const activeOrder = restaurantOrders.find(o => getTableIdFromOrder(o) === table.id)

                return (
                  <Card key={table.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg border-border/40 hover:border-primary/30 group ${isActive ? 'ring-1 ring-primary/20' : ''}`}>
                    <CardContent className="p-0 flex flex-col h-full">
                      {/* Header */}
                      <div className={`p-4 flex items-center justify-between border-b border-border/10 ${isActive ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                        <span className="text-xl font-bold text-foreground">
                          {table.number}
                        </span>
                        <Badge variant={isActive ? 'default' : 'secondary'} className={`${isActive ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                          {isActive ? 'Occupato' : 'Libero'}
                        </Badge>
                      </div>

                      {/* Body */}
                      <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
                        {isActive ? (
                          <>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-1">PIN Tavolo</p>
                              <span className="text-3xl font-mono font-bold tracking-widest text-primary">
                                {session?.session_pin || '...'}
                              </span>
                            </div>
                            {activeOrder && (
                              <Badge variant="outline" className="bg-background">
                                {activeOrder.items?.filter(i => i.status === 'SERVED').length || 0} ordini completati
                              </Badge>
                            )}
                          </>
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <MapPin size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Pronto per clienti</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="p-4 bg-muted/10 border-t border-border/10 grid gap-2">
                        {isActive ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleShowTableQr(table)}>
                                <QrCode size={16} className="mr-2" />
                                QR
                              </Button>
                              <Button
                                className="shadow-sm hover:shadow-md transition-all"
                                onClick={() => { setSelectedTableForActions(table); setShowTableBillDialog(true); }}
                              >
                                <Receipt size={16} className="mr-2" />
                                Conto
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Button
                            className="w-full bg-primary hover:bg-primary/90 shadow-sm hover:shadow-md transition-all"
                            onClick={() => handleToggleTable(table.id)}
                          >
                            Attiva Tavolo
                          </Button>
                        )}
                      </div>

                      {/* Management Actions (Hover) */}
                      <div className="absolute top-2 right-12 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background/80" onClick={() => handleEditTable(table)}>
                          <PencilSimple size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTable(table.id)}>
                          <Trash size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent >

          {/* Menu Tab */}
          < TabsContent value="menu" className="space-y-6" >
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
                        Compila i dettagli del piatto e carica un'immagine facoltativa.
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
                          onChange={(e) => handleImageChange(e)}
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
                      <DialogDescription>
                        Aggiungi, modifica o elimina le categorie del menu.
                      </DialogDescription>
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
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {restaurantCategories.map((cat, index) => (
                          <div
                            key={cat.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', index.toString())
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragOver={(e) => {
                              e.preventDefault() // Necessary to allow dropping
                              e.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={async (e) => {
                              e.preventDefault()
                              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                              const toIndex = index
                              if (fromIndex === toIndex) return

                              const newCategories = [...restaurantCategories]
                              const [movedItem] = newCategories.splice(fromIndex, 1)
                              newCategories.splice(toIndex, 0, movedItem)

                              // Optimistic update
                              const optimisticCategories = newCategories.map((c, i) => ({ ...c, order: i }))
                              setCategories(optimisticCategories)

                              try {
                                // Update order for all items
                                const updates = optimisticCategories.map(c => DatabaseService.updateCategory(c))
                                await Promise.all(updates)
                                toast.success('Ordine aggiornato')
                              } catch (error) {
                                console.error('Error reordering:', error)
                                toast.error('Errore nel riordinare')
                                // Revert on error (optional, but good practice)
                                // setCategories(restaurantCategories) 
                              }
                            }}
                            className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all group cursor-move active:cursor-grabbing"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <List size={16} weight="duotone" />
                              </div>
                              <span className="font-medium">{cat.name}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Removed Up/Down buttons, added Edit/Delete */}
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground hover:text-primary bg-background border border-border/50 shadow-sm"
                                onClick={() => handleEditCategory(cat)}
                              >
                                <PencilSimple size={20} />
                              </Button>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-10 w-10 text-destructive hover:bg-destructive/10 bg-background border border-border/50 shadow-sm"
                                onClick={() => handleDeleteCategory(cat.id)}
                              >
                                <Trash size={20} />
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
                    <div className="flex items-center gap-3 pb-2 border-b border-border/10">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary">
                        <Tag size={20} weight="duotone" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{category.name}</h3>
                    </div>
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
                                    variant="secondary"
                                    size="icon"
                                    className="h-10 w-10 bg-muted/50 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => handleEditDish(dish)}
                                  >
                                    <PencilSimple size={20} />
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className={`h-10 w-10 bg-muted/50 ${!dish.is_active ? 'text-muted-foreground' : 'text-green-600 hover:bg-green-50'}`}
                                    onClick={() => handleToggleDish(dish.id)}
                                  >
                                    {dish.is_active ? <Eye size={20} /> : <EyeSlash size={20} />}
                                  </Button>
                                </div>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-10 w-10 text-destructive bg-muted/50 hover:bg-destructive/10"
                                  onClick={() => handleDeleteDish(dish.id)}
                                >
                                  <Trash size={20} />
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
            {/* Date Filter */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <Button
                variant={selectedReservationDate.toDateString() === new Date().toDateString() ? 'default' : 'outline'}
                onClick={() => setSelectedReservationDate(new Date())}
                size="sm"
              >
                <Calendar size={16} className="mr-2" />
                Oggi ({new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})
              </Button>
              <Button
                variant={selectedReservationDate.toDateString() === new Date(new Date().setDate(new Date().getDate() + 1)).toDateString() ? 'default' : 'outline'}
                onClick={() => {
                  const d = new Date()
                  d.setDate(d.getDate() + 1)
                  setSelectedReservationDate(d)
                }}
                size="sm"
              >
                <Calendar size={16} className="mr-2" />
                Domani ({new Date(new Date().setDate(new Date().getDate() + 1)).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})
              </Button>
              <Button
                variant={selectedReservationDate.toDateString() === new Date(new Date().setDate(new Date().getDate() + 2)).toDateString() ? 'default' : 'outline'}
                onClick={() => {
                  const d = new Date()
                  d.setDate(d.getDate() + 2)
                  setSelectedReservationDate(d)
                }}
                size="sm"
              >
                <Calendar size={16} className="mr-2" />
                {new Date(new Date().setDate(new Date().getDate() + 2)).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Button>

              <div className="flex items-center gap-2 ml-2">
                <Label htmlFor="custom-date" className="whitespace-nowrap text-sm">Data:</Label>
                <Input
                  id="custom-date"
                  type="date"
                  className="w-auto h-9"
                  value={selectedReservationDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedReservationDate(new Date(e.target.value))
                    }
                  }}
                />
              </div>
            </div>
            <ReservationsManager
              user={user}
              restaurantId={restaurantId}
              tables={restaurantTables}
              bookings={bookings || []}
              selectedDate={selectedReservationDate}
              openingTime={openingTime}
              closingTime={closingTime}
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
                <CardTitle>Sala & Servizio</CardTitle>
                <CardDescription>
                  Gestisci le impostazioni per il personale di sala e la modalità cameriere.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="waiter-mode">Abilita Modalità Cameriere</Label>
                    <p className="text-sm text-muted-foreground">Permette allo staff di prendere ordini da tablet/telefono dedicato.</p>
                  </div>
                  <Switch
                    id="waiter-mode"
                    checked={waiterModeEnabled}
                    onCheckedChange={async (checked) => {
                      setWaiterModeEnabled(checked)
                      if (restaurantId) {
                        try {
                          await DatabaseService.updateRestaurant({ id: restaurantId, waiter_mode_enabled: checked })
                          toast.success('Impostazioni salvate')
                          refreshRestaurants()
                        } catch (error) {
                          console.error('Error updating waiter mode:', error)
                          toast.error('Errore durante il salvataggio')
                          setWaiterModeEnabled(!checked) // Revert on error
                        }
                      }
                    }}
                  />
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Username Cameriere</Label>
                    <div className="p-2 bg-muted rounded-md border text-sm font-mono">
                      {restaurantSlug}_cameriere
                    </div>
                    <p className="text-xs text-muted-foreground">Usa questo username per accedere come cameriere.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waiter-password">Password Cameriere</Label>
                    <div className="flex gap-2">
                      <Input
                        id="waiter-password"
                        type="text"
                        value={waiterPassword}
                        onChange={(e) => {
                          setWaiterPassword(e.target.value)
                          setWaiterCredentialsDirty(true)
                        }}
                        placeholder="Imposta password..."
                      />
                      {waiterCredentialsDirty && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (restaurantId) {
                              try {
                                await DatabaseService.updateRestaurant({ id: restaurantId, waiter_password: waiterPassword })
                                toast.success('Password salvata')
                                setWaiterCredentialsDirty(false)
                                refreshRestaurants()
                              } catch (error) {
                                console.error('Error saving password:', error)
                                toast.error('Errore nel salvataggio')
                              }
                            }
                          }}
                        >
                          Salva
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Password per l'accesso staff.</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="waiter-payments">Consenti Incasso ai Camerieri</Label>
                    <p className="text-sm text-muted-foreground">Abilita il tasto 'Segna come Pagato' sull'interfaccia camerieri.</p>
                  </div>
                  <Switch
                    id="waiter-payments"
                    checked={allowWaiterPayments}
                    disabled={!waiterModeEnabled}
                    onCheckedChange={async (checked) => {
                      setAllowWaiterPayments(checked)
                      if (restaurantId) {
                        try {
                          await DatabaseService.updateRestaurant({ id: restaurantId, allow_waiter_payments: checked })
                          toast.success('Impostazioni salvate')
                          refreshRestaurants()
                        } catch (error) {
                          console.error('Error updating waiter payments:', error)
                          toast.error('Errore durante il salvataggio')
                          setAllowWaiterPayments(!checked) // Revert on error
                        }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/10 shadow-sm">
                <CardHeader>
                  <CardTitle>Impostazioni All You Can Eat</CardTitle>
                  <CardDescription>
                    Configura le opzioni per la modalità All You Can Eat. Le modifiche vengono salvate automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ayce-enabled">Abilita All You Can Eat</Label>
                    <Switch
                      id="ayce-enabled"
                      checked={ayceEnabled}
                      onCheckedChange={(checked) => {
                        setAyceEnabled(checked)
                        setAyceDirty(true)
                      }}
                    />
                  </div>
                  {ayceEnabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="ayce-price">Prezzo a persona (€)</Label>
                        <Input
                          id="ayce-price"
                          type="number"
                          value={aycePrice}
                          onChange={(e) => {
                            setAycePrice(parseFloat(e.target.value) || 0)
                            setAyceDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ayce-max-orders">Max Ordini per persona</Label>
                        <Input
                          id="ayce-max-orders"
                          type="number"
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

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/10 shadow-sm">
                  <CardHeader>
                    <CardTitle>Impostazioni Coperto</CardTitle>
                    <CardDescription>Gestisci il costo del coperto</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Abilita Coperto</Label>
                        <p className="text-sm text-muted-foreground">
                          Aggiungi automaticamente il coperto al conto
                        </p>
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
                      <div className="space-y-2">
                        <Label htmlFor="coperto-price">Costo Coperto (€)</Label>
                        <Input
                          id="coperto-price"
                          type="number"
                          value={copertoPrice}
                          onChange={(e) => {
                            setCopertoPrice(parseFloat(e.target.value) || 0)
                            setCopertoDirty(true)
                          }}
                        />
                      </div>
                    )}
                    {copertoDirty && (
                      <Button onClick={saveCopertoSettings} className="w-full">
                        Salva Impostazioni Coperto
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/10 shadow-sm">
                  <CardHeader>
                    <CardTitle>Orari di Apertura</CardTitle>
                    <CardDescription>Imposta gli orari per le prenotazioni</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="opening-time">Apertura</Label>
                        <Input
                          id="opening-time"
                          type="time"
                          value={openingTime}
                          onChange={(e) => setOpeningTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="closing-time">Chiusura</Label>
                        <Input
                          id="closing-time"
                          type="time"
                          value={closingTime}
                          onChange={(e) => setClosingTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent >
        </Tabs >
      </div >

      {/* Table Activation Dialog */}
      < Dialog open={showTableDialog && !!selectedTable} onOpenChange={(open) => { if (!open) { setSelectedTable(null); setShowTableDialog(false) } }}>
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

      {/* Create Table Dialog */}
      < Dialog open={showCreateTableDialog} onOpenChange={setShowCreateTableDialog} >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Tavolo</DialogTitle>
            <DialogDescription>
              Inserisci il nome o numero del nuovo tavolo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome/Numero Tavolo</Label>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Es. 1, 2, Esterno 1..."
              />
            </div>
            <Button onClick={handleCreateTable} className="w-full">Crea Tavolo</Button>
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
            <DialogDescription>
              Modifica il nome della categoria selezionata.
            </DialogDescription>
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
            <DialogDescription>
              Modifica i dettagli del piatto selezionato.
            </DialogDescription>
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
                  onChange={(e) => handleImageChange(e, true)}
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
                    {currentSessionPin}
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
              const session = sessions?.find(s => s.table_id === selectedTableForActions.id && s.status === 'OPEN')
              const customerCount = session?.customer_count || 1

              // Filter orders to ONLY those belonging to the current active session
              const tableOrders = restaurantOrders.filter(o => o.table_session_id === session?.id)
              const completedOrders = restaurantCompletedOrders.filter(o => o.table_session_id === session?.id)
              const allOrders = [...tableOrders, ...completedOrders]

              let subtotal = 0
              // Use local state for immediate feedback
              const isAyceActive = ayceEnabled
              const isCoverActive = copertoEnabled

              const coverCharge = (isCoverActive ? (copertoPrice || 0) : 0) * customerCount
              const ayceCharge = (isAyceActive ? (aycePrice || 0) : 0) * customerCount

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
                        <span>Coperto ({customerCount} pers.):</span>
                        <span>€{coverCharge.toFixed(2)}</span>
                      </div>
                    )}
                    {ayceCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>All You Can Eat ({customerCount} pers.):</span>
                        <span>€{ayceCharge.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Totale:</span>
                      <span>€{(subtotal + coverCharge + ayceCharge).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-4">
                    <Button
                      variant="destructive"
                      onClick={() => selectedTableForActions && handleCloseTable(selectedTableForActions.id, false)}
                    >
                      Svuota Tavolo
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => selectedTableForActions && handleCloseTable(selectedTableForActions.id, true)}
                    >
                      Segna Pagato
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog >

    </div >
  )
}

export default RestaurantDashboard