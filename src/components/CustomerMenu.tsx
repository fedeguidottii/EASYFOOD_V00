import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
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
  AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Dish, Order, TableSession } from '../services/types'

interface CartItem extends Dish {
  cartId: string
  quantity: number
  notes?: string
}

interface CustomerMenuProps {
  tableId?: string
  onExit?: () => void
  interfaceMode?: 'customer' | 'waiter'
}

export default function CustomerMenu({ tableId: propTableId, onExit, interfaceMode = 'customer' }: CustomerMenuProps = {}) {
  // FIX: Recuperiamo i parametri in modo generico per gestire sia :tableId che :id
  const params = useParams()
  // Cerca l'ID in params.tableId O params.id O params.table_id
  const tableId = propTableId || params.tableId || params.id || params.table_id

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [session, setSession] = useState<TableSession | null>(null)
  const [previousOrders, setPreviousOrders] = useState<Order[]>([])
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dishNote, setDishNote] = useState('')

  // 0. Recupera l'ID Ristorante (FIX LOGICA CONNESSIONE)
  const initMenu = async () => {
    if (!tableId) {
      console.error("Parametri URL:", params) // Debug log
      setError("ID Tavolo mancante nel QR Code. Parametri URL non validi.")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Tentativo 1: Recupero diretto dal tavolo
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('restaurant_id')
        .eq('id', tableId)
        .single()

      if (tableData?.restaurant_id) {
        setRestaurantId(tableData.restaurant_id)
        return // Successo!
      }

      console.warn("Tentativo 1 (Table ID) fallito:", tableError)

      // Tentativo 2: Recupero da una sessione attiva (Fallback)
      const { data: sessionData, error: sessionError } = await supabase
        .from('table_sessions')
        .select('restaurant_id')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .limit(1)
        .maybeSingle()

      if (sessionData?.restaurant_id) {
        setRestaurantId(sessionData.restaurant_id)
        return // Successo via sessione
      }

      // Se arriviamo qui, non abbiamo trovato nulla
      throw new Error("Impossibile identificare il ristorante. Verifica che il tavolo esista nel sistema.")

    } catch (err: any) {
      console.error("Errore initMenu:", err)
      setError(err.message || "Errore di connessione")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initMenu()
  }, [tableId]) // Dipendenza corretta

  // Recupero Dati (Hooks Supabase - si attivano solo quando restaurantId è presente)
  const [categories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId || '' })

  // Ordinamento e Filtri
  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [categories])

  const filteredDishes = useMemo(() => {
    if (!dishes) return []
    let d = dishes.filter(dish => dish.is_active !== false)

    if (activeCategory !== 'all') {
      d = d.filter(dish => dish.category_id === activeCategory)
    }

    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase()
      d = d.filter(dish =>
        dish.name.toLowerCase().includes(lowerTerm) ||
        dish.description?.toLowerCase().includes(lowerTerm)
      )
    }
    return d
  }, [dishes, activeCategory, searchTerm])

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }, [cart])

  const cartCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }, [cart])

  const historyTotal = useMemo(() => {
    return previousOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
  }, [previousOrders])

  const grandTotal = cartTotal + historyTotal

  // Gestione Sessione e Storico Ordini
  useEffect(() => {
    if (!tableId) return

    const fetchSessionAndOrders = async () => {
      // FIX: Query più robusta per trovare la sessione
      const { data: sessions, error } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .limit(1)

      if (error) {
        console.error("Errore fetch sessione:", error)
        return
      }

      if (sessions && sessions.length > 0) {
        setSession(sessions[0])
        const { data: orders } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('table_session_id', sessions[0].id)
          .order('created_at', { ascending: false })

        if (orders) setPreviousOrders(orders as any[])
      } else {
        // Nessuna sessione attiva trovata
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

  // Azioni Carrello
  const addToCart = (dish: Dish, quantity: number = 1, notes: string = '') => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === dish.id && item.notes === notes)
      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex].quantity += quantity
        return newCart
      }
      return [...prev, { ...dish, cartId: crypto.randomUUID(), quantity, notes }]
    })

    if (quantity > 0) {
      toast.success(`Aggiunto: ${dish.name}`, {
        position: 'top-center',
        duration: 1500,
        style: { background: '#10B981', color: '#fff', border: 'none' }
      })
    }
    setSelectedDish(null)
    setDishNote('')
  }

  const updateCartItemQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const submitOrder = async () => {
    if (!session) {
      toast.error("Nessuna sessione attiva. Chiedi al cameriere di aprire il tavolo.")
      return
    }
    if (cart.length === 0 || !restaurantId) return

    setIsOrderSubmitting(true)
    try {
      const orderItems = cart.map(item => ({
        dish_id: item.id,
        quantity: item.quantity,
        note: item.notes || '',
        status: 'PENDING' as const
      }))

      await DatabaseService.createOrder({
        restaurant_id: restaurantId,
        table_session_id: session.id,
        status: 'OPEN',
        total_amount: cartTotal
      }, orderItems)

      setCart([])
      setIsCartOpen(false)
      toast.success('Ordine inviato in cucina! 👨‍🍳', {
        duration: 3000,
        style: { background: '#10B981', color: 'white' }
      })
    } catch (error) {
      console.error(error)
      toast.error('Errore invio ordine. Riprova.')
    } finally {
      setIsOrderSubmitting(false)
    }
  }

  // --- UI START ---

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-700">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Connessione al tavolo in corso...</p>
        </div>
      </div>
    )
  }

  if (error || !restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm border-none shadow-lg bg-card">
          <CardContent className="flex flex-col items-center text-center p-8 gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold">Impossibile accedere</h2>
            <p className="text-sm text-muted-foreground">
              {error || "Ristorante non trovato. Verifica che il QR Code sia corretto."}
            </p>
            {/* Debug Info in production can be helpful */}
            <p className="text-xs text-muted-foreground/50 font-mono mt-2">
              Ref: {tableId || 'No ID'}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full mt-2 gap-2">
              <RefreshCw className="w-4 h-4" />
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-28 font-sans select-none">

      {/* Header Elegante e Moderno */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 transition-all">
        <div className="max-w-5xl mx-auto px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/30">
                  <Utensils className="w-5 h-5 text-white" />
                </div>
                {session && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-xl leading-none tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Il Nostro Menu
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  {session ? (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Connesso
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">In attesa...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Search Bar Elegante */}
            <div className="relative w-40 transition-all focus-within:w-56 duration-300">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cerca..."
                className="h-10 pl-10 pr-3 text-sm bg-slate-100/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-2xl transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Categorie con stile elegante */}
          <ScrollArea className="w-full -mx-5 px-5 pb-2">
            <div className="flex gap-2.5 pb-2 min-w-max">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-sm ${
                  activeCategory === 'all'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 hover:scale-105'
                }`}
              >
                Tutti
              </button>
              {sortedCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-sm ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 hover:scale-105'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </header>

      {/* Lista Piatti con stile elegante */}
      <main className="p-4 space-y-4 max-w-5xl mx-auto">
        <AnimatePresence mode="popLayout">
          {filteredDishes.map((dish) => (
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Card
                className="overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-xl bg-white dark:bg-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer group"
                onClick={() => setSelectedDish(dish)}
              >
                <div className="flex p-3 gap-4 min-h-[100px]">

                  {/* Immagine Elegante */}
                  <div className="w-24 h-24 shrink-0 relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 shadow-inner">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}
                    {/* Badge Allergeni Elegante */}
                    {dish.allergens && dish.allergens.length > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 bg-amber-500/90 backdrop-blur-sm p-1 rounded-lg shadow-lg">
                        <Info className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info Piatto */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                    <div>
                      <h3 className="font-bold text-base leading-tight text-slate-900 dark:text-white truncate pr-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {dish.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {dish.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                        € {dish.price.toFixed(2)}
                      </span>

                      {/* Quick Add Button Elegante */}
                      <Button
                        size="sm"
                        className="h-9 w-9 rounded-full p-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition-all hover:scale-110 active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDish(dish)
                        }}
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredDishes.length === 0 && !isLoading && (
          <div className="text-center py-16 opacity-60">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Utensils className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nessun piatto trovato</p>
            <p className="text-xs text-muted-foreground">Prova a cambiare categoria</p>
          </div>
        )}
      </main>

      {/* Floating Bottom Bar - Carrello Elegante */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-4 right-4 z-40 max-w-5xl mx-auto"
          >
            <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
              <DrawerTrigger asChild>
                <Button
                  className="w-full h-16 rounded-3xl shadow-2xl shadow-emerald-500/30 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white hover:from-emerald-600 hover:via-teal-700 hover:to-emerald-700 flex items-center justify-between px-6 transition-all active:scale-95 border border-white/20 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-white/30 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center font-bold text-base text-white border-2 border-white/30 shadow-lg">
                      {cartCount}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-base">Il tuo Ordine</span>
                      <span className="text-xs opacity-90 font-medium">Tocca per vedere</span>
                    </div>
                  </div>
                  <span className="font-bold text-xl tracking-tight">€ {cartTotal.toFixed(2)}</span>
                </Button>
              </DrawerTrigger>

              <DrawerContent className="max-w-lg mx-auto max-h-[92vh] bg-background rounded-t-[20px]">
                <div className="flex flex-col h-full max-h-[85vh]">
                  <DrawerHeader className="border-b border-border/10 pb-2 shrink-0">
                    <DrawerTitle className="text-center text-lg font-bold">Riepilogo</DrawerTitle>
                    <DrawerDescription className="text-center text-xs">Gestisci il tuo ordine</DrawerDescription>
                  </DrawerHeader>

                  <Tabs defaultValue="current" className="flex-1 overflow-hidden flex flex-col w-full">
                    <div className="px-6 pt-4 shrink-0">
                      <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="current" className="text-xs">
                          Da Inviare ({cartCount})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">
                          Inviati ({previousOrders.length})
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Tab: Carrello Attuale */}
                    <TabsContent value="current" className="flex-1 overflow-hidden flex flex-col data-[state=active]:flex mt-0">
                      <ScrollArea className="flex-1 px-6 py-4">
                        {cart.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                            <ShoppingBasket className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm">Il carrello è vuoto</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {cart.map((item) => (
                              <div key={item.cartId} className="flex flex-col bg-card border border-border/40 rounded-xl p-3 shadow-sm gap-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="bg-primary/10 text-primary w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                                      {item.quantity}x
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm truncate">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">€ {(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/10">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-8 rounded-md p-0 hover:bg-background text-muted-foreground"
                                      onClick={() => updateCartItemQuantity(item.cartId, -1)}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-8 rounded-md p-0 hover:bg-background text-primary"
                                      onClick={() => updateCartItemQuantity(item.cartId, 1)}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                {item.notes && (
                                  <div className="text-[10px] text-orange-600 bg-orange-50/50 border border-orange-100 px-2 py-1.5 rounded-lg flex items-start gap-1.5">
                                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span className="italic">{item.notes}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      <div className="p-4 border-t border-border/10 bg-background/80 backdrop-blur-md shrink-0 safe-area-bottom pb-8">
                        <div className="flex justify-between items-end mb-4 px-2">
                          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Totale Stimato</span>
                          <span className="text-2xl font-bold text-primary">€ {cartTotal.toFixed(2)}</span>
                        </div>
                        <Button
                          className="w-full h-12 text-base font-bold shadow-lg bg-green-600 hover:bg-green-700 text-white rounded-xl active:scale-[0.98] transition-transform"
                          onClick={submitOrder}
                          disabled={isOrderSubmitting}
                        >
                          {isOrderSubmitting ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Invio ordine...
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <ChefHat className="w-5 h-5" />
                              Invia Ordine
                            </div>
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Tab: Storico Ordini */}
                    <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col mt-0">
                      <ScrollArea className="flex-1 px-6 py-4 h-full">
                        {previousOrders.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                            <Clock className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm">Ancora nessun ordine inviato</p>
                          </div>
                        ) : (
                          <div className="space-y-6 pb-6">
                            {previousOrders.map((order) => (
                              <div key={order.id} className="relative pl-5 border-l-2 border-primary/20">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                                <div className="mb-3 flex justify-between items-center bg-muted/30 p-2 rounded-lg border border-border/50">
                                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-5 border-none ${order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                                  >
                                    {order.status === 'completed' ? 'Completato' : 'In preparazione'}
                                  </Badge>
                                </div>

                                <div className="space-y-2">
                                  {(order as any).items?.map((item: any, idx: number) => {
                                    const dishDetails = dishes?.find(d => d.id === item.dish_id)
                                    return (
                                      <div key={idx} className="flex justify-between items-center text-sm pl-1">
                                        <div className="flex items-center gap-2.5">
                                          <span className="font-bold text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.quantity}x</span>
                                          <span className="text-sm font-medium text-foreground/90">{dishDetails?.name || 'Piatto eliminato'}</span>
                                        </div>
                                        {item.status === 'SERVED' ? (
                                          <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            Completato
                                          </span>
                                        ) : (
                                          <span className="text-orange-500 text-xs flex items-center gap-1">
                                            <ChefHat className="w-3.5 h-3.5" />
                                            In preparazione
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </DrawerContent>
            </Drawer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button Solo Storico (se carrello vuoto) */}
      <AnimatePresence>
        {cart.length === 0 && previousOrders.length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-6 right-6 z-30"
          >
            <Drawer>
              <DrawerTrigger asChild>
                <Button className="h-14 rounded-full shadow-xl bg-zinc-900 text-white border border-white/10 hover:bg-zinc-800 active:scale-95 transition-transform px-6 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-white" />
                  <span className="font-bold text-sm">Stato Ordine</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-w-lg mx-auto max-h-[80vh]">
                <DrawerHeader>
                  <DrawerTitle>I tuoi ordini precedenti</DrawerTitle>
                </DrawerHeader>
                <ScrollArea className="p-6 h-[60vh]">
                  {previousOrders.map((order) => (
                    <div key={order.id} className="mb-6 pb-4 border-b border-border/10 last:border-0">
                      <div className="flex justify-between text-sm mb-3 font-medium">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={order.status === 'completed' ? 'text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs' : 'text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-xs'}>
                          {order.status === 'completed' ? 'Completato' : 'In attesa'}
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {(order as any).items?.map((item: any) => {
                          const dish = dishes?.find(d => d.id === item.dish_id)
                          return (
                            <div key={item.id} className="text-sm text-muted-foreground flex justify-between items-center">
                              <span><span className="font-bold text-foreground mr-1">{item.quantity}x</span> {dish?.name}</span>
                              {item.status === 'SERVED' && (
                                <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Completato
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
                <div className="p-4 border-t border-border/10 bg-muted/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Totale Ordini Passati</span>
                    <span className="font-bold">€ {historyTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold text-primary">
                    <span>Totale Complessivo</span>
                    <span>€ {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup Dettagli Piatto Elegante */}
      <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl gap-0 rounded-3xl">
          {selectedDish && (
            <>
              <div className="relative h-72 w-full">
                {selectedDish.image_url ? (
                  <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                    <Utensils className="w-20 h-20 text-slate-400 dark:text-slate-600" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10 backdrop-blur-md transition-all shadow-lg hover:scale-110"
                  onClick={() => setSelectedDish(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-6 pt-20">
                  <h2 className="text-3xl font-bold text-white leading-tight">{selectedDish.name}</h2>
                  <p className="text-white font-bold mt-2 text-2xl">€ {selectedDish.price.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {selectedDish.description && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Descrizione</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedDish.description}
                    </p>
                  </div>
                )}

                {selectedDish.allergens && selectedDish.allergens.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                      <Info className="w-4 h-4 text-amber-500" />
                      Allergeni
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDish.allergens.map(allergen => (
                        <Badge key={allergen} className="text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 px-3 py-1">
                          {allergen}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-2">
                    Note per la cucina <span className="text-[10px] font-normal normal-case opacity-70">(Opzionale)</span>
                  </label>
                  <Textarea
                    placeholder="Es. Niente prezzemolo, cottura media..."
                    className="resize-none text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-500/50 min-h-[90px] rounded-2xl"
                    value={dishNote}
                    onChange={(e) => setDishNote(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="p-5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                <Button
                  className="w-full h-14 text-base font-bold shadow-xl rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition-all hover:scale-105 active:scale-95"
                  onClick={() => addToCart(selectedDish, 1, dishNote)}
                >
                  Aggiungi all'ordine - € {selectedDish.price.toFixed(2)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}