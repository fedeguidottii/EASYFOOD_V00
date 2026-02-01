import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom' // Added useNavigate
import { useSession } from '../context/SessionContext' // Import context
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
import { Minus, Plus, ShoppingCart, Trash, User, Info, X, Clock, Wallet, Check, Warning, ForkKnife, Note, Storefront } from '@phosphor-icons/react'
import {
  ShoppingBasket, Utensils, CheckCircle, ChefHat, Search,
  RefreshCw, AlertCircle, ChevronUp, ChevronDown, Layers, ArrowLeft, Send,
  ChevronRight, GripVertical, ArrowUp, ArrowDown, Menu, History, Bell
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
    transition: transition || 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 999 : 'auto',
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 group relative cursor-grab active:cursor-grabbing touch-none select-none ${isDragging ? 'ring-2 ring-amber-500 bg-zinc-800' : ''}`}
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <div className={`p-1.5 rounded-lg ${isDragging ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-600'}`}>
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

// Extract DishCard outside to prevent re-renders - Luxury Design
const DishCard = ({
  dish,
  index,
  onSelect,
  onAdd
}: {
  dish: Dish,
  index: number,
  onSelect: (dish: Dish) => void,
  onAdd: (dish: Dish) => void
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3, delay: index * 0.03 }}
    className="flex items-center gap-4 p-4 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-amber-500/20 hover:border-amber-500/40 shadow-lg shadow-black/30 hover:shadow-amber-500/10 transition-all duration-500 cursor-pointer group active:scale-[0.98]"
    onClick={() => onSelect(dish)}
  >
    <div className="w-18 h-18 shrink-0 relative rounded-lg overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-inner border border-white/5">
      {dish.image_url ? (
        <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
      ) : (
        <DishPlaceholder className="group-hover:scale-110 transition-transform duration-700" iconSize={24} variant="pot" />
      )}
      {dish.allergens && dish.allergens.length > 0 && (
        <div className="absolute bottom-1 right-1 bg-zinc-900/90 p-0.5 rounded-full shadow-sm border border-amber-500/20">
          <Info className="w-2.5 h-2.5 text-amber-400" />
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0 py-0.5">
      <h3 className="font-normal text-base leading-tight text-white line-clamp-1 mb-1 tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>{dish.name}</h3>
      {dish.description && (
        <p className="text-xs text-white/60 line-clamp-1 leading-snug font-light">{dish.description}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-medium text-sm text-amber-400 tracking-wide">€ {dish.price.toFixed(2)}</span>
      </div>
    </div>

    <Button
      size="sm"
      className="h-10 w-10 rounded-full p-0 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 hover:border-amber-500/60 text-amber-400 transition-all duration-300 hover:scale-110 shrink-0"
      onClick={(e) => { e.stopPropagation(); onAdd(dish); }}
    >
      <Plus className="w-4 h-4" strokeWidth={1.5} />
    </Button>
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
function DroppableCourse({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-colors ${isOver ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
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

const CustomerMenu = () => {
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

  // Data hooks
  const [activeSession, setActiveSession] = useState<TableSession | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(() => localStorage.getItem('restaurantId')) // Init from localStorage
  const [restaurantName, setRestaurantName] = useState<string>('') // Restaurant name for PIN screen
  const [fullRestaurant, setFullRestaurant] = useState<Restaurant | null>(null)
  const [restaurantSuspended, setRestaurantSuspended] = useState(false)
  const [courseSplittingEnabled, setCourseSplittingEnabled] = useState(true) // Default to true for backwards compat
  const [isTableActive, setIsTableActive] = useState(true) // Check if table has active session

  // Check if table is active (has ANY open session) when Not Authenticated
  useEffect(() => {
    if (!isAuthenticated && tableId) {
      const checkTableActivity = async () => {
        // Check if there is an OPEN session for this table
        const { data, error } = await supabase
          .from('table_sessions')
          .select('id')
          .eq('table_id', tableId)
          .eq('status', 'OPEN')
          .single()

        if (!data) {
          setIsTableActive(false)
        } else {
          setIsTableActive(true)
        }
      }
      checkTableActivity()
    }
  }, [isAuthenticated, tableId])

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
        }
      }
      init()
    } else if (tableId && sessionId && !restaurantId) {
      // Session exists but restaurantId not in state - fetch it
      const fetchRestaurantId = async () => {
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
      }
      fetchRestaurantId()
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
            return
          }

          if (savedSessionId === sessionId && savedPin === session.session_pin) {
            // Session is still the same and PIN matches - auto authenticate
            setIsAuthenticated(true)
          } else if (savedSessionId !== sessionId) {
            // Session changed (table was reset) - clear old credentials
            localStorage.removeItem('customerSessionId')
            localStorage.removeItem('sessionPin')
            setIsAuthenticated(false)
            // CRITICAL: Do NOT navigate away. Just show PIN screen by setting auth to false.
          }
        } else {
          // Session invalid or closed/deleted
          localStorage.removeItem('customerSessionId')
          localStorage.removeItem('sessionPin')
          setIsAuthenticated(false)
        }
      }
      checkSession()
    }
  }, [sessionId, restaurantId])

  // Real-time subscription to detect when session is closed (table paid/emptied)
  // This ensures authenticated customers are immediately redirected to PIN screen
  useEffect(() => {
    if (!tableId || !isAuthenticated) return

    const sessionChannel = supabase
      .channel(`customer-session-watch:${tableId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `table_id=eq.${tableId}`
      }, async (payload) => {
        // Handle session updates (status changed to CLOSED)
        if (payload.eventType === 'UPDATE') {
          const updatedSession = payload.new as any
          if (updatedSession.status === 'CLOSED') {
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
          // Session deleted - force logout
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
      })
      .subscribe()

    // Real-time subscription for Restaurant Settings (enable_course_splitting)
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
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(restaurantChannel)
    }
  }, [tableId, isAuthenticated, restaurantId])

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

  if (sessionLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-neutral-950 to-zinc-900">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 border border-amber-500/20 rounded-full"></div>
          <div className="absolute inset-0 w-20 h-20 border border-transparent border-t-amber-500 rounded-full animate-spin"></div>
          <div className="absolute inset-2 w-16 h-16 border border-amber-500/10 rounded-full"></div>
        </div>
        <p className="text-amber-200/60 font-light tracking-[0.2em] text-sm uppercase">Caricamento</p>
      </div>
    </div>
  )

  // LOGIN SCREEN (PIN) - Minimalist Luxury Design
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">

        <div className="w-full max-w-sm flex flex-col items-center gap-12">

          {/* Minimal Header */}
          <div className="text-center space-y-4">
            {fullRestaurant?.logo_url ? (
              <div className="flex justify-center mb-6">
                <img
                  src={fullRestaurant.logo_url}
                  alt={restaurantName}
                  className="h-32 w-auto max-w-[200px] object-contain drop-shadow-[0_0_25px_rgba(245,158,11,0.2)]"
                />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-light tracking-[0.2em] uppercase text-white" style={{ fontFamily: 'Georgia, serif' }}>
                  {restaurantName || 'Ristorante'}
                </h1>
                <div className="w-8 h-px bg-amber-500/50 mx-auto"></div>
              </>
            )}
          </div>

          {/* Minimal PIN Input */}
          <div className="w-full">
            <p className="text-center text-zinc-500 text-xs tracking-widest uppercase mb-8">Inserisci codice tavolo</p>

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
                    className={`w-12 h-16 text-center text-2xl font-light bg-transparent border-b-2 outline-none transition-all duration-300 rounded-none
                      ${pinError
                        ? 'border-red-500 text-red-500 animate-shake'
                        : pin[index]
                          ? 'border-amber-500 text-white'
                          : 'border-zinc-800 text-zinc-600 focus:border-zinc-600'
                      }`}
                    style={{ fontFamily: 'Georgia, serif' }}
                    // Force focus to first empty or clicked if valid
                    onClick={(e) => {
                      // Find first empty index
                      const firstEmptyIndex = pin.findIndex(d => d === '')
                      const targetIndex = firstEmptyIndex === -1 ? 3 : firstEmptyIndex

                      // If user clicked a field ahead of the sequence, refocus the correct one
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
          <p className="text-zinc-700 text-[10px] tracking-widest uppercase mt-auto">
            Il codice è sul segnaposto
          </p>

        </div>
      </div>
    )
  }

  // MAIN MENU CONTENT
  // Pass restaurantId to hooks
  return <AuthorizedMenuContent restaurantId={activeSession?.restaurant_id!} tableId={tableId} sessionId={sessionId!} activeSession={activeSession!} />
}

// Refactored Content Component to keep logic clean
function AuthorizedMenuContent({ restaurantId, tableId, sessionId, activeSession }: { restaurantId: string, tableId: string, sessionId: string, activeSession: TableSession }) {
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
  const [previousOrders, setPreviousOrders] = useState<Order[]>([])
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dishNote, setDishNote] = useState('')
  const [dishQuantity, setDishQuantity] = useState(1)

  const [maxCourse, setMaxCourse] = useState(1)
  const [currentCourse, setCurrentCourse] = useState(1)
  const [showCourseAlert, setShowCourseAlert] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showCourseManagement, setShowCourseManagement] = useState(false) // Waiter Mode: Course management
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'orders'>('menu')
  const [activeWaitCourse, setActiveWaitCourse] = useState(1) // Waiter Mode: Selected course for new items
  const [courseSplittingEnabled, setCourseSplittingEnabled] = useState(true) // Default to true
  const [fullRestaurant, setFullRestaurant] = useState<any>(null) // Restaurant data for pricing

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
        setFullRestaurant(restData)
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
    if (activeCategory !== 'all') d = d.filter(dish => dish.category_id === activeCategory)
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase()
      d = d.filter(dish => dish.name.toLowerCase().includes(lowerTerm) || dish.description?.toLowerCase().includes(lowerTerm))
    }
    return d
  }, [dishes, activeCategory, searchTerm])

  // Group dishes by category for dividers
  const dishesByCategory = useMemo(() => {
    if (activeCategory !== 'all') return null
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
    } catch (err) {
      console.error("Error moving item:", err)
    }
  }

  const [activeDragItem, setActiveDragItem] = useState<CartItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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

    const activeItem = cart.find(i => i.id === activeId)
    if (!activeItem) return

    if (overId === 'new-course-zone') {
      const newCourseNum = maxCourse + 1
      setMaxCourse(newCourseNum)
      moveItemToCourse(activeId, newCourseNum)
      return
    }

    if (overId.startsWith('course-')) {
      const courseNum = parseInt(overId.split('-')[1])
      if (activeItem.course_number !== courseNum) {
        moveItemToCourse(activeId, courseNum)
      }
      return
    }

    const overItem = cart.find(i => i.id === overId)
    if (overItem && activeItem.course_number !== overItem.course_number) {
      moveItemToCourse(activeId, overItem.course_number || 1)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId !== overId) {
      // Logic to move item between courses would go here if we were reordering list
      // But for courses we use drag to course container
      const activeItem = cart.find(i => i.id === activeId)
      const overCourseId = overId.toString()

      if (activeItem && overCourseId.startsWith('course-')) {
        const newCourse = parseInt(overCourseId.split('-')[1])
        if (!isNaN(newCourse) && activeItem.course_number !== newCourse) {
          moveItemToCourse(activeItem.id, newCourse)
        }
      }
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

    const uniqueCourses = [...new Set(cart.map(item => item.course_number || 1))]

    if (isWaiterMode) {
      setShowConfirmDialog(true)
    } else if (uniqueCourses.length === 1 && uniqueCourses[0] === 1) {
      setShowCourseAlert(true)
    } else {
      setShowConfirmDialog(true)
    }
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

      // Local state update handled by Realtime subscription
      // setCart([]) 
      setMaxCourse(1)
      setCurrentCourse(1)
      setIsCartOpen(false)
      setShowCourseAlert(false)
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-amber-500 text-amber-500 hover:bg-amber-500/10">Riprova</Button>
      </div>
    </div>
  )

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-900 font-sans select-none flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 relative w-full">
        {activeTab === 'menu' && (
          <>
            <header className="flex-none z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-amber-500/10">
              <div className="w-full px-4 py-3">
                {/* Restaurant Name - Compact Header */}
                {restaurantName && (
                  <div className="text-center mb-2 pb-2 border-b border-white/5">
                    <h1 className="text-base font-light text-white tracking-widest uppercase" style={{ fontFamily: 'Georgia, serif' }}>
                      {restaurantName}
                    </h1>
                  </div>
                )}

                {/* Menu Header & Search - Compact */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full border border-amber-500/30 flex items-center justify-center bg-zinc-900">
                        <Utensils className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                      </div>
                      {activeSession && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border-2 border-zinc-950" />}
                    </div>
                    <div>
                      <h2 className="text-sm font-medium text-white tracking-wide">Tavolo {tableName}</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Cerca..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-28 bg-zinc-900/50 border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:w-36 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Categories - Horizontally Scrollable */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                  <div className="flex space-x-2 w-max">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border flex-shrink-0 ${activeCategory === 'all'
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-lg shadow-amber-500/20'
                        : 'bg-zinc-900/50 text-zinc-400 border-white/5 hover:border-amber-500/30 hover:text-white'
                        }`}
                    >
                      Tutto
                    </button>
                    {sortedCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border flex-shrink-0 whitespace-nowrap ${activeCategory === cat.id
                          ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-lg shadow-amber-500/20'
                          : 'bg-zinc-900/50 text-zinc-400 border-white/5 hover:border-amber-500/30 hover:text-white'
                          }`}
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
                {activeCategory === 'all' ? (
                  // Grouped view
                  dishesByCategory?.map((group, groupIndex) => (
                    <motion.div
                      key={group.category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIndex * 0.1 }}
                      className="mb-8"
                    >
                      <h3 className="text-amber-500/80 text-xs font-bold uppercase tracking-[0.2em] mb-4 pl-1" style={{ fontFamily: 'Georgia, serif' }}>
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
                          />
                        ))}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  // Filtered view
                  <div className="grid gap-4">
                    {filteredDishes.map((dish, index) => (
                      <DishCard
                        key={`${dish.id}-${index}`}
                        dish={dish}
                        index={index}
                        onSelect={setSelectedDish}
                        onAdd={(d) => quickAddToCart(d)}
                      />
                    ))}
                  </div>
                )}

                {filteredDishes.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20"
                  >
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 shadow-inner border border-white/5">
                      <Search className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-sm font-medium text-zinc-500">Nessun piatto trovato</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </>
        )}

        {/* CART TAB */}
        {activeTab === 'cart' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-900">
            <header className="flex-none z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-amber-500/10 p-4 shadow-xl">
              <h1 className="text-xl font-light text-center text-white tracking-widest uppercase" style={{ fontFamily: 'Georgia, serif' }}>Il tuo Ordine</h1>
              <p className="text-[10px] text-center text-amber-500/50 mt-1 uppercase tracking-wider">Gestisci le portate e invia l'ordine</p>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-32 space-y-4 w-full">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                  <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-white/5">
                    <ShoppingBasket className="w-8 h-8 opacity-30" strokeWidth={1.5} />
                  </div>
                  <p className="font-light tracking-wide text-sm">Il carrello è vuoto</p>
                  <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-4 text-amber-500 hover:text-amber-400 tracking-wide font-light">Torna al menu</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="bg-zinc-900/80 backdrop-blur-sm rounded-xl p-3 shadow-md border border-amber-500/10 flex items-center gap-4 cursor-pointer hover:bg-zinc-800 transition-colors group"
                        onClick={() => setSelectedDish(item.dish || null)}
                      >
                        {item.dish?.image_url ? (
                          <img src={item.dish.image_url} alt={item.dish.name} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-inner border border-white/5">
                            <DishPlaceholder iconSize={20} variant="pot" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-normal text-white text-base line-clamp-1" style={{ fontFamily: 'Georgia, serif' }}>{item.dish?.name}</h3>
                            <span className="font-medium text-amber-400 text-sm whitespace-nowrap">
                              € {((item.dish?.is_ayce && activeSession?.ayce_enabled) ? 0 : (item.dish?.price || 0) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-white/50 mt-1 italic line-clamp-1 font-light">Note: {item.notes}</p>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-950/50 rounded-lg border border-white/5">
                              <Layers className="w-3 h-3 text-zinc-400" />
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                                {getCourseTitle(item.course_number || 1)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 bg-zinc-950/50 rounded-lg p-0.5 border border-white/5">
                              <button
                                onClick={(e) => { e.stopPropagation(); updateCartItemQuantity(item.id, -1); }}
                                className="w-7 h-7 flex items-center justify-center bg-zinc-800 rounded-md shadow-sm text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-bold text-sm w-4 text-center text-white">{item.quantity}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateCartItemQuantity(item.id, 1); }}
                                className="w-7 h-7 flex items-center justify-center bg-zinc-800 rounded-md shadow-sm text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 space-y-2 text-sm text-zinc-400">
                    {/* Coperto Calculation */}
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
                        <div className="flex justify-between items-center text-zinc-500">
                          <span>Coperto ({personCount} pers.)</span>
                          <span>€ {totalCoperto.toFixed(2)}</span>
                        </div>
                      )
                    })()}

                    <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-white/5">
                      <span className="font-semibold text-white uppercase tracking-wider">Totale Stimato</span>
                      <span className="font-bold text-amber-500 text-lg">
                        € {(() => {
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
                    </div>
                    <p className="text-[10px] text-center text-zinc-600 pt-1">
                      Il totale finale potrebbe subire variazioni al momento del pagamento in cassa.
                    </p>
                  </div>

                  {courseSplittingEnabled && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        className="w-full h-11 border-dashed border-amber-500/50 text-amber-500 hover:bg-amber-500/10 gap-2 rounded-xl font-medium tracking-wide"
                        onClick={() => setShowCourseManagement(true)}
                      >
                        <Layers className="w-4 h-4" />
                        Dividi / Organizza Portate
                      </Button>
                    </div>
                  )}

                  <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-amber-500/10 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-zinc-400 font-medium">Totale Ordine</span>
                      <span className="text-2xl font-bold text-white">€{cartTotal.toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full h-14 text-base font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-900 rounded-xl shadow-lg shadow-amber-500/30 tracking-wide uppercase"
                      onClick={handleSubmitClick}
                      disabled={isOrderSubmitting}
                    >
                      {isOrderSubmitting ? 'Invio in corso...' : 'Invia Ordine alla Cucina'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-900">
            <header className="flex-none z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-amber-500/10 p-4 shadow-xl">
              <h1 className="text-xl font-light text-center text-white tracking-widest uppercase" style={{ fontFamily: 'Georgia, serif' }}>I tuoi Ordini</h1>
              <p className="text-[10px] text-center text-amber-500/50 mt-1 uppercase tracking-wider">Riepilogo di tutti gli ordini inviati</p>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-32 space-y-4 w-full">
              {previousOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                  <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-white/5">
                    <History className="w-8 h-8 opacity-30" strokeWidth={1.5} />
                  </div>
                  <p className="font-light tracking-wide text-base">Nessun ordine inviato</p>
                  <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-4 text-amber-500 hover:text-amber-400 tracking-wide font-light">Torna al menu</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {previousOrders.map(order => (
                    <div key={order.id} className="bg-zinc-900/80 backdrop-blur-sm rounded-xl p-4 shadow-md border border-amber-500/10">
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                        <h3 className="font-bold text-white text-lg">Ordine #{order.id.slice(0, 8)}</h3>
                        <span className="text-amber-400 font-bold text-lg">€{order.total_amount?.toFixed(2)}</span>
                      </div>
                      <div className="space-y-2">
                        {order.items?.map(item => {
                          // Try to find the dish locally or use the one joined from the backend
                          const localDish = dishes.find(d => d.id === item.dish_id)
                          // Handle potential property name mismatch from Supabase join (dishes vs dish)
                          const joinedDish = item.dish || (item as any).dishes
                          const dish = localDish || joinedDish

                          // Price might not be on item directly, use dish price
                          const price = dish?.price || 0

                          return (
                            <div
                              key={item.id}
                              className="flex justify-between items-center text-sm text-white/80 cursor-pointer hover:bg-zinc-800/50 p-2 rounded-lg transition-colors"
                              onClick={() => {
                                if (dish) {
                                  setSelectedDish(dish as Dish)
                                  setDishQuantity(1)
                                  setDishNote('')
                                }
                              }}
                            >
                              <div className="flex items-baseline gap-2">
                                <span className="font-bold">{item.quantity}x</span>
                                <div className="flex flex-col">
                                  <span className="font-medium">{dish?.name || 'Piatto non disponibile'}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'SERVED' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${item.status === 'SERVED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                      {item.status === 'SERVED' ? 'Completato' : 'In preparazione'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-white/60">€{(price * item.quantity).toFixed(2)}</span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-zinc-500 mt-3 text-right">Inviato il {new Date(order.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-amber-500/10 shadow-lg shadow-black/30">
          <div className="w-full flex justify-around items-center h-16">
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'menu' ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Menu</span>
            </button>
            <button
              onClick={() => setActiveTab('cart')}
              className={`relative flex flex-col items-center gap-1 transition-colors ${activeTab === 'cart' ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ShoppingBasket className="w-5 h-5" />
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`absolute -top-1 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-xs font-bold ${isCartAnimating ? 'animate-ping-once' : ''}`}
                >
                  {cartCount}
                </motion.span>
              )}
              <span className="text-[10px] font-medium uppercase tracking-wider">Carrello</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'orders' ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <History className="w-5 h-5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Ordini</span>
            </button>
          </div>
        </div>

        {/* Dish Detail Dialog */}
        <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
          <DialogContent className="sm:max-w-[380px] bg-zinc-950 border-amber-500/20 text-white p-0 gap-0 overflow-hidden shadow-2xl rounded-3xl">
            {selectedDish && (
              <div className="flex flex-col h-full bg-zinc-950 text-white">
                {selectedDish.image_url ? (
                  <div className="relative h-48 w-full">
                    <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                  </div>
                ) : (
                  <div className="relative h-48 w-full">
                    <DishPlaceholder iconSize={48} variant="pot" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                  </div>
                )}

                <div className="flex items-start justify-between p-5 pb-0">
                  <div>
                    <h2 className="text-2xl font-light leading-tight pr-4 tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>{selectedDish.name}</h2>
                    <p className="text-amber-400 font-bold mt-2 text-xl">€{selectedDish.price.toFixed(2)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDish(null)} className="-mt-2 -mr-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full h-10 w-10">
                    <X className="w-6 h-6" />
                  </Button>
                </div>

                <div className="p-5 space-y-5 flex-1 overflow-y-auto scrollbar-hide">
                  {selectedDish.description && (
                    <p className="text-zinc-400 text-sm font-light leading-relaxed">{selectedDish.description}</p>
                  )}

                  {/* Quantity */}
                  <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                    <span className="text-sm font-medium pl-2 text-zinc-300">Quantità</span>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="h-10 w-10 border-white/10 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-lg" onClick={() => setDishQuantity(q => Math.max(1, q - 1))} disabled={dishQuantity <= 1}><Minus className="w-5 h-5" /></Button>
                      <span className="w-8 text-center font-bold text-xl">{dishQuantity}</span>
                      <Button variant="outline" size="icon" className="h-10 w-10 border-white/10 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-lg" onClick={() => setDishQuantity(q => q + 1)}><Plus className="w-5 h-5" /></Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Note speciali</span>
                    <Textarea
                      placeholder="Es. Senza cipolla, cottura media..."
                      className="bg-zinc-900/50 border-white/10 text-white min-h-[80px] focus:ring-amber-500/50 focus:border-amber-500 placeholder:text-zinc-600"
                      value={dishNote}
                      onChange={(e) => setDishNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-900 font-bold rounded-xl text-lg shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-transform h-14"
                    onClick={() => addToCart(selectedDish, dishQuantity, dishNote)}
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
          <DialogContent className="sm:max-w-sm bg-zinc-950 border-amber-500/20 text-white shadow-2xl shadow-black/80">
            <DialogHeader>
              <DialogTitle className="text-amber-500" style={{ fontFamily: 'Georgia, serif' }}>Conferma invio</DialogTitle>
              <DialogDescription className="text-zinc-400">Inviare l'ordine in cucina?</DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <div className="bg-zinc-900/50 rounded-xl p-3 space-y-2 border border-white/5">
                {courseNumbers.map(num => (
                  <div key={num} className="mb-2">
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">• Portata {num}</p>
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
                <p className="text-sm font-bold pt-2 border-t border-white/10 mt-2 text-white">Totale Ordine: €{cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold" onClick={submitOrder} disabled={isOrderSubmitting}>{isOrderSubmitting ? 'Invio...' : 'Conferma'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Course Management (Drag & Drop) */}
        <Dialog open={showCourseManagement} onOpenChange={setShowCourseManagement}>
          <DialogContent className="max-w-lg bg-zinc-950 max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl border border-amber-500/20 shadow-2xl shadow-black">
            <DialogHeader className="p-4 bg-zinc-950 border-b border-amber-500/10 z-10">
              <DialogTitle className="text-amber-500" style={{ fontFamily: 'Georgia, serif' }}>Organizza Portate</DialogTitle>
              <DialogDescription className="text-zinc-400">Trascina i piatti per cambiare l'ordine di uscita</DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4 bg-zinc-900/50">
                  <div className="space-y-4 pb-20">
                    {Array.from({ length: maxCourse }, (_, i) => i + 1).map((courseNum) => (
                      <DroppableCourse
                        key={courseNum}
                        id={`course-${courseNum}`}
                        className="bg-zinc-950/80 rounded-2xl p-3 shadow-lg border border-white/5"
                      >
                        <div className="flex items-center justify-center mb-3">
                          <h3 className="font-bold text-amber-500 uppercase tracking-widest text-xs flex items-center gap-2 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20" style={{ fontFamily: 'Georgia, serif' }}>
                            <Layers className="w-4 h-4" />
                            {getCourseTitle(courseNum)}
                          </h3>
                        </div>

                        <div className="space-y-2 min-h-[40px]">
                          <SortableContext
                            id={`course-${courseNum}`}
                            items={cartByCourse[courseNum]?.map(i => i.id) || []}
                            strategy={verticalListSortingStrategy}
                          >
                            {cartByCourse[courseNum]?.length === 0 ? (
                              <DroppableCoursePlaceholder id={`course-${courseNum}`} />
                            ) : (
                              cartByCourse[courseNum]?.map((item) => (
                                <SortableDishItem key={item.id} item={item} courseNum={courseNum} />
                              ))
                            )}
                          </SortableContext>
                        </div>
                      </DroppableCourse>
                    ))}

                    <NewCourseDropZone onClick={addNewCourse} />
                  </div>
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                  {activeDragItem ? (
                    <div className="flex items-center justify-between bg-zinc-800 p-2 rounded-xl border border-amber-500 shadow-xl opacity-90 scale-105 cursor-grabbing">
                      <div className="flex items-center gap-3">
                        <div className="p-1 text-amber-500">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">{activeDragItem.dish?.name}</p>
                          <p className="text-[10px] text-zinc-400">{activeDragItem.quantity}x</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            <div className="p-4 bg-zinc-950 border-t border-amber-500/10 z-20 relative">
              <Button className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-zinc-900 font-bold rounded-xl shadow-lg shadow-amber-500/20" onClick={() => setShowCourseManagement(false)}>
                Fatto
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Course Alert Dialog */}
        <AlertDialog open={showCourseAlert} onOpenChange={setShowCourseAlert}>
          <AlertDialogContent className="bg-white dark:bg-slate-900 rounded-3xl border-0 shadow-2xl max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center text-xl">Come vuoi procedere?</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Hai inserito tutti i piatti in un'unica portata. Vuoi inviare tutto subito o dividere in più uscite?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <Button className="h-14 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20" onClick={() => {
                setShowCourseAlert(false);
                setShowConfirmDialog(true);
              }}>
                <ChefHat className="w-5 h-5 mr-2" />
                Invia tutto insieme
              </Button>
              {courseSplittingEnabled && (
                <Button variant="outline" className="h-14 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium" onClick={() => {
                  setShowCourseAlert(false);
                  setShowCourseManagement(true);
                }}>
                  <Layers className="w-5 h-5 mr-2 text-amber-600" />
                  Dividi in portate
                </Button>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl h-12 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white">Annulla</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Call Waiter FAB - Floating Action Button */}
        <Button
          onClick={handleCallWaiter}
          disabled={callWaiterDisabled}
          className={`fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-xl border-2 transition-all duration-300 ${callWaiterDisabled
              ? 'bg-zinc-700 border-zinc-600 text-zinc-400 cursor-not-allowed opacity-50'
              : 'bg-white border-amber-300 text-amber-600 hover:bg-amber-50 hover:border-amber-400 hover:shadow-amber-500/20'
            }`}
          title={callWaiterDisabled ? 'Attendi 30 secondi...' : 'Chiama cameriere'}
        >
          <Bell className="w-6 h-6" strokeWidth={2} />
        </Button>
      </div>
    </div >
  )
}

export default CustomerMenu
