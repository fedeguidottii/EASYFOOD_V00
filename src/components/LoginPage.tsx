import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { User, Table } from '../services/types'
import { QrCode, Users, Crown } from '@phosphor-icons/react'

interface Props {
  onLogin: (user: User) => void
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

  // We'll fetch users on demand or on mount, but for login we can just fetch all users once or query by username
  // For simplicity, let's fetch all users on mount since the list is small
  const [users, setUsers] = useState<User[]>([])
  const [tables, setTables] = useState<Table[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedUsers = await DatabaseService.getUsers()
        const restaurants = await DatabaseService.getRestaurants()

        let fetchedTables: Table[] = []
        if (restaurants && restaurants.length > 0) {
          fetchedTables = await DatabaseService.getTables(restaurants[0].id)
        }

        setUsers(fetchedUsers || [])
        // Map tables to include compatibility properties
        setTables((fetchedTables || []).map(t => ({
          ...t,
          name: t.number,
          isActive: true // Default to true as we don't have this column anymore
        })))
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

    // Check against email and password_hash
    // Note: In production, password hashing should be done securely (e.g. bcrypt) on the server.
    // Check against email and password_hash
    // Also check name case-insensitively to allow 'admin' to match 'Admin'
    const foundUser = (users || []).find(u =>
      (u.email === username || (u.name && u.name.toLowerCase() === username.toLowerCase())) && u.password_hash === password
    )

    if (foundUser) {
      onLogin(foundUser)
      const roleName = foundUser.role === 'ADMIN' ? 'amministratore' : 'ristorante'
      toast.success(`Accesso ${roleName} effettuato`)
      setLoading(false)
      return
    }

    toast.error('Credenziali non valide')
    setLoading(false)
  }

  const handleTableAccess = async () => {
    setLoading(true)

    const table = (tables || []).find(t => t.id === tableCode && t.isActive)
    if (table && table.pin === pin) {
      onTableAccess(table.id)
      toast.success(`Accesso al tavolo ${table.name} effettuato`)
    } else {
      toast.error('Codice tavolo o PIN non validi')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {customerMode ? (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-professional border border-primary/20">
                <QrCode weight="bold" size={32} className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Benvenuto!</h1>
              <p className="text-muted-foreground">Inserisci il PIN del tavolo per accedere al menù</p>
            </div>

            <Card className="glass-card border-0 shadow-professional-lg">
              <CardHeader>
                <CardTitle className="text-xl text-center">Accesso al Tavolo</CardTitle>
                <CardDescription className="text-center">
                  Inserisci il PIN fornito dal cameriere
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="pin" className="text-center block">PIN Temporaneo</Label>
                  <Input
                    id="pin"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="0000"
                    maxLength={4}
                    className="text-center text-3xl font-bold tracking-[1em] h-16 bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>
                <Button
                  onClick={handleTableAccess}
                  disabled={loading || !pin}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-lg font-bold shadow-gold"
                >
                  {loading ? 'Accesso in corso...' : 'Accedi al Menù'}
                </Button>

                <div className="text-center pt-4 border-t border-white/10">
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
          </>
        ) : (
          <>
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
                  onClick={handleLogin}
                  disabled={loading || !username || !password}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-bold shadow-gold mt-2"
                >
                  {loading ? 'Accesso in corso...' : 'Accedi'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}