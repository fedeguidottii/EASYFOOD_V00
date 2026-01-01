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

            // Always persist session to localStorage
            localStorage.setItem('easyfood_user', JSON.stringify(waiterUser))

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

          // Always persist session to localStorage
          localStorage.setItem('easyfood_user', JSON.stringify(userWithRestaurant))

          onLogin(userWithRestaurant)
          toast.success(`Benvenuto, ${userRestaurant.name}`)
          return
        }

        // Always persist session to localStorage
        localStorage.setItem('easyfood_user', JSON.stringify(user))

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-amber-50 p-4 font-sans selection:bg-amber-500/30 overflow-hidden relative">
      {/* Subtle Gold Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-amber-500/5 rounded-full blur-[150px] opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[380px] relative z-10"
      >
        <div className="text-center mb-10 space-y-4">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-900/50 border border-amber-500/20 text-amber-500 mb-6 shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)] backdrop-blur-md"
          >
            <Users weight="fill" size={32} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-light tracking-tight text-white"
          >
            Benvenuto in <span className="font-bold text-amber-500">EASYFOOD</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-zinc-500 uppercase tracking-widest font-medium"
          >
            Area Riservata Staff
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-900/30 border border-white/5 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden"
        >
          {/* Decorative top shimmer line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-50" />

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">ID Ristorante / Utente</Label>
              <div className="group relative">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Inserisci ID..."
                  className="bg-black/50 border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-indigo-50 placeholder:text-zinc-700 h-12 transition-all pl-4 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1 flex justify-between">
                <span>Password</span>
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-black/50 border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-indigo-50 placeholder:text-zinc-700 h-12 pr-10 transition-all pl-4 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-amber-500 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2 pl-1">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-white/20 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-black rounded-[4px] w-5 h-5"
              />
              <Label htmlFor="remember-me" className="text-sm text-zinc-400 cursor-pointer font-normal hover:text-white transition-colors select-none">
                Resta collegato
              </Label>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-8">
            <Button
              onClick={handleAdminLogin}
              disabled={isLoading || !username || !password}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black h-12 font-bold rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.5)] disabled:opacity-50 disabled:cursor-not-allowed border-none text-base tracking-wide"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Verifica...</span>
                </div>
              ) : 'ACCEDI'}
            </Button>
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[10px] text-zinc-700 mt-12 uppercase tracking-widest"
        >
          Secured by EASYFOOD Systems
        </motion.p>
      </motion.div>
    </div>
  )
}