import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Table, Dish, Order, Category, Restaurant } from '../services/types'
import { useRestaurantLogic } from '../hooks/useRestaurantLogic'
import {
  ChefHat,
  Plus,
  Minus,
  ShoppingCart,
  X,
  Check,
  Lock,
  Eye,
  EyeSlash
} from '@phosphor-icons/react'

interface Props {
  tableId: string
  onExit: () => void
}

interface CartItem {
  menuItemId: string
  quantity: number
  notes?: string
  instanceId?: string
}

export default function CustomerMenu({ tableId, onExit }: Props) {
  const [tables] = useSupabaseData<Table>('tables', [])
  const [dishes] = useSupabaseData<Dish>('dishes', [])
  const [categories] = useSupabaseData<Category>('categories', [])
  const [restaurants] = useSupabaseData<Restaurant>('restaurants', [])

  // Find the table first to get the restaurant ID
  const table = tables?.find(t => t.id === tableId)
  const restaurant = restaurants?.find(r => r.id === table?.restaurant_id)
  const ayceSettings = restaurant?.allYouCanEat || restaurant?.all_you_can_eat
  const isAyceEnabled = ayceSettings?.enabled
  const maxAyceOrders = ayceSettings?.maxOrders || 0

  // Use restaurant-specific key for orders
  const { createOrder } = useRestaurantLogic(table?.restaurant_id || '')

  const [activeSession, setActiveSession] = useState<any>(null)
  const [sessionOrderCount, setSessionOrderCount] = useState(0)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const restaurantDishes = dishes?.filter(d =>
    d.restaurant_id === table?.restaurant_id && d.is_active
  ) || []

  const restaurantCategories = categories?.filter(cat =>
    cat.restaurant_id === table?.restaurant_id
  ).sort((a, b) => a.order - b.order) || []

  // Filter items based on selected category
  const filteredItems = selectedCategory === 'all'
    ? restaurantDishes
    : restaurantDishes.filter(item => {
      const cat = restaurantCategories.find(c => c.id === item.category_id)
      return cat?.name === selectedCategory
    })

  // Calculate different totals for display
  const cartCalculations = {
    // Items that are charged normally (excluded from AYCE or AYCE disabled)
    regularTotal: cartItems.reduce((total, cartItem) => {
      const dish = restaurantDishes.find(d => d.id === cartItem.dish_id)
      // Assuming no AYCE exclusion logic for now as it's not in Dish type
      if (dish && (!isAyceEnabled)) {
        return total + dish.price * cartItem.quantity
      }
      // If AYCE is enabled, everything is included unless specified otherwise (logic to be added if needed)
      // For now, if AYCE enabled, price is 0 for AYCE items? Or just total is 0?
      // User request implied AYCE logic. Let's assume standard price if not AYCE.
      if (dish && isAyceEnabled) {
        return total // Price is 0 for AYCE items
      }
      return total + (dish?.price || 0) * cartItem.quantity
    }, 0),

    // Cover charge
    coverCharge: table?.seats && restaurant?.coverChargePerPerson // Using seats as customer count proxy if customerCount missing
      ? restaurant.coverChargePerPerson * table.seats // simplified
      : 0,

    // All you can eat charge (only for first order typically)
    allYouCanEatCharge: isAyceEnabled && table?.seats
      ? (ayceSettings?.pricePerPerson || 0) * table.seats
      : 0,

    // Free items (included in AYCE)
    freeItems: cartItems.filter(cartItem => {
      const dish = restaurantDishes.find(d => d.id === cartItem.dish_id)
      return dish && isAyceEnabled
    })
  }

  // Legacy cart total for compatibility
  const cartTotal = cartCalculations.regularTotal

  const remainingOrders = isAyceEnabled && maxAyceOrders
    ? Math.max(maxAyceOrders - sessionOrderCount, 0)
    : null

  // Check PIN on mount and fetch session
  useEffect(() => {
    if (tableId) {
      DatabaseService.getActiveSession(tableId).then(session => {
        if (session) {
          setActiveSession(session)
          // Removed internal PIN check, rely on ClientTableAccess
          setIsPinVerified(true)

          // Subscribe to cart items
          DatabaseService.getCartItems(session.id).then(setCartItems)

          const channel = supabase
            .channel('cart_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `session_id=eq.${session.id}` }, () => {
              DatabaseService.getCartItems(session.id).then(setCartItems)
            })
            .subscribe()

          return () => {
            supabase.removeChannel(channel)
          }
        }
      })
    }
  }, [tableId])

  useEffect(() => {
    const fetchOrderCount = async () => {
      if (activeSession?.id && isAyceEnabled) {
        try {
          const count = await DatabaseService.getSessionOrderCount(activeSession.id)
          setSessionOrderCount(count)
        } catch (error) {
          console.error('Errore nel recupero del numero di ordini', error)
        }
      }
    }

    fetchOrderCount()
  }, [activeSession?.id, isAyceEnabled])

  const handlePinVerification = () => {
    if (activeSession && enteredPin === activeSession.session_pin) {
      setIsPinVerified(true)
      setShowPinDialog(false)
      toast.success(`Benvenuto al ${table?.name || 'Tavolo'}!`)
    } else {
      toast.error('PIN non corretto')
    }
  }

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  const openAddDialog = (dish: Dish) => {
    setSelectedDish(dish)
    setItemQuantity(1)
    setItemNotes('')
    setShowAddDialog(true)
  }

  const confirmAddToCart = async () => {
    if (!activeSession || !selectedDish) return

    await DatabaseService.addToCart({
      session_id: activeSession.id,
      dish_id: selectedDish.id,
      quantity: itemQuantity,
      notes: itemNotes
    })
    toast.success('Aggiunto al carrello')
    setShowAddDialog(false)
  }

  const removeFromCart = async (itemId: string) => {
    await DatabaseService.removeFromCart(itemId)
  }

  const updateQuantity = async (itemId: string, delta: number) => {
    const item = cartItems.find(i => i.id === itemId)
    if (item) {
      const newQuantity = item.quantity + delta
      if (newQuantity > 0) {
        await DatabaseService.updateCartItem(itemId, { quantity: newQuantity })
      } else {
        await DatabaseService.removeFromCart(itemId)
      }
    }
  }

  const updateItemNotes = async (itemId: string, notes: string) => {
    await DatabaseService.updateCartItem(itemId, { notes })
  }

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Il carrello è vuoto')
      return
    }

    // Check all-you-can-eat limits
    if (isAyceEnabled && activeSession?.id) {
      const latestCount = await DatabaseService.getSessionOrderCount(activeSession.id)
      setSessionOrderCount(latestCount)

      if (maxAyceOrders && latestCount >= maxAyceOrders) {
        toast.error('Hai raggiunto il limite massimo di ordini per All You Can Eat')
        return
      }
    }

    // Calculate costs based on restaurant settings
    let coverCharge = 0
    let allYouCanEatCharge = 0
    let regularTotal = 0

    if (table?.customerCount && restaurant?.coverChargePerPerson) {
      coverCharge = restaurant.coverChargePerPerson * table.customerCount
    }

    if (isAyceEnabled && table?.customerCount) {
      allYouCanEatCharge = (ayceSettings?.pricePerPerson || 0) * table.customerCount
    }

    // Calculate regular items
    cartItems.forEach(cartItem => {
      const dish = restaurantDishes.find(d => d.id === cartItem.dish_id)
      if (dish) {
        if (!isAyceEnabled || dish.excludeFromAllYouCanEat) {
          regularTotal += dish.price * cartItem.quantity
        }
      }
    })

    // Create order items from cart
    const orderItems = cartItems.map((item) => {
      return {
        dish_id: item.dish_id,
        quantity: item.quantity,
        note: item.notes,
      }
    })

    createOrder(activeSession.table_id, orderItems)
      .then(async () => {
        await DatabaseService.clearCart(activeSession.id)
        setCartItems([])
        setShowCart(false)
        if (isAyceEnabled) {
          setSessionOrderCount(count => count + 1)
        }
        toast.success('Ordine inviato in cucina!')
      })
      .catch((error) => {
        console.error('Error creating order:', error)
        toast.error('Errore durante l\'invio dell\'ordine')
      })
  }

  const getItemQuantityInCart = (menuItemId: string) => {
    const item = cartItems.find(i => i.dish_id === menuItemId)
    return item ? item.quantity : 0
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md shadow-liquid-lg bg-order-card">
          <CardHeader>
            <CardTitle>Tavolo non trovato</CardTitle>
            <CardDescription>Il tavolo richiesto non esiste o non è attivo</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onExit} className="w-full bg-liquid-gradient shadow-liquid">
              Torna alla Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isPinVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-liquid-lg bg-order-card">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold text-primary flex items-center justify-center gap-2">
              <Lock size={32} />
              Accesso Tavolo
            </CardTitle>
            <CardDescription className="text-center">
              Inserisci il PIN temporaneo per ordinare dal {table.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN Temporaneo</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="Inserisci PIN"
                  className="pr-10 shadow-liquid text-center text-2xl font-bold"
                  maxLength={4}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeSlash size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            <Button
              onClick={handlePinVerification}
              className="w-full bg-liquid-gradient shadow-liquid text-lg font-bold py-3"
              disabled={!enteredPin}
            >
              <Check size={20} className="mr-2" />
              Accedi al Menù
            </Button>
            <Button variant="outline" onClick={onExit} className="w-full">
              Torna Indietro
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border/20 shadow-professional">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <ChefHat size={28} />
                {table.name}
              </h1>
              <p className="text-sm text-muted-foreground">Menu Digitale</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onExit}
                className="border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          {/* Category Filters - Scrollable horizontal */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className={`flex-shrink-0 px-4 ${selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-gold'
                : 'hover:bg-secondary'
                }`}
            >
              Tutti
            </Button>
            {restaurantCategories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.name ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex-shrink-0 px-4 whitespace-nowrap ${selectedCategory === cat.name
                  ? 'bg-primary text-primary-foreground shadow-gold'
                  : 'hover:bg-secondary'
                  }`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Menu Items Grid - No Category Titles */}
        {/* Menu Items List - Vertical Layout */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {filteredItems.map((item) => {
            const quantityInCart = getItemQuantityInCart(item.id)

            return (
              <Card key={item.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 bg-card border-border/50">
                <div className="flex flex-row h-32 sm:h-40">
                  {/* Image Section */}
                  <div className="w-32 sm:w-48 shrink-0 relative">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                        <ChefHat size={32} />
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-base sm:text-lg text-foreground line-clamp-1">{item.name}</h3>
                        <span className="font-bold text-primary whitespace-nowrap">
                          {isAyceEnabled && !item.excludeFromAllYouCanEat
                            ? 'Incluso'
                            : `€${item.price.toFixed(2)}`
                          }
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {isAyceEnabled && !item.excludeFromAllYouCanEat && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs bg-green-100 text-green-800 border-green-200">
                          AYCE
                        </Badge>
                      )}
                      <Button
                        onClick={() => openAddDialog(item)}
                        size="sm"
                        className="ml-auto bg-primary hover:bg-primary/90 shadow-sm h-8 sm:h-9"
                      >
                        <Plus size={14} className="mr-1" />
                        Aggiungi {quantityInCart > 0 && `(${quantityInCart})`}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <ChefHat size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">Nessun piatto disponibile al momento</p>
          </div>
        )}
      </main>

      {/* Fixed Cart Button */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setShowCart(true)}
      >
        <div className="relative">
          <ShoppingCart size={24} weight="fill" />
          {cartItems.length > 0 && (
            <Badge className="absolute -top-3 -right-3 h-5 w-5 flex items-center justify-center p-0 rounded-full bg-red-500 hover:bg-red-600">
              {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
            </Badge>
          )}
        </div>
      </Button>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        {/* Cart Dialog */}
        <Dialog open={showCart} onOpenChange={setShowCart}>
          <DialogContent className="max-w-md bg-background border border-border shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Il Tuo Ordine</DialogTitle>
              <DialogDescription>
                Controlla i piatti selezionati prima di inviare l'ordine
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cartItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Il carrello è vuoto
                </div>
              ) : (
                cartItems.map(item => {
                  const dish = restaurantDishes.find(d => d.id === item.dish_id)
                  if (!dish) return null

                  return (
                    <div key={item.id} className="flex gap-4 bg-muted/30 p-3 rounded-lg">
                      {dish.image_url && (
                        <img
                          src={dish.image_url}
                          alt={dish.name}
                          className="w-16 h-16 rounded-md object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold">{dish.name}</h4>
                          <span className="font-medium">€{(dish.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-2 bg-background rounded-md border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive ml-auto"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                        <Input
                          placeholder="Note per la cucina..."
                          className="mt-2 h-8 text-xs bg-background"
                          value={item.notes || ''}
                          onChange={(e) => updateItemNotes(item.id, e.target.value)}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2 mb-4">
                {/* Regular items */}
                {cartCalculations.regularTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Piatti:</span>
                    <span>€{cartCalculations.regularTotal.toFixed(2)}</span>
                  </div>
                )}

                {/* Cover charge */}
                {cartCalculations.coverCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Coperto ({table?.customerCount} persone):</span>
                    <span>€{cartCalculations.coverCharge.toFixed(2)}</span>
                  </div>
                )}

                {/* All You Can Eat charge */}
                {cartCalculations.allYouCanEatCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>All You Can Eat ({table?.customerCount} persone):</span>
                    <span>€{cartCalculations.allYouCanEatCharge.toFixed(2)}</span>
                  </div>
                )}

                {remainingOrders !== null && (
                  <div className="text-sm text-center p-2 bg-blue-50 rounded">
                    Ordini rimasti: {remainingOrders}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-xl">Totale:</span>
                <span className="font-bold text-primary text-2xl">
                  €{(cartCalculations.regularTotal + cartCalculations.coverCharge + cartCalculations.allYouCanEatCharge).toFixed(2)}
                </span>
              </div>
              <Button
                onClick={handlePlaceOrder}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg py-3 shadow-liquid-lg"
                disabled={remainingOrders !== null && remainingOrders <= 0}
              >
                <Check size={20} className="mr-2" />
                {remainingOrders !== null && remainingOrders <= 0
                  ? 'Limite ordini raggiunto'
                  : 'Invia Ordine'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Dialog>

      {/* Add to Cart Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm bg-background">
          <DialogHeader>
            <DialogTitle>Aggiungi al carrello</DialogTitle>
            <DialogDescription>
              {selectedDish?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
              >
                <Minus size={16} />
              </Button>
              <span className="text-2xl font-bold w-8 text-center">{itemQuantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setItemQuantity(itemQuantity + 1)}
              >
                <Plus size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Note per la cucina (opzionale)</Label>
              <Textarea
                placeholder="Es. Senza cipolla, ben cotto..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="resize-none"
              />
            </div>
            <Button onClick={confirmAddToCart} className="w-full font-bold text-lg">
              Conferma Aggiunta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}