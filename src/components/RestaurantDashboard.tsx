import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { User, Restaurant, Table, Dish, Category, Order, Booking } from '../services/types'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import {
  Storefront,
  List,
  UsersThree,
  Clock,
  QrCode,
  SignOut,
  Plus,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  CookingPot,
  Bell,
  CurrencyEur
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useRestaurantLogic } from '../hooks/useRestaurantLogic'
import ReservationsManager from './ReservationsManager'
import TimelineReservations from './TimelineReservations'

interface Props {
  user: User
  onLogout: () => void
}

export default function RestaurantDashboard({ user, onLogout }: Props) {
  // 1. Fetch Restaurant
  const [restaurants] = useSupabaseData<Restaurant>('restaurants', [])
  const currentRestaurant = restaurants?.find(r => r.owner_id === user.id)
  const restaurantId = currentRestaurant?.id

  // 2. Fetch Data using correct table names and restaurant_id
  // Only fetch if we have a restaurantId
  const [tables] = useSupabaseData<Table>('tables', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [categories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [orders] = useSupabaseData<Order>('orders', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [bookings] = useSupabaseData<Booking>('bookings', [], { column: 'restaurant_id', value: restaurantId || '' })

  const [activeTab, setActiveTab] = useState('orders')
  const [activeSection, setActiveSection] = useState('orders')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  const { updateOrderStatus } = useRestaurantLogic(restaurantId || '')

  // State for new item dialog
  const [showNewItemDialog, setShowNewItemDialog] = useState(false)
  const [newItem, setNewItem] = useState<Partial<Dish>>({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    is_active: true,
    restaurant_id: restaurantId
  })

  // State for new table dialog
  const [showNewTableDialog, setShowNewTableDialog] = useState(false)
  const [newTable, setNewTable] = useState({
    number: '',
    seats: 4
  })

  useEffect(() => {
    if (restaurantId) {
      setNewItem(prev => ({ ...prev, restaurant_id: restaurantId }))
    }
  }, [restaurantId])

  const handleCreateItem = async () => {
    try {
      if (!newItem.name || !newItem.price || !newItem.category_id) {
        toast.error('Compila tutti i campi obbligatori')
        return
      }

      await DatabaseService.createDish({
        ...newItem,
        restaurant_id: restaurantId!,
        is_active: true
      } as Dish)

      setShowNewItemDialog(false)
      setNewItem({ name: '', description: '', price: 0, category_id: '', is_active: true, restaurant_id: restaurantId })
      toast.success('Piatto aggiunto al menu')
    } catch (error) {
      console.error(error)
      toast.error('Errore durante la creazione del piatto')
    }
  }

  const handleCreateTable = async () => {
    try {
      if (!newTable.number) {
        toast.error('Inserisci il numero del tavolo')
        return
      }

      await DatabaseService.createTable({
        name: `Tavolo ${newTable.number}`, // Assuming name is used for display
        number: parseInt(newTable.number), // Assuming number is int
        seats: newTable.seats,
        restaurant_id: restaurantId!,
        is_active: true,
        status: 'available'
      } as any)

      setShowNewTableDialog(false)
      setNewTable({ number: '', seats: 4 })
      toast.success('Tavolo creato con successo')
    } catch (error) {
      console.error(error)
      toast.error('Errore durante la creazione del tavolo')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo piatto?')) {
      try {
        await DatabaseService.deleteDish(id)
        toast.success('Piatto eliminato')
      } catch (error) {
        toast.error('Errore durante l\'eliminazione')
      }
    }
  }

  const handleDeleteTable = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo tavolo?')) {
      try {
        await DatabaseService.deleteTable(id)
        toast.success('Tavolo eliminato')
      } catch (error) {
        toast.error('Errore durante l\'eliminazione')
      }
    }
  }

  if (!currentRestaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl font-bold mb-4">Nessun ristorante associato</h2>
        <p className="text-muted-foreground mb-4">Contatta l'amministratore per associare il tuo account a un ristorante.</p>
        <Button onClick={onLogout}>Esci</Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarExpanded ? 'w-64' : 'w-20'} bg-card border-r transition-all duration-300 flex flex-col z-20`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          {sidebarExpanded ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Storefront weight="bold" className="text-primary-foreground" />
              </div>
              <span className="font-bold truncate">{currentRestaurant?.name || 'Ristorante'}</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <Storefront weight="bold" className="text-primary-foreground" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="hidden md:flex"
          >
            <List size={20} />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Button
            variant={activeSection === 'orders' ? 'secondary' : 'ghost'}
            className={`w-full justify-start ${!sidebarExpanded && 'px-2'} transition-all duration-200 hover:shadow-gold ${activeSection === 'orders' ? 'shadow-gold bg-primary/10 text-primary border-primary/20' : 'hover:bg-primary/5'}`}
            onClick={() => {
              setActiveSection('orders')
              setActiveTab('orders')
            }}
          >
            <Bell size={20} className={sidebarExpanded ? "mr-2" : ""} />
            {sidebarExpanded && <span>Ordini</span>}
            {orders && orders.filter(o => o.status !== 'completed').length > 0 && (
              <Badge variant="destructive" className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs">
                {orders.filter(o => o.status !== 'completed').length}
              </Badge>
            )}
          </Button>

          <Button
            variant={activeSection === 'menu' ? 'secondary' : 'ghost'}
            className={`w-full justify-start ${!sidebarExpanded && 'px-2'} transition-all duration-200 hover:shadow-gold ${activeSection === 'menu' ? 'shadow-gold bg-primary/10 text-primary border-primary/20' : 'hover:bg-primary/5'}`}
            onClick={() => {
              setActiveSection('menu')
              setActiveTab('menu')
            }}
          >
            <CookingPot size={20} className={sidebarExpanded ? "mr-2" : ""} />
            {sidebarExpanded && <span>Menu</span>}
          </Button>

          <Button
            variant={activeSection === 'tables' ? 'secondary' : 'ghost'}
            className={`w-full justify-start ${!sidebarExpanded && 'px-2'} transition-all duration-200 hover:shadow-gold ${activeSection === 'tables' ? 'shadow-gold bg-primary/10 text-primary border-primary/20' : 'hover:bg-primary/5'}`}
            onClick={() => {
              setActiveSection('tables')
              setActiveTab('tables')
            }}
          >
            <QrCode size={20} className={sidebarExpanded ? "mr-2" : ""} />
            {sidebarExpanded && <span>Tavoli</span>}
          </Button>

          <Button
            variant={activeSection === 'reservations' ? 'secondary' : 'ghost'}
            className={`w-full justify-start ${!sidebarExpanded && 'px-2'} transition-all duration-200 hover:shadow-gold ${activeSection === 'reservations' ? 'shadow-gold bg-primary/10 text-primary border-primary/20' : 'hover:bg-primary/5'}`}
            onClick={() => {
              setActiveSection('reservations')
              setActiveTab('reservations')
            }}
          >
            <Clock size={20} className={sidebarExpanded ? "mr-2" : ""} />
            {sidebarExpanded && <span>Prenotazioni</span>}
          </Button>
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className={`w-full justify-start ${!sidebarExpanded && 'px-2'} text-destructive hover:text-destructive hover:bg-destructive/10`}
            onClick={onLogout}
          >
            <SignOut size={20} className={sidebarExpanded ? "mr-2" : ""} />
            {sidebarExpanded && <span>Esci</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Ordini in Corso</h2>
              <Badge variant="outline" className="text-lg py-1">
                {orders?.filter(o => o.status !== 'completed').length || 0} Attivi
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orders?.filter(o => o.status !== 'completed').map((order) => (
                <Card key={order.id} className="border-l-4 border-l-primary shadow-gold hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Tavolo {tables?.find(t => t.id === order.table_session_id)?.name || '?'}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge className={
                        order.status === 'ready' ? 'bg-green-500' :
                          order.status === 'preparing' ? 'bg-orange-500' : 'bg-blue-500'
                      }>
                        {order.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Items would need to be fetched separately or joined. For now showing total */}
                      <div className="pt-3 border-t mt-3 flex justify-between items-center">
                        <span className="font-bold">Totale</span>
                        <span className="font-bold text-lg">€{order.total_amount.toFixed(2)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {order.status === 'pending' && (
                          <Button
                            className="w-full col-span-2 bg-orange-500 hover:bg-orange-600"
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                          >
                            Inizia Preparazione
                          </Button>
                        )}
                        {order.status === 'preparing' && (
                          <Button
                            className="w-full col-span-2 bg-green-500 hover:bg-green-600"
                            onClick={() => updateOrderStatus(order.id, 'ready')}
                          >
                            Pronto per Servire
                          </Button>
                        )}
                        {order.status === 'ready' && (
                          <Button
                            className="w-full col-span-2"
                            onClick={() => updateOrderStatus(order.id, 'served')}
                          >
                            Segna come Servito
                          </Button>
                        )}
                        {order.status === 'served' && (
                          <Button
                            className="w-full col-span-2 variant-outline"
                            variant="outline"
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                          >
                            Chiudi Ordine
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!orders || orders.filter(o => o.status !== 'completed').length === 0) && (
                <div className="col-span-full text-center py-12 bg-muted/10 rounded-lg border border-dashed">
                  <Bell size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                  <h3 className="text-lg font-medium">Nessun ordine attivo</h3>
                  <p className="text-muted-foreground">Gli ordini appariranno qui quando i clienti ordineranno.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="menu" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gestione Menu</h2>
              <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={16} />
                    Nuovo Piatto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Piatto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome Piatto</Label>
                      <Input
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrizione</Label>
                      <Input
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prezzo (€)</Label>
                        <Input
                          type="number"
                          step="0.50"
                          value={newItem.price}
                          onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select
                          value={newItem.category_id}
                          onValueChange={(v) => setNewItem({ ...newItem, category_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleCreateItem} className="w-full mt-4">Salva Piatto</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-6">
              {categories?.map(category => (
                <div key={category.id} className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    {category.name}
                    <Badge variant="secondary" className="text-xs">{dishes?.filter(i => i.category_id === category.id).length}</Badge>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {dishes
                      ?.filter(item => item.category_id === category.id)
                      .map(item => (
                        <Card key={item.id} className="group hover:border-primary/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold">{item.name}</h4>
                              <span className="font-bold text-primary">€{item.price.toFixed(2)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.description}</p>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <Switch checked={item.is_active} />
                                <span className="text-xs text-muted-foreground">{item.is_active ? 'Disponibile' : 'Esaurito'}</span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <PencilSimple size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash size={14} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gestione Tavoli</h2>
              <Dialog open={showNewTableDialog} onOpenChange={setShowNewTableDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={16} />
                    Nuovo Tavolo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Tavolo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Numero Tavolo</Label>
                      <Input
                        value={newTable.number}
                        onChange={(e) => setNewTable({ ...newTable, number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Posti a Sedere</Label>
                      <Input
                        type="number"
                        value={newTable.seats}
                        onChange={(e) => setNewTable({ ...newTable, seats: parseInt(e.target.value) })}
                      />
                    </div>
                    <Button onClick={handleCreateTable} className="w-full mt-4">Crea Tavolo</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {tables?.map(table => (
                <Card key={table.id} className="text-center hover:border-primary/50 transition-colors group relative">
                  <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold
                      ${table.status === 'occupied' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}
                    `}>
                      {table.name.replace('Tavolo ', '')}
                    </div>
                    <div>
                      <p className="font-medium">{table.seats} Posti</p>
                      <p className="text-xs text-muted-foreground capitalize">{table.status === 'occupied' ? 'Occupato' : 'Libero'}</p>
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleDeleteTable(table.id)}
                      >
                        <Trash size={12} />
                      </Button>
                    </div>

                    <Button variant="outline" size="sm" className="w-full mt-2 gap-1 text-xs">
                      <QrCode size={12} /> QR Code
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reservations" className="space-y-4">
            <ReservationsManager
              user={user}
              tables={tables || []}
              reservations={bookings || []}
              setReservations={() => { }}
            />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  )
}