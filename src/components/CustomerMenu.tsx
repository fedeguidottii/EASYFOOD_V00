import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  ForkKnife,
  Trash,
  ListBullets,
  Receipt
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

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
    placeOrder,
    cancelOrderItem,
    cancelOrder
  } = useCustomerSession(tableId)

  const mode = interfaceMode
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu')

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCart, setShowCart] = useState(false)

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase()
    return dishes.filter(item => {
      const matchesCategory = selectedCategory === 'all'
        ? true
        : item.category_id === selectedCategory

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

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const dish = dishes.find(d => d.id === item.dish_id)
      return total + (dish?.price || 0) * item.quantity
    }, 0)
  }, [cartItems, dishes])

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)

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
    if (mode === 'waiter') {
      setActiveTab('orders')
    } else {
      onExit()
    }
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
    <div className={`min-h-screen ${mode === 'waiter' ? 'bg-gray-100 pb-32' : 'bg-background pb-24'}`}>
      <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-md border-b shadow-sm">
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

          {mode === 'waiter' && (
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'menu' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('menu')}
                className="font-bold"
              >
                <ListBullets size={18} className="mr-2" />
                MENU
              </Button>
              <Button
                variant={activeTab === 'orders' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('orders')}
                className="font-bold relative"
              >
                <Receipt size={18} className="mr-2" />
                IN CORSO
                {orders.filter(o => o.status !== 'completed' && o.status !== 'PAID' && o.status !== 'CANCELLED').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                )}
              </Button>
            </div>
          )}
        </div>

        {activeTab === 'menu' && (
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
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="rounded-full whitespace-nowrap shadow-sm"
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        )}
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
        {activeTab === 'menu' ? (
          mode === 'waiter' ? (
            <div className="space-y-2">
              {filteredItems.map(dish => {
                const cartItem = cartItems.find(i => i.dish_id === dish.id)
                const quantity = cartItem?.quantity || 0

                return (
                  <div key={dish.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm active:scale-[0.99] transition-transform">
                    <div className="flex-1" onClick={() => openAddDialog(dish)}>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-gray-900">{dish.name}</h3>
                        <span className="font-bold text-lg ml-2 text-gray-900">€{dish.price.toFixed(2)}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(dish => (
                <Card
                  key={dish.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300 border-0 shadow-sm bg-card/50 backdrop-blur-sm"
                  onClick={() => openAddDialog(dish)}
                >
                  <div className="flex h-32">
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

                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-black text-gray-900 line-clamp-1 text-lg">{dish.name}</h3>
                          <span className="font-black text-primary text-lg">€{dish.price.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-600 font-medium line-clamp-2 mt-1">{dish.description}</p>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {dish.allergens?.slice(0, 2).map((allergen, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1 h-5 bg-gray-100 text-gray-700 border-gray-200">
                              {allergen}
                            </Badge>
                          ))}
                          {(dish.allergens?.length || 0) > 2 && (
                            <Badge variant="secondary" className="text-[10px] px-1 h-5 bg-gray-100 text-gray-700 border-gray-200">+{dish.allergens!.length - 2}</Badge>
                          )}
                        </div>
                        <Button size="sm" className="h-8 w-8 p-0 rounded-full shadow-sm bg-black text-white hover:bg-gray-800">
                          <Plus size={16} weight="bold" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {orders.filter(o => o.status !== 'completed' && o.status !== 'PAID' && o.status !== 'CANCELLED').length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">Nessun ordine in corso</p>
              </div>
            ) : (
              orders
                .filter(o => o.status !== 'completed' && o.status !== 'PAID' && o.status !== 'CANCELLED')
                .map(order => (
                  <Card key={order.id} className="border-2 border-primary/20 shadow-sm overflow-hidden">
                    <div className="bg-muted/30 p-3 border-b flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-white">
                          Ordine #{order.id.slice(0, 4)}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={12} />
                          {getElapsedLabel(order.created_at)}
                        </span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs font-bold"
                        onClick={() => {
                          if (confirm('Sei sicuro di voler annullare l\'intero ordine?')) {
                            cancelOrder(order.id)
                          }
                        }}
                      >
                        ANNULLA ORDINE
                      </Button>
                    </div>
                    <div className="p-3 space-y-3">
                      {order.items?.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-lg w-6 text-center">{item.quantity}</span>
                            <div>
                              <p className="font-bold text-gray-900">{item.dish?.name}</p>
                              {item.note && <p className="text-xs text-red-500 font-medium">Note: {item.note}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={item.status === 'SERVED' ? 'default' : 'secondary'} className={item.status === 'SERVED' ? 'bg-green-600' : ''}>
                              {item.status === 'SERVED' ? 'SERVITO' : item.status === 'ready' ? 'PRONTO' : 'IN PREP.'}
                            </Badge>

                            {item.status !== 'SERVED' && item.status !== 'CANCELLED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                                onClick={() => {
                                  if (confirm('Annullare questo piatto?')) {
                                    cancelOrderItem(order.id, item.id)
                                  }
                                }}
                              >
                                <Trash size={18} weight="bold" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))
            )}
          </div>
        )}

        {filteredItems.length === 0 && activeTab === 'menu' && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nessun piatto trovato</p>
          </div>
        )}
      </main>

      {mode === 'waiter' && activeTab === 'menu' ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <div className="container mx-auto max-w-md flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <Button variant="outline" size="sm" onClick={() => setShowCart(true)} className="border-gray-300 text-gray-700">
                <Clock size={18} className="mr-2" />
                Storico / Modifica
              </Button>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-500 block">{cartItemCount} articoli</span>
                <span className="text-2xl font-black text-gray-900">€{cartTotal.toFixed(2)}</span>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full h-14 text-xl font-black shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSendOrder}
              disabled={cartItemCount === 0}
            >
              INVIA ORDINE
            </Button>
          </div>
        </div>
      ) : mode === 'customer' ? (
        (cartItemCount > 0 || orders.length > 0) && (
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
      ) : null}

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

      <Dialog open={showCart} onOpenChange={setShowCart}>
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" aria-hidden="true" onClick={() => setShowCart(false)} />
        <DialogContent className="fixed z-50 left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md h-[80vh] flex flex-col p-0 gap-0 border shadow-lg duration-200 sm:rounded-lg">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Il Tuo Ordine</DialogTitle>
            <DialogDescription>Riepilogo del tavolo</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
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

            {orders.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/10">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs font-bold">2</div>
                  <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">Inviati alla Cucina</h3>
                </div>
                {orders.map(order => {
                  const allServed = order.items?.every(i => i.status === 'SERVED')
                  const isCompleted = order.status === 'completed' || order.status === 'PAID' || allServed
                  const isCancelled = order.status === 'CANCELLED'

                  if (isCancelled) return null

                  return (
                    <div key={order.id} className="border rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <Badge variant={isCompleted ? 'default' : 'secondary'} className={isCompleted ? 'bg-green-600 hover:bg-green-700' : ''}>
                          {isCompleted ? 'Piatto Pronto' : 'In Preparazione'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={12} />
                          {getElapsedLabel(order.created_at)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {order.items?.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className={item.status === 'CANCELLED' ? 'text-muted-foreground line-through' : 'text-muted-foreground'}>
                              {item.quantity}x {item.dish?.name}
                            </span>
                            <span className={
                              item.status === 'SERVED' ? 'text-green-600 font-medium' :
                                item.status === 'CANCELLED' ? 'text-red-500 font-medium' :
                                  'text-muted-foreground'
                            }>
                              {item.status === 'SERVED' ? 'Pronto' : item.status === 'CANCELLED' ? 'Annullato' : 'In arrivo...'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {cartItems.length === 0 && orders.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                <p>Il carrello è vuoto</p>
              </div>
            )}
          </div>

          {cartItems.length > 0 && (
            <div className="p-6 border-t bg-background">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-muted-foreground text-sm">
                  <span>Totale Ordini Inviati</span>
                  <span>€{orders.reduce((acc, o) => acc + (o.total_amount || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Totale Da Ordinare</span>
                  <span>€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xl font-black text-primary pt-2 border-t">
                  <span>Totale Complessivo</span>
                  <span>€{(cartTotal + orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)).toFixed(2)}</span>
                </div>
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