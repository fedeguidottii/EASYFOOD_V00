import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  ShoppingBasket,
  Plus,
  Minus,
  Utensils,
  Clock,
  CheckCircle,
  ChefHat,
  Search,
  Info,
  X,
  RefreshCw,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Layers,
  ArrowLeft,
  Send,
  ChevronRight,
  Trash,
  GripVertical,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Dish, Order, TableSession } from '../services/types'

// Helper for empty course drop zone
function DroppableCoursePlaceholder({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`text-center py-4 text-xs border-2 border-dashed rounded-xl transition-colors ${isOver ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
    >
      Trascina qui i piatti
    </div>
  )
}

// Helper for new course drop zone
function NewCourseDropZone({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'new-course-zone' })
  return (
    <div ref={setNodeRef} className="relative">
      <Button
        variant="outline"
        className={`w-full py-6 border-dashed rounded-2xl gap-2 transition-all ${isOver ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 scale-105' : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'}`}
        onClick={onClick}
      >
        <Plus className="w-5 h-5" />
        {isOver ? 'Rilascia per creare Nuova Portata' : 'Aggiungi Nuova Portata'}
      </Button>
    </div>
  )
}

// Helper for course container drop zone
function DroppableCourse({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className} transition-all duration-200 ${isOver ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 scale-[1.01]' : ''}`}>
      {children}
    </div>
  )
}

// Sortable Item Component
function SortableDishItem({ item, courseNum }: { item: CartItem, courseNum: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.cartId, data: { item, courseNum } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 999 : 'auto',
    touchAction: 'none',
    scale: isDragging ? 1.05 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 group relative cursor-grab active:cursor-grabbing touch-none select-none transition-shadow ${isDragging ? 'shadow-xl ring-1 ring-emerald-500/50' : ''}`}
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <div className="p-1 text-slate-400">
          <GripVertical className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-xs">{item.name}</p>
          <p className="text-[10px] text-slate-500">{item.quantity}x</p>
        </div>
      </div>
    </div>
  )
}

interface CartItem extends Dish {
  cartId: string
  quantity: number
  notes?: string
  courseNumber: number
}

interface CustomerMenuProps {
  tableId?: string
  onExit?: () => void
  interfaceMode?: 'customer' | 'waiter'
}

export default function CustomerMenu({ tableId: propTableId, onExit, interfaceMode = 'customer' }: CustomerMenuProps = {}) {
  const params = useParams()
  const tableId = propTableId || params.tableId || params.id || params.table_id
  const isWaiterMode = interfaceMode === 'waiter'

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tableName, setTableName] = useState<string>('')

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [session, setSession] = useState<TableSession | null>(null)
  const [previousOrders, setPreviousOrders] = useState<Order[]>([])
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dishNote, setDishNote] = useState('')

  const [maxCourse, setMaxCourse] = useState(1)
  const [currentCourse, setCurrentCourse] = useState(1)
  const [showCourseAlert, setShowCourseAlert] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showCourseManagement, setShowCourseManagement] = useState(false)
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'orders'>('menu')

  const initMenu = async () => {
    if (!tableId) {
      setError("ID Tavolo mancante.")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data: tableData } = await supabase
        .from('tables')
        .select('restaurant_id, number')
        .eq('id', tableId)
        .single()

      if (tableData?.restaurant_id) {
        setRestaurantId(tableData.restaurant_id)
        setTableName(tableData.number || '')

        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', tableData.restaurant_id)
          .single()

        if (restaurantData?.name) {
          setRestaurantName(restaurantData.name)
        }
        return
      }

      const { data: sessionData } = await supabase
        .from('table_sessions')
        .select('restaurant_id')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .limit(1)
        .maybeSingle()

      if (sessionData?.restaurant_id) {
        setRestaurantId(sessionData.restaurant_id)

        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', sessionData.restaurant_id)
          .single()

        if (restaurantData?.name) {
          setRestaurantName(restaurantData.name)
        }
        return
      }

      throw new Error("Impossibile identificare il ristorante.")

    } catch (err: any) {
      setError(err.message || "Errore di connessione")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initMenu()
  }, [tableId])

  const [categories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId || '' })

  // FIXED: Sort categories by order field properly
  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a, b) => {
      const orderA = a.order ?? 9999
      const orderB = b.order ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [categories])

  const filteredDishes = useMemo(() => {
    if (!dishes) return []
    let d = dishes.filter(dish => dish.is_active !== false)
    if (activeCategory !== 'all') d = d.filter(dish => dish.category_id === activeCategory)
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase()
      d = d.filter(dish => dish.name.toLowerCase().includes(lowerTerm) || dish.description?.toLowerCase().includes(lowerTerm))
    }
    return d
  }, [dishes, activeCategory, searchTerm])

  // Group dishes by category for dividers
  const dishesByCategory = useMemo(() => {
    if (activeCategory !== 'all') return null
    const grouped: { category: Category, dishes: Dish[] }[] = []
    sortedCategories.forEach(cat => {
      const categoryDishes = filteredDishes.filter(d => d.category_id === cat.id)
      if (categoryDishes.length > 0) {
        grouped.push({ category: cat, dishes: categoryDishes })
      }
    })
    return grouped
  }, [sortedCategories, filteredDishes, activeCategory])

  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (item.price * item.quantity), 0), [cart])
  const cartCount = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart])
  const historyTotal = useMemo(() => previousOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0), [previousOrders])
  const grandTotal = cartTotal + historyTotal

  const cartByCourse = useMemo(() => {
    const grouped: { [key: number]: CartItem[] } = {}
    cart.forEach(item => {
      const course = item.courseNumber || 1
      if (!grouped[course]) grouped[course] = []
      grouped[course].push(item)
    })
    return grouped
  }, [cart])

  const courseNumbers = useMemo(() => Object.keys(cartByCourse).map(Number).sort((a, b) => a - b), [cartByCourse])

  useEffect(() => {
    if (!tableId) return

    const fetchSessionAndOrders = async () => {
      const { data: sessions } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .limit(1)

      if (sessions && sessions.length > 0) {
        setSession(sessions[0])
        const { data: orders } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('table_session_id', sessions[0].id)
          .order('created_at', { ascending: false })

        if (orders) setPreviousOrders(orders as any[])
      } else {
        setSession(null)
      }
    }

    fetchSessionAndOrders()
    const channel = supabase
      .channel(`public:orders:table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchSessionAndOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchSessionAndOrders())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId])

  const quickAddToCart = (dish: Dish) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === dish.id && !item.notes && item.courseNumber === 1)
      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex].quantity += 1
        return newCart
      }
      return [...prev, { ...dish, cartId: crypto.randomUUID(), quantity: 1, notes: '', courseNumber: 1 }]
    })
    toast.success(`+1 ${dish.name}`, { position: 'top-center', duration: 800, style: { background: '#10B981', color: '#fff', border: 'none', fontSize: '14px', padding: '8px 16px' } })
  }

  const addToCart = (dish: Dish, quantity: number = 1, notes: string = '', courseNum?: number) => {
    const targetCourse = courseNum !== undefined ? courseNum : currentCourse
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === dish.id && item.notes === notes && item.courseNumber === targetCourse)
      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex].quantity += quantity
        return newCart
      }
      return [...prev, { ...dish, cartId: crypto.randomUUID(), quantity, notes, courseNumber: targetCourse }]
    })
    if (quantity > 0) {
      setIsCartAnimating(true)
      setTimeout(() => setIsCartAnimating(false), 500)
      toast.success(`Aggiunto al carrello`, { position: 'top-center', duration: 1500, style: { background: '#10B981', color: '#fff', border: 'none' } })
    }
    setSelectedDish(null)
    setDishNote('')
  }

  const updateCartItemQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0))
  }

  const moveItemToCourse = (cartId: string, newCourse: number) => {
    setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, courseNumber: newCourse } : item))
  }

  const [activeDragItem, setActiveDragItem] = useState<CartItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const item = cart.find(i => i.cartId === active.id)
    if (item) setActiveDragItem(item)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeItem = cart.find(i => i.cartId === activeId)
    if (!activeItem) return

    if (overId === 'new-course-zone') {
      const newCourseNum = maxCourse + 1
      setMaxCourse(newCourseNum)
      moveItemToCourse(activeId, newCourseNum)
      return
    }

    if (overId.startsWith('course-')) {
      const courseNum = parseInt(overId.split('-')[1])
      if (activeItem.courseNumber !== courseNum) {
        moveItemToCourse(activeId, courseNum)
      }
      return
    }

    const overItem = cart.find(i => i.cartId === overId)
    if (overItem && activeItem.courseNumber !== overItem.courseNumber) {
      moveItemToCourse(activeId, overItem.courseNumber)
    }
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  const addNewCourse = () => {
    const newCourseNum = maxCourse + 1
    setMaxCourse(newCourseNum)
    toast.success(`Portata ${newCourseNum} aggiunta`, { position: 'top-center', duration: 1500 })
  }

  const handleSubmitClick = () => {
    if (!session) {
      toast.error("Nessuna sessione attiva. Apri prima il tavolo.")
      return
    }
    if (cart.length === 0) return

    const uniqueCourses = [...new Set(cart.map(item => item.courseNumber))]

    if (isWaiterMode) {
      setShowConfirmDialog(true)
    } else if (uniqueCourses.length === 1 && uniqueCourses[0] === 1) {
      setShowCourseAlert(true)
    } else {
      setShowConfirmDialog(true)
    }
  }

  const submitOrder = async () => {
    if (!session || cart.length === 0 || !restaurantId) return

    setIsOrderSubmitting(true)
    try {
      const orderItems = cart.map(item => ({
        dish_id: item.id,
        quantity: item.quantity,
        note: item.notes || '',
        status: 'PENDING' as const,
        course_number: item.courseNumber
      }))

      await DatabaseService.createOrder({
        restaurant_id: restaurantId,
        table_session_id: session.id,
        status: 'OPEN',
        total_amount: cartTotal
      }, orderItems)

      setCart([])
      setMaxCourse(1)
      setCurrentCourse(1)
      setIsCartOpen(false)
      setShowCourseAlert(false)
      setShowConfirmDialog(false)
      toast.success('Ordine inviato! 👨‍🍳', { duration: 2000, style: { background: '#10B981', color: 'white' } })
    } catch (error) {
      console.error(error)
      toast.error('Errore invio ordine.')
    } finally {
      setIsOrderSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (error || !restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
        <Card className="w-full max-w-sm border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20">
          <CardContent className="flex flex-col items-center text-center p-8 gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Errore</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{error || "Ristorante non trovato."}</p>
            <Button onClick={() => window.location.reload()} className="w-full mt-2 gap-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl h-12 font-semibold shadow-lg">
              <RefreshCw className="w-4 h-4" />Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // WAITER MODE
  if (isWaiterMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={onExit}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg text-white">Tavolo {tableName}</h1>
                <p className="text-xs text-slate-400">{session ? 'Sessione attiva' : 'Nessuna sessione'}</p>
              </div>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input placeholder="Cerca piatto..." className="h-9 pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setActiveCategory('all')} className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Tutto</button>
            {sortedCategories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{cat.name}</button>
            ))}
          </div>
        </header>

        <main className="p-3 pb-28">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredDishes.map((dish) => (
              <Card key={dish.id} className="overflow-hidden border-slate-700/50 bg-slate-800/50 hover:bg-slate-800 transition-all cursor-pointer group" onClick={() => quickAddToCart(dish)}>
                <CardContent className="p-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-xs text-white leading-tight line-clamp-2 flex-1">{dish.name}</h3>
                    <span className="text-emerald-400 font-bold text-xs whitespace-nowrap">€{dish.price.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 left-4 right-4 z-40"
            >
              <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 shadow-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold">{cartCount}</div>
                  <div>
                    <p className="text-xs text-slate-400">Totale</p>
                    <p className="text-lg font-bold text-white">€{cartTotal.toFixed(2)}</p>
                  </div>
                </div>
                <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="ghost" className="h-12 px-4 border border-slate-700 text-white hover:bg-slate-800">
                      <ChevronUp className="w-5 h-5 mr-2" />
                      Vedi
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="bg-slate-900 border-slate-700 text-white max-h-[80vh]">
                    <DrawerHeader>
                      <DrawerTitle>Riepilogo Ordine</DrawerTitle>
                      <DrawerDescription className="text-slate-400">Tavolo {tableName}</DrawerDescription>
                    </DrawerHeader>
                    <ScrollArea className="flex-1 p-4 max-h-[50vh]">
                      <div className="space-y-4">
                        {courseNumbers.map(num => (
                          <div key={num} className="bg-slate-800 rounded-xl p-3">
                            <p className="text-xs font-bold text-emerald-400 uppercase mb-2">Portata {num}</p>
                            <div className="space-y-2">
                              {cartByCourse[num]?.map((item) => (
                                <div key={item.cartId} className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-white truncate">{item.name}</p>
                                    <p className="text-xs text-slate-500">{item.quantity}x €{item.price.toFixed(2)}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => updateCartItemQuantity(item.cartId, -1)}><Minus className="w-3 h-3" /></Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => updateCartItemQuantity(item.cartId, 1)}><Plus className="w-3 h-3" /></Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full h-9 text-xs gap-2 border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500" onClick={addNewCourse}><Plus className="w-3 h-3" />Nuova Portata</Button>
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t border-slate-700">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-400">Totale</span>
                        <span className="text-2xl font-bold text-white">€{cartTotal.toFixed(2)}</span>
                      </div>
                      <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleSubmitClick} disabled={isOrderSubmitting}>
                        {isOrderSubmitting ? 'Invio...' : <><Send className="w-4 h-4 mr-2" />Invia Ordine</>}
                      </Button>
                    </div>
                  </DrawerContent>
                </Drawer>
                <Button className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleSubmitClick} disabled={isOrderSubmitting}>
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-sm bg-slate-900 border-slate-700 text-white">
            <DialogHeader><DialogTitle>Conferma invio</DialogTitle><DialogDescription className="text-slate-400">Inviare l'ordine in cucina?</DialogDescription></DialogHeader>
            <div className="py-3">
              <div className="bg-slate-800 rounded-lg p-3 space-y-1">
                {courseNumbers.map(num => (<p key={num} className="text-xs text-slate-300">• Portata {num}: {cartByCourse[num]?.length || 0} piatti</p>))}
                <p className="text-sm font-bold pt-2 border-t border-slate-700 mt-2 text-white">Totale: €{cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submitOrder} disabled={isOrderSubmitting}>{isOrderSubmitting ? 'Invio...' : 'Conferma'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // CUSTOMER MODE - Professional UI with Category Dividers
  const DishCard = ({ dish }: { dish: Dish }) => (
    <div
      className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-sm hover:shadow-lg hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 cursor-pointer group active:scale-[0.98]"
      onClick={() => setSelectedDish(dish)}
    >
        <div className="w-16 h-16 shrink-0 relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 shadow-inner">
          {dish.image_url ? (
            <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Utensils className="w-5 h-5 text-slate-400" />
            </div>
          )}
          {dish.allergens && dish.allergens.length > 0 && (
            <div className="absolute bottom-1 right-1 bg-white/90 dark:bg-slate-900/90 p-0.5 rounded-full shadow-sm">
              <Info className="w-2.5 h-2.5 text-amber-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 py-0.5">
          <h3 className="font-semibold text-sm leading-tight text-slate-900 dark:text-white line-clamp-1 mb-0.5">{dish.name}</h3>
          {dish.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-snug">{dish.description}</p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">€{dish.price.toFixed(2)}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="h-8 w-8 rounded-full p-0 shadow-lg shadow-emerald-500/20 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-all hover:scale-110 shrink-0"
          onClick={(e) => { e.stopPropagation(); setSelectedDish(dish) }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans select-none flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 relative">
        {activeTab === 'menu' && (
          <>
            <header className="flex-none z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 shadow-sm shadow-slate-200/50 dark:shadow-black/10">
              <div className="max-w-2xl mx-auto px-4 py-3">
                {restaurantName && (
                  <div className="text-center mb-3 pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                    <h1 className="font-bold text-2xl leading-tight tracking-tight text-slate-900 dark:text-white">
                      {restaurantName}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Benvenuti</p>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/30">
                        <Utensils className="w-5 h-5 text-white" />
                      </div>
                      {session && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-900 animate-pulse" />}
                    </div>
                    <div>
                      <h2 className="font-bold text-base leading-none tracking-tight text-slate-900 dark:text-white">Menu</h2>
                      <div className="flex items-center gap-1.5 mt-1">
                        {session ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Tavolo {tableName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                            In attesa...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative w-36 transition-all focus-within:w-44 duration-300">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Cerca..."
                      className="h-10 pl-9 pr-3 text-sm rounded-xl bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-slate-700/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50 backdrop-blur-sm shadow-inner"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                  <div className="flex gap-2 min-w-max">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${activeCategory === 'all'
                        ? 'bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-900/20 dark:shadow-white/20 scale-105'
                        : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-white/30 dark:border-slate-700/30 hover:bg-white/80 backdrop-blur-sm'
                        }`}
                    >
                      Tutto
                    </button>
                    {sortedCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${activeCategory === cat.id
                          ? 'bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-900/20 dark:shadow-white/20 scale-105'
                          : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-white/30 dark:border-slate-700/30 hover:bg-white/80 backdrop-blur-sm'
                          }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-2 max-w-2xl mx-auto w-full pb-32">
              {activeCategory === 'all' && dishesByCategory ? (
                dishesByCategory.map(({ category, dishes: catDishes }) => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center gap-3 pt-4 pb-2 first:pt-0">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-3 py-1.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full border border-white/30 dark:border-slate-700/30 shadow-sm">
                        {category.name}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                    </div>
                    {catDishes.map(dish => (
                      <DishCard key={dish.id} dish={dish} />
                    ))}
                  </div>
                ))
              ) : (
                filteredDishes.map(dish => (
                  <DishCard key={dish.id} dish={dish} />
                ))
              )}
              {filteredDishes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Nessun piatto trovato</p>
                </div>
              )}
            </main>
          </>
        )}

        {activeTab === 'cart' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <header className="flex-none z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 shadow-sm">
              <h1 className="text-xl font-bold text-center text-slate-900 dark:text-white">Il tuo Ordine</h1>
              <p className="text-xs text-center text-slate-500 mt-1">Gestisci le portate e invia l'ordine</p>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-32 space-y-4 max-w-2xl mx-auto w-full">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                    <ShoppingBasket className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="font-medium">Il carrello è vuoto</p>
                  <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-2 text-emerald-600">Torna al menu</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.cartId} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-white/20 dark:border-slate-800/50 flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                            <Utensils className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{item.name}</h3>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">€{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-slate-500 mt-0.5 italic line-clamp-1">Note: {item.notes}</p>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg">
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                {item.courseNumber === 1 ? '1ª Uscita' : item.courseNumber === 2 ? '2ª Uscita' : `${item.courseNumber}ª Uscita`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg p-0.5">
                              <button
                                onClick={() => updateCartItemQuantity(item.cartId, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-bold text-sm w-4 text-center text-slate-900 dark:text-white">{item.quantity}</span>
                              <button
                                onClick={() => updateCartItemQuantity(item.cartId, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Button
                      variant="outline"
                      className="w-full h-11 border-dashed border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-2 rounded-xl font-semibold"
                      onClick={() => setShowCourseManagement(true)}
                    >
                      <Layers className="w-4 h-4" />
                      Dividi / Organizza Portate
                    </Button>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/30 dark:border-slate-800/50">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-500 font-medium">Totale Ordine</span>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">€{cartTotal.toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full h-14 text-base font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30"
                      onClick={handleSubmitClick}
                      disabled={isOrderSubmitting}
                    >
                      {isOrderSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Invio in corso...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-5 h-5" />
                          Invia Ordine in Cucina
                        </div>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <header className="flex-none z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 shadow-sm">
              <h1 className="text-xl font-bold text-center text-slate-900 dark:text-white">I tuoi Ordini</h1>
              <p className="text-xs text-center text-slate-500 mt-1">Segui lo stato delle tue ordinazioni</p>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-32 space-y-3 max-w-2xl mx-auto w-full">
              {previousOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                    <Clock className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="font-medium">Nessun ordine ancora</p>
                  <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-2 text-emerald-600">Vai al menu</Button>
                </div>
              ) : (
                previousOrders.map((order, index) => (
                  <div key={order.id} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-white/20 dark:border-slate-800/50">
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-emerald-600">#{index + 1}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(order.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Badge
                        className={`text-[10px] font-semibold ${order.status === 'OPEN' || order.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : order.status === 'preparing'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : order.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                          }`}
                      >
                        {order.status === 'OPEN' || order.status === 'pending' ? 'In attesa' :
                          order.status === 'preparing' ? 'In preparazione' :
                            order.status === 'ready' ? 'Pronto' : order.status}
                      </Badge>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {(order as any).items?.map((item: any, idx: number) => {
                        const d = dishes?.find(dd => dd.id === item.dish_id)
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white w-5">{item.quantity}x</span>
                              <span className="text-slate-600 dark:text-slate-300">{d?.name}</span>
                            </div>
                            {item.status === 'SERVED' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center">
                      <span className="text-xs text-slate-500">Totale parziale</span>
                      <span className="font-bold text-slate-900 dark:text-white">€{order.total_amount?.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}

              {previousOrders.length > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 rounded-2xl text-white dark:text-slate-900 shadow-xl">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Totale Complessivo</span>
                    <span className="text-2xl font-bold">€{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/30 dark:border-slate-800/50 pb-safe shadow-lg shadow-slate-900/5">
        <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all ${activeTab === 'menu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'menu' ? 'bg-emerald-500/10' : ''}`}>
              <Utensils className={`w-5 h-5 ${activeTab === 'menu' ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[10px] font-semibold">Menu</span>
          </button>

          <button
            onClick={() => setActiveTab('cart')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all relative ${activeTab === 'cart' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <div className={`relative p-1.5 rounded-xl transition-all ${activeTab === 'cart' ? 'bg-emerald-500/10' : ''} ${isCartAnimating ? 'scale-125' : ''}`}>
              <ShoppingBasket className={`w-5 h-5 ${activeTab === 'cart' ? 'fill-current' : ''} ${isCartAnimating ? 'text-emerald-500' : ''}`} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow-lg shadow-red-500/30 animate-bounce">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold">Carrello</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all ${activeTab === 'orders' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-emerald-500/10' : ''}`}>
              <Clock className={`w-5 h-5 ${activeTab === 'orders' ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[10px] font-semibold">Ordini</span>
          </button>
        </div>
      </div>

      {/* Dish Detail Dialog */}
      <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border-0 shadow-2xl">
          {selectedDish && (
            <>
              <div className="relative h-56 w-full">
                {selectedDish.image_url ? (
                  <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                    <Utensils className="w-16 h-16 text-slate-300" />
                  </div>
                )}
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white rounded-full hover:bg-black/50 transition-colors" onClick={() => setSelectedDish(null)}>
                  <X className="w-5 h-5" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 text-center">
                  <h2 className="text-3xl font-bold text-white leading-tight">{selectedDish.name}</h2>
                  <p className="text-emerald-400 font-bold text-xl mt-2">€{selectedDish.price.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {selectedDish.description && (
                  <div className="text-center">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white mb-2">Descrizione</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{selectedDish.description}</p>
                  </div>
                )}

                {selectedDish.allergens && selectedDish.allergens.length > 0 && (
                  <div className="text-center">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                      <Info className="w-4 h-4 text-amber-500" />
                      Allergeni
                    </h3>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {selectedDish.allergens.map(a => (
                        <Badge key={a} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30 text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5 block tracking-wider text-center">Note per la cucina</label>
                  <Textarea
                    placeholder="Es. Niente cipolla, ben cotto..."
                    className="resize-none text-xs min-h-[60px] rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500"
                    value={dishNote}
                    onChange={(e) => setDishNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                <Button
                  className="w-full h-13 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98]"
                  onClick={() => {
                    addToCart(selectedDish, 1, dishNote, 1);
                    setActiveTab('menu');
                  }}
                >
                  Aggiungi al carrello - €{selectedDish.price.toFixed(2)}
                </Button>
                <p className="text-center text-[10px] text-slate-400 mt-2">
                  Potrai gestire le portate direttamente nel carrello
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-sm bg-white dark:bg-slate-900 rounded-3xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Conferma Ordine</DialogTitle>
            <DialogDescription className="text-center">Inviare l'ordine in cucina?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
              {courseNumbers.map(n => (
                cartByCourse[n]?.length > 0 && (
                  <div key={n} className="space-y-2">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-wider sticky top-0 bg-slate-50 dark:bg-slate-800 py-1 z-10">
                      {n === 1 ? 'Prima Uscita' : n === 2 ? 'Seconda Uscita' : `Uscita ${n}`}
                    </h4>
                    <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                      {cartByCourse[n].map((item) => (
                        <div key={item.cartId} className="flex justify-between items-start text-xs gap-2">
                          <div className="flex gap-2 min-w-0">
                            <span className="font-bold text-slate-500 whitespace-nowrap">{item.quantity}x</span>
                            <span className="text-slate-700 dark:text-slate-300 truncate leading-tight">{item.name}</span>
                          </div>
                          <span className="text-slate-400 whitespace-nowrap">€{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-2 flex justify-between items-center sticky bottom-0 bg-slate-50 dark:bg-slate-800 pb-1">
                <span className="font-bold text-sm">Totale</span>
                <span className="font-bold text-emerald-600 text-lg">€{cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
            <Button className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={submitOrder} disabled={isOrderSubmitting}>
              {isOrderSubmitting ? 'Invio...' : 'Conferma'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Management Dialog */}
      <Dialog open={showCourseManagement} onOpenChange={setShowCourseManagement}>
        <DialogContent className="max-w-lg bg-slate-50 dark:bg-slate-900 max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl">
          <DialogHeader className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
            <DialogTitle>Organizza Portate</DialogTitle>
            <DialogDescription>Trascina i piatti per cambiare l'ordine di uscita</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex-1 overflow-y-auto scrollbar-hide p-4 bg-slate-100 dark:bg-slate-950">
                <div className="space-y-4 pb-20">
                  {Array.from({ length: maxCourse }, (_, i) => i + 1).map((courseNum) => (
                    <DroppableCourse
                      key={courseNum}
                      id={`course-${courseNum}`}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-xs flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          {courseNum === 1 ? 'Prima Uscita' : courseNum === 2 ? 'Seconda Uscita' : `Uscita ${courseNum}`}
                        </h3>
                        {courseNum > 1 && cartByCourse[courseNum]?.length === 0 && (
                          <Button variant="ghost" size="sm" className="h-6 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { }}>
                            <Trash className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 min-h-[40px]">
                        <SortableContext
                          id={`course-${courseNum}`}
                          items={cartByCourse[courseNum]?.map(i => i.cartId) || []}
                          strategy={verticalListSortingStrategy}
                        >
                          {cartByCourse[courseNum]?.length === 0 ? (
                            <DroppableCoursePlaceholder id={`course-${courseNum}`} />
                          ) : (
                            cartByCourse[courseNum]?.map((item) => (
                              <SortableDishItem key={item.cartId} item={item} courseNum={courseNum} />
                            ))
                          )}
                        </SortableContext>
                      </div>
                    </DroppableCourse>
                  ))}

                  <NewCourseDropZone onClick={addNewCourse} />
                </div>
              </div>

              <DragOverlay dropAnimation={dropAnimation}>
                {activeDragItem ? (
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-xl border border-emerald-500 shadow-xl opacity-90 scale-105 cursor-grabbing">
                    <div className="flex items-center gap-3">
                      <div className="p-1 text-emerald-500">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs">{activeDragItem.name}</p>
                        <p className="text-[10px] text-slate-500">{activeDragItem.quantity}x</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-20 relative">
            <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20" onClick={() => setShowCourseManagement(false)}>
              Fatto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Alert Dialog */}
      <AlertDialog open={showCourseAlert} onOpenChange={setShowCourseAlert}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 rounded-3xl border-0 shadow-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl">Come vuoi procedere?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Hai inserito tutti i piatti in un'unica portata. Vuoi inviare tutto subito o dividere in più uscite?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button className="h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20" onClick={() => {
              setShowCourseAlert(false);
              setShowConfirmDialog(true);
            }}>
              <ChefHat className="w-5 h-5 mr-2" />
              Invia tutto insieme
            </Button>
            <Button variant="outline" className="h-14 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium" onClick={() => {
              setShowCourseAlert(false);
              setShowCourseManagement(true);
            }}>
              <Layers className="w-5 h-5 mr-2 text-emerald-600" />
              Dividi in portate
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-12">Annulla</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}