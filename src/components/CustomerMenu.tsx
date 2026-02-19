import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical Menu Crash:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6 text-center text-white">
          <div className="max-w-md">
            <h2 className="text-xl font-bold text-red-500 mb-4">Errore Critico</h2>
            <p className="mb-4">Si è verificato un errore durante il caricamento del menu.</p>
            <p className="text-xs text-zinc-500 mb-6 font-mono bg-zinc-900 p-2 rounded text-left overflow-auto max-h-32">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full transition-colors"
            >
              Ricarica Pagina
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
import { useSupabaseData } from '../hooks/useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DishPlaceholder } from '@/components/ui/DishPlaceholder'
// Icons
import { Minus, Plus, ShoppingCart, Trash, User, Info, X, Clock, Wallet, Check, Warning, ForkKnife, Note, Storefront, Rocket, ListNumbers, CheckCircle } from '@phosphor-icons/react'
import {
  ShoppingBasket, Utensils, ChefHat, Search,
  RefreshCw, AlertCircle, ChevronUp, ChevronDown, Layers, ArrowLeft, Send,
  ChevronRight, GripVertical, ArrowUp, ArrowDown, Menu, Bell
} from 'lucide-react'
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor,
  closestCenter, useDroppable, DragStartEvent, DragEndEvent, DragOverEvent,
  defaultDropAnimationSideEffects, DropAnimation
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Dish, Order, TableSession, Restaurant } from '../services/types'
import { getCurrentCopertoPrice } from '../utils/pricingUtils'
import { getMenuTheme, type MenuTheme, type MenuStyleKey } from '../utils/menuTheme'

// --- HELPER COMPONENTS ---

// Local interface removed, using type from services/types
import { CartItem } from '../services/types'

// Helper function for consistent course titles
const getCourseTitle = (courseNum: number): string => {
  return `Uscita ${courseNum}`
}

// Sortable Item Component with smooth animations
function SortableDishItem({ item, courseNum }: { item: CartItem, courseNum: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id, data: { item, courseNum } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
    touchAction: 'none',
    scale: isDragging ? 0.98 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center justify-between bg-zinc-900 p-3 rounded-xl border group relative cursor-grab active:cursor-grabbing touch-none select-none transition-all duration-300 ${isDragging
        ? 'border-amber-500/50 bg-zinc-800/50 shadow-lg shadow-amber-500/10'
        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80'
        }`}
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <div className={`p-1.5 rounded-lg transition-colors duration-200 ${isDragging ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
          <GripVertical className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">{item.dish?.name}</p>
          <p className="text-xs text-zinc-500">{item.quantity}x · €{((item.dish?.price || 0) * item.quantity).toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}

// Extract DishCard outside to prevent re-renders - Themed Design
const DishCard = ({
  dish,
  index,
  onSelect,
  onAdd,
  isViewOnly,
  theme
}: {
  dish: Dish,
  index: number,
  onSelect: (dish: Dish) => void,
  onAdd: (dish: Dish) => void,
  isViewOnly?: boolean,
  theme: MenuTheme
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3, delay: index * 0.03 }}
    className="flex items-center gap-4 p-4 backdrop-blur-sm shadow-lg transition-all duration-500 cursor-pointer group active:scale-[0.98]"
    style={{
      backgroundColor: theme.cardBg,
      borderRadius: theme.cardRadius,
      border: `1px solid ${theme.primaryAlpha(0.2)}`,
      boxShadow: theme.cardShadow,
    }}
    onClick={() => onSelect(dish)}
  >
    <div className="w-18 h-18 shrink-0 relative rounded-lg overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-inner border border-white/5">
      {dish.image_url ? (
        <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
      ) : (
        <DishPlaceholder className="group-hover:scale-110 transition-transform duration-700" iconSize={24} variant="pot" />
      )}
      {dish.allergens && dish.allergens.length > 0 && (
        <div className="absolute bottom-1 right-1 p-0.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgba(9,9,11,0.9)', border: `1px solid ${theme.primaryAlpha(0.2)}` }}>
          <Info className="w-2.5 h-2.5" style={{ color: theme.primary }} />
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0 py-0.5">
      <h3 className="font-normal text-base leading-tight line-clamp-1 mb-1 tracking-wide" style={{ color: theme.textPrimary, fontFamily: theme.headerFont }}>{dish.name}</h3>
      {dish.description && (
        <p className="text-xs line-clamp-1 leading-snug font-light" style={{ color: `${theme.textPrimary}99` }}>{dish.description}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-medium text-sm tracking-wide" style={{ color: theme.primary }}>€ {dish.price.toFixed(2)}</span>
      </div>
    </div>

    {!isViewOnly && (
      <Button
        size="sm"
        className="h-10 w-10 rounded-full p-0 transition-all duration-300 hover:scale-110 shrink-0"
        style={{
          backgroundColor: theme.primaryAlpha(0.1),
          border: `1px solid ${theme.primaryAlpha(0.4)}`,
          color: theme.primary,
        }}
        onClick={(e) => { e.stopPropagation(); onAdd(dish); }}
      >
        <Plus className="w-4 h-4" strokeWidth={1.5} />
      </Button>
    )}
  </motion.div>
)

// Helper for empty course drop zone
function DroppableCoursePlaceholder({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`text-center py-4 text-xs border-2 border-dashed rounded-xl transition-colors ${isOver ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 text-zinc-600'}`}
    >
      Trascina qui i piatti
    </div>
  )
}

// Helper for new course drop zone
function NewCourseDropZone({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'new-course-zone' })
  return (
    <div ref={setNodeRef} className="relative">
      <Button
        variant="outline"
        className={`w-full py-6 border-dashed rounded-2xl gap-2 transition-all ${isOver ? 'border-amber-500 bg-amber-500/10 text-amber-500 scale-105' : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500 hover:bg-amber-500/5'}`}
        onClick={onClick}
      >
        <Plus className="w-5 h-5" />
        {isOver ? 'Rilascia per creare Nuova Portata' : 'Aggiungi Nuova Portata'}
      </Button>
    </div>
  )
}

// Helper for course container drop zone
function DroppableCourse({ id, children, className, style }: { id: string, children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-all duration-300 ease-out ${isOver
        ? 'scale-[1.01]'
        : ''
        }`}
      style={style}
    >
      {children}
    </div>
  )
}

// Helper for sortable items
function SortableItem({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

const CustomerMenuBase = () => {
  // 1. Get Table ID from URL params (via generic Route)
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()

  // 2. Use Session Context
  const {
    sessionId,
    sessionStatus,
    joinSession,
    loading: sessionLoading
  } = useSession()

  // Local state for PIN entry/validation
  const [pin, setPin] = useState(['', '', '', '']) // 4 digit pin state
  const [inputPin, setInputPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [isInitLoading, setIsInitLoading] = useState(true) // Prevent PIN flicker during init

  // Safe timeout for initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitLoading) {
        console.warn("Forcing init loading completion after timeout")
        setIsInitLoading(false)
      }
    }, 8000)
    return () => clearTimeout(timer)
  }, [isInitLoading])

  // Data hooks
  const [activeSession, setActiveSession] = useState<TableSession | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(() => localStorage.getItem('restaurantId')) // Init from localStorage
  const [restaurantName, setRestaurantName] = useState<string>('') // Restaurant name for PIN screen
  const [fullRestaurant, setFullRestaurant] = useState<Restaurant | null>(null)
  const [restaurantSuspended, setRestaurantSuspended] = useState(false)
  const [courseSplittingEnabled, setCourseSplittingEnabled] = useState(true) // Default to true for backwards compat
  const [isTableActive, setIsTableActive] = useState(true) // Check if table has active session
  const [isViewOnly, setIsViewOnly] = useState(false) // New state for view-only mode

  // Check if table is active (has ANY open session) when Not Authenticated
  // Also subscribe to real-time changes so if waiter activates after customer scans QR,
  // the customer auto-sees the PIN screen
  useEffect(() => {
    if (!tableId) return

    const checkTableActivity = async () => {
      const { data } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .single()

      setIsTableActive(!!data)

      // If session found and not authenticated, try to join it
      if (data && !isAuthenticated && restaurantId) {
        joinSession(tableId, restaurantId)
      }
    }
    checkTableActivity()

    // Real-time subscription: detect when a session is created/updated for this table
    const channel = supabase
      .channel(`table-activity-watch:${tableId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const session = payload.new as any
          if (session.status === 'OPEN') {
            setIsTableActive(true)
            // Auto-join the new session
            if (!isAuthenticated && restaurantId) {
              joinSession(tableId, restaurantId)
            }
          } else if (session.status === 'CLOSED' || session.status === 'PAID') {
            setIsTableActive(false)
          }
        }
        if (payload.eventType === 'DELETE') {
          setIsTableActive(false)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAuthenticated, tableId, restaurantId, joinSession])

  // Attempt joining session on mount if tableId exists and no sessionId
  useEffect(() => {
    if (tableId && !sessionId) {
      // Need restaurantId to join session via RPC properly or fetch tables first
      const init = async () => {
        try {
          const { data: tableData, error } = await supabase
            .from('tables')
            .select('restaurant_id, restaurants(*)')
            .eq('id', tableId)
            .single()

          if (error) {
            console.error('Error fetching table:', error)
            if (error.message?.includes('Failed to fetch')) {
              toast.error("Errore di connessione. Verifica la tua connessione internet.")
            } else if (error.code === 'PGRST116') {
              toast.error("Tavolo non trovato. QR code non valido.")
            } else {
              toast.error("Errore nel caricamento del tavolo.")
            }
            return
          }

          if (tableData) {
            // Check if restaurant is active - Supabase join returns object or array
            const restaurantsData = tableData.restaurants as unknown
            const restaurant = (Array.isArray(restaurantsData) ? restaurantsData[0] : restaurantsData) as Restaurant | null

            if (restaurant) {
              setRestaurantName(restaurant.name)
              setFullRestaurant(restaurant)
              setCourseSplittingEnabled(restaurant.enable_course_splitting !== false)
              if (restaurant.isActive === false) { // Note: types.ts uses isActive, DB uses is_active. Checking both for safety or assuming mapped
                // Check raw DB field if possible or mapped
                // Assuming raw return:
                if ((restaurant as any).is_active === false) {
                  setRestaurantId(null)
                  setRestaurantSuspended(true)
                  setIsAuthenticated(false)
                  return
                }
              }

              // View Only Logic
              if (restaurant.view_only_menu_enabled) {
                setIsViewOnly(true)
                setIsAuthenticated(true) // Bypass PIN
                // We don't join session here because we don't need a session to view menu? 
                // Actually, we might still want to join if a session exists to show 'orders' if any?
                // But user requirement says: "valid only for visualization... no PIN required".
                // So we treat it as authenticated but restricted.
              }
            }

            setRestaurantId(tableData.restaurant_id)
            // Attempt auto-join
            joinSession(tableId, tableData.restaurant_id)
          } else {
            toast.error("Tavolo non trovato.")
          }
        } catch (err: any) {
          console.error('Init error:', err)
          if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
            toast.error("Impossibile connettersi al server. Riprova più tardi.")
          } else {
            toast.error("Errore imprevisto. Riprova.")
          }
        } finally {
          setIsInitLoading(false)
        }
      }
      init()
    } else if (tableId && sessionId && !restaurantId) {
      // Session exists but restaurantId not in state - fetch it
      const fetchRestaurantId = async () => {
        try {
          const { data: tableData } = await supabase
            .from('tables')
            .select('restaurant_id, restaurants(*)')
            .eq('id', tableId)
            .single()

          if (tableData && tableData.restaurants) {
            const restaurantsData = tableData.restaurants as unknown
            const restaurant = (Array.isArray(restaurantsData) ? restaurantsData[0] : restaurantsData) as Restaurant | null
            if (restaurant) {
              setRestaurantName(restaurant.name)
              setFullRestaurant(restaurant)
              setCourseSplittingEnabled(restaurant.enable_course_splitting !== false)
              if (restaurant.isActive === false) {
                // Check raw DB field if needed
                if ((restaurant as any).is_active === false) {
                  setRestaurantSuspended(true)
                  setIsAuthenticated(false)
                }
              }
            }
            setRestaurantId(tableData.restaurant_id)
          }
        } finally {
          setIsInitLoading(false)
        }
      }
      fetchRestaurantId()
    } else {
      // No work to do - ensure loading is false
      setIsInitLoading(false)
    }
  }, [tableId, sessionId, joinSession, restaurantId])

  // Auto-authenticate from localStorage if session matches
  useEffect(() => {
    if (sessionId && restaurantId) {
      const checkSession = async () => {
        // Fetch session details to get the correct PIN
        const session = await DatabaseService.getSessionById(sessionId)

        if (session) {
          setActiveSession(session)

          // Check if saved session matches current session AND PIN is correct
          const savedSessionId = localStorage.getItem('customerSessionId')
          const savedPin = localStorage.getItem('sessionPin')

          // Verify session status - if CLOSED, force logout/re-auth
          if (session.status === 'CLOSED') {
            localStorage.removeItem('customerSessionId')
            localStorage.removeItem('sessionPin')
            setIsAuthenticated(false)
            setAuthChecking(false)
            return
          }

          if (savedSessionId === sessionId && savedPin === session.session_pin) {
            // Session is still the same and PIN matches - auto authenticate
            setIsAuthenticated(true)
          } else if (savedSessionId !== sessionId) {
            // Session changed (table was reset) - clear old credentials
            localStorage.removeItem('customerSessionId')
            localStorage.removeItem('sessionPin')
            if (!isViewOnly) setIsAuthenticated(false)
            // CRITICAL: Do NOT navigate away. Just show PIN screen by setting auth to false.
          }
        } else {
          // Session invalid or closed/deleted
          localStorage.removeItem('customerSessionId')
          localStorage.removeItem('customerSessionId')
          localStorage.removeItem('sessionPin')
          if (!isViewOnly) setIsAuthenticated(false)
        }
        setAuthChecking(false)
      }
      checkSession()
    } else if (!sessionLoading && !sessionId && tableId) {
      // If loading finished but no session (and we have tableId), stop checking
      // This handles invalid table/no session cases where we show specific errors
      setAuthChecking(false)
    }
  }, [sessionId, restaurantId, sessionLoading, tableId])

  // Real-time subscription to detect when session is closed (table paid/emptied)
  // This ensures authenticated customers are immediately redirected to PIN screen
  useEffect(() => {
    // Only subscribe if we have an active session
    if (!tableId || !isAuthenticated || !activeSession?.id) return

    const currentSessionId = activeSession.id

    const sessionChannel = supabase
      .channel(`customer-session-watch:${currentSessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        // Filter by session ID, not table_id, for precise targeting
        filter: `id=eq.${currentSessionId}`
      }, async (payload) => {
        // Handle session updates (status changed to CLOSED)
        if (payload.eventType === 'UPDATE') {
          const updatedSession = payload.new as any
          // Double-check session ID matches before logging out
          if (updatedSession.id === currentSessionId && updatedSession.status === 'CLOSED') {
            // Session closed - force logout
            localStorage.removeItem('customerSessionId')
            localStorage.removeItem('sessionPin')
            setIsAuthenticated(false)
            setActiveSession(null)
            setPin(['', '', '', ''])
            toast.info('Il tavolo è stato chiuso. Inserisci il nuovo codice per ordinare.', {
              duration: 4000,
              style: { background: '#3b82f6', color: 'white' }
            })
          }
        }

        // Handle session deletion
        if (payload.eventType === 'DELETE') {
          const deletedSession = payload.old as any
          // Only log out if the deleted session is OUR session
          if (deletedSession?.id === currentSessionId) {
            localStorage.removeItem('customerSessionId')
            localStorage.removeItem('sessionPin')
            setIsAuthenticated(false)
            setActiveSession(null)
            setPin(['', '', '', ''])
            toast.info('Il tavolo è stato chiuso. Inserisci il nuovo codice per ordinare.', {
              duration: 4000,
              style: { background: '#3b82f6', color: 'white' }
            })
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sessionChannel)
    }
  }, [tableId, isAuthenticated, activeSession?.id])

  // Real-time subscription for Restaurant Settings (Independent of session/auth)
  useEffect(() => {
    if (!restaurantId) return

    const restaurantChannel = supabase
      .channel(`restaurant-settings-watch:${restaurantId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurants',
        filter: `id=eq.${restaurantId}`
      }, (payload) => {
        const newSettings = payload.new as Restaurant
        if (newSettings) {
          // Update full restaurant object for theme sync
          setFullRestaurant((prev: any) => ({ ...prev, ...newSettings }))
          setRestaurantName(newSettings.name)

          // Update course splitting setting immediately
          setCourseSplittingEnabled(newSettings.enable_course_splitting !== false)

          // Optionally update active status if changed
          if ((newSettings as any).is_active === false) {
            setRestaurantSuspended(true)
            setIsAuthenticated(false)
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(restaurantChannel)
    }
  }, [restaurantId])

  const handlePinSubmit = async (enteredPin: string) => {
    // Retry joining session if missing (connection recovery)
    if (!activeSession) {
      if (tableId && restaurantId) {
        toast.loading("Tentativo di connessione al tavolo...")
        const joined = await joinSession(tableId, restaurantId)
        if (!joined) {
          toast.dismiss()
          toast.error("Impossibile connettersi. Scansiona di nuovo il QR.")
          return
        }
        // If joined successfully, we need to wait for activeSession to update in the effect
        // But we can't wait for React state here easily without refactoring. 
        // For now, let's ask user to click again once connected, or rely on the fact that joinSession sets state.
        // However, joinSession updates Context state, which updates formatted activeSession asynchronously.

        // Let's just return h let the user click again (or auto-submit if we could)
        // Better UX: check session via DB directly here to verify PIN immediately
        const session = await DatabaseService.getSessionById(sessionId || (await DatabaseService.getActiveSession(tableId))?.id!)
        if (session && enteredPin === session.session_pin) {
          toast.dismiss()
          setActiveSession(session)
          setIsAuthenticated(true)
          localStorage.setItem('sessionPin', enteredPin)
          localStorage.setItem('customerSessionId', session.id)
          toast.success("Accesso effettuato!")
          return
        }
      } else {
        toast.error("Dati tavolo mancanti. Riprova a scansionare il QR.")
        return
      }
    }

    if (activeSession && enteredPin === activeSession.session_pin) {
      setIsAuthenticated(true)
      localStorage.setItem('sessionPin', enteredPin)
      localStorage.setItem('customerSessionId', activeSession.id)
      toast.success("Accesso effettuato!")
    } else if (activeSession) {
      setPinError(true)
      toast.error("PIN non valido")
      setTimeout(() => setPinError(false), 2000)
      setPin(['', '', '', ''])
    }
  }

  // Handle individual PIN digit input
  const handlePinDigitChange = (index: number, value: string) => {
    // Sanitize input: allow only numbers
    const sanitizedValue = value.replace(/\D/g, '').slice(-1)

    // Update state
    const newPin = [...pin]
    newPin[index] = sanitizedValue
    setPin(newPin)

    // Auto-focus logic
    if (sanitizedValue) {
      // If a digit was entered, move to next field if valid
      if (index < 3) {
        const nextInput = document.getElementById(`pin-${index + 1}`)
        nextInput?.focus()
      } else {
        // If last digit entered, try to submit
        if (newPin.every(d => d !== '')) {
          handlePinSubmit(newPin.join(''))
        }
      }
    } else {
      // Handle deletion (empty value) - stay on current or move back logic is in OnKeyDown usually
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`)
      prevInput?.focus()
    }
  }

  // --- RENDER GATES ---

  if (restaurantSuspended) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500">
        <Storefront size={40} weight="duotone" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Servizio Non Disponibile</h1>
      <p className="text-zinc-400 max-w-md">
        Il servizio per &quot;{restaurantName || 'questo ristorante'}&quot; è momentaneamente sospeso.
        Ci scusiamo per il disagio.
      </p>
    </div>
  )

  if (!tableId) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-neutral-950 to-zinc-900 p-6">
      <div className="text-center text-amber-100/60">
        <p className="text-lg font-light tracking-wide">QR Code non valido</p>
      </div>
    </div>
  )

  if (!isTableActive && !isAuthenticated) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 text-zinc-500 border border-zinc-800">
        <Storefront size={40} weight="duotone" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Tavolo Non Attivo</h1>
      <p className="text-zinc-400 max-w-md">
        Questo tavolo non è stato ancora attivato.
        Chiedi al personale di attivarlo per ordinare.
      </p>
    </div>
  )

  // Compute menu theme from restaurant settings
  const theme = useMemo(() => getMenuTheme(
    (fullRestaurant?.menu_style as MenuStyleKey) || 'elegant',
    fullRestaurant?.menu_primary_color || '#f59e0b'
  ), [fullRestaurant?.menu_style, fullRestaurant?.menu_primary_color])

  if (sessionLoading || authChecking || isInitLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.pageBgGradient }}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full" style={{ border: `1px solid ${theme.primaryAlpha(0.2)}` }}></div>
          <div className="absolute inset-0 w-20 h-20 rounded-full animate-spin" style={{ border: '1px solid transparent', borderTopColor: theme.primary }}></div>
          <div className="absolute inset-2 w-16 h-16 rounded-full" style={{ border: `1px solid ${theme.primaryAlpha(0.1)}` }}></div>
        </div>
        <p className="font-light tracking-[0.2em] text-sm uppercase" style={{ color: `${theme.primary}99` }}>Caricamento</p>
      </div>
    </div>
  )

  // LOGIN SCREEN (PIN) - Themed Design
  if (!isAuthenticated && !isViewOnly) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: theme.pageBgGradient, color: theme.textPrimary }}>

        <div className="w-full max-w-sm flex flex-col items-center gap-12">

          {/* Minimal Header */}
          <div className="text-center space-y-4">
            {fullRestaurant?.logo_url ? (
              <div className="flex justify-center mb-6">
                <img
                  src={fullRestaurant.logo_url}
                  alt={restaurantName}
                  className="h-32 w-auto max-w-[200px] object-contain"
                  style={{ filter: `drop-shadow(0 0 25px ${theme.primaryAlpha(0.2)})` }}
                />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-light tracking-[0.2em] uppercase" style={{ fontFamily: theme.headerFont, color: theme.textPrimary }}>
                  {restaurantName || 'Ristorante'}
                </h1>
                <div className="w-8 h-px mx-auto" style={{ backgroundColor: theme.primaryAlpha(0.5) }}></div>
              </>
            )}
          </div>

          {/* Minimal PIN Input */}
          <div className="w-full">
            <p className="text-center text-xs tracking-widest uppercase mb-8" style={{ color: theme.textMuted }}>Inserisci codice tavolo</p>

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => {
                return (
                  <input
                    key={index}
                    id={`pin-${index}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[index]}
                    onChange={(e) => handlePinDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-12 h-16 text-center text-2xl font-light bg-transparent border-b-2 outline-none transition-all duration-300 rounded-none"
                    style={{
                      fontFamily: theme.headerFont,
                      ...(pinError
                        ? { borderColor: '#ef4444', color: '#ef4444' }
                        : pin[index]
                          ? { borderColor: theme.primary, color: theme.textPrimary }
                          : { borderColor: theme.textMuted, color: theme.textSecondary }
                      )
                    }}
                    onClick={(e) => {
                      const firstEmptyIndex = pin.findIndex(d => d === '')
                      const targetIndex = firstEmptyIndex === -1 ? 3 : firstEmptyIndex
                      if (index !== targetIndex) {
                        const targetInput = document.getElementById(`pin-${targetIndex}`)
                        targetInput?.focus()
                      }
                    }}
                    autoFocus={index === 0}
                  />
                )
              })}
            </div>

            {/* Error Message */}
            <div className="h-6 mt-4 flex justify-center">
              {pinError && (
                <p className="text-red-500 text-xs tracking-wide animate-pulse">Codice non valido</p>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <p className="text-[10px] tracking-widest uppercase mt-auto" style={{ color: theme.textMuted }}>
            Il codice è sul segnaposto
          </p>

        </div>
      </div>
    )
  }

  // MAIN MENU CONTENT
  // Pass restaurantId to hooks

  if (!activeSession?.restaurant_id && !restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: theme.pageBgGradient, color: theme.textPrimary }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-4" style={theme.spinnerBorderStyle}></div>
          <p className="text-sm opacity-70 animate-pulse">Inizializzazione menu...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AuthorizedMenuContent
        restaurantId={activeSession?.restaurant_id || restaurantId!}
        tableId={tableId}
        sessionId={sessionId!}
        activeSession={activeSession!}
        isViewOnly={isViewOnly}
        isAuthenticated={isAuthenticated}
        fullRestaurant={fullRestaurant}
      />
    </ErrorBoundary>
  )
}



// Refactored Content Component to keep logic clean
function AuthorizedMenuContent({ restaurantId, tableId, sessionId, activeSession, isViewOnly, isAuthenticated, fullRestaurant: propsFullRestaurant }: { restaurantId: string, tableId: string, sessionId: string, activeSession: TableSession, isViewOnly?: boolean, isAuthenticated: boolean, fullRestaurant?: any }) {
  // Using passed props instead of resolving them
  const isWaiterMode = false // Or pass as prop if needed

  // NOTE: removed redundant restaurantId/tableId state since they are passed as props

  const [restaurantName, setRestaurantName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tableName, setTableName] = useState<string>('')
  const [dataInitialized, setDataInitialized] = useState(false) // Prevent double loading

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  // const [activeSession, setSession] = useState<TableSession | null>(null) // Removed
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)

  // New state for course splitting modal
  const [showCourseSelectionModal, setShowCourseSelectionModal] = useState(false)
  const [pendingDishToAdd, setPendingDishToAdd] = useState<{ dish: Dish, quantity: number, notes: string } | null>(null)

  // Derived state for sorted cart
  const sortedCart = useMemo(() => {
    return [...cart].sort((a, b) => (a.course_number || 1) - (b.course_number || 1))
  }, [cart])
  const [previousOrders, setPreviousOrders] = useState<Order[]>([])
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false)
  const [dishNote, setDishNote] = useState('')
  const [dishQuantity, setDishQuantity] = useState(1)

  const [maxCourse, setMaxCourse] = useState(1)
  const [currentCourse, setCurrentCourse] = useState(1)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [activeWaitCourse, setActiveWaitCourse] = useState(1) // Waiter Mode: Selected course for new items
  const [courseSplittingEnabled, setCourseSplittingEnabled] = useState(true) // Default to true
  const [fullRestaurantState, setFullRestaurantState] = useState<any>(null) // Local state if needed

  // Use prop if available, otherwise local state
  const fullRestaurant = propsFullRestaurant || fullRestaurantState

  // Compute menu theme from restaurant settings
  const theme = useMemo(() => getMenuTheme(
    (fullRestaurant?.menu_style as MenuStyleKey) || 'elegant',
    fullRestaurant?.menu_primary_color || '#f59e0b'
  ), [fullRestaurant?.menu_style, fullRestaurant?.menu_primary_color])

  // Scroll to category helper
  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId)
    const element = document.getElementById(`category-${categoryId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Call Waiter FAB state
  const [callWaiterDisabled, setCallWaiterDisabled] = useState(false)

  // Handler to call waiter - updates tables.last_assistance_request
  const handleCallWaiter = async () => {
    if (!tableId || callWaiterDisabled) return
    try {
      const { error } = await supabase
        .from('tables')
        .update({ last_assistance_request: new Date().toISOString() })
        .eq('id', tableId)

      if (error) throw error

      toast.success("Cameriere avvisato! Arriva subito 🏃", {
        duration: 3000,
        style: { background: '#10B981', color: '#fff', border: 'none' }
      })

      // 30 second cooldown to prevent spam
      setCallWaiterDisabled(true)
      setTimeout(() => setCallWaiterDisabled(false), 30000)
    } catch (err) {
      console.error('Error calling waiter:', err)
      toast.error("Errore. Riprova.")
    }
  }

  // Helper to generate PIN
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString()

  // --- Realtime Order Updates ---
  useEffect(() => {
    if (!sessionId) return

    // 1. Subscribe to new Orders (to fetch them when created)
    const orderChannel = supabase
      .channel(`orders-watch:${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `table_session_id=eq.${sessionId}`
      }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(orderChannel)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || previousOrders.length === 0) return

    // 2. Subscribe to Order Items updates (for status changes: SERVED etc)
    const orderIds = previousOrders.map(o => o.id)
    // Create filter string: order_id=in.(id1,id2,...)
    const filter = `order_id=in.(${orderIds.join(',')})`

    const itemsChannel = supabase
      .channel(`order-items-watch:${orderIds.join('-')}`) // Unique channel name per ID set
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'order_items',
        filter: filter
      }, () => {
        // Refresh orders when any item status changes
        fetchOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(itemsChannel)
    }
  }, [sessionId, previousOrders.map(o => o.id).join(',')])

  // --- Shared Cart Implementation ---
  const fetchCart = useCallback(async () => {
    if (!sessionId) return
    try {
      const items = await DatabaseService.getCartItems(sessionId)
      setCart(items)
      // Update max course
      const max = items.reduce((m, i) => Math.max(m, i.course_number || 1), 1)
      setMaxCourse(max)
    } catch (err) {
      console.error("Error fetching cart:", err)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    fetchCart()

    const cartChannel = supabase
      .channel(`cart-watch:${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cart_items',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        fetchCart()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(cartChannel)
    }
  }, [sessionId, fetchCart])

  // --- FIX DOUBLE LOADING: Consolidated data fetch ---
  const [categories, setCategories] = useState<Category[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])

  const initMenu = useCallback(async () => {
    if (!tableId || !restaurantId || dataInitialized) {
      if (!tableId || !restaurantId) {
        // If missing data, stop loading so we don't show infinite spinner. 
        // Error will be shown if tableId is missing by parent check, 
        // but if restaurantId is missing we need to handle it.
        setIsLoading(false)
      }
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch table data and restaurant info in one batch
      // Fixing query logic to be safer:
      // We already have restaurantId passed as prop which is consistent.
      // But let's re-fetch strictly by restaurant_id to be safe and consistent.
      const { data: tableData } = await supabase.from('tables').select('restaurant_id, number').eq('id', tableId).single()
      const { data: restData } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
      const { data: catsData } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('order', { ascending: true })
      // Use maybeSingle or just data for dishes
      const { data: dishesData } = await supabase.from('dishes').select('*').eq('restaurant_id', restaurantId).eq('is_active', true)

      if (tableData) setTableName(tableData.number || '')
      if (restData) {
        setRestaurantName(restData.name || '')
        if (restData) {
          setRestaurantName(restData.name || '')
          if (!propsFullRestaurant) setFullRestaurantState(restData)
          setCourseSplittingEnabled(restData.enable_course_splitting ?? true)
        }
        setCourseSplittingEnabled(restData.enable_course_splitting ?? true)
      }
      if (catsData) setCategories(catsData)
      if (dishesData) setDishes(dishesData)

      setDataInitialized(true)
    } catch (err: any) {
      setError(err.message || "Errore di connessione")
    } finally {
      setIsLoading(false)
    }
  }, [tableId, restaurantId, dataInitialized])

  // Single effect to initialize data - no double loading
  useEffect(() => {
    initMenu()
  }, [initMenu])

  // Safety Timeout for Loading State
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn("Forcing loading completion after timeout")
        setIsLoading(false)
        if (!restaurantName && !error) {
          setError("Tempo di attesa scaduto. Riprova.")
        }
      }
    }, 10000) // 10 seconds timeout

    return () => clearTimeout(timer)
  }, [isLoading, restaurantName, error])

  // Sort categories by order field properly
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const orderA = a.order ?? 9999
      const orderB = b.order ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [categories])

  const filteredDishes = useMemo(() => {
    let d = dishes
    // REMOVED CATEGORY FILTERING TO ALLOW SCROLLING
    // if (activeCategory !== 'all') d = d.filter(dish => dish.category_id === activeCategory)
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase()
      d = d.filter(dish => dish.name.toLowerCase().includes(lowerTerm) || dish.description?.toLowerCase().includes(lowerTerm))
    }
    return d
  }, [dishes, activeCategory, searchTerm])

  // Group dishes by category for dividers
  const dishesByCategory = useMemo(() => {
    // REMOVED EARLY RETURN TO ALLOW SCROLLING - ALWAYS GROUP ALL
    // if (activeCategory !== 'all') return null
    const grouped: { category: Category, dishes: Dish[] }[] = []
    sortedCategories.forEach(cat => {
      const categoryDishes = filteredDishes.filter(d => d.category_id === cat.id)
      if (categoryDishes.length > 0) {
        grouped.push({ category: cat, dishes: categoryDishes })
      }
    })
    return grouped
  }, [sortedCategories, filteredDishes, activeCategory])

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      // Check if AYCE is active for this session
      const isAyce = activeSession?.ayce_enabled ?? false
      const price = item.dish?.price || 0
      const isDishAyce = item.dish?.is_ayce

      // If AYCE is active and the dish is included in AYCE, price is 0
      const itemPrice = (isDishAyce && isAyce) ? 0 : price
      return total + (itemPrice * item.quantity)
    }, 0)
  }, [cart, activeSession])
  const cartCount = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart])
  const historyTotal = useMemo(() => previousOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0), [previousOrders])
  const grandTotal = cartTotal + historyTotal

  const cartByCourse = useMemo(() => {
    const grouped: { [key: number]: CartItem[] } = {}
    cart.forEach(item => {
      const course = item.course_number || 1
      if (!grouped[course]) grouped[course] = []
      grouped[course].push(item)
    })
    return grouped
  }, [cart])

  const courseNumbers = useMemo(() => Object.keys(cartByCourse).map(Number).sort((a, b) => a - b), [cartByCourse])

  const fetchOrders = React.useCallback(async () => {
    if (!sessionId) return

    const { data: orders } = await supabase
      .from('orders')
      .select('*, items:order_items(*, dishes(*))')
      .eq('table_session_id', sessionId)
      .order('created_at', { ascending: false })

    if (orders) setPreviousOrders(orders as any[])
  }, [sessionId])

  useEffect(() => {
    fetchOrders()

    // Real-time subscription for orders
    const channel = supabase
      .channel(`orders:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_session_id=eq.${sessionId}` }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchOrders])

  const quickAddToCart = (dish: Dish) => {
    // OLD: Immediately added +1
    // NEW Requirements: Always open popup
    setSelectedDish(dish)
    setDishQuantity(1)
    setDishNote('')
  }

  const handleAddClick = (dish: Dish, quantity: number, notes: string) => {
    if (fullRestaurant?.enable_course_splitting) {
      setPendingDishToAdd({ dish, quantity, notes })
      if (maxCourse < 2) setMaxCourse(2) // Ensure at least 2 courses are shown initially
      setShowCourseSelectionModal(true)
    } else {
      addToCart(dish, quantity, notes, 1)
    }
  }

  const addToCart = async (dish: Dish, quantity: number = 1, notes: string = '', courseNum?: number) => {
    if (!sessionId) return
    const targetCourse = courseNum !== undefined ? courseNum : currentCourse

    try {
      await DatabaseService.addToCart({
        session_id: sessionId,
        dish_id: dish.id,
        quantity,
        notes,
        course_number: targetCourse
      })

      if (quantity > 0) {
        setIsCartAnimating(true)
        setTimeout(() => setIsCartAnimating(false), 500)
        toast.success(`Aggiunto al carrello`, { position: 'top-center', duration: 1500, style: { background: '#10B981', color: '#fff', border: 'none' } })
      }
      setSelectedDish(null)
      setDishNote('')
      setDishQuantity(1)
      setPendingDishToAdd(null)
      setShowCourseSelectionModal(false)
    } catch (err) {
      console.error("Error adding to cart:", err)
      toast.error("Errore aggiunta al carrello")
    }
  }

  const updateCartItemQuantity = async (cartId: string, delta: number) => {
    const item = cart.find(i => i.id === cartId)
    if (!item) return
    const newQuantity = item.quantity + delta
    try {
      await DatabaseService.updateCartItem(cartId, { quantity: newQuantity })
    } catch (err) {
      console.error("Error updating cart:", err)
    }
  }

  const moveItemToCourse = async (cartId: string, newCourse: number) => {
    try {
      await DatabaseService.updateCartItem(cartId, { course_number: newCourse })
      toast.success(`Piatto spostato alla Portata ${newCourse}`, { duration: 1500 })
    } catch (err) {
      console.error("Error moving item:", err)
      toast.error("Errore spostamento piatto")
      fetchCart()
    }
  }

  const [activeDragItem, setActiveDragItem] = useState<CartItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 15 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const item = cart.find(i => i.id === active.id)
    if (item) setActiveDragItem(item)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find active item
    const activeItem = cart.find(i => i.id === activeId)
    if (!activeItem) return

    const optimisticUpdate = (newCourse: number) => {
      setCart(items => items.map(item =>
        item.id === activeId ? { ...item, course_number: newCourse } : item
      ))
    }

    // 1. Drop on New Course Zone
    if (overId === 'new-course-zone') {
      const target = maxCourse + 1
      if (activeItem.course_number !== target) {
        optimisticUpdate(target)
      }
      return
    }

    // 2. Drop on Course Container
    if (overId.startsWith('course-')) {
      const courseNum = parseInt(overId.split('-')[1])
      if (!isNaN(courseNum) && activeItem.course_number !== courseNum) {
        optimisticUpdate(courseNum)
      }
      return
    }

    // 3. Drop on Item
    const overItem = cart.find(i => i.id === overId)
    if (overItem && activeItem.course_number !== overItem.course_number) {
      optimisticUpdate(overItem.course_number || 1)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    let finalCourse: number | null = null

    if (overId === 'new-course-zone') {
      finalCourse = maxCourse + 1
    } else if (overId.startsWith('course-')) {
      finalCourse = parseInt(overId.split('-')[1])
    } else {
      const overItem = cart.find(i => i.id === overId)
      if (overItem) {
        finalCourse = overItem.course_number || 1
      }
    }


    if (finalCourse !== null && !isNaN(finalCourse)) {
      await moveItemToCourse(activeId, finalCourse)
    }
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  const addNewCourse = () => {
    const newCourseNum = maxCourse + 1
    setMaxCourse(newCourseNum)
    toast.success(`Portata ${newCourseNum} aggiunta`, { position: 'top-center', duration: 1500 })
  }

  const handleSubmitClick = () => {
    // In Waiter Mode, we allow "Auto-Start" of the activeSession if it doesn't exist.
    // In Customer Mode (QR), activeSession MUST exist (via PIN login or scan).
    if (!activeSession && !isWaiterMode) {
      toast.error("Nessuna activeSessione attiva. Apri prima il tavolo.")
      return
    }
    if (cart.length === 0) return

    setShowConfirmDialog(true)
  }

  const submitOrder = async () => {
    if ((!activeSession && !isWaiterMode) || cart.length === 0 || !restaurantId) return

    setIsOrderSubmitting(true)
    try {
      let activeSessionId = activeSession?.id

      // AUTO-ACTIVATE SESSION IF MISSING (Waiter Mode Only)
      if (!activeSession && isWaiterMode) {
        try {
          const newSession = await DatabaseService.createSession({
            restaurant_id: restaurantId,
            table_id: tableId,
            status: 'OPEN',
            opened_at: new Date().toISOString(),
            session_pin: generatePin(),
            customer_count: 1 // Default to 1 for quick auto-start
          })
          activeSessionId = newSession.id
          // setSession removed - reliance on Context subscription
          fetchOrders()
        } catch (err) {
          console.error("Error auto-creating activeSession:", err)
          toast.error("Impossibile attivare il tavolo automaticamente.")
          setIsOrderSubmitting(false)
          return
        }
      }

      if (!activeSessionId) {
        toast.error("Errore sessione mancante. Riprova ad accedere.")
        setIsOrderSubmitting(false)
        return
      }

      const orderItems = cart.map(item => ({
        dish_id: item.dish_id,
        quantity: item.quantity,
        note: item.notes || '',
        status: 'PENDING' as const,
        course_number: item.course_number || 1
      }))

      await DatabaseService.createOrder({
        restaurant_id: restaurantId,
        table_session_id: activeSessionId,
        status: 'OPEN',
        total_amount: cartTotal
      }, orderItems)

      // Clear Cart from DB
      await DatabaseService.clearCart(activeSessionId)

      // Local state update
      setCart([])
      setMaxCourse(1)
      setCurrentCourse(1)
      setIsCartOpen(false)
      setShowConfirmDialog(false)
      toast.success('Ordine inviato! 👨‍🍳', { duration: 2000, style: { background: '#10B981', color: 'white' } })
    } catch (error) {
      console.error(error)
      toast.error('Errore invio ordine.')
    } finally {
      setIsOrderSubmitting(false)
    }
  }

  // RENDER HELPERS - LUXURY THEME
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.pageBgGradient }}>
      <div className="w-10 h-10 border-2 rounded-full animate-spin" style={theme.spinnerBorderStyle}></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: theme.pageBgGradient, color: theme.textPrimary }}>
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" style={{ borderColor: theme.primary, color: theme.primary }}>Riprova</Button>
      </div>
    </div>
  )

  return (
    <div className="h-[100dvh] font-sans select-none flex flex-col overflow-hidden" style={{ background: theme.pageBgGradient }}>
      <div className="flex-1 flex flex-col min-h-0 relative w-full">

        <header className="flex-none z-20 backdrop-blur-xl" style={{ backgroundColor: theme.headerBg, borderBottom: `1px solid ${theme.primaryAlpha(0.1)}` }}>
          <div className="w-full px-4 py-3">
            {/* Restaurant Name - Compact Header */}
            {restaurantName && (
              <div className="text-center mb-2 pb-2" style={{ borderBottom: `1px solid ${theme.divider}` }}>
                <h1 className="text-base font-light tracking-widest uppercase" style={{ fontFamily: theme.headerFont, color: theme.textPrimary }}>
                  {restaurantName}
                </h1>
              </div>
            )}

            {/* Menu Header & Search - Compact */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${theme.primaryAlpha(0.3)}`, backgroundColor: theme.cardBg }}>
                    <Utensils className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: theme.primary }} />
                  </div>
                  {activeSession && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary, border: `2px solid ${theme.pageBg}` }} />}
                </div>
                <div>
                  <h2 className="text-sm font-medium tracking-wide" style={{ color: theme.textPrimary }}>Tavolo {tableName}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: theme.textMuted }} />
                  <input
                    type="text"
                    placeholder="Cerca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-28 rounded-full pl-8 pr-3 py-1.5 text-xs placeholder:text-zinc-600 focus:outline-none focus:w-36 transition-all duration-300"
                    style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary }}
                  />
                </div>
              </div>
            </div>

            {/* Categories - Horizontally Scrollable */}
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
              <div className="flex space-x-2 w-max">
                <button
                  onClick={() => scrollToCategory('all')}
                  className="px-3 py-1.5 text-xs font-medium transition-all duration-300 border flex-shrink-0"
                  style={{
                    borderRadius: theme.badgeRadius,
                    ...(activeCategory === 'all'
                      ? theme.categoryActiveStyle
                      : { backgroundColor: theme.inputBg, color: theme.textSecondary, borderColor: theme.cardBorder }
                    )
                  }}
                >
                  Tutto
                </button>
                {sortedCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className="px-3 py-1.5 text-xs font-medium transition-all duration-300 border flex-shrink-0 whitespace-nowrap"
                    style={{
                      borderRadius: theme.badgeRadius,
                      ...(activeCategory === cat.id
                        ? theme.categoryActiveStyle
                        : { backgroundColor: theme.inputBg, color: theme.textSecondary, borderColor: theme.cardBorder }
                      )
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-32 w-full">
          <AnimatePresence mode="popLayout" initial={false}>
            {dishesByCategory?.map((group, groupIndex) => (
              <motion.div
                key={group.category.id}
                id={`category-${group.category.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.1 }}
                className="mb-8 scroll-mt-40"
              >
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 pl-1" style={{ color: `${theme.primary}cc`, fontFamily: theme.headerFont }}>
                  {group.category.name}
                </h3>
                <div className="grid gap-4">
                  {group.dishes.map((dish, index) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      index={index}
                      onSelect={setSelectedDish}
                      onAdd={(d) => quickAddToCart(d)}
                      isViewOnly={isViewOnly}
                      theme={theme}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </main>

        {/* Floating Cart Button */}
        <AnimatePresence>
          {cart.length > 0 ? (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-4 right-4 z-40"
            >
              <Button
                onClick={() => setIsCartOpen(true)}
                className="w-full h-14 text-white rounded-full flex items-center justify-between px-6 transform transition-transform active:scale-95 shadow-xl shadow-black/20"
                style={theme.floatingCartStyle}
              >
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm font-bold">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                  <span className="font-medium text-lg tracking-wide uppercase">Vedi Ordine</span>
                </div>
                <span className="font-bold text-xl">
                  €{(() => {
                    const isCopertoEnabled = activeSession?.coperto_enabled ?? true
                    let copertoTotal = 0
                    if (isCopertoEnabled) {
                      const currentCoperto = fullRestaurant
                        ? getCurrentCopertoPrice(
                          fullRestaurant,
                          fullRestaurant.lunch_time_start || '12:00',
                          fullRestaurant.dinner_time_start || '19:00'
                        ).price
                        : (fullRestaurant?.cover_charge_per_person || 0)
                      if (currentCoperto > 0) {
                        copertoTotal = currentCoperto * (activeSession?.customer_count || 1)
                      }
                    }
                    return (cartTotal + copertoTotal).toFixed(2)
                  })()}
                </span>
              </Button>
            </motion.div>
          ) : previousOrders.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none"
            >
              <Button
                onClick={() => setIsCartOpen(true)}
                className="h-10 rounded-full px-6 shadow-lg backdrop-blur-md border pointer-events-auto transition-transform active:scale-95 flex items-center gap-2"
                style={{
                  backgroundColor: `${theme.primary}15`, // Very transparent background
                  borderColor: `${theme.primary}40`,
                  color: theme.primary,
                }}
              >
                <Clock size={16} weight="bold" />
                <span className="font-medium text-sm tracking-wide uppercase">I Miei Ordini</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>


        {/* CART & HISTORY MODAL */}
        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden shadow-2xl rounded-3xl h-[85vh] flex flex-col w-[95vw]" style={{ backgroundColor: theme.dialogBg, borderColor: theme.primaryAlpha(0.2), color: theme.textPrimary }}>
            <DialogHeader className="p-4 backdrop-blur-xl flex-none" style={{ borderBottom: `1px solid ${theme.divider}`, backgroundColor: theme.cardBg }}>
              <DialogTitle className="text-center text-xl font-light uppercase tracking-widest" style={{ fontFamily: theme.headerFont, color: theme.textPrimary }}>Riepilogo</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-6">

              {/* CURRENT CART */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.primary }}>Nel Carrello</h3>
                  </div>
                  <span className="text-xs" style={{ color: theme.textMuted }}>{cart.length} articoli</span>
                </div>

                {cart.length === 0 ? (
                  <p className="text-sm italic text-center py-8 rounded-xl" style={{ color: theme.textMuted, backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>Il carrello è vuoto</p>
                ) : (
                  <div className="space-y-3">
                    {sortedCart.map((item, index) => {
                      // Logic for grouping headers
                      const showCourseHeader = fullRestaurant?.enable_course_splitting && (index === 0 || (item.course_number || 1) !== (sortedCart[index - 1].course_number || 1));

                      return (
                        <React.Fragment key={item.id}>
                          {showCourseHeader && (
                            <div className="text-xs font-bold mt-2 mb-1 px-1 uppercase tracking-widest" style={{ color: theme.textSecondary }}>
                              Portata {item.course_number || 1}
                            </div>
                          )}
                          <div className="rounded-xl p-3 flex gap-3 shadow-sm relative overflow-hidden" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                            {/* Image if available */}
                            {item.dish?.image_url ? (
                              <img src={item.dish.image_url} className="w-16 h-16 rounded-lg object-cover bg-zinc-800" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600">
                                <ForkKnife weight="duotone" size={24} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-medium text-white line-clamp-1 text-sm">{item.dish?.name}</h4>
                                <span className="font-medium text-sm whitespace-nowrap" style={{ color: theme.primary }}>€{((item.dish?.price || 0) * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.notes && <p className="text-[10px] text-zinc-500 line-clamp-1 italic">{item.notes}</p>}

                              <div className="flex items-center justify-between mt-2">
                                {/* Quantity Controls */}
                                <div className="flex items-center gap-3 rounded-lg p-0.5 shadow-inner shrink-0" style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.cardBorder}` }}>
                                  <button
                                    onClick={() => updateCartItemQuantity(item.id, -1)}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                                  >
                                    <Minus size={14} weight="bold" />
                                  </button>
                                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => updateCartItemQuantity(item.id, 1)}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                                  >
                                    <Plus size={14} weight="bold" />
                                  </button>
                                </div>

                                {/* Removed old course selection bubbles in cart */}

                                <button
                                  onClick={() => {
                                    updateCartItemQuantity(item.id, -item.quantity)
                                  }}
                                  className="text-red-400/50 hover:text-red-400 p-1.5 hover:bg-red-400/10 rounded-md transition-colors ml-auto"
                                >
                                  <Trash size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* SEND BUTTON AREA */}
              {cart.length > 0 && (
                <div className="p-4 rounded-2xl space-y-4 shadow-lg" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                  <div className="flex justify-between items-center text-sm pb-3" style={{ color: theme.textSecondary, borderBottom: `1px solid ${theme.divider}` }}>
                    <span>Totale Carrello</span>
                    <span>€{cartTotal.toFixed(2)}</span>
                  </div>
                  {/* Coperto Display in Modal */}
                  {(() => {
                    const isCopertoEnabled = activeSession?.coperto_enabled ?? true
                    if (!isCopertoEnabled) return null;
                    const currentCoperto = fullRestaurant
                      ? getCurrentCopertoPrice(
                        fullRestaurant,
                        fullRestaurant.lunch_time_start || '12:00',
                        fullRestaurant.dinner_time_start || '19:00'
                      ).price
                      : (fullRestaurant?.cover_charge_per_person || 0)
                    if (currentCoperto <= 0) return null;

                    const personCount = activeSession?.customer_count || 1;
                    const totalCoperto = currentCoperto * personCount;
                    return (
                      <div className="flex justify-between items-center text-zinc-500 text-xs pb-3 border-b border-white/5">
                        <span>Coperto ({personCount} pers.)</span>
                        <span>€{totalCoperto.toFixed(2)}</span>
                      </div>
                    )
                  })()}

                  <Button
                    className="w-full font-bold h-12 rounded-xl shadow-lg text-white"
                    style={theme.floatingCartStyle}
                    onClick={() => {
                      handleSubmitClick()
                      // Close modal after successful submission? 
                      // Check handleSubmitClick logic: it doesn't close modal but clears cart. 
                      // We should probably wait or close.
                      // Looking at handleSubmitClick: it calls submitOrder which resets cart and sets IsCartOpen(false)
                    }}
                    disabled={isOrderSubmitting}
                  >
                    {isOrderSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Invio...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Rocket weight="fill" size={18} />
                        <span>Conferma e Invia Ordine</span>
                      </div>
                    )}
                  </Button>
                </div>
              )}

              {/* HISTORY */}
              {previousOrders.length > 0 && (
                <div className="pt-6 space-y-4" style={{ borderTop: `1px solid ${theme.divider}` }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>Storico Ordini</h3>
                  {previousOrders.map(order => (
                    <div key={order.id} className="rounded-xl p-3 opacity-80 hover:opacity-100 transition-opacity" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                      <div className="flex justify-between text-sm mb-3 pb-2" style={{ borderBottom: `1px solid ${theme.divider}` }}>
                        <span className="text-xs" style={{ color: theme.textSecondary }}>Ordine delle {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-bold" style={{ color: theme.textPrimary }}>€{order.total_amount?.toFixed(2)}</span>
                      </div>
                      <div className="space-y-2">
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-zinc-500 items-start">
                            <span className="line-clamp-1 flex-1 pr-2">
                              <span className="font-bold text-zinc-400">{item.quantity}x</span> {(item.dish || dishes.find(d => d.id === item.dish_id))?.name || 'Piatto'}
                            </span>
                            <span className={`whitespace-nowrap ${item.status === 'SERVED' ? 'text-emerald-500 font-medium' : 'text-amber-500/80'}`}>
                              {item.status === 'SERVED' ? 'Servito' : 'In prep.'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </DialogContent>
        </Dialog>







        {/* Dish Detail Dialog */}
        <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
          <DialogContent className="sm:max-w-[380px] p-0 gap-0 overflow-hidden shadow-2xl rounded-3xl" style={{ backgroundColor: theme.dialogBg, borderColor: theme.primaryAlpha(0.2), color: theme.textPrimary }}>
            {selectedDish && (
              <div className="flex flex-col h-full" style={{ backgroundColor: theme.dialogBg, color: theme.textPrimary }}>
                {selectedDish.image_url ? (
                  <div className="relative h-48 w-full">
                    <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${theme.dialogBg}cc, transparent)` }} />
                  </div>
                ) : (
                  <div className="relative h-48 w-full">
                    <DishPlaceholder iconSize={48} variant="pot" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                  </div>
                )}

                <div className="flex items-start justify-between p-5 pb-0">
                  <div>
                    <h2 className="text-2xl font-light leading-tight pr-4 tracking-wide" style={{ fontFamily: theme.headerFont }}>{selectedDish.name}</h2>
                    <p className="font-bold mt-2 text-xl" style={{ color: theme.primary }}>€{selectedDish.price.toFixed(2)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDish(null)} className="-mt-2 -mr-2 hover:bg-zinc-800 rounded-full h-10 w-10" style={{ color: theme.textSecondary }}>
                    <X className="w-6 h-6" />
                  </Button>
                </div>

                <div className="p-5 space-y-5 flex-1 overflow-y-auto scrollbar-hide">
                  {selectedDish.description && (
                    <p className="text-sm font-light leading-relaxed" style={{ color: theme.textSecondary }}>{selectedDish.description}</p>
                  )}

                  {/* Quantity */}
                  <div className="flex items-center justify-between p-2 rounded-xl" style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.cardBorder}` }}>
                    <span className="text-sm font-medium pl-2" style={{ color: theme.textSecondary }}>Quantità</span>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="h-10 w-10 border-white/10 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-lg" onClick={() => setDishQuantity(q => Math.max(1, q - 1))} disabled={dishQuantity <= 1}><Minus className="w-5 h-5" /></Button>
                      <span className="w-8 text-center font-bold text-xl">{dishQuantity}</span>
                      <Button variant="outline" size="icon" className="h-10 w-10 border-white/10 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-lg" onClick={() => setDishQuantity(q => q + 1)}><Plus className="w-5 h-5" /></Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Note speciali</span>
                    <Textarea
                      placeholder="Es. Senza cipolla, cottura media..."
                      className="min-h-[80px] placeholder:text-zinc-600"
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                      value={dishNote}
                      onChange={(e) => setDishNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    className="w-full font-bold rounded-xl text-lg shadow-lg active:scale-[0.98] transition-transform h-14"
                    style={{ ...theme.ctaButtonStyle, borderRadius: theme.buttonRadius }}
                    onClick={() => handleAddClick(selectedDish, dishQuantity, dishNote)}
                  >
                    AGGIUNGI - €{(selectedDish.price * dishQuantity).toFixed(2)}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Send Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-sm shadow-2xl shadow-black/80" style={{ backgroundColor: theme.dialogBg, borderColor: theme.primaryAlpha(0.2), color: theme.textPrimary }}>
            <DialogHeader>
              <DialogTitle style={{ color: theme.primary, fontFamily: theme.headerFont }}>Conferma invio</DialogTitle>
              <DialogDescription style={{ color: theme.textSecondary }}>Inviare l'ordine in cucina?</DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                {courseNumbers.map(num => (
                  <div key={num} className="mb-2">
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: theme.primary }}>• Portata {num}</p>
                    <ul className="pl-2 space-y-1">
                      {cartByCourse[num]?.map((item, idx) => (
                        <li key={idx} className="text-xs text-zinc-300 flex justify-between">
                          <span>{item.quantity}x {item.dish?.name}</span>
                          {item.notes && <span className="text-[10px] italic text-zinc-500 max-w-[120px] truncate ml-2">({item.notes})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-sm font-bold pt-2 mt-2" style={{ borderTop: `1px solid ${theme.divider}`, color: theme.textPrimary }}>Totale Ordine: €{cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" style={{ borderColor: theme.cardBorder, backgroundColor: theme.cardBg, color: theme.textSecondary }} onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
              <Button className="flex-1 font-bold" style={theme.ctaButtonStyle} onClick={submitOrder} disabled={isOrderSubmitting}>{isOrderSubmitting ? 'Invio...' : 'Conferma'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Course Selection Modal */}
        <Dialog open={showCourseSelectionModal} onOpenChange={(open) => {
          setShowCourseSelectionModal(open)
          if (!open) {
            setPendingDishToAdd(null)
          }
        }}>
          <DialogContent className="sm:max-w-xs shadow-2xl rounded-3xl p-6" style={{ backgroundColor: theme.dialogBg, borderColor: theme.primaryAlpha(0.2), color: theme.textPrimary }}>
            <DialogHeader>
              <DialogTitle className="text-center text-xl" style={{ color: theme.primary, fontFamily: theme.headerFont }}>Scegli la Portata</DialogTitle>
              <DialogDescription className="text-center mt-1" style={{ color: theme.textSecondary }}>Quando vuoi ricevere questo piatto?</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              {Array.from({ length: maxCourse }, (_, i) => i + 1).map((courseNum) => (
                <Button
                  key={courseNum}
                  variant="outline"
                  className="h-14 rounded-xl font-bold transition-all text-lg"
                  style={{ borderColor: theme.cardBorder, backgroundColor: theme.cardBg, color: theme.textPrimary }}
                  onClick={() => {
                    if (pendingDishToAdd) {
                      addToCart(pendingDishToAdd.dish, pendingDishToAdd.quantity, pendingDishToAdd.notes, courseNum)
                    }
                  }}
                >
                  <Layers className="w-5 h-5 mr-3" style={{ color: theme.primary }} />
                  Portata {courseNum}
                </Button>
              ))}
              <Button
                variant="ghost"
                className="h-14 rounded-xl font-medium mt-2"
                style={{ color: theme.primary }}
                onClick={() => setMaxCourse(prev => prev + 1)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Aggiungi nuova portata
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Call Waiter FAB */}
        <Button
          onClick={handleCallWaiter}
          disabled={callWaiterDisabled}
          className={`fixed top-4 right-4 z-50 h-12 w-12 rounded-full shadow-xl border-2 transition-all duration-300 ${callWaiterDisabled ? 'cursor-not-allowed' : ''}`}
          style={callWaiterDisabled
            ? { backgroundColor: '#27272a', borderColor: '#3f3f46', color: '#71717a' }
            : theme.fabStyle
          }
          title={callWaiterDisabled ? 'Attendi 30 secondi...' : 'Chiama cameriere'}
        >
          <Bell className="w-5 h-5" fill="currentColor" />
        </Button>
      </div>
    </div >
  )
}

export default function CustomerMenu() {
  return (
    <ErrorBoundary>
      <CustomerMenuBase />
    </ErrorBoundary>
  )
}
