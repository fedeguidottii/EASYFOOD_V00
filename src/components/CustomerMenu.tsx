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

  // Use restaurant-specific key for orders
  const { createOrder } = useRestaurantLogic(table?.restaurant_id || '')

  const [cart, setCart] = useState<CartItem[]>([])
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
    regularTotal: cart.reduce((total, cartItem) => {
      const dish = restaurantDishes.find(d => d.id === cartItem.menuItemId)
      // Assuming no AYCE exclusion logic for now as it's not in Dish type
      if (dish && (!restaurant?.allYouCanEat?.enabled)) {
        return total + dish.price * cartItem.quantity
      }
      // If AYCE is enabled, everything is included unless specified otherwise (logic to be added if needed)
      // For now, if AYCE enabled, price is 0 for items? Or just total is 0?
      // User request implied AYCE logic. Let's assume standard price if not AYCE.
      if (dish && restaurant?.allYouCanEat?.enabled) {
        return total // Price is 0 for AYCE items
      }
      return total + (dish?.price || 0) * cartItem.quantity
    }, 0),

    // Cover charge
    coverCharge: table?.seats && restaurant?.coverChargePerPerson // Using seats as customer count proxy if customerCount missing
      ? restaurant.coverChargePerPerson * table.seats // simplified
      : 0,

    // All you can eat charge (only for first order typically)
    allYouCanEatCharge: restaurant?.allYouCanEat?.enabled && table?.seats
      ? restaurant.allYouCanEat.pricePerPerson * table.seats
      : 0,

    // Free items (included in AYCE)
    freeItems: cart.filter(cartItem => {
      const dish = restaurantDishes.find(d => d.id === cartItem.menuItemId)
      return dish && restaurant?.allYouCanEat?.enabled
    })
  }

  // Legacy cart total for compatibility
  const cartTotal = cartCalculations.regularTotal

  // Check PIN on mount
  useEffect(() => {
    if (table && !isPinVerified) {
      setShowPinDialog(true)
    }
  }, [table, isPinVerified])

  const handlePinVerification = () => {
    if (table && enteredPin === table.pin) {
      setIsPinVerified(true)
      setShowPinDialog(false)
      toast.success(`Benvenuto al ${table.name}!`)
    } else {
      toast.error('PIN non corretto')
    }
  }

  const addToCart = (menuItemId: string) => {
    if (!isPinVerified) {
      setShowPinDialog(true)
      return
    }
    setCart(current => {
      return [...current, { menuItemId, quantity: 1, instanceId: `${menuItemId}-${Date.now()}` }]
    })
  }

  const removeFromCart = (instanceId: string) => {
    setCart(current => current.filter(item => item.instanceId !== instanceId))
  }

  const updateQuantity = (instanceId: string, delta: number) => {
    setCart(current =>
      current.map(item => {
        if (item.instanceId === instanceId) {
          const newQuantity = item.quantity + delta
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
        }
        return item
      }).filter(item => item.quantity > 0)
    )
  }

  const updateItemNotes = (instanceId: string, notes: string) => {
    setCart(current =>
      current.map(item =>
        item.instanceId === instanceId
          ? { ...item, notes }
          : item
      )
    )
  }

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      toast.error('Il carrello è vuoto')
      return
    }

    // Check all-you-can-eat limits
    if (restaurant?.allYouCanEat?.enabled && table?.remainingOrders !== undefined && table.remainingOrders !== null && table.remainingOrders <= 0) {
      toast.error('Hai raggiunto il limite massimo di ordini per All You Can Eat')
      return
    }

    // Calculate costs based on restaurant settings
    let coverCharge = 0
    let allYouCanEatCharge = 0
    let regularTotal = 0

    if (table?.customerCount && restaurant?.coverChargePerPerson) {
      coverCharge = restaurant.coverChargePerPerson * table.customerCount
    }

    if (restaurant?.allYouCanEat?.enabled && table?.customerCount) {
      allYouCanEatCharge = restaurant.allYouCanEat.pricePerPerson * table.customerCount
    }

    // Calculate regular items
    cart.forEach(cartItem => {
      const dish = restaurantDishes.find(d => d.id === cartItem.menuItemId)
      if (dish) {
        if (!restaurant?.allYouCanEat?.enabled || dish.excludeFromAllYouCanEat) {
          regularTotal += dish.price * cartItem.quantity
        }
      }
    })

    const orderItems = cart.map((item) => {
      return {
        dish_id: item.menuItemId,
        quantity: item.quantity,
        note: item.notes,
      }
    })

    createOrder(tableId, orderItems)

    // Decrease remaining orders for all-you-can-eat
    if (restaurant?.allYouCanEat?.enabled && table?.remainingOrders !== undefined && table.id) {
      DatabaseService.updateTable(table.id, { remainingOrders: (table.remainingOrders || 0) - 1 })
    }

    setCart([])
    setShowCart(false)
    // Toast is handled in createOrder
  }

  const getItemQuantityInCart = (menuItemId: string) => {
    return cart.filter(item => item.menuItemId === menuItemId).reduce((sum, item) => sum + item.quantity, 0)
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
              {cart.length > 0 && (
                <Button
                  onClick={() => setShowCart(true)}
                  className="bg-primary hover:bg-primary/90 shadow-gold relative"
                >
                  <ShoppingCart size={16} className="mr-2" />
                  Carrello
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-white text-primary absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center"
                  >
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                </Button>
              )}
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const quantityInCart = getItemQuantityInCart(item.id)

            return (
              <Card key={item.id} className="overflow-hidden shadow-professional hover:shadow-professional-lg transition-all duration-300 hover-lift bg-order-card">
                {item.image_url && (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {restaurant?.allYouCanEat?.enabled && !item.excludeFromAllYouCanEat
                            ? 'Incluso'
                            : `€${item.price.toFixed(2)}`
                          }
                        </span>
                        {restaurant?.allYouCanEat?.enabled && !item.excludeFromAllYouCanEat && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            All You Can Eat
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        onClick={() => addToCart(item.id)}
                        className="flex-1 bg-primary hover:bg-primary/90 shadow-gold"
                      >
                        <Plus size={16} className="mr-2" />
                        Aggiungi {quantityInCart > 0 && `(${quantityInCart})`}
                      </Button>
                    </div>
                  </div>
                </CardContent>
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

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md shadow-liquid-lg bg-order-card">
          <DialogHeader>
            <DialogTitle className="text-xl">Il Tuo Ordine</DialogTitle>
            <DialogDescription>
              Controlla i piatti selezionati prima di inviare l'ordine
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Il carrello è vuoto
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cart.map((cartItem) => {
                    const dish = restaurantDishes.find(d => d.id === cartItem.menuItemId)
                    if (!dish) return null

                    return (
                      <div key={cartItem.instanceId} className="p-3 bg-liquid-gradient rounded-lg border-liquid shadow-liquid">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-base">{dish.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(cartItem.instanceId!, -1)}
                                className="h-7 w-7 p-0 rounded-full"
                              >
                                <Minus size={12} />
                              </Button>
                              <span className="w-8 text-center font-bold text-primary">{cartItem.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(cartItem.instanceId!, 1)}
                                className="h-7 w-7 p-0 rounded-full"
                              >
                                <Plus size={12} />
                              </Button>
                              <span className="text-sm text-muted-foreground ml-2">
                                {restaurant?.allYouCanEat?.enabled && !dish.excludeFromAllYouCanEat
                                  ? 'Incluso'
                                  : `€${(dish.price * cartItem.quantity).toFixed(2)}`
                                }
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(cartItem.instanceId!)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Note speciali per questo piatto..."
                          value={cartItem.notes || ''}
                          onChange={(e) => updateItemNotes(cartItem.instanceId!, e.target.value)}
                          className="h-16 text-sm shadow-liquid"
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="border-t pt-4">
                  <div className="space-y-2 mb-4">
                    {/* All You Can Eat Summary */}
                    {restaurant?.allYouCanEat?.enabled && cartCalculations.freeItems.length > 0 && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-green-800 mb-1">All You Can Eat</div>
                        {cartCalculations.freeItems.map(cartItem => {
                          const dish = restaurantDishes.find(d => d.id === cartItem.menuItemId)
                          return dish ? (
                            <div key={cartItem.menuItemId} className="text-sm text-green-700">
                              {cartItem.quantity}x {dish.name} - Incluso
                            </div>
                          ) : null
                        })}
                      </div>
                    )}

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

                    {/* All You Can Eat charge (shown only on first order or if no orders placed yet) */}
                    {cartCalculations.allYouCanEatCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>All You Can Eat ({table?.customerCount} persone):</span>
                        <span>€{cartCalculations.allYouCanEatCharge.toFixed(2)}</span>
                      </div>
                    )}

                    {restaurant?.allYouCanEat?.enabled && table?.remainingOrders !== undefined && (
                      <div className="text-sm text-center p-2 bg-blue-50 rounded">
                        Ordini rimasti: {table.remainingOrders}
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
                    disabled={restaurant?.allYouCanEat?.enabled && table?.remainingOrders !== undefined && table.remainingOrders !== null && table.remainingOrders <= 0}
                  >
                    <Check size={20} className="mr-2" />
                    {restaurant?.allYouCanEat?.enabled && table?.remainingOrders !== undefined && table.remainingOrders !== null && table.remainingOrders <= 0
                      ? 'Limite ordini raggiunto'
                      : 'Invia Ordine'
                    }
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}