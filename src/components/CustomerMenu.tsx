import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCustomerSession } from '../hooks/useCustomerSession'
import { Dish } from '../services/types'
import {
  ChefHat,
  Plus,
  Minus,
  ShoppingCart,
  X,
  Clock,
  MagnifyingGlass,

  Info,
  ForkKnife
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface Props {
  tableId: string
  onExit: () => void
  interfaceMode?: 'customer' | 'waiter'
}

export default function CustomerMenu({ tableId, onExit, interfaceMode = 'customer' }: Props) {
  const {
    restaurant,
    categories,
    dishes,
    cartItems,
    orders,
    loading,
    addToCart,
    removeFromCart,
    updateCartItem,
    placeOrder
  } = useCustomerSession(tableId)

  const isWaiterMode = interfaceMode === 'waiter'
  const mode = interfaceMode

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCart, setShowCart] = useState(false)

  // Add Dish Dialog State
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Filter Logic
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase()
    return dishes.filter(item => {
      const matchesCategory = selectedCategory === 'all'
        ? true
        : categories.find(c => c.id === item.category_id)?.name === selectedCategory

      const matchesSearch = !normalizedSearch
        || item.name.toLowerCase().includes(normalizedSearch)
        || item.description?.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSearch && item.is_active
    })
  }, [dishes, categories, selectedCategory, searchTerm])

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const orderA = a.order ?? 9999
      const orderB = b.order ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [categories])

  // Cart Calculations
  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const dish = dishes.find(d => d.id === item.dish_id)
      return total + (dish?.price || 0) * item.quantity
    }, 0)
  }, [cartItems, dishes])

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)

  // Handlers
  const openAddDialog = (dish: Dish) => {
    setSelectedDish(dish)
    setItemQuantity(1)
    setItemNotes('')
    setShowAddDialog(true)
  }

  const handleAddToCart = async () => {
    if (selectedDish) {
      await addToCart(selectedDish, itemQuantity, itemNotes)
      setShowAddDialog(false)
    }
    setSelectedDish(null)
    setItemQuantity(1)
    setItemNotes('')
  }

  // Waiter Mode Handlers
  const handleQuickAdd = async (e: React.MouseEvent, dish: Dish) => {
    e.stopPropagation()
    await addToCart(dish, 1, '')
  }

  const handleQuickRemove = async (e: React.MouseEvent, dish: Dish) => {
    e.stopPropagation()
    const item = cartItems.find(i => i.dish_id === dish.id)
    if (item) {
      if (item.quantity > 1) {
        await updateCartItem(item.id, item.quantity - 1)
      } else {
        await removeFromCart(item.id)
      }
    }
  }

  const handleSendOrder = async () => {
    await placeOrder()
    onExit() // Go back to dashboard
  }

  const getElapsedLabel = (timestamp?: string | null) => {
    if (!timestamp) return ''
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Appena inviato'
    if (mins < 60) return `${mins} min`
    const hours = Math.floor(mins / 60)
    return `${hours}h ${mins % 60}m`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Caricamento menu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-background ${mode === 'waiter' ? 'pb-32' : 'pb-24'}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {mode === 'customer' ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <ChefHat size={20} weight="fill" />
              </div>
              <h1 className="font-bold text-lg tracking-tight">{restaurant?.name || 'Menu'}</h1>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onExit}>
                <X size={24} />
              </Button>
              <h1 className="font-bold text-xl">Tavolo {tableId}</h1>
            </div>
          )}

          {mode === 'customer' && (
            <Button variant="ghost" size="icon" onClick={onExit} className="rounded-full hover:bg-muted">
              <X size={20} />
            </Button>
          )}
        </div>

        {/* Categories */}
        <div className="w-full overflow-x-auto no-scrollbar border-b bg-background/50">
          <div className="container mx-auto px-4 flex gap-2 py-3">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="rounded-full whitespace-nowrap shadow-sm"
            >
              Tutti
            </Button>
            {sortedCategories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.name)}
                className="rounded-full whitespace-nowrap shadow-sm"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {mode === 'customer' && (
        <div className="container mx-auto px-4 py-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Cerca piatti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-0 h-12 rounded-xl"
            />
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-2">
        {mode === 'waiter' ? (
          // WAITER MODE LIST VIEW
          <div className="space-y-2">
            {filteredItems.map(dish => {
              const cartItem = cartItems.find(i => i.dish_id === dish.id)
              const quantity = cartItem?.quantity || 0

              return (
                <div key={dish.id} className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm active:scale-[0.99] transition-transform">
                  <div className="flex-1" onClick={() => openAddDialog(dish)}>
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-lg">{dish.name}</h3>
                      <span className="font-bold text-lg ml-2">€{dish.price.toFixed(2)}</span>
                    </div>
                    {quantity > 0 && (
                      <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                        {quantity} nel carrello
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full border-2"
                      onClick={(e) => handleQuickRemove(e, dish)}
                      disabled={quantity === 0}
                    >
                      <Minus size={24} weight="bold" />
                    </Button>
                    <span className="w-8 text-center font-bold text-xl">{quantity}</span>
                    <Button
                      variant="default"
                      size="icon"
                      className="h-12 w-12 rounded-full shadow-md"
                      onClick={(e) => handleQuickAdd(e, dish)}
                    >
                      <Plus size={24} weight="bold" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // CUSTOMER MODE CARD VIEW
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(dish => (
              <Card
                key={dish.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300 border-0 shadow-sm bg-card/50 backdrop-blur-sm"
                onClick={() => openAddDialog(dish)}
              >
                <div className="flex h-32">
                  {/* Image */}
                  <div className="w-32 h-full shrink-0 bg-muted relative">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                        <ForkKnife size={32} weight="duotone" />
                      </div>
                    )}
                    {cartItems.some(i => i.dish_id === dish.id) && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                        {cartItems.find(i => i.dish_id === dish.id)?.quantity}x
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold line-clamp-1">{dish.name}</h3>
                        <span className="font-bold text-primary">€{dish.price.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{dish.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-1">
                        {dish.allergens?.slice(0, 2).map((allergen, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1 h-5">
                            {allergen}
                          </Badge>
                        ))}
                        {(dish.allergens?.length || 0) > 2 && (
                          <Badge variant="secondary" className="text-[10px] px-1 h-5">+{dish.allergens!.length - 2}</Badge>
                        )}
                      </div>
                      <Button size="sm" className="h-8 w-8 p-0 rounded-full shadow-sm">
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nessun piatto trovato</p>
          </div>
        )}
      </main>

      {/* Footer Actions */}
      {mode === 'waiter' ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <div className="container mx-auto max-w-md flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-medium text-muted-foreground">{cartItemCount} articoli</span>
              <span className="text-2xl font-black">€{cartTotal.toFixed(2)}</span>
            </div>
            <Button
              size="lg"
              className="w-full h-14 text-xl font-black shadow-lg"
              onClick={handleSendOrder}
              disabled={cartItemCount === 0}
            >
              INVIA ORDINE
            </Button>
          </div>
        </div>
      ) : (
        // Customer Floating Cart
        cartItemCount > 0 && (
          <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center z-50">
            <Button
              onClick={() => setShowCart(true)}
              className="w-full max-w-md h-14 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center justify-between px-6 animate-in slide-in-from-bottom-4"
            >
              <div className="flex items-center gap-2">
                <div className="bg-white/20 px-2 py-1 rounded text-sm font-bold">
                  {cartItemCount}
                </div>
                <span className="font-semibold">Vedi Ordine</span>
              </div>
              <span className="font-bold text-lg">€{cartTotal.toFixed(2)}</span>
            </Button>
          </div>
        )
      )}

      {/* Add Dish Dialog (Shared) */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDish?.name}</DialogTitle>
            <DialogDescription>{selectedDish?.description}</DialogDescription>
          </DialogHeader>

          {selectedDish?.image_url && (
            <div className="w-full h-48 rounded-lg overflow-hidden my-2">
              <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-4 py-4">
            {selectedDish?.allergens && selectedDish.allergens.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedDish.allergens.map(a => (
                  <Badge key={a} variant="outline" className="text-xs border-destructive/50 text-destructive">
                    ⚠️ {a}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-6">
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}>
                <Minus size={20} />
              </Button>
              <span className="text-3xl font-bold w-12 text-center">{itemQuantity}</span>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setItemQuantity(itemQuantity + 1)}>
                <Plus size={20} />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Note per la cucina</Label>
              <Textarea
                placeholder="Es. Senza cipolla, ben cotto..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleAddToCart} className="w-full h-12 text-lg font-bold">
              Aggiungi €{(selectedDish ? selectedDish.price * itemQuantity : 0).toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cart Drawer */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Il Tuo Ordine</DialogTitle>
            <DialogDescription>Riepilogo del tavolo</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
            {/* Current Cart */}
            {cartItems.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/10">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">1</div>
                  <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">Da Ordinare</h3>
                </div>
                {cartItems.map(item => {
                  const dish = dishes.find(d => d.id === item.dish_id)
                  if (!dish) return null
                  return (
                    <div key={item.id} className="flex gap-3 bg-secondary/30 p-3 rounded-xl">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{dish.name}</span>
                          <span>€{(dish.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-background rounded-lg border px-1 h-8">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartItem(item.id, item.quantity - 1)}>
                              <Minus size={12} />
                            </Button>
                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartItem(item.id, item.quantity + 1)}>
                              <Plus size={12} />
                            </Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive ml-auto" onClick={() => removeFromCart(item.id)}>
                            <X size={16} />
                          </Button>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic">Note: {item.notes}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Order History */}
            {orders.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/10">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs font-bold">2</div>
                  <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">Inviati alla Cucina</h3>
                </div>
                {orders.map(order => (
                  <div key={order.id} className="border rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                        {order.status === 'completed' ? 'Completato' : 'In Preparazione'}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} />
                        {getElapsedLabel(order.created_at)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {order.items?.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.quantity}x {item.dish?.name}</span>
                          <span>{item.status === 'SERVED' ? '✅' : '⏳'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cartItems.length === 0 && orders.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                <p>Il carrello è vuoto</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {cartItems.length > 0 && (
            <div className="p-6 border-t bg-background">
              <div className="flex justify-between items-center mb-4 text-lg font-bold">
                <span>Totale Da Ordinare</span>
                <span>€{cartTotal.toFixed(2)}</span>
              </div>
              <Button onClick={() => { placeOrder(); setShowCart(false); }} className="w-full h-12 text-lg font-bold shadow-lg">
                Invia Ordine
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}