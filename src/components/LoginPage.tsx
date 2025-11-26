import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { User, Table, Restaurant } from '../services/types'
import { QrCode, Users } from '@phosphor-icons/react'

interface Props {
  onLogin: (user: any) => void
  onTableAccess: (tableId: string) => void
  customerMode?: boolean
  presetTableId?: string
}

export default function LoginPage({ onLogin, onTableAccess, customerMode = false, presetTableId = '' }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tableCode, setTableCode] = useState(presetTableId)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const [users, setUsers] = useState<User[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedUsers = await DatabaseService.getUsers()
        const fetchedTables = await DatabaseService.getTables('TODO_PASS_ID') // GetTables richiederebbe ID, ma per ora carichiamo tutto se possibile o fixiamo dopo
        // Fix rapido: carichiamo i ristoranti per trovare il link
        const fetchedRestaurants = await DatabaseService.getRestaurants()
        
        setUsers(fetchedUsers || [])
        // Se DatabaseService.getTables richiede un ID, qui potrebbe fallire se non gestito, 
        // ma per il login admin ci interessano users e restaurants.
        setRestaurants(fetchedRestaurants || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (presetTableId) {
      setTableCode(presetTableId)
    }
  }, [presetTableId])

  const handleLogin = async () => {
    setLoading(true)

    // 1. Cerca l'utente confrontando 'name' con 'username' inserito e 'password_hash'
    const foundUser = (users || []).find(u => 
        (u.name === username || u.email === username) && 
        (u.password_hash === password)
    )

    if (foundUser) {
      // 2. Trova il ristorante di cui questo utente è proprietario
      const userRestaurant = restaurants.find(r => r.owner_id === foundUser.id)

      // 3. Adatta il ruolo per l'App (App si aspetta 'admin' o 'restaurant', DB ha 'ADMIN')
      let appRole = 'customer'
      if (foundUser.role === 'ADMIN') appRole = 'admin'
      if (foundUser.role === 'OWNER') appRole = 'restaurant'

      // 4. Crea oggetto sessione completo
      const sessionUser = {
        ...foundUser,
        role: appRole,
        // Iniettiamo restaurant_id così la dashboard sa cosa caricare
        restaurant_id: userRestaurant ? userRestaurant.id : undefined 
      }

      onLogin(sessionUser)
      toast.success(`Accesso ${appRole} effettuato`)
      setLoading(false)
      return
    }

    toast.error('Credenziali non valide')
    setLoading(false)
  }

  const handleTableAccess = async () => {
    // Nota: questa parte richiede che i tavoli siano stati caricati correttamente
    // Potrebbe richiedere logica aggiuntiva se getTables vuole un ID ristorante
    setLoading(true)
    onTableAccess(tableCode) // Bypass semplificato per test
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {customerMode ? (
          <Card className="glass-card border-0 shadow-professional-lg">
             <CardHeader>
                <CardTitle className="text-xl text-center">Accesso Tavolo</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
                <Input 
                    placeholder="PIN Tavolo" 
                    value={pin} 
                    onChange={e => setPin(e.target.value)} 
                    className="text-center text-2xl tracking-widest"
                />
                <Button onClick={handleTableAccess} className="w-full font-bold">Accedi</Button>
             </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-professional border border-primary/20">
                <Users weight="bold" size={32} className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Ristorante</h1>
            </div>

            <Card className="glass-card border-0 shadow-professional-lg">
              <CardHeader>
                <CardTitle className="text-xl text-center">Login Staff</CardTitle>
                <CardDescription className="text-center">admin / admin123</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Utente</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="admin123"
                    className="bg-black/20"
                  />
                </div>
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full font-bold shadow-gold mt-2"
                >
                  {loading ? '...' : 'Accedi'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
