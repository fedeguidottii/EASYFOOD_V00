import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { User, Restaurant, Order } from '../services/types'
import { Crown, Plus, Buildings, SignOut, Trash, ChartBar, PencilSimple, Power, Eye, EyeSlash, Database, MagnifyingGlass, SortAscending, UploadSimple } from '@phosphor-icons/react'
import AdminStatistics from './AdminStatistics'
import { v4 as uuidv4 } from 'uuid'
import { populateRestaurantData } from '../services/populateData'

interface Props {
  user: User
  onLogout: () => void
}

type SortOption = 'name' | 'sales' | 'status'

export default function AdminDashboard({ user, onLogout }: Props) {
  // Map is_active to isActive for all restaurant data
  const [restaurants] = useSupabaseData<Restaurant>(
    'restaurants',
    [],
    undefined,
    (r: any) => ({ ...r, isActive: r.is_active })
  )
  const [users] = useSupabaseData<User>('users', [])
  const [orders] = useSupabaseData<Order>('orders', [])
  const [activeView, setActiveView] = useState<'restaurants' | 'statistics'>('restaurants')

  // Search & Sort State
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('name')

  // Create State
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    phone: '',
    email: '',
    logo_url: '',
    username: '',
    password: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showRestaurantDialog, setShowRestaurantDialog] = useState(false)

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)

  // Visibility state for passwords
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  const togglePasswordVisibility = (restaurantId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [restaurantId]: !prev[restaurantId]
    }))
  }

  // Filtered & Sorted Restaurants
  const processedRestaurants = useMemo(() => {
    let result = [...(restaurants || [])]

    // 1. Filter by Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query) ||
        r.phone?.includes(query)
      )
    }

    // 2. Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'status':
          // Active first
          return (a.isActive === b.isActive) ? 0 : a.isActive ? -1 : 1
        case 'sales':
          // Calculate sales for a and b
          const getSales = (rId: string) => (orders || [])
            .filter(o => o.restaurant_id === rId && o.status === 'PAID')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0)
          return getSales(b.id) - getSales(a.id)
        default:
          return 0
      }
    })

    return result
  }, [restaurants, orders, searchQuery, sortOption])

  const handleLogoUpload = async (file: File) => {
    try {
      setIsUploading(true)
      const url = await DatabaseService.uploadLogo(file)
      return url
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Errore caricamento logo')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleCreateRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.phone || !newRestaurant.email || !newRestaurant.username || !newRestaurant.password) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    let finalLogoUrl = newRestaurant.logo_url
    if (logoFile) {
      const uploadedUrl = await handleLogoUpload(logoFile)
      if (uploadedUrl) finalLogoUrl = uploadedUrl
    }

    const restaurantId = uuidv4()
    const userId = uuidv4()

    const restaurant: Restaurant = {
      id: restaurantId,
      name: newRestaurant.name,
      phone: newRestaurant.phone,
      email: newRestaurant.email,
      logo_url: finalLogoUrl,
      owner_id: userId,
      isActive: true, // Set active by default
    }

    const restaurantUser: User = {
      id: userId,
      name: newRestaurant.username, // Using name as username
      email: newRestaurant.email,
      password_hash: newRestaurant.password,
      role: 'OWNER',
    }

    try {
      // Create User first (referenced by Restaurant)
      await DatabaseService.createUser(restaurantUser)
      // Then Restaurant
      await DatabaseService.createRestaurant(restaurant)

      setNewRestaurant({ name: '', phone: '', email: '', logo_url: '', username: '', password: '' })
      setLogoFile(null)
      setShowRestaurantDialog(false)
      toast.success('Ristorante creato con successo')
    } catch (error: any) {
      console.error('Error creating restaurant:', error)
      if (error.code === '23505' || error.status === 409 || error.message?.includes('duplicate key')) {
        toast.error('Esiste già un utente o un ristorante con questa email.')
      } else {
        toast.error('Errore durante la creazione: ' + (error.message || 'Errore sconosciuto'))
      }
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
    if (confirm('Sei sicuro di voler eliminare questo ristorante? Verranno eliminati anche tutti i dati associati (ordini, menu, utente).')) {
      try {
        // Find associated user to delete manually if cascade doesn't cover backward reference (Restaurant -> User)
        // Actually, our schema is Restaurant -> User (owner_id). 
        // If we delete Restaurant, User stays unless we delete it.
        // But usually we want to delete the User too.
        const restaurant = restaurants?.find(r => r.id === restaurantId)

        await DatabaseService.deleteRestaurant(restaurantId)

        // Try to delete the owner user as well if it exists
        if (restaurant?.owner_id) {
          try {
            await DatabaseService.deleteUser(restaurant.owner_id)
          } catch (e) {
            console.warn("Could not delete associated user (might be shared or already deleted)", e)
          }
        }

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
    const associatedUser = (users || []).find(u => u.id === restaurant.owner_id)
    setEditingRestaurant(restaurant)
    setEditingUser(associatedUser || null)
    setEditLogoFile(null)
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingRestaurant) return

    try {
      let finalLogoUrl = editingRestaurant.logo_url
      if (editLogoFile) {
        const uploadedUrl = await handleLogoUpload(editLogoFile)
        if (uploadedUrl) finalLogoUrl = uploadedUrl
      }

      await DatabaseService.updateRestaurant({
        ...editingRestaurant,
        logo_url: finalLogoUrl
      })

      if (editingUser) {
        await DatabaseService.updateUser(editingUser)
      }

      setShowEditDialog(false)
      setEditingRestaurant(null)
      setEditingUser(null)
      setEditLogoFile(null)
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
                <p className="text-sm text-muted-foreground">Ciao, {user.name}</p>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Gestione Ristoranti</h2>
                <p className="text-muted-foreground">Gestisci i ristoranti partner della piattaforma</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <MagnifyingGlass className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca ristorante..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Sort Dropdown */}
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                  <SelectTrigger className="w-[180px]">
                    <SortAscending className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Ordina per" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                    <SelectItem value="sales">Fatturato (Alto-Basso)</SelectItem>
                    <SelectItem value="status">Stato (Attivi prima)</SelectItem>
                  </SelectContent>
                </Select>

                <Dialog open={showRestaurantDialog} onOpenChange={setShowRestaurantDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus size={16} />
                      Nuovo
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
                        <div className="space-y-1">
                          <Label>Logo</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/png, image/jpeg"
                              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                            />
                            {isUploading && <UploadSimple className="animate-spin" />}
                          </div>
                        </div>
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

                      <Button onClick={handleCreateRestaurant} className="w-full mt-4" disabled={isUploading}>
                        {isUploading ? 'Caricamento...' : 'Crea Ristorante e Account'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-4">
              {processedRestaurants.map((restaurant) => {
                const restaurantUser = (users || []).find(u => u.id === restaurant.owner_id)
                const isPasswordVisible = visiblePasswords[restaurant.id]

                return (
                  <Card key={restaurant.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className={`flex flex-col md:flex-row md:items-center justify-between p-6 gap-4 transition-opacity ${!restaurant.isActive ? 'opacity-30' : ''}`}>
                        <div className="flex items-center gap-4 flex-1">
                          {restaurant.logo_url ? (
                            <img src={restaurant.logo_url} alt={restaurant.name} className="w-16 h-16 rounded-lg object-cover bg-muted border" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border">
                              <Buildings size={24} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="space-y-2">
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
                                  <p>Username: <span className="text-foreground font-medium">{restaurantUser.name}</span></p>
                                  <div className="flex items-center gap-2">
                                    <span>Password: </span>
                                    <span className="text-foreground font-medium">
                                      {isPasswordVisible ? restaurantUser.password_hash : '••••••••'}
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
                            <Power size={16} className={restaurant.isActive ? "text-green-600" : "text-red-600"} />
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

              {processedRestaurants.length === 0 && (
                <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed">
                  <Buildings size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Nessun ristorante trovato</h3>
                  <p className="text-muted-foreground">Prova a cambiare i filtri o aggiungi un nuovo ristorante.</p>
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
                  value={editingRestaurant.phone || ''}
                  onChange={(e) => setEditingRestaurant(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editingRestaurant.email || ''}
                  onChange={(e) => setEditingRestaurant(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                />
              </div>
              <div className="space-y-1">
                <Label>Logo</Label>
                <div className="flex items-center gap-2">
                  {editingRestaurant.logo_url && (
                    <img src={editingRestaurant.logo_url} alt="Logo" className="w-8 h-8 rounded object-cover" />
                  )}
                  <Input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => setEditLogoFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {editingUser && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Credenziali Proprietario</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Username</Label>
                    <Input
                      value={editingUser.name || ''}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <Input
                      value={editingUser.password_hash || ''}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, password_hash: e.target.value }) : null)}
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleSaveEdit} className="w-full" disabled={isUploading}>
                {isUploading ? 'Salvataggio...' : 'Salva Modifiche'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}