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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  DotsSixVertical,
  Funnel
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

  const [restaurants, , refreshRestaurants] = useSupabaseData<Restaurant>('restaurants', [])
  const currentRestaurant = restaurants?.find(r => r.owner_id === user.id || r.id === user.restaurant_id)
  const restaurantId = currentRestaurant?.id ? String(currentRestaurant.id) : ''
  const restaurantSlug = currentRestaurant?.name.toLowerCase().replace(/\s+/g, '-') || ''

  const [tables, , , setTables] = useSupabaseData<Table>('tables', [], { column: 'restaurant_id', value: restaurantId })
  const [dishes, , , setDishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId })

  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!restaurantId) return

    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (data) setOrders(data as Order[])
    }

    fetchOrders()

    const channel = supabase
      .channel(`dashboard_orders_${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        fetchOrders()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as Order
        if (newOrder.restaurant_id === restaurantId) {
          fetchOrders()
          toast.info(`Nuovo ordine al tavolo! 🔔`)
          // Play notification sound using AudioContext (no file needed)
          try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            if (AudioContext) {
              const ctx = new AudioContext()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.type = 'sine'
              osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
              osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5) // Drop to A4
              gain.gain.setValueAtTime(0.5, ctx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
              osc.start()
              osc.stop(ctx.currentTime + 0.5)
            }
          } catch (e) {
            console.error('Audio play failed', e)
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
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
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [customerCount, setCustomerCount] = useState('')
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
  const [selectedKitchenCategories, setSelectedKitchenCategories] = useState<string[]>([])

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

  const sortedActiveOrders = [...restaurantOrders].sort((a, b) => {
    if (orderSortMode === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const filteredOrders = sortedActiveOrders.map(order => {
    if (selectedKitchenCategories.length === 0) return order

    const filteredItems = order.items?.filter(item => {
      const dish = dishes?.find(d => d.id === item.dish_id)
      return dish && selectedKitchenCategories.includes(dish.category_id)
    })

    return { ...order, items: filteredItems }
  }).filter(order => order.items && order.items.length > 0)

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

      setWaiterModeEnabled(currentRestaurant.waiter_mode_enabled || false)
      setAllowWaiterPayments(currentRestaurant.allow_waiter_payments || false)
      setWaiterPassword(currentRestaurant.waiter_password || '')
    }
  }, [currentRestaurant])

  const { updateOrderItemStatus, updateOrderStatus } = useRestaurantLogic(restaurantId)

  useEffect(() => {
    if (activeTab === 'tables') {
      refreshSessions()
    }
  }, [activeTab, refreshSessions])

  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString()

  const generateQrCode = (tableId: string) => {
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
      number: newTableName,
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
        await DatabaseService.closeSession(openSession.id)
        if (markPaid) {
          await DatabaseService.markOrdersPaidForSession(openSession.id)
        } else {
          // FIX: If just emptying the table (not paid), cancel all active orders
          // so they don't count as "Active" in analytics.
          await DatabaseService.cancelSessionOrders(openSession.id)
        }

        toast.success(markPaid ? 'Tavolo pagato e liberato' : 'Tavolo svuotato e liberato')
        refreshSessions()
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
      handleCloseTable(tableId, true)
      return
    }

    const table = tables?.find(t => t.id === tableId)
    if (!table) return

    const isAyceEnabled = ayceEnabled
    const isCopertoEnabled = copertoEnabled && copertoPrice > 0

    if (!isAyceEnabled && !isCopertoEnabled) {
      handleActivateTable(tableId, 1)
    } else {
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
      refreshSessions()
      setShowTableDialog(false)
      setShowQrDialog(false)
    } catch (err) {
      console.error('Error activating table:', err)
      toast.error('Errore durante l\'attivazione del tavolo')
    }
  }

  const handleShowTableQr = async (table: Table) => {
    setSelectedTableForActions(table)
    setShowTableQrDialog(true)
    setCurrentSessionPin('Caricamento...')

    try {
      const session = await DatabaseService.getActiveSession(table.id)
      if (session && session.session_pin) {
        setCurrentSessionPin(session.session_pin)
      } else {
        setCurrentSessionPin('N/A')
        refreshSessions()
      }
    } catch (error) {
      console.error('Error fetching session for PIN:', error)
      setCurrentSessionPin('Errore')
    }
  }

  const handleDeleteTable = (tableId: string) => {
    setTables(prev => prev.filter(t => t.id !== tableId))

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
    setDishes(prev => prev.filter(d => d.id !== dishId))

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

  // --- Category Drag & Drop Logic ---
  const handleDragStart = (category: Category) => {
    setDraggedCategory(category)
  }

  const handleDragOver = (e: React.DragEvent, targetCategory: Category) => {
    e.preventDefault()
    if (!draggedCategory || draggedCategory.id === targetCategory.id) return
  }

  const handleDrop = async (targetCategory: Category) => {
    if (!draggedCategory || draggedCategory.id === targetCategory.id) return

    const updatedCategories = [...restaurantCategories]
    const draggedIndex = updatedCategories.findIndex(c => c.id === draggedCategory.id)
    const targetIndex = updatedCategories.findIndex(c => c.id === targetCategory.id)

    updatedCategories.splice(draggedIndex, 1)
    updatedCategories.splice(targetIndex, 0, draggedCategory)

    setCategories(updatedCategories)
    setDraggedCategory(null)

    // Update orders in DB
    try {
      const updates = updatedCategories.map((cat, index) => ({
        ...cat,
        order: index
      }))

      // We update optimistically first, then in DB.
      // Ideally we would batch update, but supabase might need individual calls or an RPC.
      // For simplicity/robustness here we iterate.
      for (const cat of updates) {
        await DatabaseService.updateCategory(cat)
      }
      toast.success('Ordine categorie aggiornato')
    } catch (err) {
      console.error("Failed to reorder categories", err)
      toast.error("Errore nel riordinare le categorie")
      refreshRestaurants() // Revert on error roughly
    }
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
      {/* Sidebar */}
      <div
        id="sidebar"
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`${sidebarExpanded ? 'w-64' : 'w-20'
          } border-r border-border/20 flex flex-col fixed h-full z-50 transition-all duration-300 ease-in-out bg-card/80 backdrop-blur-md shadow-2xl`}
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
          {['orders', 'tables', 'menu', 'reservations', 'analytics', 'settings'].map((section) => (
            <Button
              key={section}
              variant="ghost"
              className={`w-full justify-start ${!sidebarExpanded && 'justify-center px-0'} transition-all duration-200 hover:bg-muted ${activeSection === section ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}
              onClick={() => {
                setActiveSection(section)
                if (sidebarExpanded) setSidebarExpanded(false)
              }}
            >
              {section === 'orders' && <Clock size={24} weight={activeSection === section ? 'fill' : 'regular'} />}
              {section === 'tables' && <MapPin size={24} weight={activeSection === section ? 'fill' : 'regular'} />}
              {section === 'menu' && <BookOpen size={24} weight={activeSection === section ? 'fill' : 'regular'} />}
              {section === 'reservations' && <Calendar size={24} weight={activeSection === section ? 'fill' : 'regular'} />}
              {section === 'analytics' && <ChartBar size={24} weight={activeSection === section ? 'fill' : 'regular'} />}
              {section === 'settings' && <Gear size={24} weight={activeSection === section ? 'fill' : 'regular'} />}
              {sidebarExpanded && <span className="ml-3 font-medium capitalize">{section === 'analytics' ? 'Analitiche' : section === 'settings' ? 'Impostazioni' : section === 'reservations' ? 'Prenotazioni' : section === 'tables' ? 'Tavoli' : section === 'orders' ? 'Ordini' : 'Menu'}</span>}
            </Button>
          ))}
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
      <div className={`flex-1 p-6 transition-all duration-300 ${sidebarExpanded ? 'ml-64' : 'ml-16'}`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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

                {/* Category Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={selectedKitchenCategories.length > 0 ? "default" : "outline"} size="sm" className="mr-2 h-9 border-dashed">
                      <Funnel size={16} className="mr-2" />
                      Filtra Categorie
                      {selectedKitchenCategories.length > 0 && (
                        <span className="ml-1 rounded-full bg-primary-foreground text-primary w-4 h-4 text-[10px] flex items-center justify-center">
                          {selectedKitchenCategories.length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="start">
                    <div className="p-2 border-b border-border/10">
                      <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Seleziona Categorie</h4>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto space-y-1">
                      {categories?.map(cat => (
                        <div key={cat.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded cursor-pointer"
                          onClick={() => {
                            setSelectedKitchenCategories(prev =>
                              prev.includes(cat.id)
                                ? prev.filter(id => id !== cat.id)
                                : [...prev, cat.id]
                            )
                          }}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedKitchenCategories.includes(cat.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                            {selectedKitchenCategories.includes(cat.id) && <Check size={10} weight="bold" />}
                          </div>
                          <span className="text-sm">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                    {selectedKitchenCategories.length > 0 && (
                      <div className="p-2 border-t border-border/10">
                        <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setSelectedKitchenCategories([])}>
                          Resetta Filtri
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <div className="flex items-center gap-2 bg-muted p-1 rounded-lg mr-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground px-2">Zoom</span>
                  <Button variant="ghost" size="sm" onClick={() => setKitchenColumns(prev => prev + 1)} className="h-7 w-7 p-0">
                    <Minus size={14} />
                  </Button>
                  <span className="w-4 text-center text-xs font-bold">{kitchenColumns}</span>
                  <Button variant="ghost" size="sm" onClick={() => setKitchenColumns(prev => Math.max(1, prev - 1))} className="h-7 w-7 p-0">
                    <Plus size={14} />
                  </Button>
                </div>

                <Select value={orderSortMode} onValueChange={(value: 'oldest' | 'newest') => setOrderSortMode(value)}>
                  <SelectTrigger className="w-[140px] h-9 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oldest">Meno recenti</SelectItem>
                    <SelectItem value="newest">Più recenti</SelectItem>
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
                      <Card key={order.id} className="bg-card border-border/50 shadow-sm">
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
            ) : filteredOrders.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} className="text-muted-foreground/40" weight="duotone" />
                </div>
                <p className="text-lg font-semibold text-muted-foreground">Nessun ordine attivo</p>
                <p className="text-xs text-muted-foreground mt-1">Gli ordini appariranno qui non appena arrivano</p>
              </div>
            ) : (
              <KitchenView
                orders={filteredOrders}
                tables={tables || []}
                dishes={dishes || []}
                selectedCategoryIds={selectedKitchenCategories}
                viewMode={kitchenViewMode}
                columns={kitchenColumns}
                onCompleteDish={handleCompleteDish}
                onCompleteOrder={handleCompleteOrder}
                sessions={sessions || []}
              />
            )}
          </TabsContent >

          {/* Tables Tab */}
          < TabsContent value="tables" className="space-y-6" >
            <Card className="border-border/50 bg-card shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <MapPin size={20} weight="duotone" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Gestione Tavoli</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Gestisci la sala e i tavoli</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <Input
                        placeholder="Cerca tavolo..."
                        value={tableSearchTerm}
                        onChange={(e) => setTableSearchTerm(e.target.value)}
                        className="pl-9 h-10 w-[180px] lg:w-[230px]"
                      />
                    </div>
                    <Button onClick={() => setShowCreateTableDialog(true)} size="sm" className="h-10">
                      <Plus size={16} className="mr-2" />
                      Nuovo Tavolo
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-10">
                          <ClockCounterClockwise size={16} className="mr-2" />
                          Storico
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Storico Tavoli Chiusi</DialogTitle>
                          <DialogDescription>Visualizza le sessioni dei tavoli concluse.</DialogDescription>
                        </DialogHeader>
                        {/* History Logic here if needed, keeping simple for now */}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {restaurantTables.map(table => {
                const session = getOpenSessionForTable(table.id)
                const isActive = session?.status === 'OPEN'
                const activeOrder = restaurantOrders.find(o => getTableIdFromOrder(o) === table.id)

                return (
                  <Card
                    key={table.id}
                    className={`relative overflow-hidden transition-all duration-300 group border shadow-sm hover:shadow-md ${isActive ? 'bg-card border-primary/20 ring-1 ring-primary/10' : 'bg-card border-border/50'}`}
                  >
                    <CardContent className="p-0 flex flex-col h-full">
                      <div className="p-4 flex items-center justify-between border-b border-border/10">
                        <span className="text-xl font-semibold text-foreground">
                          {table.number}
                        </span>
                        <Badge variant={isActive ? 'default' : 'outline'}>
                          {isActive ? 'Occupato' : 'Libero'}
                        </Badge>
                      </div>

                      <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
                        {isActive ? (
                          <>
                            <div className="text-center">
                              <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-[0.2em] font-medium">PIN Tavolo</p>
                              <span className="text-4xl font-mono font-bold tracking-wider text-foreground">
                                {session?.session_pin || '...'}
                              </span>
                            </div>
                            {activeOrder && (
                              <Badge variant="outline" className="text-xs">
                                {activeOrder.items?.filter(i => i.status === 'SERVED').length || 0} ordini completati
                              </Badge>
                            )}
                          </>
                        ) : (
                          <div className="text-center text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                            <MapPin size={32} className="mx-auto mb-2" />
                            <p className="text-sm font-medium">Pronto</p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-muted/5 border-t border-border/10 grid gap-2">
                        {isActive ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleShowTableQr(table)}>
                              <QrCode size={16} className="mr-2" />
                              QR
                            </Button>
                            <Button
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => { setSelectedTableForActions(table); setShowTableBillDialog(true); }}
                            >
                              <Receipt size={16} className="mr-2" />
                              Conto
                            </Button>
                          </div>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleToggleTable(table.id)}
                          >
                            Attiva Tavolo
                          </Button>
                        )}
                      </div>

                      <div className="absolute top-2 right-12 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTable(table)}>
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
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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
                    <Button>
                      <Plus size={16} className="mr-2" />
                      Nuovo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    {/* Dish Form Content */}
                    <DialogHeader>
                      <DialogTitle>Aggiungi Piatto</DialogTitle>
                      <DialogDescription>
                        Compila i dettagli del piatto.
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
                        <Switch
                          id="new_is_ayce"
                          checked={newDish.is_ayce}
                          onCheckedChange={(checked) => setNewDish({ ...newDish, is_ayce: checked })}
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
                        Trascina le categorie per riordinarle.
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
                            onDragStart={() => handleDragStart(cat)}
                            onDragOver={(e) => handleDragOver(e, cat)}
                            onDrop={() => handleDrop(cat)}
                            className={`flex items-center justify-between p-3 bg-card border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-all group cursor-move ${draggedCategory?.id === cat.id ? 'opacity-50 border-primary' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary cursor-grab">
                                <DotsSixVertical size={16} weight="bold" />
                              </div>
                              <span className="font-medium">{cat.name}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditCategory(cat)}
                              >
                                <PencilSimple size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteCategory(cat.id)}
                              >
                                <Trash size={16} />
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
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Tag size={20} weight="duotone" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{category.name}</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryDishes.map(dish => (
                        <Card key={dish.id} className={`group hover:shadow-lg transition-all border-border/50 bg-card shadow-sm ${!dish.is_active ? 'opacity-60 grayscale' : ''}`}>
                          <CardContent className="p-0">
                            {dish.image_url && (
                              <div className="relative h-48 w-full overflow-hidden rounded-t-xl">
                                <img
                                  src={dish.image_url}
                                  alt={dish.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                                    <Badge className="bg-orange-500 hover:bg-orange-600 text-xs text-white border-none">
                                      AYCE
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/10">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 hover:bg-muted"
                                    onClick={() => handleEditDish(dish)}
                                  >
                                    <PencilSimple size={18} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-9 w-9 hover:bg-muted ${!dish.is_active ? 'text-muted-foreground' : 'text-green-600'}`}
                                    onClick={() => handleToggleDish(dish.id)}
                                  >
                                    {dish.is_active ? <Eye size={18} /> : <EyeSlash size={18} />}
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteDish(dish.id)}
                                >
                                  <Trash size={18} />
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
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Gear size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Impostazioni</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Configura il tuo ristorante</p>
                </div>
              </div>
            </div>

            <Card className="border-border/50 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Gear size={18} />
                  </span>
                  Aspetto
                </CardTitle>
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

            <Card className="border-border/50 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ClockCounterClockwise size={18} />
                  </span>
                  Sala & Servizio
                </CardTitle>
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
                          setWaiterModeEnabled(!checked)
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
                          setAllowWaiterPayments(!checked)
                        }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-card border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <ForkKnife size={20} className="text-primary" />
                    Impostazioni All You Can Eat
                  </CardTitle>
                  <CardDescription>
                    Configura le opzioni per la modalità All You Can Eat.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                    <Label htmlFor="ayce-enabled" className="text-base font-medium">Abilita All You Can Eat</Label>
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
                    <div className="grid gap-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <Label htmlFor="ayce-price" className="text-muted-foreground">Prezzo a persona (€)</Label>
                        <div className="relative">
                          <Input
                            id="ayce-price"
                            type="number"
                            value={aycePrice}
                            onChange={(e) => {
                              setAycePrice(parseFloat(e.target.value) || 0)
                              setAyceDirty(true)
                            }}
                            className="pl-8"
                          />
                          <span className="absolute left-3 top-2.5 text-muted-foreground">€</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ayce-max-orders" className="text-muted-foreground">Max Ordini per persona</Label>
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
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Receipt size={20} className="text-primary" />
                      Impostazioni Coperto
                    </CardTitle>
                    <CardDescription>Gestisci il costo del coperto</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Abilita Coperto</Label>
                        <p className="text-xs text-muted-foreground">
                          Aggiungi automaticamente il coperto
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
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label htmlFor="coperto-price" className="text-muted-foreground">Costo Coperto (€)</Label>
                        <div className="relative">
                          <Input
                            id="coperto-price"
                            type="number"
                            value={copertoPrice}
                            onChange={(e) => {
                              setCopertoPrice(parseFloat(e.target.value) || 0)
                              setCopertoDirty(true)
                            }}
                            className="pl-8"
                          />
                          <span className="absolute left-3 top-2.5 text-muted-foreground">€</span>
                        </div>
                      </div>
                    )}
                    {copertoDirty && (
                      <Button onClick={saveCopertoSettings} className="w-full">
                        Salva Impostazioni Coperto
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Clock size={20} className="text-primary" />
                      Orari di Apertura
                    </CardTitle>
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

      {/* Dialogs ... (Same as before) */}
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
              <Switch
                id="edit_is_ayce"
                checked={editDishData.is_ayce}
                onCheckedChange={(checked) => setEditDishData({ ...editDishData, is_ayce: checked })}
              />
              <Label htmlFor="edit_is_ayce">Incluso in All You Can Eat</Label>
            </div>
            <Button onClick={handleSaveDish} className="w-full">Salva Modifiche</Button>
          </div>
        </DialogContent>
      </Dialog >

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

              const tableOrders = restaurantOrders.filter(o => o.table_session_id === session?.id)
              const completedOrders = restaurantCompletedOrders.filter(o => o.table_session_id === session?.id)
              const allOrders = [...tableOrders, ...completedOrders]

              let subtotal = 0
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
                      className="bg-green-600 hover:bg-green-700 text-white"
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