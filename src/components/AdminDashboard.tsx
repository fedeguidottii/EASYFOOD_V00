import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { User, Restaurant } from '../services/types'
import { Crown, Plus, Buildings, SignOut, Trash, ChartBar, PencilSimple, Power, Eye, EyeSlash, Database } from '@phosphor-icons/react'
import AdminStatistics from './AdminStatistics'
import { v4 as uuidv4 } from 'uuid'
import { populateRestaurantData } from '../services/populateData'

interface Props {
  user: User
  onLogout: () => void
}

export default function AdminDashboard({ user, onLogout }: Props) {
  const [restaurants] = useSupabaseData<Restaurant>('restaurants', [])
  const [users] = useSupabaseData<User>('users', [])
  const [activeView, setActiveView] = useState<'restaurants' | 'statistics'>('restaurants')

  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    phone: '',
    email: '',
    username: '',
    password: ''
  })
  const [showRestaurantDialog, setShowRestaurantDialog] = useState(false)

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Visibility state for passwords
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  const togglePasswordVisibility = (restaurantId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [restaurantId]: !prev[restaurantId]
    }))
  }

  const handleCreateRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.phone || !newRestaurant.email || !newRestaurant.username || !newRestaurant.password) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    const restaurantId = uuidv4()

    const restaurant: Restaurant = {
      id: restaurantId,
      name: newRestaurant.name,
      contact: newRestaurant.email,
      phone: newRestaurant.phone,
      email: newRestaurant.email,
      hours: '09:00-23:00',
      isActive: true,
      coverChargePerPerson: 2.00,
      allYouCanEat: {
        enabled: false,
        pricePerPerson: 25.00,
        maxOrders: 3
      }
    }

    const restaurantUser: User = {
      id: uuidv4(),
      username: newRestaurant.username,
      password: newRestaurant.password,
      role: 'restaurant',
      restaurantId: restaurantId
    }

    try {
      await DatabaseService.createRestaurant(restaurant)
      await DatabaseService.createUser(restaurantUser)

      setNewRestaurant({ name: '', phone: '', email: '', username: '', password: '' })
      setShowRestaurantDialog(false)
      toast.success('Ristorante e account proprietario creati con successo')
    } catch (error) {
      console.error('Error creating restaurant:', error)
      toast.error('Errore durante la creazione. Il ristorante potrebbe esistere già.')
    }
  }

  const handlePopulateData = async (restaurantId: string) => {
    if (confirm('Vuoi popolare questo ristorante con dati di esempio?')) {
      try {
        await populateRestaurantData(restaurantId)
        toast.success('Dati inseriti con successo')
      } catch (error) {
        console.error(error)
        toast.error('Errore durante l\'inserimento dei dati')
      }
    }
  }

  const handleDeleteRestaurant = async (restaurantId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo ristorante e il relativo utente? Questa azione è irreversibile.')) {
      try {
        // Find associated user(s)
        const associatedUsers = (users || []).filter(u => u.restaurantId === restaurantId)

        // Delete associated users first
        for (const user of associatedUsers) {
          await DatabaseService.deleteUser(user.id)
        }

        // Then delete restaurant
        await DatabaseService.deleteRestaurant(restaurantId)

        toast.success('Ristorante eliminato')
      } catch (error) {
        console.error('Error deleting restaurant:', error)
        toast.error('Errore durante l\'eliminazione')
      }
    }
  }

  const handleToggleActive = async (restaurant: Restaurant) => {
    try {
      await DatabaseService.updateRestaurant({
        ...restaurant,
        isActive: !restaurant.isActive
      })
      toast.success(restaurant.isActive ? 'Ristorante disattivato' : 'Ristorante attivato')
    } catch (error) {
      toast.error('Errore durante l\'aggiornamento')
    }
  }

  const handleEditRestaurant = (restaurant: Restaurant) => {
    const associatedUser = (users || []).find(u => u.restaurantId === restaurant.id)
    setEditingRestaurant(restaurant)
    setEditingUser(associatedUser || null)
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingRestaurant) return

    try {
      await DatabaseService.updateRestaurant(editingRestaurant)

      if (editingUser) {
        await DatabaseService.updateUser(editingUser)
      }

      setShowEditDialog(false)
      setEditingRestaurant(null)
      setEditingUser(null)
      toast.success('Ristorante aggiornato')
    } catch (error) {
      console.error('Error updating:', error)
      toast.error('Errore durante l\'aggiornamento')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Crown weight="bold" size={20} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Amministrazione</h1>
                <p className="text-sm text-muted-foreground">Ciao, {user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={activeView === 'restaurants' ? 'default' : 'ghost'}
                onClick={() => setActiveView('restaurants')}
                className="gap-2"
              >
                <Buildings size={16} />
                Ristoranti
              </Button>
              <Button
                variant={activeView === 'statistics' ? 'default' : 'ghost'}
                onClick={() => setActiveView('statistics')}
                className="gap-2"
              >
                <ChartBar size={16} />
                Statistiche
              </Button>
              <div className="h-6 w-px bg-border mx-2" />
              <Button variant="outline" onClick={onLogout} className="flex items-center gap-2">
                <SignOut size={16} />
                Esci
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {activeView === 'statistics' ? (
          <AdminStatistics />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Gestione Ristoranti</h2>
                <p className="text-muted-foreground">Gestisci i ristoranti partner della piattaforma</p>
              </div>
              <Dialog open={showRestaurantDialog} onOpenChange={setShowRestaurantDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus size={16} />
                    Nuovo Ristorante
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nuovo Ristorante Partner</DialogTitle>
                    <DialogDescription>
                      Inserisci i dati del ristorante e le credenziali per il proprietario.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Dati Ristorante</Label>
                      <Input
                        placeholder="Nome Ristorante"
                        value={newRestaurant.name}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <Input
                        placeholder="Telefono"
                        value={newRestaurant.phone}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, phone: e.target.value }))}
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={newRestaurant.email}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <Label>Credenziali Proprietario</Label>
                      <Input
                        placeholder="Username"
                        value={newRestaurant.username}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, username: e.target.value }))}
                      />
                      <Input
                        placeholder="Password"
                        type="password"
                        value={newRestaurant.password}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>

                    <Button onClick={handleCreateRestaurant} className="w-full mt-4">
                      Crea Ristorante e Account
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {(restaurants || []).map((restaurant) => {
                const restaurantUser = (users || []).find(u => u.restaurantId === restaurant.id)
                const isPasswordVisible = visiblePasswords[restaurant.id]

                return (
                  <Card key={restaurant.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{restaurant.name}</h3>
                            <Badge variant={restaurant.isActive ? "default" : "secondary"}>
                              {restaurant.isActive ? "Attivo" : "Disattivato"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted-foreground">
                            <p>Email: <span className="text-foreground">{restaurant.email}</span></p>
                            <p>Tel: <span className="text-foreground">{restaurant.phone}</span></p>
                            {restaurantUser && (
                              <>
                                <p>Username: <span className="text-foreground font-medium">{restaurantUser.username}</span></p>
                                <div className="flex items-center gap-2">
                                  <span>Password: </span>
                                  <span className="text-foreground font-medium">
                                    {isPasswordVisible ? restaurantUser.password : '••••••••'}
                                  </span>
                                  <button
                                    onClick={() => togglePasswordVisibility(restaurant.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    {isPasswordVisible ? <EyeSlash size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePopulateData(restaurant.id)}
                            title="Popola Dati Demo"
                          >
                            <Database size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(restaurant)}
                            title={restaurant.isActive ? "Disattiva" : "Attiva"}
                          >
                            <Power size={16} className={restaurant.isActive ? "text-green-600" : "text-muted-foreground"} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRestaurant(restaurant)}
                          >
                            <PencilSimple size={16} />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRestaurant(restaurant.id)}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {(!restaurants || restaurants.length === 0) && (
                <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed">
                  <Buildings size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Nessun ristorante</h3>
                  <p className="text-muted-foreground">Inizia aggiungendo il primo ristorante partner.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Ristorante</DialogTitle>
            <DialogDescription>
              Modifica i dettagli del ristorante e le credenziali di accesso.
            </DialogDescription>
          </DialogHeader>
          {editingRestaurant && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editingRestaurant.name}
                  onChange={(e) => setEditingRestaurant(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input
                  value={editingRestaurant.phone}
                  onChange={(e) => setEditingRestaurant(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editingRestaurant.email}
                  onChange={(e) => setEditingRestaurant(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Orari</Label>
                <Input
                  value={editingRestaurant.hours}
                  onChange={(e) => setEditingRestaurant(prev => prev ? ({ ...prev, hours: e.target.value }) : null)}
                />
              </div>

              {editingUser && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Credenziali Proprietario</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Username</Label>
                    <Input
                      value={editingUser.username}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, username: e.target.value }) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <Input
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, password: e.target.value }) : null)}
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleSaveEdit} className="w-full">
                Salva Modifiche
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}