import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Receipt, Trash, Circle, Check, Plus, Minus, ForkKnife, CurrencyEur, Clock, Users, Sparkle, X, ArrowLeft, Wallet } from '@phosphor-icons/react'
import { Order, Table, TableSession, Restaurant, OrderItem, Dish } from '../services/types'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { getCurrentCopertoPrice, getCurrentAyceSettings } from '../utils/pricingUtils'
import { motion, AnimatePresence } from 'framer-motion'

interface TableBillDialogProps {
    isOpen: boolean
    onClose: () => void
    table: Table | null
    session: TableSession | null
    orders: Order[]
    restaurant: Restaurant | null
    onPaymentComplete: () => void
    onEmptyTable?: () => void
    isWaiter?: boolean
}

interface SplitItem {
    id: string
    name: string
    price: number
    quantity: number // Always 1 for split items
    status: string
    isVirtual?: boolean
    originalId?: string // Link to original item if this is a split part
    originalItem?: any
    dish?: Dish
}

export default function TableBillDialog({
    isOpen,
    onClose,
    table,
    session,
    orders,
    restaurant,
    onPaymentComplete,
    onEmptyTable,
    isWaiter = false
}: TableBillDialogProps) {
    // Reset Split Mode when dialog opens
    useEffect(() => {
        if (isOpen) {
            setIsSplitMode(false)
            setEqualSplitMode(false)
            setSelectedSplitItems(new Set())
            setPaidItemIds(new Set())
        }
    }, [isOpen])

    const [paidItemIds, setPaidItemIds] = useState<Set<string>>(new Set())

    const [isSplitMode, setIsSplitMode] = useState(false)
    const [selectedSplitItems, setSelectedSplitItems] = useState<Set<string>>(new Set())
    const [processingPayment, setProcessingPayment] = useState(false)
    const [equalSplitMode, setEqualSplitMode] = useState(false)

    // Calculate Pricing Settings (Coperto & AYCE)
    const pricingSettings = useMemo(() => {
        if (!restaurant) return { copertoPrice: 0, aycePrice: 0 }

        const lunchStart = restaurant.lunch_time_start || '12:00'
        const dinnerStart = restaurant.dinner_time_start || '19:00'

        const coperto = getCurrentCopertoPrice(restaurant, lunchStart, dinnerStart)
        const ayce = getCurrentAyceSettings(restaurant, lunchStart, dinnerStart)

        return {
            copertoPrice: coperto.price,
            aycePrice: ayce.price
        }
    }, [restaurant])

    // Calculate Virtual Items (Coperto & AYCE Cover)
    const virtualItems = useMemo(() => {
        const items: SplitItem[] = []
        if (!session || !restaurant) return items

        const customerCount = session.customer_count || 0

        // 1. Coperto Items
        // Check session flag first (default true if undefined), then pricing enabled check
        const isCopertoEnabled = session.coperto_enabled !== false // Default true
        if (isCopertoEnabled && pricingSettings.copertoPrice > 0) {
            for (let i = 0; i < customerCount; i++) {
                items.push({
                    id: `coperto-${session.id}-${i}`,
                    name: 'Coperto',
                    price: pricingSettings.copertoPrice,
                    quantity: 1,
                    status: 'SERVED',
                    isVirtual: true
                })
            }
        }

        // 2. All You Can Eat Items (Per Person Charge)
        const isAyceEnabled = session.ayce_enabled === true
        if (isAyceEnabled && pricingSettings.aycePrice > 0) {
            for (let i = 0; i < customerCount; i++) {
                items.push({
                    id: `ayce-cover-${session.id}-${i}`,
                    name: 'All You Can Eat',
                    price: pricingSettings.aycePrice,
                    quantity: 1,
                    status: 'SERVED',
                    isVirtual: true
                })
            }
        }

        return items
    }, [session, restaurant, pricingSettings])


    // Flatten Real Items (Handle AYCE price overrides + Expand Quantity > 1 for splitting)
    const realItemsExpanded = useMemo(() => {
        let items: SplitItem[] = []
        const isAyceEnabled = session?.ayce_enabled === true

        orders.forEach(order => {
            if (order.items) {
                order.items.forEach((item: any) => {
                    // Skip finished items
                    if (item.status === 'CANCELLED' || item.status === 'PAID' || paidItemIds.has(item.id)) return

                    // Determine effective price
                    let price = item.dish?.price || item.price || 0

                    // If AYCE session AND dish is included in AYCE, price is 0
                    if (isAyceEnabled && item.dish?.is_ayce) {
                        price = 0
                    }

                    // For display/logic: Expand quantity into individual items
                    // e.g. "Coca Cola x3" -> 3 separate "Coca Cola" lines
                    const qty = item.quantity || 1
                    for (let i = 0; i < qty; i++) {
                        items.push({
                            id: `${item.id}-split-${i}`, // Virtual split ID
                            originalId: item.id,      // Reference to real DB item
                            originalItem: item,
                            name: item.dish?.name || item.name || 'Piatto',
                            price: price,
                            quantity: 1, // Normalized to 1
                            status: item.status,
                            dish: item.dish
                        })
                    }
                })
            }
        })
        return items
    }, [orders, session, paidItemIds])

    // Specific list for display in "Split" view
    // (In normal view we show totals, in split view we show the expanded list)
    const splitPayableItems = useMemo(() => {
        // Filter out items already in paidItemIds (handled in loop above mostly, but double check virtuals)
        const virt = virtualItems.filter(i => !paidItemIds.has(i.id))
        return [...realItemsExpanded, ...virt]
    }, [realItemsExpanded, virtualItems, paidItemIds])


    // Calculate Total Amount (Full Bill)
    const totalAmount = useMemo(() => {
        return splitPayableItems.reduce((acc, item) => acc + item.price, 0)
    }, [splitPayableItems])


    const perPersonAmount = useMemo(() => {
        const count = Math.max(1, session?.customer_count || 1)
        return totalAmount / count
    }, [totalAmount, session])


    // Handle Split Payment Logic
    const handlePaySplit = async () => {
        if (selectedSplitItems.size === 0) return
        setProcessingPayment(true)

        try {
            // Check if paying everything
            if (selectedSplitItems.size === splitPayableItems.length) {
                onPaymentComplete()
                return
            }

            // Group selected non-virtual items by their Original DB ID
            // key: originalId, value: count of splits selected
            const selectedRealGroups = new Map<string, number>()
            const virtualIdsToHide: string[] = []

            selectedSplitItems.forEach(splitId => {
                const item = splitPayableItems.find(i => i.id === splitId)
                if (!item) return

                if (item.isVirtual) {
                    virtualIdsToHide.push(splitId)
                } else if (item.originalId) {
                    const current = selectedRealGroups.get(item.originalId) || 0
                    selectedRealGroups.set(item.originalId, current + 1)
                }
            })

            // Process Database Updates
            for (const [originalId, countToPay] of selectedRealGroups.entries()) {
                const itemWrapper = realItemsExpanded.find(i => i.originalId === originalId)
                if (!itemWrapper || !itemWrapper.originalItem) continue

                const originalItem = itemWrapper.originalItem
                const currentQty = originalItem.quantity

                if (countToPay >= currentQty) {
                    // Paying the Full quantity of this item row -> Mark entire row PAID
                    const { error } = await supabase
                        .from('order_items')
                        .update({ status: 'PAID' })
                        .eq('id', originalId)
                    if (error) throw error
                } else {
                    // Partial payment of a quantity row (e.g. paying 1 of 3 beers)
                    // 1. Decrement original row
                    const { error: updateError } = await supabase
                        .from('order_items')
                        .update({ quantity: currentQty - countToPay })
                        .eq('id', originalId)

                    if (updateError) throw updateError

                    // 2. Insert new row for paid items
                    // SANITIZATION FIX: Explicitly select fields
                    const { error: insertError } = await supabase
                        .from('order_items')
                        .insert({
                            order_id: originalItem.order_id,
                            dish_id: originalItem.dish_id,
                            course_number: originalItem.course_number,
                            note: originalItem.note,
                            price: originalItem.price,
                            quantity: countToPay,
                            status: 'PAID'
                        })

                    if (insertError) throw insertError
                }
            }

            // Update UI State locally
            setPaidItemIds(prev => {
                const newSet = new Set(prev)
                virtualIdsToHide.forEach(id => newSet.add(id))
                selectedSplitItems.forEach(id => newSet.add(id))
                return newSet
            })

            const totalPaid = Array.from(selectedSplitItems).reduce((sum, id) => {
                const item = splitPayableItems.find(i => i.id === id)
                return sum + (item?.price || 0)
            }, 0)

            toast.success(`Pagamento parziale di €${totalPaid.toFixed(2)} registrato`)
            setIsSplitMode(false)
            setSelectedSplitItems(new Set())

        } catch (error) {
            console.error('Payment error:', error)
            toast.error('Errore durante il pagamento')
        } finally {
            setProcessingPayment(false)
        }
    }

    const { splitTotal } = useMemo(() => {
        let total = 0
        selectedSplitItems.forEach(id => {
            const item = splitPayableItems.find(i => i.id === id)
            if (item) total += item.price
        })
        return { splitTotal: total }
    }, [selectedSplitItems, splitPayableItems])


    // Render Helper
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl w-[95vw] max-h-[85vh] md:max-h-[90vh] overflow-hidden bg-zinc-950/90 backdrop-blur-2xl border-white/10 text-zinc-100 p-0 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col outline-none">

                {/* Header */}
                <div className="p-4 md:p-6 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between shrink-0 relative z-20">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                <Receipt size={20} weight="fill" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold tracking-tight">Conto Tavolo {table?.number}</h2>
                                <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                                    {session?.customer_count || 1} Ospiti <span className="mx-1.5 opacity-50">•</span> PIN: <span className="font-mono text-white">{session?.session_pin}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10" onClick={onClose}>
                        <X size={16} weight="bold" />
                    </Button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative">
                    <AnimatePresence mode="wait">

                        {/* Mode 1: Main Overview */}
                        {!isSplitMode && !equalSplitMode && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className="h-full flex flex-col p-4 md:p-6"
                            >

                                {/* Receipt Card - Dark Glassmorphism */}
                                <div className="bg-black/20 backdrop-blur-2xl border border-white/5 text-zinc-100 rounded-[1.5rem] overflow-hidden shadow-2xl relative flex-1 flex flex-col ring-1 ring-white/5">

                                    {/* Fluid Background Effect */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none -mr-32 -mt-32"></div>
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none -ml-32 -mb-32"></div>

                                    {/* Receipt Header */}
                                    <div className="p-6 border-b border-white/5 flex items-center justify-between relative z-10 bg-gradient-to-b from-white/5 to-transparent">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold uppercase tracking-widest text-[10px] text-amber-500">{restaurant?.name || 'Ristorante'}</span>
                                            <span className="text-zinc-400 text-xs font-medium">{new Date().toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}</span>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-zinc-200 shadow-inner">
                                            {table?.number}
                                        </div>
                                    </div>

                                    <ScrollArea className="flex-1 relative z-10">
                                        <div className="p-6 space-y-3">
                                            {(() => {
                                                // Group items for clean receipt display
                                                const displayGroups = new Map<string, { name: string, quantity: number, price: number, total: number }>()

                                                splitPayableItems.forEach(item => {
                                                    const key = `${item.name}-${item.price}`
                                                    const existing = displayGroups.get(key)
                                                    if (existing) {
                                                        existing.quantity += 1
                                                        existing.total += item.price
                                                    } else {
                                                        displayGroups.set(key, {
                                                            name: item.name,
                                                            quantity: 1,
                                                            price: item.price,
                                                            total: item.price
                                                        })
                                                    }
                                                })

                                                if (displayGroups.size === 0) {
                                                    return (
                                                        <div className="py-12 flex flex-col items-center justify-center text-zinc-500 space-y-3 opacity-50">
                                                            <Receipt size={40} weight="duotone" />
                                                            <p className="font-medium">Conto saldato o vuoto</p>
                                                        </div>
                                                    )
                                                }

                                                return Array.from(displayGroups.entries()).map(([key, item]) => (
                                                    <div key={key} className="flex justify-between items-baseline py-2 border-b border-white/5 last:border-0 group hover:bg-white/5 transition-colors rounded-lg px-2 -mx-2">
                                                        <div className="flex gap-3 text-sm items-center">
                                                            <span className="font-bold min-w-[24px] h-6 rounded bg-white/10 flex items-center justify-center text-xs text-zinc-300">{item.quantity}x</span>
                                                            <span className="font-medium text-zinc-200">{item.name}</span>
                                                        </div>
                                                        <span className="font-mono font-bold text-sm tabular-nums text-zinc-300">€{item.total.toFixed(2)}</span>
                                                    </div>
                                                ))
                                            })()}
                                        </div>
                                    </ScrollArea>

                                    {/* Receipt Footer */}
                                    <div className="p-6 border-t border-white/10 bg-black/20 backdrop-blur-md relative z-10">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Totale</span>
                                            <div className="text-right">
                                                <span className="text-3xl font-black text-white tracking-tight drop-shadow-lg">€{totalAmount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Split Options - Floating above bottom */}
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-14 rounded-2xl bg-zinc-900/50 backdrop-blur-md border-zinc-700/50 text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 hover:border-amber-500/50 transition-all duration-300 group"
                                        onClick={() => { setIsSplitMode(true); setEqualSplitMode(false) }}
                                        disabled={totalAmount <= 0}
                                    >
                                        <ForkKnife className="mr-2 group-hover:scale-110 transition-transform" size={20} weight="duotone" />
                                        <span className="font-medium">Dividi per Piatti</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-14 rounded-2xl bg-zinc-900/50 backdrop-blur-md border-zinc-700/50 text-zinc-300 hover:text-indigo-400 hover:bg-zinc-800 hover:border-indigo-500/50 transition-all duration-300 group"
                                        onClick={() => { setEqualSplitMode(true); setIsSplitMode(false) }}
                                        disabled={totalAmount <= 0}
                                    >
                                        <Users className="mr-2 group-hover:scale-110 transition-transform" size={20} weight="duotone" />
                                        <span className="font-medium">Dividi alla Romana</span>
                                    </Button>
                                </div>
                            </motion.div>
                        )}


                        {/* Mode 2: Split by Items */}
                        {isSplitMode && (
                            <motion.div
                                key="split-items"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className="h-full flex flex-col p-4 md:p-6"
                            >

                                {/* Glass Container */}
                                <div className="bg-black/20 backdrop-blur-2xl border border-white/5 text-zinc-100 rounded-[1.5rem] overflow-hidden shadow-2xl relative flex-1 flex flex-col ring-1 ring-white/5">

                                    {/* Fluid Background Effect */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none -mr-32 -mt-32"></div>

                                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-500 sticky top-0 z-10 bg-black/20 backdrop-blur-md">
                                        <span>Seleziona Piatti</span>
                                        <button className="text-amber-500 hover:text-amber-400 transition-colors" onClick={() => {
                                            if (selectedSplitItems.size === splitPayableItems.length) setSelectedSplitItems(new Set())
                                            else setSelectedSplitItems(new Set(splitPayableItems.map(i => i.id)))
                                        }}>
                                            {selectedSplitItems.size === splitPayableItems.length ? 'Deseleziona Tutto' : 'Seleziona Tutto'}
                                        </button>
                                    </div>

                                    <ScrollArea className="flex-1 relative z-10">
                                        <div className="p-4 space-y-2 pb-6">
                                            {splitPayableItems.map((item) => {
                                                const isSelected = selectedSplitItems.has(item.id)
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            const newSet = new Set(selectedSplitItems)
                                                            if (newSet.has(item.id)) newSet.delete(item.id)
                                                            else newSet.add(item.id)
                                                            setSelectedSplitItems(newSet)
                                                        }}
                                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer select-none group ${isSelected
                                                            ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]'
                                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 border-amber-500 scale-110' : 'border-zinc-600 bg-transparent group-hover:border-zinc-500'
                                                                }`}>
                                                                {isSelected && <Check size={14} weight="bold" className="text-black" />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>{item.name}</span>
                                                                {item.isVirtual && <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider">Autom</span>}
                                                            </div>
                                                        </div>
                                                        <span className={`font-mono font-bold transition-colors ${isSelected ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-400'}`}>€{item.price.toFixed(2)}</span>
                                                    </div>
                                                )
                                            })}
                                            {splitPayableItems.length === 0 && (
                                                <div className="py-20 flex flex-col items-center justify-center text-zinc-600 text-sm">
                                                    <Sparkle size={32} className="mb-2 opacity-20" />
                                                    <p>Nessun elemento da dividere</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </motion.div>
                        )}


                        {/* Mode 3: Equal Split */}
                        {equalSplitMode && (
                            <motion.div
                                key="equal-split"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className="h-full flex flex-col p-4 md:p-6"
                            >
                                {/* Glass Container */}
                                <div className="bg-black/20 backdrop-blur-2xl border border-white/5 text-zinc-100 rounded-[1.5rem] overflow-hidden shadow-2xl relative flex-1 flex flex-col items-center justify-center p-8 text-center ring-1 ring-white/5">

                                    {/* Fluid Background Effect */}
                                    <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none -ml-32 -mt-32"></div>
                                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-fuchsia-500/10 blur-[100px] rounded-full pointer-events-none -mr-32 -mb-32"></div>

                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-full bg-linear-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative group">
                                            <Users size={40} className="text-zinc-400 group-hover:text-white transition-colors" weight="duotone" />
                                            <div className="absolute -bottom-2 -right-2 bg-amber-500 text-black text-sm font-bold px-3 py-1 rounded-full shadow-lg border border-black/20">
                                                {Math.max(1, session?.customer_count || 1)}
                                            </div>
                                        </div>

                                        <h3 className="text-xl text-zinc-400 mb-2 font-medium tracking-wide">Quota a Persona</h3>
                                        <div className="text-6xl font-black text-white tracking-tighter mb-4 tabular-nums drop-shadow-2xl">
                                            €{perPersonAmount.toFixed(2)}
                                        </div>
                                        <p className="text-sm text-zinc-500 max-w-[240px] leading-relaxed mx-auto">
                                            Calcolato su un totale di <span className="text-zinc-300 font-bold">€{totalAmount.toFixed(2)}</span> diviso per <span className="text-zinc-300 font-bold">{session?.customer_count || 1}</span> ospiti.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

                {/* Footer Action Bar */}
                <div className="p-4 md:p-6 border-t border-white/5 bg-zinc-900/40 relative z-20">
                    {isWaiter && !restaurant?.allow_waiter_payments ? (
                        <div className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 text-red-400 text-sm font-bold">
                            <X size={16} />
                            Pagamenti disabilitati per i camerieri
                        </div>
                    ) : (
                        <>
                            {isSplitMode || equalSplitMode ? (
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-12 px-6 rounded-xl border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                                        onClick={() => { setIsSplitMode(false); setEqualSplitMode(false); setSelectedSplitItems(new Set()) }}
                                    >
                                        <ArrowLeft className="mr-2" /> Indietro
                                    </Button>

                                    {isSplitMode && (
                                        <Button
                                            className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-xl shadow-lg shadow-amber-500/20"
                                            disabled={selectedSplitItems.size === 0 || processingPayment}
                                            onClick={handlePaySplit}
                                        >
                                            {processingPayment ? <span className="animate-pulse">Attendi...</span> : `Paga €${splitTotal.toFixed(2)}`}
                                        </Button>
                                    )}

                                    {equalSplitMode && (
                                        <Button
                                            className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-xl shadow-lg shadow-amber-500/20"
                                            // Logic for paying "one share" is tricky as it's not tied to items. Usually just pay custom amount.
                                            // So for now we just show "Back" or maybe "Mark All Paid" if they collected cash?
                                            // Or implement partial custom payment. 
                                            // For simplicity, revert to main to pay full, or use split items for partial.
                                            // Let's allow "Pay Full" from here too as shortcut
                                            onClick={() => onPaymentComplete()}
                                        >
                                            Salda Intero Tavolo
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <Button
                                        className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xl rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-between px-6"
                                        onClick={() => onPaymentComplete()}
                                        disabled={totalAmount <= 0}
                                    >
                                        <div className="flex items-center gap-2">
                                            <CheckCircle weight="fill" size={24} />
                                            <span>Salda Tutto</span>
                                        </div>
                                        <span>€{totalAmount.toFixed(2)}</span>
                                    </Button>

                                    {onEmptyTable && (
                                        <Button
                                            variant="ghost"
                                            className="text-zinc-500 hover:text-red-400 hover:bg-red-500/5 h-10 rounded-xl text-xs uppercase font-bold tracking-wider"
                                            onClick={onEmptyTable}
                                            disabled={totalAmount > 0}
                                        >
                                            {totalAmount > 0 ? 'Salda prima di liberare' : 'Libera Tavolo e Chiudi'}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    )
}
