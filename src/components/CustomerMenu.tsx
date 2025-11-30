import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
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
  X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Dish, Order, TableSession } from '../services/types'

// Interfaccia estesa per gestire note e ID univoci nel carrello
interface CartItem extends Dish {
  cartId: string
  quantity: number
  notes?: string
}

export default function CustomerMenu() {
  const { restaurantId, tableId } = useParams<{ restaurantId: string; tableId: string }>()
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [session, setSession] = useState<TableSession | null>(null)
  const [previousOrders, setPreviousOrders] = useState<Order[]>([])
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null) // Per il popup dettagli
  const [dishNote, setDishNote] = useState('') // Nota temporanea nel popup

  // Recupero Dati
  const [categories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId })
  const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId })

  // 1. Ordinamento Categorie (Cruciale: rispetta l'ordine del backend)
  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [categories])

  // 2. Filtro Piatti (Categoria + Ricerca + Attivi)
  const filteredDishes = useMemo(() => {
    let d = dishes || []
    d = d.filter(dish => dish.is_active !== false) // Mostra solo piatti attivi

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

  // Totali
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }, [cart])

  const cartCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }, [cart])

  // Inizializzazione Sessione
  useEffect(() => {
    if (!tableId) return

    const fetchSession = async () => {
      // Cerca sessione aperta
      const { data: sessions } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .limit(1)

      if (sessions && sessions.length > 0) {
        setSession(sessions[0])

        // Carica ordini precedenti
        const { data: orders } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('table_session_id', sessions[0].id)
          .order('created_at', { ascending: false })

        if (orders) setPreviousOrders(orders as any[])
      }
    }

    fetchSession()

    // Realtime: Ascolta cambiamenti sugli ordini (es. cucina accetta ordine)
    const channel = supabase
      .channel(`public:orders:table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchSession())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId])

  // --- Gestione Carrello ---

  const addToCart = (dish: Dish, quantity: number = 1, notes: string = '') => {
    setCart(prev => {
      // Se esiste già lo stesso piatto SENZA note, aumenta quantità
      const existingIndex = prev.findIndex(item => item.id === dish.id && item.notes === notes)

      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex].quantity += quantity
        return newCart
      }

      // Altrimenti aggiungi nuovo item
      return [...prev, {
        ...dish,
        cartId: crypto.randomUUID(),
        quantity,
        notes
      }]
    })

    if (quantity > 0) {
      toast.success(`Aggiunto: ${dish.name}`, {
        position: 'top-center',
        duration: 1500,
        style: { background: '#10B981', color: '#fff', border: 'none' }
      })
    }
    setSelectedDish(null) // Chiudi popup se aperto
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

  const removeCartItem = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId))
  }

  const submitOrder = async () => {
    if (!session || cart.length === 0) return

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
      toast.error('Errore invio ordine')
    } finally {
      setIsOrderSubmitting(false)
    }
  }

  // --- UI Components ---

  return (
    <div className="min-h-screen bg-muted/5 pb-28 font-sans select-none">

      {/* Header Fisso: Titolo + Ricerca + Categorie */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/10 shadow-sm">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-lg shadow-sm">
                <Utensils className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-none">Menu Digitale</h1>
                {session && <span className="text-[10px] text-muted-foreground">Tavolo connesso</span>}
              </div>
            </div>

            {/* Barra Ricerca Compatta */}
            <div className="relative w-32 sm:w-48 transition-all focus-within:w-40 sm:focus-within:w-56">
              <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca..."
                className="h-7 pl-7 text-xs bg-muted/20 border-none focus-visible:ring-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Categorie Scrollabili */}
          <ScrollArea className="w-full -mx-4 px-4">
            <div className="flex gap-2 pb-2 min-w-max">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${activeCategory === 'all'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border/40 hover:bg-muted'
                  }`}
              >
                Tutti
              </button>
              {sortedCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${activeCategory === cat.id
                      ? 'bg-foreground text-background border-foreground shadow-sm'
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
      <main className="p-4 space-y-3 max-w-lg mx-auto">
        <AnimatePresence mode="popLayout">
          {filteredDishes.map((dish) => (
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <Card
                className="overflow-hidden border-none shadow-sm bg-card hover:bg-muted/10 transition-colors cursor-pointer group"
                onClick={() => setSelectedDish(dish)}
              >
                <div className="flex p-2 gap-3 h-[90px]"> {/* Altezza ridotta fissa */}

                  {/* Immagine (1:1 o quasi, arrotondata) */}
                  <div className="w-[85px] h-full shrink-0 relative rounded-lg overflow-hidden bg-muted/20">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Badge Allergeni Mini */}
                    {dish.allergens && dish.allergens.length > 0 && (
                      <div className="absolute bottom-1 right-1 bg-black/50 backdrop-blur-[2px] p-0.5 rounded text-[8px] text-white">
                        <Info className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Info Piatto */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                    <div>
                      <h3 className="font-bold text-sm leading-tight text-foreground truncate pr-4">
                        {dish.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                        {dish.description}
                      </p>
                    </div>

                    <div className="flex items-end justify-between">
                      <span className="font-bold text-sm text-foreground">
                        € {dish.price.toFixed(2)}
                      </span>

                      {/* Tasto Quick Add (+), senza aprire dettagli se uno vuole fare veloce */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 rounded-full p-0 shadow-sm bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all"
                        onClick={(e) => {
                          e.stopPropagation() // Non aprire popup dettagli
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

        {filteredDishes.length === 0 && (
          <div className="text-center py-12 opacity-60">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Utensils className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nessun piatto trovato</p>
            <p className="text-xs text-muted-foreground">Prova a cambiare categoria o ricerca</p>
          </div>
        )}
      </main>

      {/* Floating Bottom Bar (Carrello & Storico Unificati) */}
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
                    <div className="bg-background/20 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white">
                      {cartCount}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-sm">Vedi ordine</span>
                      <span className="text-[10px] opacity-80 font-normal">Clicca per completare</span>
                    </div>
                  </div>
                  <span className="font-bold text-lg">€ {cartTotal.toFixed(2)}</span>
                </Button>
              </DrawerTrigger>

              <DrawerContent className="max-w-lg mx-auto max-h-[90vh] bg-background">
                <div className="flex flex-col h-full max-h-[85vh]">
                  <DrawerHeader className="border-b border-border/10 pb-2 shrink-0">
                    <DrawerTitle className="text-center text-lg font-bold">Riepilogo Ordine</DrawerTitle>
                    <DrawerDescription className="text-center text-xs">Controlla prima di inviare</DrawerDescription>
                  </DrawerHeader>

                  <Tabs defaultValue="current" className="flex-1 overflow-hidden flex flex-col w-full">
                    <div className="px-4 pt-2 shrink-0">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="current" className="text-xs">
                          Carrello ({cartCount})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">
                          Storico ({previousOrders.length})
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Tab: Carrello Attuale */}
                    <TabsContent value="current" className="flex-1 overflow-hidden flex flex-col data-[state=active]:flex mt-0">
                      <ScrollArea className="flex-1 px-4 py-4">
                        {cart.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                            <ShoppingBasket className="w-12 h-12 mb-2 opacity-20" />
                            <p className="text-sm">Il carrello è vuoto</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {cart.map((item) => (
                              <div key={item.cartId} className="flex flex-col bg-card border border-border/40 rounded-xl p-3 shadow-sm gap-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    {/* Quantità Badge */}
                                    <div className="bg-primary/10 text-primary w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0">
                                      {item.quantity}x
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm truncate">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">€ {(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                  </div>

                                  {/* Controlli Quantità */}
                                  <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/10">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 rounded-md p-0 hover:bg-background text-muted-foreground"
                                      onClick={() => updateCartItemQuantity(item.cartId, -1)}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 rounded-md p-0 hover:bg-background text-primary"
                                      onClick={() => updateCartItemQuantity(item.cartId, 1)}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                {item.notes && (
                                  <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded flex items-start gap-1">
                                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                    Nota: {item.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      <div className="p-4 border-t border-border/10 bg-background/50 backdrop-blur-sm shrink-0 safe-area-bottom">
                        <div className="flex justify-between items-end mb-4">
                          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Totale</span>
                          <span className="text-2xl font-bold text-primary">€ {cartTotal.toFixed(2)}</span>
                        </div>
                        <Button
                          className="w-full h-12 text-base font-bold shadow-lg bg-green-600 hover:bg-green-700 text-white rounded-xl"
                          onClick={submitOrder}
                          disabled={isOrderSubmitting}
                        >
                          {isOrderSubmitting ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Invio in corso...
                            </div>
                          ) : 'Conferma e Invia Ordine'}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Tab: Storico Ordini (Ex "Miei Ordini") */}
                    <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col mt-0">
                      <ScrollArea className="flex-1 px-4 py-4 h-full">
                        {previousOrders.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                            <Clock className="w-12 h-12 mb-2 opacity-20" />
                            <p className="text-sm">Nessun ordine precedente</p>
                          </div>
                        ) : (
                          <div className="space-y-6 pb-6">
                            {previousOrders.map((order) => (
                              <div key={order.id} className="relative pl-4 border-l-2 border-primary/20">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                                <div className="mb-3 flex justify-between items-center bg-muted/20 p-2 rounded-lg">
                                  <span className="text-xs font-bold text-foreground">
                                    Ore {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <Badge
                                    variant={order.status === 'completed' ? 'secondary' : 'outline'}
                                    className={`text-[10px] h-5 ${order.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-none' : 'border-primary/30 text-primary'}`}
                                  >
                                    {order.status === 'completed' ? 'Completato' : 'In preparazione'}
                                  </Badge>
                                </div>

                                <div className="space-y-2">
                                  {(order as any).items?.map((item: any, idx: number) => {
                                    const dishDetails = dishes?.find(d => d.id === item.dish_id)
                                    return (
                                      <div key={idx} className="flex justify-between items-center text-sm pl-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.quantity}x</span>
                                          <span className="text-sm text-foreground/80">{dishDetails?.name || 'Piatto'}</span>
                                        </div>
                                        {item.status === 'SERVED' ? (
                                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                        ) : (
                                          <ChefHat className="w-3.5 h-3.5 text-orange-400 opacity-60" />
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

      {/* Floating Button Solo Storico (se carrello vuoto ma esistono ordini) */}
      <AnimatePresence>
        {cart.length === 0 && previousOrders.length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-4 right-4 z-30"
          >
            <Drawer>
              <DrawerTrigger asChild>
                <Button size="icon" className="h-12 w-12 rounded-full shadow-lg bg-background border border-border text-foreground hover:bg-muted">
                  <Clock className="w-5 h-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-w-lg mx-auto max-h-[80vh]">
                <DrawerHeader>
                  <DrawerTitle>I tuoi ordini precedenti</DrawerTitle>
                </DrawerHeader>
                <ScrollArea className="p-4 h-[60vh]">
                  {previousOrders.map((order) => (
                    <div key={order.id} className="mb-6 pb-4 border-b border-border/10 last:border-0">
                      <div className="flex justify-between text-sm mb-2 font-medium">
                        <span>Ore {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={order.status === 'completed' ? 'text-green-600' : 'text-orange-500'}>
                          {order.status === 'completed' ? 'Servito' : 'In attesa'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {(order as any).items?.map((item: any) => {
                          const dish = dishes?.find(d => d.id === item.dish_id)
                          return (
                            <div key={item.id} className="text-sm text-muted-foreground flex justify-between">
                              <span>{item.quantity}x {dish?.name}</span>
                              {item.status === 'SERVED' && <CheckCircle className="w-3 h-3 text-green-500" />}
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
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-none">
          {selectedDish && (
            <>
              <div className="relative h-56 w-full">
                {selectedDish.image_url ? (
                  <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Utensils className="w-12 h-12 text-muted-foreground/20" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8 backdrop-blur-sm"
                  onClick={() => setSelectedDish(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                  <h2 className="text-xl font-bold text-white leading-tight">{selectedDish.name}</h2>
                  <p className="text-white/90 font-medium mt-1">€ {selectedDish.price.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Descrizione</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedDish.description || "Nessuna descrizione disponibile."}
                  </p>
                </div>

                {selectedDish.allergens && selectedDish.allergens.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Info className="w-4 h-4 text-orange-500" />
                      Allergeni
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDish.allergens.map(allergen => (
                        <Badge key={allergen} variant="outline" className="text-xs font-normal border-orange-200 text-orange-700 bg-orange-50">
                          {allergen}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Note per la cucina</label>
                  <Textarea
                    placeholder="Es. Niente prezzemolo, cottura media..."
                    className="resize-none text-sm bg-muted/20"
                    rows={2}
                    value={dishNote}
                    onChange={(e) => setDishNote(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="p-4 bg-muted/10">
                <Button
                  className="w-full h-11 text-base font-bold shadow-md"
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