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

export default function CustomerMenu() {
  const { tableId } = useParams<{ tableId: string }>()
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
      setError("ID Tavolo mancante nel QR Code")
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

      console.warn("Tentativo 1 fallito:", tableError)

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
      throw new Error("Impossibile identificare il ristorante. Verifica che il tavolo esista o chiedi allo staff.")

    } catch (err: any) {
      console.error("Errore initMenu:", err)
      setError(err.message || "Errore di connessione")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initMenu()
  }, [tableId])

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

  // Gestione Sessione e Storico Ordini
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
      }
    }

    fetchSessionAndOrders()
    const channel = supabase
      .channel(`public:orders:table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchSessionAndOrders())
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
        notes: item.notes || '',
        price_at_time: item.price
      }))

      await DatabaseService.createOrder({
        restaurant_id: restaurantId,
        table_session_id: session.id,
        status: 'pending',
        total_amount: cartTotal,
        items: orderItems
      })

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
    <div className="min-h-screen bg-muted/5 pb-28 font-sans select-none">

      {/* Header Fisso */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/10 shadow-sm transition-all">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <Utensils className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-none tracking-tight">Menu</h1>
                <div className="flex items-center gap-1 mt-0.5">
                  {session ? (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Tavolo connesso
                    </span>
                  ) : (
                    <span className="text-[10px] text-orange-500 font-medium">In attesa apertura tavolo...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Search Bar Micro */}
            <div className="relative w-36 transition-all focus-within:w-48">
              <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca piatto..."
                className="h-8 pl-8 text-xs bg-muted/30 border-none focus-visible:ring-1 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Categorie Scroll orizzontale fluido */}
          <ScrollArea className="w-full -mx-4 px-4 pb-1">
            <div className="flex gap-2 pb-1 min-w-max">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${activeCategory === 'all'
                    ? 'bg-foreground text-background border-foreground shadow-sm scale-105'
                    : 'bg-background text-muted-foreground border-border/40 hover:bg-muted'
                  }`}
              >
                Tutti
              </button>
              {sortedCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${activeCategory === cat.id
                      ? 'bg-foreground text-background border-foreground shadow-sm scale-105'
                      : 'bg-background text-muted-foreground border-border/40 hover:bg-muted'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </header>

      {/* Lista Piatti */}
      <main className="p-3 space-y-3 max-w-lg mx-auto">
        <AnimatePresence mode="popLayout">
          {filteredDishes.map((dish) => (
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className="overflow-hidden border-none shadow-sm bg-card hover:bg-muted/5 active:scale-[0.99] transition-all cursor-pointer group"
                onClick={() => setSelectedDish(dish)}
              >
                {/* Card Compatta: Immagine a sx, testo a dx */}
                <div className="flex p-2 gap-3 h-[88px]">

                  {/* Immagine */}
                  <div className="w-[88px] h-full shrink-0 relative rounded-lg overflow-hidden bg-muted/20">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils className="w-6 h-6 text-muted-foreground/20" />
                      </div>
                    )}
                    {/* Badge Allergeni */}
                    {dish.allergens && dish.allergens.length > 0 && (
                      <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-[2px] p-0.5 rounded text-[8px] text-white">
                        <Info className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                    <div>
                      <h3 className="font-bold text-sm leading-tight text-foreground truncate pr-2">
                        {dish.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1 leading-snug">
                        {dish.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <span className="font-bold text-sm text-foreground">
                        € {dish.price.toFixed(2)}
                      </span>

                      {/* Quick Add Button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 rounded-full p-0 shadow-sm bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          addToCart(dish)
                        }}
                      >
                        <Plus className="w-4 h-4" />
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

      {/* Floating Bottom Bar - CARRELLO UNIFICATO */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto"
          >
            <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
              <DrawerTrigger asChild>
                <Button
                  className="w-full h-14 rounded-2xl shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-between px-5 transition-all active:scale-95 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white border border-white/20">
                      {cartCount}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-sm">Il tuo Ordine</span>
                      <span className="text-[10px] opacity-80 font-normal">Clicca per rivedere</span>
                    </div>
                  </div>
                  <span className="font-bold text-lg tracking-tight">€ {cartTotal.toFixed(2)}</span>
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
                                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                        ) : (
                                          <ChefHat className="w-4 h-4 text-orange-400 opacity-60 shrink-0" />
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
                <Button size="icon" className="h-14 w-14 rounded-full shadow-xl bg-background border border-border text-foreground hover:bg-muted active:scale-95 transition-transform">
                  <Clock className="w-6 h-6 text-primary" />
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
                          {order.status === 'completed' ? 'Servito' : 'In attesa'}
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {(order as any).items?.map((item: any) => {
                          const dish = dishes?.find(d => d.id === item.dish_id)
                          return (
                            <div key={item.id} className="text-sm text-muted-foreground flex justify-between items-center">
                              <span><span className="font-bold text-foreground mr-1">{item.quantity}x</span> {dish?.name}</span>
                              {item.status === 'SERVED' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </DrawerContent>
            </Drawer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup Dettagli Piatto */}
      <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-none gap-0">
          {selectedDish && (
            <>
              <div className="relative h-64 w-full">
                {selectedDish.image_url ? (
                  <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Utensils className="w-16 h-16 text-muted-foreground/20" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9 backdrop-blur-sm transition-colors"
                  onClick={() => setSelectedDish(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 pt-16">
                  <h2 className="text-2xl font-bold text-white leading-tight">{selectedDish.name}</h2>
                  <p className="text-white/90 font-medium mt-1 text-lg">€ {selectedDish.price.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {selectedDish.description && (
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-sm text-foreground/80">Descrizione</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedDish.description}
                    </p>
                  </div>
                )}

                {selectedDish.allergens && selectedDish.allergens.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                      <Info className="w-4 h-4 text-orange-500" />
                      Allergeni
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDish.allergens.map(allergen => (
                        <Badge key={allergen} variant="outline" className="text-xs font-medium border-orange-200 text-orange-700 bg-orange-50 px-2.5 py-0.5">
                          {allergen}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    Note per la cucina <span className="text-[10px] font-normal normal-case opacity-70">(Opzionale)</span>
                  </label>
                  <Textarea
                    placeholder="Es. Niente prezzemolo, cottura media..."
                    className="resize-none text-sm bg-muted/30 border-border/50 focus:border-primary/50 min-h-[80px]"
                    value={dishNote}
                    onChange={(e) => setDishNote(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="p-4 bg-muted/10 border-t border-border/5">
                <Button
                  className="w-full h-12 text-base font-bold shadow-md rounded-xl"
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