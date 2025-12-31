import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { v4 as uuidv4 } from 'uuid'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { User, Table } from '../services/types'
import { Users, Eye, EyeSlash } from '@phosphor-icons/react'
import { Checkbox } from '@/components/ui/checkbox'

interface Props {
  onLogin: (user: User) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleAdminLogin = async () => {
    setIsLoading(true)

    try {
      console.log('Login attempt:', { username, password })
      const users = await DatabaseService.getUsers()
      console.log('Fetched users:', users)

      // Check for username or email match
      const user = users.find(u => {
        const nameMatch = u.name?.toLowerCase() === username.toLowerCase()
        const emailMatch = u.email?.toLowerCase() === username.toLowerCase()
        const passwordMatch = u.password_hash === password

        console.log(`Checking user ${u.name} (${u.email}):`, { nameMatch, emailMatch, passwordMatch, storedHash: u.password_hash })

        return (nameMatch || emailMatch) && passwordMatch
      })

      // Check for Waiter Login (format: restaurantSlug_cameriere)
      if (!user && username.includes('_cameriere')) {
        const restaurants = await DatabaseService.getRestaurants()
        const [slug] = username.split('_cameriere')

        const targetRestaurant = restaurants.find(r =>
          r.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
        )

        if (targetRestaurant && targetRestaurant.waiter_mode_enabled) {
          if (targetRestaurant.waiter_password === password) {
            // Successful Waiter Login
            const waiterUser: User = {
              id: uuidv4(),
              name: 'Cameriere',
              email: `waiter@${slug}.local`,
              role: 'STAFF',
              restaurant_id: targetRestaurant.id
            }

            // Remember Me: Store in localStorage
            if (rememberMe) {
              localStorage.setItem('easyfood_user', JSON.stringify(waiterUser))
            }

            onLogin(waiterUser)
            toast.success(`Benvenuto Staff - ${targetRestaurant.name}`)
            setIsLoading(false)
            return
          }
        }
      }

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
          // Attach restaurant_id to the user object
          const userWithRestaurant = { ...user, restaurant_id: userRestaurant.id }

          // Remember Me: Store in localStorage
          if (rememberMe) {
            localStorage.setItem('easyfood_user', JSON.stringify(userWithRestaurant))
          }

          onLogin(userWithRestaurant)
          toast.success(`Benvenuto, ${userRestaurant.name}`)
          return
        }

        // Remember Me for non-OWNER users
        if (rememberMe) {
          localStorage.setItem('easyfood_user', JSON.stringify(user))
        }

        onLogin(user)
        toast.success(`Benvenuto ${user.name || 'Utente'}`)
      } else {
        console.warn('Login failed: Invalid credentials')
        toast.error('Credenziali non valide')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      // Provide more specific error messages based on error type
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        toast.error('Errore di connessione al server. Verifica la tua connessione internet.')
      } else if (error.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        toast.error('Server non raggiungibile. Contatta il supporto.')
      } else {
        toast.error('Errore durante il login. Riprova.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-subtle-gradient p-4">
      <div className="w-full max-w-md space-y-8">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
                Ricordami su questo dispositivo
              </Label>
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
      </div>
    </div>
  )
}