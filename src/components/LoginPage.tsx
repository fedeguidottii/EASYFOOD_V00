import { motion } from 'framer-motion'
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
    // ... logic remains same
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
          // Check if restaurant is active
          if (targetRestaurant.isActive === false) {
            toast.error('Ristorante temporaneamente sospeso. Contatta l\'amministrazione.')
            setIsLoading(false)
            return
          }

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

          // Check if restaurant is active
          if (userRestaurant.isActive === false) {
            toast.error('Il tuo ristorante è stato temporaneamente sospeso. Contatta l\'assistenza.')
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-50 p-4 font-sans selection:bg-amber-500/30 overflow-hidden relative">
      {/* Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[400px] relative z-10"
      >
        <div className="text-center mb-10 space-y-2">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 text-amber-500 mb-6 shadow-2xl shadow-amber-900/10"
          >
            <Users weight="duotone" size={32} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold tracking-tight text-white"
          >
            Bentornato
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-zinc-400"
          >
            Inserisci le tue credenziali per accedere
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl space-y-6"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nome Utente</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. nomeristorante"
                className="bg-zinc-950/50 border-zinc-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-zinc-100 placeholder:text-zinc-600 h-11 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex justify-between">
                <span>Password</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-zinc-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-zinc-100 placeholder:text-zinc-600 h-11 pr-10 transition-all"
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
                className="border-white/10 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 text-black"
              />
              <Label htmlFor="remember-me" className="text-sm text-zinc-400 cursor-pointer font-normal hover:text-zinc-300 transition-colors">
                Ricordami
              </Label>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleAdminLogin}
              disabled={isLoading || !username || !password}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black h-11 font-bold rounded-lg transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed border-none"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Accesso...</span>
                </div>
              ) : 'Accedi'}
            </Button>
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-zinc-600 mt-8"
        >
          &copy; {new Date().getFullYear()} EASYFOOD. Tutti i diritti riservati.
        </motion.p>
      </motion.div>
    </div>
  )
}