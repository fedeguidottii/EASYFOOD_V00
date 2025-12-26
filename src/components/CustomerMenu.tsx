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
// Icons
import {
  ShoppingBasket, Plus, Minus, Utensils, Clock, CheckCircle, ChefHat, Search, Info,
  X, RefreshCw, AlertCircle, ChevronUp, ChevronDown, Layers, ArrowLeft, Send,
  ChevronRight, Trash, GripVertical, ArrowUp, ArrowDown
} from 'lucide-react'
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor,
  closestCenter, useDroppable, DragStartEvent, DragEndEvent, DragOverEvent,
  defaultDropAnimationSideEffects, DropAnimation
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Dish, Order, TableSession } from '../services/types'

// --- HELPER COMPONENTS ---

interface CartItem extends Dish {
  cartId: string
  quantity: number
  notes?: string
  courseNumber: number
}

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
  } = useSortable({ id: item.cartId, data: { item, courseNum } })

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
      className={`flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 group relative cursor-grab active:cursor-grabbing touch-none select-none ${isDragging ? 'ring-2 ring-emerald-500 bg-white dark:bg-slate-700' : ''}`}
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <div className={`p-1.5 rounded-lg ${isDragging ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-400'}`}>
          <GripVertical className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
          <p className="text-xs text-slate-500">{item.quantity}x · €{(item.price * item.quantity).toFixed(2)}</p>
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
        <div className="w-full h-full flex items-center justify-center">
          <Utensils className="w-5 h-5 text-amber-500/40" strokeWidth={1.5} />
        </div>
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
      className={`text-center py-4 text-xs border-2 border-dashed rounded-xl transition-colors ${isOver ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
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
        className={`w-full py-6 border-dashed rounded-2xl gap-2 transition-all ${isOver ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 scale-105' : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'}`}
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
      className={`${className} transition-colors ${isOver ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
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
  // Removed setRestaurantId call since it is passed as prop
  const [activeSession, setActiveSession] = useState<TableSession | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null) // State to hold restaurantId fetched from table
  const [restaurantName, setRestaurantName] = useState<string>('') // Restaurant name for PIN screen

  // Attempt joining session on mount if tableId exists
  useEffect(() => {
    if (tableId && !sessionId) {
      // Need restaurantId to join session via RPC properly or fetch tables first
      // To simplify, let's fetch the table details first to get restaurant_id
      const init = async () => {
        try {
          const { data: tableData, error } = await supabase
            .from('tables')
            .select('restaurant_id')
            .eq('id', tableId)
            .single()

          if (error) {
            console.error('Table fetch error:', error)
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
            // Fetch restaurant name for PIN screen
            const { data: restaurantData } = await supabase
              .from('restaurants')
              .select('name')
              .eq('id', tableData.restaurant_id)
              .single()

            if (restaurantData?.name) {
              setRestaurantName(restaurantData.name)
            }

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
    }
  }, [tableId, sessionId, joinSession])

  // Verify PIN against active session
  useEffect(() => {
    if (sessionId && restaurantId) {
      const checkSession = async () => {
        // Fetch session details to get the correct PIN
        const session = await DatabaseService.getSessionById(sessionId)
        if (session) {
          setActiveSession(session)
          // Check if PIN matches what user entered (or if we auto-authenticated via localStorage logic in Context)
          // Actually Context handles session persistence. Authentication (PIN check) is a UI guard.
          // If we have a sessionId, it means we "joined". Now we need to prove identity with PIN.

          // Optimization: If local storage has 'sessionPin' matching data, auto-auth
          const savedPin = localStorage.getItem('sessionPin')
          if (savedPin === session.session_pin) {
            setIsAuthenticated(true)
          }
        }
      }
      checkSession()
    }
  }, [sessionId, restaurantId])

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

        // Let's just return here and let the user click again (or auto-submit if we could)
        // Better UX: check session via DB directly here to verify PIN immediately
        const session = await DatabaseService.getSessionById(sessionId || (await DatabaseService.getActiveSession(tableId))?.id!)
        if (session && enteredPin === session.session_pin) {
          toast.dismiss()
          setActiveSession(session)
          setIsAuthenticated(true)
          localStorage.setItem('sessionPin', enteredPin)
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
    if (value.length > 1) value = value.slice(-1)
    if (!/^\d*$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`)
      nextInput?.focus()
    }

    // Auto-submit when all digits entered
    if (newPin.every(d => d !== '')) {
      handlePinSubmit(newPin.join(''))
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`)
      prevInput?.focus()
    }
  }

  // --- RENDER GATES ---

  if (!tableId) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-neutral-950 to-zinc-900 p-6">
      <div className="text-center text-amber-100/60">
        <p className="text-lg font-light tracking-wide">QR Code non valido</p>
      </div>
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

  // LOGIN SCREEN (PIN) - Luxury Gala Restaurant Design
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-950 to-zinc-900 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        {/* Elegant background pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Subtle golden radial gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/5 via-transparent to-transparent"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-t from-amber-600/3 via-transparent to-transparent"></div>

          {/* Decorative lines */}
          <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"></div>
          <div className="absolute bottom-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"></div>

          {/* Corner ornaments */}
          <div className="absolute top-8 left-8 w-16 h-16 border-l border-t border-amber-500/20"></div>
          <div className="absolute top-8 right-8 w-16 h-16 border-r border-t border-amber-500/20"></div>
          <div className="absolute bottom-8 left-8 w-16 h-16 border-l border-b border-amber-500/20"></div>
          <div className="absolute bottom-8 right-8 w-16 h-16 border-r border-b border-amber-500/20"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 w-full max-w-sm">
          {/* Elegant Icon */}
          <div className="flex justify-center mb-10">
            <div className="relative">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl scale-150"></div>
              {/* Icon container */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full border border-amber-500/30 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                  <Utensils size={32} className="text-amber-400" strokeWidth={1.5} />
                </div>
                {/* Decorative ring */}
                <div className="absolute inset-[-4px] rounded-full border border-amber-500/10"></div>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-10">
            <p className="text-amber-500/60 text-xs tracking-[0.3em] uppercase mb-3">Benvenuti</p>
            <h1 className="text-3xl font-light text-white tracking-wide mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              {restaurantName || 'Ristorante'}
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500/40"></div>
              <div className="w-1.5 h-1.5 rotate-45 bg-amber-500/40"></div>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500/40"></div>
            </div>
          </div>

          {/* PIN Card */}
          <div className="backdrop-blur-xl bg-white/[0.03] border border-amber-500/20 rounded-2xl p-8 shadow-2xl shadow-black/50">
            {/* Card Header */}
            <div className="text-center mb-8">
              <p className="text-amber-200/80 text-sm font-light tracking-wide">
                Inserisci il codice del tavolo
              </p>
            </div>

            {/* PIN Input Section */}
            <div className="mb-6">
              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    id={`pin-${index}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[index]}
                    onChange={(e) => handlePinDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className={`w-14 h-16 text-center text-2xl font-light tracking-wider rounded-xl border-2 transition-all duration-500 outline-none bg-zinc-900/50
                      ${pinError
                        ? 'border-red-500/70 text-red-400 animate-shake'
                        : pin[index]
                          ? 'border-amber-500/70 text-amber-300 shadow-lg shadow-amber-500/20'
                          : 'border-white/20 text-white hover:border-amber-500/30 focus:border-amber-500/50 focus:shadow-lg focus:shadow-amber-500/10'
                      }`}
                    style={{ fontFamily: 'Georgia, serif' }}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Error Message */}
              {pinError && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm font-light">
                  <AlertCircle className="w-4 h-4" />
                  <span>Codice non valido</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => {
                const fullPin = pin.join('')
                if (fullPin.length === 4) {
                  handlePinSubmit(fullPin)
                }
              }}
              disabled={pin.some(d => d === '')}
              className="w-full h-14 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-900 font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed text-base tracking-wide"
            >
              Accedi al Menu
            </Button>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-3 mt-6 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
              <div className="w-1 h-1 rotate-45 bg-amber-500/50"></div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
            </div>

            {/* Help Text */}
            <div className="text-center">
              <p className="text-white/40 text-xs tracking-wide">
                Il codice è visualizzato sul segnaposto del tavolo
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-white/20 text-[10px] tracking-[0.2em] uppercase">
              Powered by EasyFood
            </p>
          </div>
        </div>
      </div>
    )
  }

  // MAIN MENU CONTENT
  // Pass restaurantId to hooks
  // MAIN MENU CONTENT
  // Pass restaurantId to hooks
  return <AuthorizedMenuContent restaurantId={activeSession?.restaurant_id!} tableId={tableId} sessionId={sessionId!} activeSession={activeSession!} />
}

export default CustomerMenu

// Refactored Content Component to keep logic clean
const AuthorizedMenuContent = ({ restaurantId, tableId, sessionId, activeSession }: { restaurantId: string, tableId: string, sessionId: string, activeSession: TableSession }) => {
  // Using passed props instead of resolving them
  const isWaiterMode = false // Or pass as prop if needed

  // NOTE: removed redundant restaurantId/tableId state since they are passed as props

  const [restaurantName, setRestaurantName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tableName, setTableName] = useState<string>('')

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

  // Helper to generate PIN
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString()

  const initMenu = async () => {
    if (!tableId) {
      setError("ID Tavolo mancante.")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data: tableData } = await supabase
        .from('tables')
        .select('restaurant_id, number')
        .eq('id', tableId)
        .single()

      if (tableData?.restaurant_id) {
        /* setRestaurantId removed */
        setTableName(tableData.number || '')

        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', tableData.restaurant_id)
          .single()

        if (restaurantData?.name) {
          setRestaurantName(restaurantData.name)
        }
        return
      }

      const { data: activeSessionData } = await supabase
        .from('table_activeSessions')
        .select('restaurant_id')
        .eq('table_id', tableId)
        .eq('status', 'OPEN')
        .limit(1)
        .maybeSingle()

      if (activeSessionData?.restaurant_id) {
        /* setRestaurantId removed */

        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', activeSessionData.restaurant_id)
          .single()

        if (restaurantData?.name) {
          setRestaurantName(restaurantData.name)
        }
        return
      }

      throw new Error("Impossibile identificare il ristorante.")

    } catch (err: any) {
      setError(err.message || "Errore di connessione")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initMenu()
  }, [tableId])

  const [categories] = useSupabaseData<Category>('categories', [], { column: 'restaurant_id', value: restaurantId || '' })
  const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId || '' })

  // FIXED: Sort categories by order field properly
  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a, b) => {
      const orderA = a.order ?? 9999
      const orderB = b.order ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [categories])

  const filteredDishes = useMemo(() => {
    if (!dishes) return []
    let d = dishes.filter(dish => dish.is_active !== false)
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

  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (item.price * item.quantity), 0), [cart])
  const cartCount = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart])
  const historyTotal = useMemo(() => previousOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0), [previousOrders])
  const grandTotal = cartTotal + historyTotal

  const cartByCourse = useMemo(() => {
    const grouped: { [key: number]: CartItem[] } = {}
    cart.forEach(item => {
      const course = item.courseNumber || 1
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
      .select('*, items:order_items(*)')
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
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === dish.id && !item.notes && item.courseNumber === 1)
      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex].quantity += 1
        return newCart
      }
      return [...prev, { ...dish, cartId: crypto.randomUUID(), quantity: 1, notes: '', courseNumber: 1 }]
    })
    toast.success(`+ 1 ${dish.name} `, { position: 'top-center', duration: 800, style: { background: '#10B981', color: '#fff', border: 'none', fontSize: '14px', padding: '8px 16px' } })
  }

  const addToCart = (dish: Dish, quantity: number = 1, notes: string = '', courseNum?: number) => {
    const targetCourse = courseNum !== undefined ? courseNum : currentCourse
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === dish.id && item.notes === notes && item.courseNumber === targetCourse)
      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex].quantity += quantity
        return newCart
      }
      return [...prev, { ...dish, cartId: crypto.randomUUID(), quantity, notes, courseNumber: targetCourse }]
    })
    if (quantity > 0) {
      setIsCartAnimating(true)
      setTimeout(() => setIsCartAnimating(false), 500)
      toast.success(`Aggiunto al carrello`, { position: 'top-center', duration: 1500, style: { background: '#10B981', color: '#fff', border: 'none' } })
    }
    setSelectedDish(null)
    setDishNote('')
    setDishQuantity(1)
  }

  const updateCartItemQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0))
  }

  const moveItemToCourse = (cartId: string, newCourse: number) => {
    setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, courseNumber: newCourse } : item))
  }

  const [activeDragItem, setActiveDragItem] = useState<CartItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const item = cart.find(i => i.cartId === active.id)
    if (item) setActiveDragItem(item)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeItem = cart.find(i => i.cartId === activeId)
    if (!activeItem) return

    if (overId === 'new-course-zone') {
      const newCourseNum = maxCourse + 1
      setMaxCourse(newCourseNum)
      moveItemToCourse(activeId, newCourseNum)
      return
    }

    if (overId.startsWith('course-')) {
      const courseNum = parseInt(overId.split('-')[1])
      if (activeItem.courseNumber !== courseNum) {
        moveItemToCourse(activeId, courseNum)
      }
      return
    }

    const overItem = cart.find(i => i.cartId === overId)
    if (overItem && activeItem.courseNumber !== overItem.courseNumber) {
      moveItemToCourse(activeId, overItem.courseNumber)
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

    const uniqueCourses = [...new Set(cart.map(item => item.courseNumber))]

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
        toast.error("Errore activeSessione mancante.")
        setIsOrderSubmitting(false)
        return
      }

      const orderItems = cart.map(item => ({
        dish_id: item.id,
        quantity: item.quantity,
        note: item.notes || '',
        status: 'PENDING' as const,
        course_number: item.courseNumber
      }))

      await DatabaseService.createOrder({
        restaurant_id: restaurantId,
        table_session_id: activeSessionId,
        status: 'OPEN',
        total_amount: cartTotal
      }, orderItems)

      setCart([])
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (error || !restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
        <Card className="w-full max-w-sm border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20">
          <CardContent className="flex flex-col items-center text-center p-8 gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Errore</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{error || "Ristorante non trovato."}</p>
            <Button onClick={() => window.location.reload()} className="w-full mt-2 gap-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl h-12 font-semibold shadow-lg">
              <RefreshCw className="w-4 h-4" />Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }



  if (isWaiterMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => { }}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg text-white">{tableName}</h1>
                <p className="text-xs text-slate-400">{activeSession ? 'Sessione attiva' : 'Nessuna activeSessione'}</p>
              </div>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input placeholder="Cerca piatto..." className="h-9 pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                onClick={() => setActiveWaitCourse(num)}
                className={`px - 4 py - 2 text - sm font - bold rounded - xl whitespace - nowrap transition - all flex items - center gap - 2 border ${activeWaitCourse === num ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'} `}
              >
                <Layers className={`w - 4 h - 4 ${activeWaitCourse === num ? 'text-white' : 'text-slate-500'} `} />
                Portata {num}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setActiveCategory('all')} className={`px - 4 py - 1.5 text - xs font - bold rounded - full whitespace - nowrap transition - all ${activeCategory === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} `}>Tutto</button>
            {sortedCategories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px - 4 py - 1.5 text - xs font - bold rounded - full whitespace - nowrap transition - all ${activeCategory === cat.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} `}>{cat.name}</button>
            ))}
          </div>
        </header>

        <main className="p-3 pb-32">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredDishes.map((dish) => (
              <button
                key={dish.id}
                onClick={() => setSelectedDish(dish)}
                className="relative overflow-hidden bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all rounded-xl p-3 h-24 flex flex-col justify-between items-start text-left border border-slate-700 shadow-sm group"
              >
                <div className="w-full">
                  <h3 className="font-bold text-sm text-white leading-tight line-clamp-2">{dish.name}</h3>
                </div>
                <div className="w-full flex justify-between items-end mt-2">
                  <span className="text-emerald-400 font-bold text-sm">€{dish.price.toFixed(2)}</span>
                  <div className="bg-slate-700 p-1.5 rounded-lg group-hover:bg-slate-600 transition-colors">
                    <Plus className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>

        {/* Add Dish Dialog (Waiter Mode) */}
        <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
          <DialogContent className="sm:max-w-[340px] bg-slate-900 border border-slate-800 text-white p-0 gap-0 overflow-hidden shadow-2xl rounded-3xl translate-y-[-50%] top-[50%]">
            {selectedDish && (
              <div className="flex flex-col h-full bg-slate-900 text-white">
                <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-900/50">
                  <div>
                    <h2 className="text-lg font-bold leading-tight pr-4">{selectedDish.name}</h2>
                    <p className="text-emerald-400 font-bold mt-1">€{selectedDish.price.toFixed(2)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDish(null)} className="-mt-1 -mr-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full h-10 w-10">
                    <X className="w-6 h-6" />
                  </Button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Quantity */}
                  <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-xl border border-slate-800">
                    <span className="text-sm font-medium pl-2 text-slate-300">Quantità</span>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="h-10 w-10 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:text-white text-white rounded-lg" onClick={() => setDishQuantity(q => Math.max(1, q - 1))} disabled={dishQuantity <= 1}><Minus className="w-5 h-5" /></Button>
                      <span className="w-8 text-center font-bold text-xl">{dishQuantity}</span>
                      <Button variant="outline" size="icon" className="h-10 w-10 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:text-white text-white rounded-lg" onClick={() => setDishQuantity(q => q + 1)}><Plus className="w-5 h-5" /></Button>
                    </div>
                  </div>

                  {/* Course */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Portata</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map(num => (
                        <button
                          key={num}
                          onClick={() => setActiveWaitCourse(num)}
                          className={`h - 10 text - sm font - bold rounded - lg border transition - all ${activeWaitCourse === num
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            } `}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note</span>
                    <Textarea
                      placeholder="Es. Senza cipolla..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[80px] focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-600"
                      value={dishNote}
                      onChange={(e) => setDishNote(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-lg shadow-lg shadow-emerald-500/20 mt-2 active:scale-[0.98] transition-transform"
                    onClick={() => {
                      addToCart(selectedDish, dishQuantity, dishNote, activeWaitCourse);
                    }}
                  >
                    AGGIUNGI - €{(selectedDish.price * dishQuantity).toFixed(2)}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cart/Bill Drawer */}
        <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DrawerContent className="bg-slate-900 border-slate-700 text-white max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Conto e Comanda</DrawerTitle>
              <DrawerDescription className="text-slate-400">{tableName}</DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="flex-1 p-4 max-h-[60vh]">
              <div className="space-y-6">

                {/* CURRENT CART */}
                {cart.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-emerald-400 text-sm uppercase tracking-wider">Nuovo Ordine (Da inviare)</h3>
                    {courseNumbers.map(num => (
                      <div key={num} className="bg-slate-800 rounded-xl p-3">
                        <p className="text-xs font-bold text-slate-300 uppercase mb-2">Portata {num}</p>
                        <div className="space-y-2">
                          {cartByCourse[num]?.map((item) => (
                            <div key={item.cartId} className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-bold text-white">{item.quantity}x</span>
                                  <span className="font-medium text-sm text-slate-200 truncate">{item.name}</span>
                                </div>
                                {item.notes && <p className="text-xs text-amber-500 italic">Note: {item.notes}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">€{(item.price * item.quantity).toFixed(2)}</span>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => updateCartItemQuantity(item.cartId, -1)}><Minus className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => updateCartItemQuantity(item.cartId, 1)}><Plus className="w-3 h-3" /></Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-sm font-medium pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Parziale Ordine Corrente</span>
                      <span className="text-emerald-400">€{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* HISTORY / PREVIOUS ORDERS */}
                {previousOrders.length > 0 && (
                  <div className="space-y-3 opacity-80">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-400 text-sm uppercase tracking-wider">Ordini Precedenti</h3>
                      <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">€{historyTotal.toFixed(2)}</span>
                    </div>
                    {previousOrders.map(order => (
                      <div key={order.id} className="text-xs text-slate-500">
                        Ord. #{order.id.slice(0, 4)} - {new Date(order.created_at).toLocaleTimeString().slice(0, 5)} - €{order.total_amount?.toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}

                <div className="h-4"></div>
              </div>
            </ScrollArea>

            {/* TOTALS FOOTER */}
            <div className="p-4 border-t border-slate-700 bg-slate-900">
              <div className="flex justify-between items-end mb-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Totale Tavolo</p>
                  <p className="text-3xl font-bold text-white">€{grandTotal.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Coper{activeSession?.customer_count || '-'}</p>
                  {cartTotal > 0 && <p className="text-xs text-emerald-500 font-bold">+ €{cartTotal.toFixed(2)} (in attesa)</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { }}>
                  <span className="flex flex-col items-center leading-none">
                    <span className="font-bold">Stampa</span>
                    <span className="text-[10px] font-normal opacity-70">Preconto</span>
                  </span>
                </Button>
                <Button className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleSubmitClick} disabled={isOrderSubmitting || cart.length === 0}>
                  {isOrderSubmitting ? 'Invio...' : <><Send className="w-4 h-4 mr-2" /> Invia Ordine</>}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Floating Bottom Bar (Summary) - Luxury Style */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 left-4 right-4 z-40"
            >
              <div className="bg-zinc-950/95 backdrop-blur-xl rounded-xl border border-amber-500/20 p-4 shadow-2xl shadow-black/50 flex items-center justify-between gap-4">
                <div onClick={() => setIsCartOpen(true)} className="flex items-center gap-3 cursor-pointer">
                  <div className="w-11 h-11 rounded-full border border-amber-500/30 flex items-center justify-center text-amber-400 font-light text-lg">{cartCount}</div>
                  <div>
                    <p className="text-[10px] text-white/40 tracking-wide uppercase">Carrello</p>
                    <p className="text-lg font-light text-amber-400 tracking-wide">€ {cartTotal.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" className="h-11 w-11 p-0 border border-white/10 text-white/60 hover:bg-white/5 hover:border-amber-500/20 rounded-lg" onClick={() => setIsCartOpen(true)}>
                    <ChevronUp className="w-5 h-5" strokeWidth={1.5} />
                  </Button>
                  <Button className="h-11 px-6 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-light rounded-lg tracking-wide transition-all duration-300" onClick={handleSubmitClick} disabled={isOrderSubmitting}>
                    <Send className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Send Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-sm bg-slate-900 border-slate-700 text-white">
            <DialogHeader><DialogTitle>Conferma invio</DialogTitle><DialogDescription className="text-slate-400">Inviare l'ordine in cucina?</DialogDescription></DialogHeader>
            <div className="py-3">
              <div className="bg-slate-800 rounded-lg p-3 space-y-1">
                {courseNumbers.map(num => (
                  <div key={num} className="mb-2">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">• Portata {num}</p>
                    <ul className="pl-2 space-y-1">
                      {cartByCourse[num]?.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                          {item.notes && <span className="text-[10px] italic text-slate-500 max-w-[120px] truncate ml-2">({item.notes})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-sm font-bold pt-2 border-t border-slate-700 mt-2 text-white">Totale Ordine: €{cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submitOrder} disabled={isOrderSubmitting}>{isOrderSubmitting ? 'Invio...' : 'Conferma'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Course Management (Drag & Drop) */}
        <Dialog open={showCourseManagement} onOpenChange={setShowCourseManagement}>
          <DialogContent className="max-w-lg bg-slate-50 dark:bg-slate-900 max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl">
            <DialogHeader className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
              <DialogTitle>Organizza Portate</DialogTitle>
              <DialogDescription>Trascina i piatti per cambiare l'ordine di uscita</DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4 bg-slate-100 dark:bg-slate-950">
                  <div className="space-y-4 pb-20">
                    {Array.from({ length: maxCourse }, (_, i) => i + 1).map((courseNum) => (
                      <DroppableCourse
                        key={courseNum}
                        id={`course - ${courseNum} `}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-center mb-3">
                          <h3 className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-sm flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Layers className="w-4 h-4" />
                            {getCourseTitle(courseNum)}
                          </h3>
                        </div>

                        <div className="space-y-2 min-h-[40px]">
                          <SortableContext
                            id={`course - ${courseNum} `}
                            items={cartByCourse[courseNum]?.map(i => i.cartId) || []}
                            strategy={verticalListSortingStrategy}
                          >
                            {cartByCourse[courseNum]?.length === 0 ? (
                              <DroppableCoursePlaceholder id={`course - ${courseNum} `} />
                            ) : (
                              cartByCourse[courseNum]?.map((item) => (
                                <SortableDishItem key={item.cartId} item={item} courseNum={courseNum} />
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
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-xl border border-emerald-500 shadow-xl opacity-90 scale-105 cursor-grabbing">
                      <div className="flex items-center gap-3">
                        <div className="p-1 text-emerald-500">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-xs">{activeDragItem.name}</p>
                          <p className="text-[10px] text-slate-500">{activeDragItem.quantity}x</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-20 relative">
              <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20" onClick={() => setShowCourseManagement(false)}>
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
              <Button className="h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20" onClick={() => {
                setShowCourseAlert(false);
                setShowConfirmDialog(true);
              }}>
                <ChefHat className="w-5 h-5 mr-2" />
                Invia tutto insieme
              </Button>
              <Button variant="outline" className="h-14 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium" onClick={() => {
                setShowCourseAlert(false);
                setShowCourseManagement(true);
              }}>
                <Layers className="w-5 h-5 mr-2 text-emerald-600" />
                Dividi in portate
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl h-12">Annulla</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }


  return (
    <div className="h-[100dvh] bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-900 font-sans select-none flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 relative">
        {activeTab === 'menu' && (
          <>
            <header className="flex-none z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-amber-500/10">
              <div className="max-w-2xl mx-auto px-4 py-4">
                {/* Restaurant Name - Luxury Header */}
                {restaurantName && (
                  <div className="text-center mb-4 pb-4 border-b border-white/5">
                    <p className="text-amber-500/50 text-[10px] tracking-[0.3em] uppercase mb-2">Menu</p>
                    <h1 className="text-2xl font-light text-white tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>
                      {restaurantName}
                    </h1>
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/30"></div>
                      <div className="w-1 h-1 rotate-45 bg-amber-500/30"></div>
                      <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/30"></div>
                    </div>
                  </div>
                )}

                {/* Menu Header & Search */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border border-amber-500/30 flex items-center justify-center bg-zinc-900">
                        <Utensils className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                      </div>
                      {activeSession && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-zinc-950" />}
                    </div>
                    <div>
                      <h2 className="font-medium text-sm text-white tracking-wide">{tableName || 'Tavolo'}</h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {activeSession ? (
                          <span className="text-[11px] text-amber-400 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Sessione attiva
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/50">
                            In attesa...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative w-36 transition-all focus-within:w-44 duration-300">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <Input
                      placeholder="Cerca..."
                      className="h-10 pl-9 pr-3 text-sm rounded-lg bg-zinc-900/80 border border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/50"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Category Pills - Luxury Style */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                  <div className="flex gap-2 min-w-max">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`px-4 py-2 text-xs tracking-wide transition-all duration-300 rounded-full border ${activeCategory === 'all'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-zinc-900/50 text-white/70 border-white/20 hover:border-amber-500/30 hover:text-white'
                        }`}
                    >
                      Tutto
                    </button>
                    {sortedCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-4 py-2 text-xs tracking-wide transition-all duration-300 rounded-full border ${activeCategory === cat.id
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-zinc-900/50 text-white/70 border-white/20 hover:border-amber-500/30 hover:text-white'
                          }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3 max-w-2xl mx-auto w-full pb-32">
              <AnimatePresence mode="popLayout">
                {activeCategory === 'all' && dishesByCategory ? (
                  dishesByCategory.map(({ category, dishes: catDishes }, catIndex) => (
                    <motion.div
                      key={category.id}
                      className="space-y-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: catIndex * 0.1 }}
                    >
                      <motion.div
                        className="flex items-center gap-4 pt-6 pb-3 first:pt-0"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                        <span className="text-[10px] font-light uppercase tracking-[0.2em] text-amber-400/70 px-4 py-1.5 bg-zinc-900/80 backdrop-blur-sm rounded-full border border-amber-500/20" style={{ fontFamily: 'Georgia, serif' }}>
                          {category.name}
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                      </motion.div>
                      {catDishes.map((dish, index) => (
                        <DishCard
                          key={dish.id}
                          dish={dish}
                          index={index}
                          onSelect={(d) => { setSelectedDish(d); setDishQuantity(1); }}
                          onAdd={(d) => { setSelectedDish(d); setDishQuantity(1); }}
                        />
                      ))}
                    </motion.div>
                  ))
                ) : (
                  filteredDishes.map((dish, index) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      index={index}
                      onSelect={(d) => { setSelectedDish(d); setDishQuantity(1); }}
                      onAdd={(d) => { setSelectedDish(d); setDishQuantity(1); }}
                    />
                  ))
                )}
                {filteredDishes.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-20 opacity-60"
                  >
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Nessun piatto trovato</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </>
        )}

        {activeTab === 'cart' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <header className="flex-none z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 shadow-sm">
              <h1 className="text-xl font-bold text-center text-slate-900 dark:text-white">Il tuo Ordine</h1>
              <p className="text-xs text-center text-slate-500 mt-1">Gestisci le portate e invia l'ordine</p>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-32 space-y-4 max-w-2xl mx-auto w-full">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                    <ShoppingBasket className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="font-medium">Il carrello è vuoto</p>
                  <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-2 text-emerald-600">Torna al menu</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.cartId} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-white/20 dark:border-slate-800/50 flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                            <Utensils className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{item.name}</h3>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">€{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-slate-500 mt-0.5 italic line-clamp-1">Note: {item.notes}</p>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg">
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                {getCourseTitle(item.courseNumber)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg p-0.5">
                              <button
                                onClick={() => updateCartItemQuantity(item.cartId, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-bold text-sm w-4 text-center text-slate-900 dark:text-white">{item.quantity}</span>
                              <button
                                onClick={() => updateCartItemQuantity(item.cartId, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Button
                      variant="outline"
                      className="w-full h-11 border-dashed border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-2 rounded-xl font-semibold"
                      onClick={() => setShowCourseManagement(true)}
                    >
                      <Layers className="w-4 h-4" />
                      Dividi / Organizza Portate
                    </Button>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/30 dark:border-slate-800/50">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-500 font-medium">Totale Ordine</span>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">€{cartTotal.toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full h-14 text-base font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30"
                      onClick={handleSubmitClick}
                      disabled={isOrderSubmitting}
                    >
                      {isOrderSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Invio in corso...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-5 h-5" />
                          Invia Ordine in Cucina
                        </div>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <header className="flex-none z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 shadow-sm">
              <h1 className="text-xl font-bold text-center text-slate-900 dark:text-white">I tuoi Ordini</h1>
              <p className="text-xs text-center text-slate-500 mt-1">Segui lo stato delle tue ordinazioni</p>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-32 space-y-3 max-w-2xl mx-auto w-full">
              {previousOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                    <Clock className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="font-medium">Nessun ordine ancora</p>
                  <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-2 text-emerald-600">Vai al menu</Button>
                </div>
              ) : (
                previousOrders.map((order, index) => (
                  <div key={order.id} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-white/20 dark:border-slate-800/50">
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-emerald-600">#{index + 1}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(order.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Badge
                        className={`text - [10px] font - semibold ${order.status === 'OPEN' || order.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : order.status === 'preparing'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : order.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                          } `}
                      >
                        {order.status === 'OPEN' || order.status === 'pending' ? 'In attesa' :
                          order.status === 'preparing' ? 'In preparazione' :
                            order.status === 'ready' ? 'Pronto' : order.status}
                      </Badge>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {(order as any).items?.map((item: any, idx: number) => {
                        const d = dishes?.find(dd => dd.id === item.dish_id)
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white w-5">{item.quantity}x</span>
                              <span className="text-slate-600 dark:text-slate-300">{d?.name}</span>
                            </div>
                            {item.status === 'SERVED' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center">
                      <span className="text-xs text-slate-500">Totale parziale</span>
                      <span className="font-bold text-slate-900 dark:text-white">€{order.total_amount?.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}

              {previousOrders.length > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 rounded-2xl text-white dark:text-slate-900 shadow-xl">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Totale Complessivo</span>
                    <span className="text-2xl font-bold">€{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/30 dark:border-slate-800/50 pb-safe shadow-lg shadow-slate-900/5">
        <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex - 1 flex flex - col items - center justify - center gap - 1 h - full transition - all ${activeTab === 'menu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'} `}
          >
            <div className={`p - 1.5 rounded - xl transition - all ${activeTab === 'menu' ? 'bg-emerald-500/10' : ''} `}>
              <Utensils className={`w - 5 h - 5 ${activeTab === 'menu' ? 'fill-current' : ''} `} />
            </div>
            <span className="text-[10px] font-semibold">Menu</span>
          </button>

          <button
            onClick={() => setActiveTab('cart')}
            className={`flex - 1 flex flex - col items - center justify - center gap - 1 h - full transition - all relative ${activeTab === 'cart' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'} `}
          >
            <div className={`relative p - 1.5 rounded - xl transition - all ${activeTab === 'cart' ? 'bg-emerald-500/10' : ''} ${isCartAnimating ? 'scale-125' : ''} `}>
              <ShoppingBasket className={`w - 5 h - 5 ${activeTab === 'cart' ? 'fill-current' : ''} ${isCartAnimating ? 'text-emerald-500' : ''} `} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow-lg shadow-red-500/30 animate-bounce">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold">Carrello</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex - 1 flex flex - col items - center justify - center gap - 1 h - full transition - all ${activeTab === 'orders' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'} `}
          >
            <div className={`p - 1.5 rounded - xl transition - all ${activeTab === 'orders' ? 'bg-emerald-500/10' : ''} `}>
              <Clock className={`w - 5 h - 5 ${activeTab === 'orders' ? 'fill-current' : ''} `} />
            </div>
            <span className="text-[10px] font-semibold">Ordini</span>
          </button>
        </div>
      </div>

      {/* Dish Detail Dialog */}
      <Dialog open={!!selectedDish} onOpenChange={(open) => !open && setSelectedDish(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border-0 shadow-2xl">
          {selectedDish && (
            <>
              <div className="relative h-56 w-full">
                {selectedDish.image_url ? (
                  <img src={selectedDish.image_url} alt={selectedDish.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                    <Utensils className="w-16 h-16 text-slate-300" />
                  </div>
                )}
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white rounded-full hover:bg-black/50 transition-colors" onClick={() => setSelectedDish(null)}>
                  <X className="w-5 h-5" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 text-center">
                  <h2 className="text-3xl font-bold text-white leading-tight">{selectedDish.name}</h2>
                  <p className="text-emerald-400 font-bold text-xl mt-2">€{selectedDish.price.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {selectedDish.description && (
                  <div className="text-center">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white mb-2">Descrizione</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{selectedDish.description}</p>
                  </div>
                )}

                {selectedDish.allergens && selectedDish.allergens.length > 0 && (
                  <div className="text-center">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                      <Info className="w-4 h-4 text-amber-500" />
                      Allergeni
                    </h3>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {selectedDish.allergens.map(a => (
                        <Badge key={a} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30 text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5 block tracking-wider text-center">Quantità</label>
                  <div className="flex items-center justify-center gap-4 bg-slate-50 dark:bg-slate-800 rounded-xl p-2">
                    <button
                      onClick={() => setDishQuantity(q => Math.max(1, q - 1))}
                      className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl shadow-sm text-slate-600 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95 disabled:opacity-40"
                      disabled={dishQuantity <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-3xl w-12 text-center text-slate-900 dark:text-white">{dishQuantity}</span>
                    <button
                      onClick={() => setDishQuantity(q => q + 1)}
                      className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl shadow-sm text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5 block tracking-wider text-center">Note per la cucina</label>
                  <Textarea
                    placeholder="Es. Niente cipolla, ben cotto..."
                    className="resize-none text-xs min-h-[60px] rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500"
                    value={dishNote}
                    onChange={(e) => setDishNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                <Button
                  className="w-full h-13 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98]"
                  onClick={() => {
                    addToCart(selectedDish, dishQuantity, dishNote, 1);
                    setSelectedDish(null);
                    setDishQuantity(1);
                    setDishNote('');
                  }}
                >
                  Aggiungi {dishQuantity > 1 ? `${dishQuantity} x` : ''}al carrello - €{(selectedDish.price * dishQuantity).toFixed(2)}
                </Button>
                <p className="text-center text-[10px] text-slate-400 mt-2">
                  Potrai gestire le portate direttamente nel carrello
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}