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
  mode?: 'customer' | 'waiter'
}

export default function CustomerMenu({ tableId, onExit, mode = 'customer' }: Props) {
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
    return [...categories].sort((a, b) => a.order - b.order)
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
        <div className="animate-pulse flex flex-col items-center gap-4">
          <ChefHat size={48} className="text-primary opacity-50" />
          <p className="text-muted-foreground">Caricamento menu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5 pb-24">
    </div>

          {/* Search Bar */ }
  <div className="relative">
    <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    <Input
      placeholder="Cerca piatti..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-10 bg-secondary/50 border-transparent focus:bg-background transition-all"
    />
  </div>

  {/* Categories Slider */ }
  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
    <Button
      variant={selectedCategory === 'all' ? 'default' : 'outline'}
      size="sm"
      onClick={() => setSelectedCategory('all')}
      className="rounded-full flex-shrink-0"
    >
      Tutti
    </Button>
    {sortedCategories.map(cat => (
      <Button
        key={cat.id}
        variant={selectedCategory === cat.name ? 'default' : 'outline'}
        size="sm"
        onClick={() => setSelectedCategory(cat.name)}
        className="rounded-full flex-shrink-0"
      >
        {cat.name}
      </Button>
    ))}
  </div>
        </div >
      </div >

    {/* Menu Grid */ }
    < main className = "container mx-auto px-4 py-6" >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map(dish => (
          <Card key={dish.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-all group" onClick={() => openAddDialog(dish)}>
            <div className="flex h-32">
              {/* Image */}
              <div className="w-32 h-full shrink-0 bg-muted relative">
                {dish.image_url ? (
                  <img
                    src={dish.image_url}
                    alt={dish.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/50 to-muted text-muted-foreground p-2 text-center">
                    <ForkKnife size={24} className="mb-1 opacity-50" />
                    <span className="text-[10px] font-medium leading-tight opacity-70 line-clamp-2">{dish.name}</span>
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

  {
    filteredItems.length === 0 && (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nessun piatto trovato</p>
      </div>
    )
  }
      </main >

    {/* Floating Cart Button */ }
  {
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
  }

  {/* Add Dish Dialog */ }
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
            placeholder="Es. Ben cotto, senza sale..."
            value={itemNotes}
            onChange={(e) => setItemNotes(e.target.value)}
            className="resize-none"
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleAddToCart} className="w-full h-12 text-lg font-bold">
          Aggiungi • €{((selectedDish?.price || 0) * itemQuantity).toFixed(2)}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Cart Drawer/Dialog */ }
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
    </div >
  )
}