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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-white/10 shadow-lg">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 text-cyan-200 flex items-center justify-center shadow-inner">
                <ChefHat size={20} weight="duotone" />
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300/80">Benvenuto</p>
              <h1 className="font-semibold text-slate-50 leading-tight truncate max-w-[200px]">
                {restaurant?.name || 'Menu'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'menu' && (
              <Button
                variant="ghost"
                size="icon"
                className="relative text-slate-200 hover:text-white hover:bg-white/10"
                onClick={() => setShowCart(true)}
              >
                <ShoppingCart size={22} weight="duotone" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            )}
            {mode === 'waiter' && (
              <Button variant="ghost" size="icon" onClick={onExit} className="text-slate-300 hover:text-red-400 hover:bg-red-500/10">
                <X size={22} />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-3xl mx-auto px-5 flex border-t border-white/10">
          <button
            onClick={() => setActiveTab('menu')}
            className={cn(
              "flex-1 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === 'menu'
                ? "border-cyan-400 text-white"
                : "border-transparent text-slate-300/80 hover:text-white",
            )}
          >
            Menu
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex-1 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === 'orders'
                ? "border-cyan-400 text-white"
                : "border-transparent text-slate-300/80 hover:text-white",
            )}
          >
            I Miei Ordini
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto pb-24 px-5">
        {activeTab === 'menu' ? (
          <div className="pt-6 space-y-6">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300/70" size={18} />
              <Input
                placeholder="Cerca piatti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 bg-white/5 border-white/10 text-slate-50 placeholder:text-slate-300/70 focus-visible:ring-cyan-400"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  "rounded-full whitespace-nowrap shadow-sm border",
                  selectedCategory === 'all'
                    ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white border-transparent"
                    : "bg-white/5 text-slate-100 border-white/10 hover:bg-white/10",
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
                    "rounded-full whitespace-nowrap shadow-sm border",
                    selectedCategory === cat.id
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white border-transparent"
                      : "bg-white/5 text-slate-100 border-white/10 hover:bg-white/10",
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
                  className="overflow-hidden border border-white/10 shadow-xl shadow-black/20 bg-white/5 backdrop-blur cursor-pointer transition hover:border-cyan-400/40"
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
                          <h3 className="font-bold text-slate-50 line-clamp-2 leading-tight">
                            {dish.name}
                          </h3>
                          <span className="font-bold text-cyan-300 whitespace-nowrap">
                            €{dish.price.toFixed(2)}
                          </span>
                        </div>
                        {dish.description && (
                          <p className="text-xs text-slate-200/80 mt-1 line-clamp-2">
                            {dish.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {dish.allergens && dish.allergens.length > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1 text-slate-100 border-white/20 bg-white/10">
                              {dish.allergens.length} allergeni
                            </Badge>
                          )}
                          {dish.is_ayce && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-emerald-500/20 text-emerald-100 border-transparent">
                              AYCE
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="h-8 w-8 rounded-full p-0 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                        >
                          <Plus size={14} weight="bold" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {filteredItems.length === 0 && (
                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <ForkKnife size={32} />
                  </div>
                  <p className="text-slate-100 font-medium">Nessun piatto trovato</p>
                  <p className="text-sm text-slate-300/80 mt-1">Prova a cambiare categoria o ricerca</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-6 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-slate-50">I tuoi ordini</h2>
              <Badge variant="outline" className="text-slate-100 border-white/20 bg-white/5">
                Tavolo {tableId}
              </Badge>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10 shadow-lg">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <Receipt size={32} />
                </div>
                <p className="text-slate-100 font-medium">Nessun ordine effettuato</p>
                <Button
                  variant="link"
                  className="text-cyan-300 mt-2"
                  onClick={() => setActiveTab('menu')}
                >
                  Vai al menu
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="border border-white/10 shadow-lg bg-white/5 overflow-hidden">
                    <div className="bg-white/10 px-4 py-3 border-b border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Clock size={16} className="text-cyan-300" />
                        <span className="text-sm font-medium">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Badge
                        variant={order.status === 'completed' ? 'default' : 'secondary'}
                        className={cn(
                          order.status === 'completed' ? "bg-emerald-500/20 text-emerald-100" : "bg-amber-500/20 text-amber-100",
                        )}
                      >
                        {order.status === 'completed' ? 'Completato' : 'In preparazione'}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3 text-slate-100">
                      {order.items?.map((item: any) => {
                        const dish = dishes.find(d => d.id === item.dish_id)
                        return (
                          <div key={item.id} className="flex justify-between items-start text-sm">
                            <div className="flex gap-3">
                              <span className="font-bold min-w-[20px]">{item.quantity}x</span>
                              <div>
                                <span>{dish?.name}</span>
                                {item.notes && (
                                  <p className="text-xs text-slate-300 mt-0.5 italic">Note: {item.notes}</p>
                                )}
                              </div>
                            </div>
                            <span className="font-medium text-cyan-200">
                              €{((dish?.price || 0) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                      <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center">
                        <span className="font-semibold">Totale Ordine</span>
                        <span className="font-bold text-cyan-300 text-lg">
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
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0 bg-slate-950 text-slate-50 border border-white/10">
          <DialogHeader className="px-6 py-4 border-b border-white/10">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-50">
              <ShoppingCart size={24} className="text-cyan-300" />
              Il tuo carrello
            </DialogTitle>
            <DialogDescription className="text-slate-300/80">
              Riepilogo dei piatti selezionati
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-900/60 to-slate-950">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-slate-300">
                  <ShoppingCart size={32} className="" />
                </div>
                <p className="text-slate-100 font-medium">Il carrello è vuoto</p>
                <Button variant="outline" onClick={() => setShowCart(false)} className="mt-2 border-white/20 text-slate-100 hover:bg-white/10">
                  Torna al menu
                </Button>
              </div>
            ) : (
              cartItems.map(item => {
                const dish = dishes.find(d => d.id === item.dish_id)
                if (!dish) return null
                return (
                  <div key={item.id} className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between">
                        <h4 className="font-bold text-slate-50">{dish.name}</h4>
                        <span className="font-bold text-cyan-300">€{(dish.price * item.quantity).toFixed(2)}</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-slate-300 italic">Note: {item.notes}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center bg-white/5 rounded-lg border border-white/10 shadow-sm h-8">
                          <button
                            className="w-8 h-full flex items-center justify-center text-slate-200 hover:text-cyan-300 hover:bg-white/10 rounded-l-lg transition-colors"
                            onClick={() => updateCartItem(item.id, { quantity: Math.max(0, item.quantity - 1) })}
                          >
                            <Minus size={14} weight="bold" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-slate-100">{item.quantity}</span>
                          <button
                            className="w-8 h-full flex items-center justify-center text-slate-200 hover:text-cyan-300 hover:bg-white/10 rounded-r-lg transition-colors"
                            onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                          >
                            <Plus size={14} weight="bold" />
                          </button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-red-400 hover:bg-red-500/10 ml-auto"
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
            <div className="p-6 border-t border-white/10 bg-slate-900/60">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-200 font-medium">Totale stimato</span>
                <span className="text-2xl font-bold text-cyan-300">€{cartTotal.toFixed(2)}</span>
              </div>
              <Button
                className="w-full h-12 text-lg font-bold shadow-md bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white"
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
        <DialogContent className="sm:max-w-md bg-slate-950 border border-white/10 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-50">{selectedDish?.name}</DialogTitle>
            <DialogDescription className="text-slate-300/80">
              Personalizza il tuo ordine
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-white/20 bg-white/5 hover:bg-white/10 hover:text-cyan-300"
                onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
              >
                <Minus size={20} weight="bold" />
              </Button>
              <span className="text-3xl font-bold text-slate-50 w-12 text-center">
                {itemQuantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-white/20 bg-white/5 hover:bg-white/10 hover:text-cyan-300"
                onClick={() => setItemQuantity(itemQuantity + 1)}
              >
                <Plus size={20} weight="bold" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-100 font-medium">Note per la cucina</Label>
              <Textarea
                id="notes"
                placeholder="Es. Senza cipolla, ben cotto..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="resize-none bg-white/5 border-white/10 focus-visible:ring-cyan-400"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-white/20 text-slate-100 hover:bg-white/10">
              Annulla
            </Button>
            <Button onClick={handleAddToCart} className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold shadow-sm">
              Aggiungi • €{((selectedDish?.price || 0) * itemQuantity).toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}