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
    if (!selectedDish) return
    await addToCart(selectedDish.id, itemQuantity, itemNotes)
    setShowAddDialog(false)
    setSelectedDish(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ChefHat size={20} weight="duotone" />
              </div>
            )}
            <h1 className="font-bold text-lg text-gray-900 truncate max-w-[150px]">
              {restaurant?.name || 'Menu'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'menu' && (
              <Button
                variant="ghost"
                size="icon"
                className="relative text-gray-600 hover:text-primary hover:bg-gray-100"
                onClick={() => setShowCart(true)}
              >
                <ShoppingCart size={24} weight="duotone" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            )}
            {mode === 'waiter' && (
              <Button variant="ghost" size="icon" onClick={onExit} className="text-gray-500 hover:text-red-600">
                <X size={24} />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-md mx-auto px-4 flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('menu')}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'menu'
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            Menu
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'orders'
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            I Miei Ordini
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto pb-24">
        {activeTab === 'menu' ? (
          <div className="p-4 space-y-6">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Cerca piatti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  "rounded-full whitespace-nowrap shadow-sm",
                  selectedCategory === 'all'
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                Tutti
              </Button>
              {sortedCategories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "rounded-full whitespace-nowrap shadow-sm",
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Dish List */}
            <div className="space-y-4">
              {filteredItems.map(dish => (
                <Card
                  key={dish.id}
                  className="overflow-hidden border border-gray-200 shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => openAddDialog(dish)}
                >
                  <div className="flex h-28">
                    {dish.image_url && (
                      <div className="w-28 h-full shrink-0">
                        <img
                          src={dish.image_url}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight">
                            {dish.name}
                          </h3>
                          <span className="font-bold text-primary whitespace-nowrap">
                            €{dish.price.toFixed(2)}
                          </span>
                        </div>
                        {dish.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {dish.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {dish.allergens && dish.allergens.length > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1 text-gray-500 border-gray-200 bg-gray-50">
                              {dish.allergens.length} allergeni
                            </Badge>
                          )}
                          {dish.is_ayce && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-green-100 text-green-700 border-transparent">
                              AYCE
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="h-7 w-7 rounded-full p-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        >
                          <Plus size={14} weight="bold" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <ForkKnife size={32} />
                  </div>
                  <p className="text-gray-500 font-medium">Nessun piatto trovato</p>
                  <p className="text-sm text-gray-400 mt-1">Prova a cambiare categoria o ricerca</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">I tuoi ordini</h2>
              <Badge variant="outline" className="text-gray-600 border-gray-300">
                Tavolo {tableId}
              </Badge>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Receipt size={32} />
                </div>
                <p className="text-gray-500 font-medium">Nessun ordine effettuato</p>
                <Button
                  variant="link"
                  className="text-primary mt-2"
                  onClick={() => setActiveTab('menu')}
                >
                  Vai al menu
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 shadow-sm bg-white overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Badge
                        variant={order.status === 'completed' ? 'default' : 'secondary'}
                        className={cn(
                          order.status === 'completed' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                        )}
                      >
                        {order.status === 'completed' ? 'Completato' : 'In preparazione'}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      {order.items?.map((item: any) => {
                        const dish = dishes.find(d => d.id === item.dish_id)
                        return (
                          <div key={item.id} className="flex justify-between items-start text-sm">
                            <div className="flex gap-3">
                              <span className="font-bold text-gray-900 min-w-[20px]">{item.quantity}x</span>
                              <div>
                                <span className="text-gray-800">{dish?.name}</span>
                                {item.notes && (
                                  <p className="text-xs text-gray-500 mt-0.5 italic">Note: {item.notes}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-gray-600 font-medium">
                              €{((dish?.price || 0) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                      <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Totale Ordine</span>
                        <span className="font-bold text-primary text-lg">
                          €{(order.total_amount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cart Sheet / Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0 bg-white">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={24} className="text-primary" />
              Il tuo carrello
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Riepilogo dei piatti selezionati
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                  <ShoppingCart size={32} />
                </div>
                <p className="text-gray-500 font-medium">Il carrello è vuoto</p>
                <Button variant="outline" onClick={() => setShowCart(false)} className="mt-2 border-gray-300 text-gray-700">
                  Torna al menu
                </Button>
              </div>
            ) : (
              cartItems.map(item => {
                const dish = dishes.find(d => d.id === item.dish_id)
                if (!dish) return null
                return (
                  <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between">
                        <h4 className="font-bold text-gray-900">{dish.name}</h4>
                        <span className="font-bold text-primary">€{(dish.price * item.quantity).toFixed(2)}</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-gray-500 italic">Note: {item.notes}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm h-8">
                          <button
                            className="w-8 h-full flex items-center justify-center text-gray-600 hover:text-primary hover:bg-gray-50 rounded-l-lg transition-colors"
                            onClick={() => updateCartItem(item.id, { quantity: Math.max(0, item.quantity - 1) })}
                          >
                            <Minus size={14} weight="bold" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                          <button
                            className="w-8 h-full flex items-center justify-center text-gray-600 hover:text-primary hover:bg-gray-50 rounded-r-lg transition-colors"
                            onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                          >
                            <Plus size={14} weight="bold" />
                          </button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 ml-auto"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {cartItems.length > 0 && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600 font-medium">Totale stimato</span>
                <span className="text-2xl font-bold text-primary">€{cartTotal.toFixed(2)}</span>
              </div>
              <Button
                className="w-full h-12 text-lg font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={async () => {
                  await placeOrder()
                  setShowCart(false)
                  setActiveTab('orders')
                }}
              >
                Invia Ordine
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">{selectedDish?.name}</DialogTitle>
            <DialogDescription className="text-gray-500">
              Personalizza il tuo ordine
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-gray-200 hover:bg-gray-100 hover:text-primary"
                onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
              >
                <Minus size={20} weight="bold" />
              </Button>
              <span className="text-3xl font-bold text-gray-900 w-12 text-center">
                {itemQuantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-gray-200 hover:bg-gray-100 hover:text-primary"
                onClick={() => setItemQuantity(itemQuantity + 1)}
              >
                <Plus size={20} weight="bold" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-gray-700 font-medium">Note per la cucina</Label>
              <Textarea
                id="notes"
                placeholder="Es. Senza cipolla, ben cotto..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="resize-none bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-gray-300 text-gray-700">
              Annulla
            </Button>
            <Button onClick={handleAddToCart} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
              Aggiungi • €{((selectedDish?.price || 0) * itemQuantity).toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}