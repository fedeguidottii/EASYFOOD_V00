import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Table, Dish, Category, Restaurant } from '../../services/types'
import { toast } from 'sonner'
import { ArrowLeft, MagnifyingGlass, Plus, Minus, Trash, ShoppingCart, Info, CaretDown, CaretUp, CheckCircle, Warning, PencilSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { DishPlaceholder } from '@/components/ui/DishPlaceholder'
import { motion, AnimatePresence } from 'framer-motion'

interface OrderItem {
    dishId: string
    quantity: number
    notes: string
    courseNumber: number
    dish?: Dish
}

const WaiterOrderPage = () => {
    const { tableId } = useParams<{ tableId: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [table, setTable] = useState<Table | null>(null)
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [dishes, setDishes] = useState<Dish[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Order State
    const [orderItems, setOrderItems] = useState<OrderItem[]>([])
    const [activeCourse, setActiveCourse] = useState(1)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Refs for scrolling
    const categoryScrollRef = useRef<HTMLDivElement>(null)

    // Fetch Initial Data
    useEffect(() => {
        const init = async () => {
            if (!tableId) return
            try {
                setLoading(true)

                // Fetch Table & Restaurant
                const { data: tableData } = await supabase
                    .from('tables')
                    .select('*, restaurants(*)')
                    .eq('id', tableId)
                    .single()

                if (!tableData) throw new Error('Tavolo non trovato')

                setTable(tableData)
                // Fix: Handle potentially array or single object for joined resource
                const rest = Array.isArray(tableData.restaurants) ? tableData.restaurants[0] : tableData.restaurants
                setRestaurant(rest)

                const restaurantId = tableData.restaurant_id || rest?.id

                if (restaurantId) {
                    // Fetch Categories
                    const cats = await DatabaseService.getCategories(restaurantId)
                    setCategories(cats)

                    // Fetch Dishes
                    const allDishes = await DatabaseService.getDishes(restaurantId)
                    // Relaxed filter: show providing is_available is not explicitly false
                    setDishes(allDishes.filter(d => d.is_available !== false))
                }

            } catch (error) {
                console.error('Error init:', error)
                toast.error('Errore caricamento dati')
                navigate('/waiter')
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [tableId, navigate])

    // Filter Dishes
    const filteredDishes = useMemo(() => {
        return dishes.filter(dish => {
            const matchesSearch = dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (dish.short_code && dish.short_code.toLowerCase().includes(searchQuery.toLowerCase()))
            const matchesCategory = selectedCategory === 'all' || dish.category_id === selectedCategory
            return matchesSearch && matchesCategory
        })
    }, [dishes, searchQuery, selectedCategory])

    // Cart Logic
    const addToOrder = (dish: Dish) => {
        setOrderItems(prev => {
            const existing = prev.find(i => i.dishId === dish.id && i.courseNumber === activeCourse)
            if (existing) {
                return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
            }
            return [...prev, { dishId: dish.id, quantity: 1, notes: '', courseNumber: activeCourse, dish }]
        })
        toast.success(`Aggiunto: ${dish.name}`, { duration: 1500, position: 'top-center' })
    }

    const updateQuantity = (index: number, delta: number) => {
        setOrderItems(prev => {
            const newItems = [...prev]
            const item = newItems[index]
            const newQty = item.quantity + delta

            if (newQty <= 0) {
                return newItems.filter((_, i) => i !== index)
            }

            newItems[index] = { ...item, quantity: newQty }
            return newItems
        })
    }

    const updateNote = (index: number, note: string) => {
        setOrderItems(prev => prev.map((item, i) => i === index ? { ...item, notes: note } : item))
    }

    const moveToCourse = (index: number, courseNum: number) => {
        setOrderItems(prev => prev.map((item, i) => i === index ? { ...item, courseNumber: courseNum } : item))
    }

    // Submit Order
    const handleSubmit = async () => {
        if (orderItems.length === 0) return
        if (!table || !restaurant) return

        try {
            setSubmitting(true)

            // Get or Create Session
            const activeSession = await DatabaseService.getActiveSession(table.id)
            let sessionId = activeSession?.id

            if (!sessionId) {
                // Determine cover charge
                const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

                // We'll use simple defaults if complex pricing logic isn't easily reusable without importing large utils
                const baseCover = restaurant.cover_charge_per_person || 0

                // Create session with minimal required data
                const newSession = await DatabaseService.createSession({
                    table_id: table.id,
                    restaurant_id: restaurant.id,
                    coperto: baseCover,
                    customer_count: table.seats || 2 // Default if unknown
                })

                if (!newSession) throw new Error("Errore creazione sessione")
                sessionId = newSession.id
            }

            // Group by Course
            const courses = [...new Set(orderItems.map(i => i.courseNumber))].sort((a, b) => a - b)

            for (const courseNum of courses) {
                const itemsInCourse = orderItems.filter(i => i.courseNumber === courseNum)
                const totalAmount = itemsInCourse.reduce((sum, item) => sum + ((item.dish?.price || 0) * item.quantity), 0)

                // Create Order - Use 'OPEN' status which is standard
                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        table_session_id: sessionId,
                        restaurant_id: restaurant.id,
                        status: 'OPEN', // Changed from 'pending' to 'OPEN'
                        total_amount: totalAmount
                    })
                    .select()
                    .single()

                if (orderError) throw orderError

                // Create Order Items
                const dbItems = itemsInCourse.map(item => ({
                    order_id: orderData.id,
                    dish_id: item.dishId,
                    quantity: item.quantity,
                    notes: item.notes,
                    status: 'PENDING', // Changed from 'pending' to 'PENDING'
                    course_number: courseNum,
                }))

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(dbItems)

                if (itemsError) throw itemsError
            }

            toast.success('Ordine inviato con successo!')
            navigate('/waiter') // Return to dashboard

        } catch (error) {
            console.error('Submit error:', error)
            toast.error("Errore nell'invio dell'ordine: " + (error as any)?.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Totals
    const totalAmount = orderItems.reduce((sum, item) => sum + ((item.dish?.price || 0) * item.quantity), 0)
    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0)

    // Dish Detail Dialog State
    const [selectedDishForDetail, setSelectedDishForDetail] = useState<Dish | null>(null)
    const [detailQuantity, setDetailQuantity] = useState(1)
    const [detailNotes, setDetailNotes] = useState('')

    const openDishDetail = (dish: Dish, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedDishForDetail(dish)
        setDetailQuantity(1)
        setDetailNotes('')
    }

    const addFromDetail = () => {
        if (!selectedDishForDetail) return

        setOrderItems(prev => {
            // Check if we can merge with existing identical item (same notes) or just add new
            // For simplicity in Waiter Mode, we just append or update if exact match.
            // But since notes can vary, we treat as unique entry if notes differ?
            // The current addToOrder logic merges by DishId + Course. 
            // If we want to support same dish with different notes, we need strictly separate items or merged notes?
            // The current data structure: dishId is key.
            // If I add Carbonara (No pepe) and then Carbonara (No uovo), they might merge if I match only ID.
            // Let's stick to the current logic: Merge by ID+Course.
            // If notes exist, we append them? Or overwrite? 
            // Better: Add as new item or Append notes. 
            // Given the structure, let's just use the standard addToOrder but with initial notes?
            // Re-implementing specific add logic here:

            const existingIndex = prev.findIndex(i => i.dishId === selectedDishForDetail.id && i.courseNumber === activeCourse)

            if (existingIndex >= 0) {
                // Update existing
                const newItems = [...prev]
                newItems[existingIndex].quantity += detailQuantity
                // Append notes if not empty
                if (detailNotes) {
                    newItems[existingIndex].notes = newItems[existingIndex].notes
                        ? `${newItems[existingIndex].notes}, ${detailNotes}`
                        : detailNotes
                }
                return newItems
            } else {
                // New Item
                return [...prev, {
                    dishId: selectedDishForDetail.id,
                    quantity: detailQuantity,
                    notes: detailNotes,
                    courseNumber: activeCourse,
                    dish: selectedDishForDetail
                }]
            }
        })

        toast.success(`Aggiunto con note: ${selectedDishForDetail.name}`)
        setSelectedDishForDetail(null)
    }

    if (loading) return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-amber-500">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                <p className="text-xs uppercase tracking-widest font-medium">Caricamento Menù...</p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-zinc-950 text-foreground flex flex-col pb-24">
            {/* 1. Header Fissa */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/waiter')} className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-2">
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-none">Tavolo {table?.number}</h1>
                        <p className="text-xs text-zinc-500 font-medium">{restaurant?.name}</p>
                    </div>
                </div>

                {/* Search Toggle (Mobile) or Input (Desktop) */}
                <div className="relative w-48 hidden md:block">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                    <Input
                        placeholder="Cerca piatto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 bg-zinc-900 border-zinc-800 text-sm rounded-full focus:ring-amber-500/50"
                    />
                </div>
            </header>

            {/* 2. Course & Category Sticky Navigation */}
            <div className="fixed top-16 left-0 right-0 z-30 bg-zinc-950 border-b border-white/5 shadow-2xl shadow-black/50">
                {/* Course Selector - Compact */}
                <div className="px-4 py-2 flex items-center justify-between border-b border-white/5 bg-zinc-900/50">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Stai ordinando per:</span>
                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                        {[1, 2, 3, 4, 5].map(num => (
                            <button
                                key={num}
                                onClick={() => setActiveCourse(num)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeCourse === num
                                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                            >
                                Portata {num}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Horizontal Category Scroll */}
                <ScrollArea className="w-full whitespace-nowrap bg-zinc-950">
                    <div className="flex p-2 px-4 gap-2" ref={categoryScrollRef}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCategory('all')}
                            className={`rounded-full border transition-all h-8 px-4 text-xs font-medium ${selectedCategory === 'all'
                                ? 'bg-white text-black border-white'
                                : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600'
                                }`}
                        >
                            Tutti
                        </Button>
                        {categories.map(cat => (
                            <Button
                                key={cat.id}
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`rounded-full border transition-all h-8 px-4 text-xs font-medium ${selectedCategory === cat.id
                                    ? 'bg-amber-500 text-black border-amber-500'
                                    : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600'
                                    }`}
                            >
                                {cat.name}
                            </Button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="h-0" />
                </ScrollArea>

                {/* Mobile Search Bar (if filtered) */}
                <div className="md:hidden px-4 pb-2">
                    <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                        <Input
                            placeholder="Cerca piatto o codice..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-zinc-900 border-zinc-800 text-sm rounded-xl focus:ring-amber-500/50"
                        />
                    </div>
                </div>
            </div>

            {/* 3. Main Content - Dish List - Spaced for fixed headers */}
            <main className="flex-1 pt-60 px-4 space-y-3 max-w-2xl mx-auto w-full">
                {filteredDishes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                        <Info size={48} className="mb-4 opacity-20" />
                        <p>Nessun piatto trovato</p>
                    </div>
                ) : (
                    filteredDishes.map(dish => {
                        const qtyInCurrentCourse = orderItems.find(i => i.dishId === dish.id && i.courseNumber === activeCourse)?.quantity || 0
                        return (
                            <motion.div
                                key={dish.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative flex items-center gap-4 p-3 rounded-2xl border transition-all active:scale-[0.99] touch-manipulation cursor-pointer ${qtyInCurrentCourse > 0
                                    ? 'bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5'
                                    : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                                    }`}
                                onClick={() => addToOrder(dish)}
                            >
                                {/* Image / Placeholder */}
                                <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative">
                                    {dish.image_url ? (
                                        <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <DishPlaceholder iconSize={24} className="text-zinc-700" variant="fork" />
                                    )}
                                    {qtyInCurrentCourse > 0 && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                            <span className="text-xl font-bold text-white shadow-black drop-shadow-md">{qtyInCurrentCourse}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-medium text-zinc-100 text-sm line-clamp-2 leading-tight pr-2">{dish.name}</h3>
                                        <span className="text-amber-500 font-bold text-sm whitespace-nowrap">€{dish.price.toFixed(2)}</span>
                                    </div>
                                    <p className="text-zinc-500 text-xs line-clamp-1 mt-0.5">{dish.description}</p>
                                    {dish.allergens && dish.allergens.length > 0 && (
                                        <div className="flex gap-1 mt-1.5 overflow-hidden">
                                            {dish.allergens.map(a => (
                                                <span key={a} className="text-[9px] uppercase font-bold text-zinc-600 bg-zinc-900 px-1 rounded">{a.slice(0, 3)}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add/Remove Buttons */}
                                <div className="flex flex-col gap-2">
                                    {/* Note/Edit Button */}
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-amber-500 hover:border-amber-500"
                                        onClick={(e) => openDishDetail(dish, e)}
                                    >
                                        <PencilSimple weight="bold" size={14} />
                                    </div>

                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${qtyInCurrentCourse > 0 ? 'bg-amber-500 text-black border-amber-500' : 'bg-transparent text-zinc-600 border-zinc-800'
                                        }`}>
                                        <Plus weight="bold" size={14} />
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </main>

            {/* 4. Formatting Cart Floating Bar */}
            <AnimatePresence>
                {totalItems > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-gradient-to-t from-black via-black/90 to-transparent pt-12"
                    >
                        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                            <SheetTrigger asChild>
                                <Button className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black shadow-xl shadow-amber-500/20 flex items-center justify-between px-6 text-lg font-bold">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-black/20 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                                            <ShoppingCart weight="bold" />
                                            {totalItems}
                                        </div>
                                        <span className="text-sm font-medium opacity-80">Vedi Ordine</span>
                                    </div>
                                    <span>€{totalAmount.toFixed(2)}</span>
                                </Button>
                            </SheetTrigger>
                            {/* FIX: max-h-[90dvh] for better mobile support, overflow-hidden to let ScrollArea handle scroll */}
                            <SheetContent side="bottom" className="max-h-[90dvh] h-[90dvh] bg-zinc-950 border-t border-zinc-800 p-0 flex flex-col rounded-t-[2rem] overflow-hidden">
                                <SheetHeader className="p-6 pb-2 border-b border-white/5 bg-zinc-900/50 shrink-0">
                                    <SheetTitle className="text-xl text-white flex items-center gap-2">
                                        <ShoppingCart className="text-amber-500" weight="duotone" />
                                        Riepilogo Ordine
                                    </SheetTitle>
                                </SheetHeader>

                                <ScrollArea className="flex-1 p-4">
                                    {orderItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                                            <ShoppingCart size={48} weight="duotone" className="mb-4 opacity-50" />
                                            <p>Nessun piatto selezionato</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 pb-24">
                                            {[1, 2, 3, 4, 5].map(courseNum => {
                                                const items = orderItems.filter(i => i.courseNumber === courseNum)
                                                if (items.length === 0) return null
                                                return (
                                                    <div key={courseNum} className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                                                            <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5">
                                                                {courseNum === 0 ? 'Bevande / Altro' : `Portata ${courseNum}`}
                                                            </Badge>
                                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                                                        </div>

                                                        {items.map((item) => {
                                                            const realIndex = orderItems.indexOf(item)
                                                            const uniqueId = `${item.dishId}-${realIndex}`
                                                            return (
                                                                <div key={uniqueId} className="flex gap-3 bg-zinc-900/50 p-3 rounded-xl border border-white/5 relative group">
                                                                    <div className="flex-1">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className="font-bold text-zinc-200">{item.dish?.name}</span>
                                                                            <span className="text-zinc-400 text-sm">€{((item.dish?.price || 0) * item.quantity).toFixed(2)}</span>
                                                                        </div>
                                                                        {item.notes && <p className="text-xs text-amber-500 italic mt-1">{item.notes}</p>}

                                                                        <div className="flex items-center gap-4 mt-3">
                                                                            <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1">
                                                                                <button
                                                                                    onClick={() => updateQuantity(realIndex, -1)}
                                                                                    className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-md text-zinc-400 hover:text-white"
                                                                                >
                                                                                    <Minus size={14} weight="bold" />
                                                                                </button>
                                                                                <span className="font-mono font-bold w-6 text-center">{item.quantity}</span>
                                                                                <button
                                                                                    onClick={() => updateQuantity(realIndex, 1)}
                                                                                    className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-md text-zinc-400 hover:text-white"
                                                                                >
                                                                                    <Plus size={14} weight="bold" />
                                                                                </button>
                                                                            </div>

                                                                            <input
                                                                                type="text"
                                                                                placeholder="Note..."
                                                                                value={item.notes || ''}
                                                                                onChange={(e) => updateNote(realIndex, e.target.value)}
                                                                                className="h-8 text-xs bg-black/20 border-transparent focus:border-zinc-700 rounded-lg flex-1 min-w-0 px-2 text-zinc-300"
                                                                            />

                                                                            <button
                                                                                // Remove by reducing quantity to 0
                                                                                onClick={() => updateQuantity(realIndex, -item.quantity)}
                                                                                className="w-8 h-8 flex items-center justify-center text-red-500/50 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"
                                                                            >
                                                                                <Trash size={16} weight="duotone" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>

                                {/* Fixed Footer */}
                                <div className="p-4 bg-zinc-900 border-t border-white/5 space-y-3 pb-8 md:pb-6">
                                    {/* Increased bottom padding for mobile safe area */}
                                    <div className="flex justify-between items-center text-lg font-bold text-white">
                                        <span>Totale</span>
                                        <span className="text-amber-500 text-2xl">€{totalAmount.toFixed(2)}</span>
                                    </div>
                                    <Button
                                        className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-lg shadow-lg shadow-amber-500/20"
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Invio in corso...' : 'Invia Ordine in Cucina'}
                                    </Button>
                                    <div className="h-4 md:hidden" /> {/* Spacer for iOS Home Bar */}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dish Detail Dialog */}
            <Dialog open={!!selectedDishForDetail} onOpenChange={(open) => !open && setSelectedDishForDetail(null)}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden max-h-[90vh] flex flex-col">
                    {/* Added max-h and flex-col to DishDetail as well just in case */}
                    {selectedDishForDetail && (
                        <>
                            <div className="h-48 relative">
                                {selectedDishForDetail.image_url ? (
                                    <img src={selectedDishForDetail.image_url} alt={selectedDishForDetail.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                        <DishPlaceholder iconSize={64} className="text-zinc-800" variant="fork" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h2 className="text-2xl font-bold text-white">{selectedDishForDetail.name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-amber-500 font-bold text-lg">€{selectedDishForDetail.price.toFixed(2)}</span>
                                        {selectedDishForDetail.allergens && (
                                            <div className="flex gap-1">
                                                {selectedDishForDetail.allergens.map(a => (
                                                    <Badge key={a} variant="outline" className="border-white/10 bg-black/40 text-[10px] h-5">{a}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <p className="text-zinc-400 text-sm">{selectedDishForDetail.description}</p>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quantità</label>
                                    <div className="flex items-center gap-4 bg-zinc-900 p-2 rounded-xl border border-zinc-800 w-fit">
                                        <Button variant="ghost" size="icon" onClick={() => setDetailQuantity(Math.max(1, detailQuantity - 1))} className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-white/5">
                                            <Minus weight="bold" />
                                        </Button>
                                        <span className="text-xl font-bold font-mono w-8 text-center">{detailQuantity}</span>
                                        <Button variant="ghost" size="icon" onClick={() => setDetailQuantity(detailQuantity + 1)} className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-white/5">
                                            <Plus weight="bold" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Note e Richieste</label>
                                    <Textarea
                                        placeholder="Es. Senza cipolla, ben cotto..."
                                        value={detailNotes}
                                        onChange={(e) => setDetailNotes(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 focus:border-amber-500/50 min-h-[100px]"
                                    />
                                </div>

                                <Button className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-xl" onClick={addFromDetail}>
                                    Aggiungi all'ordine - €{(selectedDishForDetail.price * detailQuantity).toFixed(2)}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default WaiterOrderPage
