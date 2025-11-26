import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { User, Table } from '../services/types'
import { QrCode, Users, LockKey, Storefront } from '@phosphor-icons/react'

interface Props {
  onLogin: (user: User, table?: Table) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [activeTab, setActiveTab] = useState<'admin' | 'table'>('table')
  const [isLoading, setIsLoading] = useState(false)

  // Admin/Restaurant Login State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Table Login State
  const [tablePin, setTablePin] = useState('')

  const handleAdminLogin = async () => {
    setIsLoading(true)

    try {
      const users = await DatabaseService.getUsers()

      // Check for username or email match
      const user = users.find(u =>
        (u.name?.toLowerCase() === username.toLowerCase() || u.email?.toLowerCase() === username.toLowerCase()) &&
        u.password_hash === password
      )

      if (user) {
        // If user is OWNER, we might want to fetch their restaurant here to ensure it exists
        if (user.role === 'OWNER') {
          const restaurants = await DatabaseService.getRestaurants()
          const userRestaurant = restaurants.find(r => r.owner_id === user.id)
          if (!userRestaurant) {
            toast.error('Nessun ristorante associato a questo account.')
            setIsLoading(false)
            return
          }
        }

        onLogin(user)
        toast.success(`Benvenuto ${user.name || 'Utente'} `)
      } else {
        toast.error('Credenziali non valide')
      }
    } catch (error) {
      console.error(error)
      toast.error('Errore durante il login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTableLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const restaurants = await DatabaseService.getRestaurants()
      if (restaurants.length === 0) {
        toast.error('Nessun ristorante disponibile')
        setIsLoading(false)
        return
      }

      // Try to find table in any restaurant (demo only)
      let foundTable: Table | undefined
      let foundRestaurantId: string | undefined

      for (const restaurant of restaurants) {
        const tables = await DatabaseService.getTables(restaurant.id)
        const table = tables.find(t => t.pin === tablePin)
        if (table) {
          foundTable = table
          foundRestaurantId = restaurant.id
          break
        }
      }

      if (foundTable && foundRestaurantId) {
        // Create a temporary customer user
        const customerUser: User = {
          id: 'customer-temp',
          role: 'CUSTOMER',
          email: 'customer@temp.com',
          name: 'Cliente'
        }
        onLogin(customerUser, foundTable)
        toast.success('Accesso al tavolo effettuato')
      } else {
        toast.error('PIN non valido')
      }
    } catch (error) {
      console.error(error)
      toast.error('Errore durante l\'accesso al tavolo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-subtle-gradient p-4">
      <div className="w-full max-w-md space-y-8">

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'admin' | 'table')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <QrCode size={18} />
              <span>Cliente</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Storefront size={18} />
              <span>Ristorante</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-4">
            <div className="text-center mb-8">
              <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-professional border border-primary/20">
                <QrCode weight="bold" size={32} className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Benvenuto</h1>
              <p className="text-muted-foreground">Scansiona il QR code o inserisci il PIN</p>
            </div>

            <Card className="glass-card border-0 shadow-professional-lg">
              <CardContent className="pt-6">
                <form onSubmit={handleTableLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pin" className="text-center block text-lg">PIN Tavolo</Label>
                    <div className="flex justify-center">
                      <Input
                        id="pin"
                        value={tablePin}
                        onChange={(e) => setTablePin(e.target.value)}
                        placeholder="1234"
                        className="text-center text-2xl tracking-[1em] font-mono h-14 w-48 bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-bold shadow-gold mt-4"
                    disabled={isLoading || tablePin.length < 4}
                  >
                    {isLoading ? 'Verifica in corso...' : 'Accedi al Tavolo'}
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-sm text-muted-foreground mb-3">
                    Come funziona:
                  </p>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">1</div>
                      <span>Scansiona il QR code sul tavolo</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">2</div>
                      <span>Inserisci il PIN temporaneo fornito</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">3</div>
                      <span>Ordina direttamente dal tuo dispositivo</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4">
            <div className="text-center mb-8">
              <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-professional border border-primary/20">
                <Users weight="bold" size={32} className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Ristorante</h1>
              <p className="text-muted-foreground">Portale di gestione</p>
            </div>

            <Card className="glass-card border-0 shadow-professional-lg">
              <CardHeader>
                <CardTitle className="text-xl text-center">Accesso Staff</CardTitle>
                <CardDescription className="text-center">
                  Area riservata al personale
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nome Utente</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nome utente"
                    className="bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>
                <Button
                  onClick={handleAdminLogin}
                  disabled={isLoading || !username || !password}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-bold shadow-gold mt-2"
                >
                  {isLoading ? 'Accesso in corso...' : 'Accedi'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}