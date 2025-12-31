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
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-50 p-4 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-[400px] animate-in fade-in-50 zoom-in-95 duration-500">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 text-emerald-500 mb-6 shadow-2xl">
            <Users weight="duotone" size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bentornato</h1>
          <p className="text-sm text-zinc-400">Inserisci le tue credenziali per accedere</p>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm shadow-xl space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nome Utente</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. nomeristorante"
                className="bg-zinc-950/50 border-white/5 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-zinc-100 placeholder:text-zinc-600 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" showPassword={showPassword} className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex justify-between">
                <span>Password</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-white/5 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-zinc-100 placeholder:text-zinc-600 h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-white/10 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <Label htmlFor="remember-me" className="text-sm text-zinc-400 cursor-pointer font-normal hover:text-zinc-300 transition-colors">
                Ricordami
              </Label>
            </div>
          </div>

          <Button
            onClick={handleAdminLogin}
            disabled={isLoading || !username || !password}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-11 font-medium rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Accesso...</span>
              </div>
            ) : 'Accedi'}
          </Button>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          &copy; {new Date().getFullYear()} EASYFOOD. Tutti i diritti riservati.
        </p>
      </div>
    </div>
  )
}