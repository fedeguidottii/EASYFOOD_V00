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
import { Crown, Plus, Buildings, SignOut, Trash, ChartBar, PencilSimple, Eye, EyeSlash, Database, MagnifyingGlass, SortAscending, UploadSimple } from '@phosphor-icons/react'
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
  const [restaurants, , refreshRestaurants, setRestaurants] = useSupabaseData<Restaurant>(
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

    setIsUploading(true)

    try {
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
        isActive: true,
      }

      const restaurantUser: User = {
        id: userId,
        name: newRestaurant.username,
        email: newRestaurant.email,
        password_hash: newRestaurant.password,
        role: 'OWNER',
      }

      await DatabaseService.createUser(restaurantUser)
      await DatabaseService.createRestaurant(restaurant)

      setNewRestaurant({ name: '', phone: '', email: '', logo_url: '', username: '', password: '' })
      setLogoFile(null)
      setShowRestaurantDialog(false)
      toast.success('Ristorante creato con successo')
      await refreshRestaurants()
    } catch (error: any) {
      console.error('Error creating restaurant:', error)
      if (error.code === '23505' || error.status === 409 || error.message?.includes('duplicate key')) {
        toast.error('Esiste già un utente o un ristorante con questa email.')
      } else {
        toast.error('Errore durante la creazione: ' + (error.message || 'Errore sconosciuto'))
      }
    } finally {
      setIsUploading(false)
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
    if (confirm('Sei sicuro? Questa azione è irreversibile e cancellerà TUTTI i dati del ristorante.')) {
      try {
        // Optimistic update: remove immediately from UI
        if (setRestaurants) {
          setRestaurants(prev => prev.filter(r => r.id !== restaurantId))
        }

        const restaurant = restaurants?.find(r => r.id === restaurantId)
        await DatabaseService.deleteRestaurant(restaurantId)

        if (restaurant?.owner_id) {
          try {
            await DatabaseService.deleteUser(restaurant.owner_id)
          } catch (e) {
            // Suppress 409 error for user deletion as it's likely a constraint issue 
            // and the main goal (deleting restaurant) is achieved.
            console.warn("Could not delete associated user (likely linked to other data)", e)
          }
        }

        toast.success('Ristorante eliminato')
        await refreshRestaurants()
      } catch (error: any) {
        console.error('Error deleting restaurant:', error)
        toast.error('Errore: ' + (error.message || "Impossibile eliminare"))
        await refreshRestaurants() // Revert state on error
      }
    }
  }

  const handleToggleActive = async (restaurant: Restaurant) => {
    try {
      // Optimistic Update
      if (setRestaurants) {
        setRestaurants(prev => prev.map(r =>
          r.id === restaurant.id ? { ...r, isActive: !r.isActive } : r
        ))
      }

      await DatabaseService.updateRestaurant({
        id: restaurant.id,
        isActive: !restaurant.isActive
      })

      // Removed the toast as requested ("non deve saltare fuori la scritta grossa")
      // The visual feedback (transparency) is enough.
    } catch (error) {
      console.error(error)
      toast.error('Errore durante l\'aggiornamento dello stato')
      await refreshRestaurants() // Revert on error
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
      setIsUploading(true)
      let finalLogoUrl = editingRestaurant.logo_url
      if (editLogoFile) {
        const uploadedUrl = await handleLogoUpload(editLogoFile)
        if (uploadedUrl) finalLogoUrl = uploadedUrl
      }

      const updatedRestaurant = {
        ...editingRestaurant,
        logo_url: finalLogoUrl
      }

      // Optimistic Update
      if (setRestaurants) {
        setRestaurants(prev => prev.map(r =>
          r.id === updatedRestaurant.id ? updatedRestaurant : r
        ))
      }

      await DatabaseService.updateRestaurant({
        id: updatedRestaurant.id,
        name: updatedRestaurant.name,
        phone: updatedRestaurant.phone,
        email: updatedRestaurant.email,
        logo_url: finalLogoUrl,
      })

      if (editingUser) {
        await DatabaseService.updateUser({
          id: editingUser.id,
          name: editingUser.name,
          password_hash: editingUser.password_hash,
          role: editingUser.role
        })
      }

      setShowEditDialog(false)
      setEditingRestaurant(null)
      setEditingUser(null)
      setEditLogoFile(null)
      toast.success('Ristorante aggiornato')
      await refreshRestaurants() // Sync with DB to be sure
    } catch (error) {
      console.error('Error updating:', error)
      toast.error('Errore durante l\'aggiornamento')
      await refreshRestaurants() // Revert on error
    } finally {
      setIsUploading(false)
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
                      <div className={`flex flex-col md:flex-row items-center p-4 gap-4 transition-all duration-300 ${!restaurant.isActive ? 'opacity-50 grayscale bg-muted/30' : ''}`}>

                        {/* Left: Logo */}
                        <div className="flex-shrink-0">
                          {restaurant.logo_url ? (
                            <img src={restaurant.logo_url} alt={restaurant.name} className="w-12 h-12 rounded-full object-cover border bg-background" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border">
                              <Buildings size={20} className="text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Center: Info */}
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold truncate">{restaurant.name}</h3>
                              {restaurant.isActive && (
                                <Badge variant="default" className="text-xs px-2 py-0 h-5">
                                  Attivo
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3 truncate">
                              <span>{restaurant.email}</span>
                              <span className="w-1 h-1 rounded-full bg-border" />
                              <span>{restaurant.phone}</span>
                            </div>
                          </div>

                          {/* Credentials (Compact) */}
                          {restaurantUser && (
                            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border flex items-center justify-between gap-2">
                              <div className="truncate">
                                <span className="font-medium text-foreground">{restaurantUser.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-mono bg-background px-1 rounded border">
                                  {isPasswordVisible ? restaurantUser.password_hash : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(restaurant.id)}
                                  className="text-muted-foreground hover:text-foreground p-1 hover:bg-background rounded"
                                >
                                  {isPasswordVisible ? <EyeSlash size={12} /> : <Eye size={12} />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 border-l pl-4 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handlePopulateData(restaurant.id)}
                            title="Popola Dati Demo"
                          >
                            <Database size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${restaurant.isActive ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-green-600'}`}
                            onClick={() => handleToggleActive(restaurant)}
                            title={restaurant.isActive ? "Disattiva" : "Attiva"}
                          >
                            {restaurant.isActive ? (
                              <Eye size={18} />
                            ) : (
                              <EyeSlash size={18} />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEditRestaurant(restaurant)}
                            title="Modifica"
                          >
                            <PencilSimple size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteRestaurant(restaurant.id)}
                            title="Elimina"
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