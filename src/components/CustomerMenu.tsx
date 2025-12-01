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
  Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Dish, Order, TableSession } from '../services/types'

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
  const [currentCourse, setCurrentCourse] = useState(1) // Track which course user is currently adding to
  const [showCourseAlert, setShowCourseAlert] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

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

  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
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

  // Quick add for waiter mode (no dialog)
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
      const courseLabel = targetCourse === 1 ? 'Prima portata' : targetCourse === 2 ? 'Seconda portata' : `Portata ${targetCourse}`
      toast.success(`Aggiunto a ${courseLabel}: ${dish.name}`, { position: 'top-center', duration: 1500, style: { background: '#10B981', color: '#fff', border: 'none' } })
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
      // Waiter mode: skip alert, go directly to confirm
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400 animate-pulse">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (error || !restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <Card className="w-full max-w-sm border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardContent className="flex flex-col items-center text-center p-8 gap-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Errore</h2>
            <p className="text-sm text-slate-400">{error || "Ristorante non trovato."}</p>
            <Button onClick={() => window.location.reload()} className="w-full mt-2 gap-2 bg-slate-700 hover:bg-slate-600">
              <RefreshCw className="w-4 h-4" />Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================
  // WAITER MODE - Fast Grid Layout
  // ============================================
  if (isWaiterMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Waiter Header */}
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
          
          {/* Category Pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setActiveCategory('all')} className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Tutto</button>
            {sortedCategories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{cat.name}</button>
            ))}
          </div>
        </header>

        {/* Waiter Grid - Compact Cards */}
        <main className="p-3 pb-28">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredDishes.map((dish) => (
              <Card key={dish.id} className="overflow-hidden border-slate-700/50 bg-slate-800/50 hover:bg-slate-800 transition-all cursor-pointer group" onClick={() => quickAddToCart(dish)}>
                <CardContent className="p-3 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-white leading-tight line-clamp-2 flex-1">{dish.name}</h3>
                    <span className="text-emerald-400 font-bold text-sm whitespace-nowrap">€{dish.price.toFixed(2)}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 line-clamp-1">{dish.description?.substring(0, 30) || ''}</span>
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 transition-all">
                      <Plus className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        {/* Waiter Cart Bar */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 p-3 safe-area-bottom">
              <div className="flex items-center gap-3">
                <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" className="flex-1 h-12 justify-between border-slate-700 bg-slate-800 hover:bg-slate-700 text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-sm">{cartCount}</div>
                        <span className="font-medium">Carrello</span>
                      </div>
                      <span className="font-bold text-lg">€{cartTotal.toFixed(2)}</span>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-w-lg mx-auto bg-slate-900 border-slate-700">
                    <DrawerHeader className="border-b border-slate-700">
                      <DrawerTitle className="text-white">Riepilogo Ordine</DrawerTitle>
                      <DrawerDescription className="text-slate-400">Tavolo {tableName}</DrawerDescription>
                    </DrawerHeader>
                    <ScrollArea className="h-[50vh] p-4">
                      <div className="space-y-3">
                        {courseNumbers.map((courseNum) => (
                          <div key={courseNum}>
                            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-700">
                              <Layers className="w-4 h-4 text-emerald-400" />
                              <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Portata {courseNum}</span>
                            </div>
                            <div className="space-y-2">
                              {cartByCourse[courseNum]?.map((item) => (
                                <div key={item.cartId} className="flex items-center justify-between bg-slate-800 rounded-lg p-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-bold text-sm">{item.quantity}x</span>
                                    <span className="text-white text-sm">{item.name}</span>
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

        {/* Confirm Dialog */}
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

  // ============================================
  // CUSTOMER MODE - Original Elegant Layout
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 font-sans select-none">
      {/* Customer Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 pt-2 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5 rounded-xl shadow-md">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
                {session && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white dark:border-slate-900 animate-pulse" />}
              </div>
              <div>
                <h1 className="font-bold text-base leading-none tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Menu</h1>
                <div className="flex items-center gap-1 mt-0.5">
                  {session ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />Connesso</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">In attesa...</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                currentCourse === 1 ? 'bg-emerald-500 text-white' :
                currentCourse === 2 ? 'bg-amber-500 text-white' :
                'bg-purple-500 text-white'
              }`}>
                {currentCourse}ª Portata
              </div>
              <div className="relative w-32 transition-all focus-within:w-44 duration-300">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <Input placeholder="Cerca..." className="h-7 pl-7 pr-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
            <div className="flex gap-1.5 min-w-max">
              <button onClick={() => setActiveCategory('all')} className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${activeCategory === 'all' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>Tutto</button>
              {sortedCategories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${activeCategory === cat.id ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{cat.name}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Customer Dish List */}
      <main className="p-3 space-y-2 max-w-5xl mx-auto">
        <AnimatePresence mode="popLayout">
          {filteredDishes.map((dish) => (
            <motion.div key={dish.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Card className="overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md bg-white dark:bg-slate-900 cursor-pointer group" onClick={() => setSelectedDish(dish)}>
                <div className="flex p-2 gap-3 min-h-[70px]">
                  <div className="w-16 h-16 shrink-0 relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                    {dish.image_url ? (<img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" loading="lazy" />) : (<div className="w-full h-full flex items-center justify-center"><Utensils className="w-5 h-5 text-slate-400" /></div>)}
                    {dish.allergens && dish.allergens.length > 0 && (<div className="absolute bottom-1 right-1 bg-amber-500/90 p-0.5 rounded"><Info className="w-2 h-2 text-white" /></div>)}
                  </div>
                  <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                    <div>
                      <h3 className="font-semibold text-sm leading-tight text-slate-900 dark:text-white truncate">{dish.name}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{dish.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">€{dish.price.toFixed(2)}</span>
                      <Button size="sm" className="h-7 w-7 rounded-full p-0 shadow-md bg-gradient-to-r from-emerald-500 to-teal-600 text-white" onClick={(e) => { e.stopPropagation(); setSelectedDish(dish) }}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredDishes.length === 0 && (<div className="text-center py-12 opacity-60"><Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-2" /><p className="text-xs">Nessun piatto trovato</p></div>)}
      </main>

      {/* Customer Cart Floating Bar */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-4 left-3 right-3 z-40 max-w-5xl mx-auto">
            <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
              <DrawerTrigger asChild>
                <Button className="w-full h-12 rounded-2xl shadow-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/25 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{cartCount}</div>
                    <span className="font-semibold text-sm">Carrello</span>
                  </div>
                  <span className="font-bold text-lg">€{cartTotal.toFixed(2)}</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-w-lg mx-auto max-h-[90vh] bg-background rounded-t-[20px]">
                <DrawerHeader className="border-b pb-2">
                  <DrawerTitle className="text-center text-base font-bold">Riepilogo Ordine</DrawerTitle>
                </DrawerHeader>
                <Tabs defaultValue="current" className="flex-1 overflow-hidden flex flex-col w-full">
                  <div className="px-4 pt-3">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="current" className="text-xs">Da Inviare ({cartCount})</TabsTrigger>
                      <TabsTrigger value="history" className="text-xs">Inviati ({previousOrders.length})</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="current" className="flex-1 overflow-hidden flex flex-col mt-0">
                    <ScrollArea className="flex-1 px-4 py-3">
                      <div className="space-y-4">
                        {courseNumbers.map((courseNum) => (
                          <div key={courseNum}>
                            <div className={`flex items-center gap-2 mb-2 pb-1 border-b-2 ${courseNum === 1 ? 'border-emerald-400' : courseNum === 2 ? 'border-amber-400' : 'border-purple-400'}`}>
                              <Layers className={`w-4 h-4 ${courseNum === 1 ? 'text-emerald-500' : courseNum === 2 ? 'text-amber-500' : 'text-purple-500'}`} />
                              <span className="font-bold text-xs uppercase tracking-wider">Portata {courseNum}</span>
                            </div>
                            <div className="space-y-2 pl-2">
                              {cartByCourse[courseNum]?.map((item) => (
                                <div key={item.cartId} className="flex items-center justify-between bg-card border rounded-lg p-2">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-primary/10 text-primary w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px]">{item.quantity}x</div>
                                    <div><p className="font-medium text-xs">{item.name}</p><p className="text-[10px] text-muted-foreground">€{(item.price * item.quantity).toFixed(2)}</p></div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {courseNumbers.length > 1 && (
                                      <div className="flex flex-col gap-0.5 mr-1">
                                        {item.courseNumber > 1 && <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveItemToCourse(item.cartId, item.courseNumber - 1)}><ChevronUp className="w-3 h-3" /></Button>}
                                        {item.courseNumber < maxCourse && <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveItemToCourse(item.cartId, item.courseNumber + 1)}><ChevronDown className="w-3 h-3" /></Button>}
                                      </div>
                                    )}
                                    <div className="flex items-center bg-muted/50 rounded p-0.5">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateCartItemQuantity(item.cartId, -1)}><Minus className="w-3 h-3" /></Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateCartItemQuantity(item.cartId, 1)}><Plus className="w-3 h-3" /></Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full h-9 text-xs gap-2 border-dashed border-2" onClick={addNewCourse}><Plus className="w-3 h-3" />Aggiungi Portata</Button>
                      </div>
                    </ScrollArea>
                    <div className="p-3 border-t bg-background/80 pb-6">
                      <div className="flex justify-between items-end mb-3"><span className="text-muted-foreground text-[10px] uppercase tracking-wider">Totale</span><span className="text-xl font-bold text-primary">€{cartTotal.toFixed(2)}</span></div>
                      <Button className="w-full h-10 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl" onClick={handleSubmitClick} disabled={isOrderSubmitting}>
                        {isOrderSubmitting ? 'Invio...' : <><ChefHat className="w-4 h-4 mr-2" />Invia Ordine</>}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col mt-0">
                    <ScrollArea className="flex-1 px-4 py-3">
                      {previousOrders.length === 0 ? (<div className="text-center py-10 text-muted-foreground"><Clock className="w-10 h-10 mb-2 opacity-20 mx-auto" /><p className="text-xs">Nessun ordine inviato</p></div>) : (
                        <div className="space-y-4">
                          {previousOrders.map((order) => (
                            <div key={order.id} className="pl-4 border-l-2 border-primary/20">
                              <div className="flex justify-between items-center bg-muted/30 p-1.5 rounded mb-2">
                                <span className="text-[10px] font-bold flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <Badge variant="outline" className={`text-[9px] h-4 ${order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{order.status === 'completed' ? 'OK' : 'In prep'}</Badge>
                              </div>
                              <div className="space-y-1">
                                {(order as any).items?.map((item: any, idx: number) => {
                                  const d = dishes?.find(dd => dd.id === item.dish_id)
                                  return (<div key={idx} className="text-xs flex justify-between"><span><span className="font-bold mr-1">{item.quantity}x</span>{d?.name}</span>{item.status === 'SERVED' && <CheckCircle className="w-3 h-3 text-green-600" />}</div>)
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </DrawerContent>
            </Drawer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer History Button */}
      <AnimatePresence>
        {cart.length === 0 && previousOrders.length > 0 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="fixed bottom-4 right-4 z-30">
            <Drawer>
              <DrawerTrigger asChild>
                <Button className="h-10 rounded-full shadow-lg bg-zinc-900 text-white px-4"><Clock className="w-4 h-4 mr-2" /><span className="text-xs font-semibold">Ordini</span></Button>
              </DrawerTrigger>
              <DrawerContent className="max-w-lg mx-auto max-h-[75vh]">
                <DrawerHeader><DrawerTitle className="text-sm">I tuoi ordini</DrawerTitle></DrawerHeader>
                <ScrollArea className="p-4 h-[55vh]">
                  {previousOrders.map((order) => (
                    <div key={order.id} className="mb-4 pb-3 border-b last:border-0">
                      <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className={order.status === 'completed' ? 'text-green-600' : 'text-orange-600'}>{order.status === 'completed' ? 'OK' : 'In prep'}</span></div>
                      <div className="space-y-1 pl-2">{(order as any).items?.map((item: any) => { const d = dishes?.find(dd => dd.id === item.dish_id); return (<div key={item.id} className="text-xs"><span className="font-bold mr-1">{item.quantity}x</span>{d?.name}</div>) })}</div>
                    </div>
                  ))}
                </ScrollArea>
                <div className="p-3 border-t"><div className="flex justify-between text-sm font-bold"><span>Totale</span><span>€{grandTotal.toFixed(2)}</span></div></div>
              </DrawerContent>
            </Drawer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dish Detail Dialog */}
      <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl">
          {selectedDish && (
            <>
              <div className="relative h-48 w-full">
                {selectedDish.image_url ? (<img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center"><Utensils className="w-12 h-12 text-slate-400" /></div>)}
                <Button variant="ghost" size="icon" className="absolute top-3 right-3 bg-black/50 text-white rounded-full h-8 w-8" onClick={() => setSelectedDish(null)}><X className="w-4 h-4" /></Button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12"><h2 className="text-xl font-bold text-white">{selectedDish.name}</h2><p className="text-white font-bold mt-1 text-lg">€{selectedDish.price.toFixed(2)}</p></div>
              </div>
              <div className="p-4 space-y-4">
                {selectedDish.description && (<div><h3 className="font-bold text-xs">Descrizione</h3><p className="text-xs text-muted-foreground mt-1">{selectedDish.description}</p></div>)}
                {selectedDish.allergens && selectedDish.allergens.length > 0 && (<div><h3 className="font-bold text-xs flex items-center gap-1"><Info className="w-3 h-3 text-amber-500" />Allergeni</h3><div className="flex flex-wrap gap-1 mt-1">{selectedDish.allergens.map(a => (<Badge key={a} className="text-[10px] bg-amber-100 text-amber-700">{a}</Badge>))}</div></div>)}
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Portata</label>
                  <div className="flex gap-2 mt-2">
                    {Array.from({ length: maxCourse }, (_, i) => i + 1).map((courseNum) => (
                      <button
                        key={courseNum}
                        onClick={() => setCurrentCourse(courseNum)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                          currentCourse === courseNum
                            ? courseNum === 1
                              ? 'bg-emerald-500 text-white shadow-md'
                              : courseNum === 2
                              ? 'bg-amber-500 text-white shadow-md'
                              : 'bg-purple-500 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {courseNum}ª
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const newCourse = maxCourse + 1
                        setMaxCourse(newCourse)
                        setCurrentCourse(newCourse)
                        toast.success(`Portata ${newCourse} aggiunta`)
                      }}
                      className="py-2 px-3 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Seleziona la portata in cui desideri questo piatto
                  </p>
                </div>
                <div><label className="text-[10px] font-bold uppercase text-muted-foreground">Note (opzionale)</label><Textarea placeholder="Es. Niente cipolla..." className="resize-none text-xs min-h-[60px] mt-1 rounded-xl" value={dishNote} onChange={(e) => setDishNote(e.target.value)} /></div>
              </div>
              <DialogFooter className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-t">
                <Button className="w-full h-11 font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white" onClick={() => addToCart(selectedDish, 1, dishNote)}>
                  Aggiungi alla {currentCourse}ª portata - €{selectedDish.price.toFixed(2)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Course Alert */}
      <Dialog open={showCourseAlert} onOpenChange={setShowCourseAlert}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Conferma ordine</DialogTitle><DialogDescription className="text-xs">Tutto arriverà insieme. Vuoi dividere in portate?</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" className="h-9 text-xs" onClick={() => { setShowCourseAlert(false); addNewCourse() }}>Sì, dividi in portate</Button>
            <Button className="h-9 text-xs bg-green-600 hover:bg-green-700" onClick={submitOrder} disabled={isOrderSubmitting}>{isOrderSubmitting ? 'Invio...' : 'No, invia tutto insieme'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi Course Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Conferma</DialogTitle></DialogHeader>
          <div className="py-2 bg-muted/50 rounded-lg p-3">
            {courseNumbers.map(n => (<p key={n} className="text-xs text-muted-foreground">• Portata {n}: {cartByCourse[n]?.length} piatti</p>))}
            <p className="text-sm font-bold pt-2 border-t mt-2">Totale: €{cartTotal.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
            <Button className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700" onClick={submitOrder} disabled={isOrderSubmitting}>{isOrderSubmitting ? 'Invio...' : 'Conferma'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
