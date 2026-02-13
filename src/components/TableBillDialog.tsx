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
            <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100 p-0 rounded-3xl shadow-2xl flex flex-col">

                {/* Header */}
                <div className="p-5 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between shrink-0 relative z-20">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Receipt size={18} weight="fill" />
                            </div>
                            <h2 className="text-lg font-bold">Conto Tavolo {table?.number}</h2>
                        </div>
                        <p className="text-xs text-zinc-500 ml-10">
                            {session?.customer_count || 1} Ospiti · Sessione {session?.session_pin}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800" onClick={onClose}>
                        <X size={16} />
                    </Button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative bg-zinc-950">

                    {/* Mode 1: Main Overview */}
                    {!isSplitMode && !equalSplitMode && (
                        <div className="h-full flex flex-col p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

                            {/* Receipt Card */}
                            <div className="bg-white text-zinc-900 rounded-2xl p-0 overflow-hidden shadow-2xl relative flex-1 flex flex-col">
                                {/* Receipt Header */}
                                <div className="bg-zinc-100 p-4 border-b border-dashed border-zinc-300 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="font-bold uppercase tracking-wider text-xs text-zinc-500">{restaurant?.name || 'Ristorante'}</span>
                                        <span className="text-zinc-400 text-[10px]">{new Date().toLocaleString('it-IT')}</span>
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-500">{table?.number}</div>
                                </div>

                                <ScrollArea className="flex-1">
                                    <div className="p-4 space-y-1">
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
                                                return <div className="py-10 text-center text-zinc-400 italic text-sm">Conto saldato o vuoto</div>
                                            }

                                            return Array.from(displayGroups.entries()).map(([key, item]) => (
                                                <div key={key} className="flex justify-between items-baseline py-1 border-b border-zinc-100 last:border-0">
                                                    <div className="flex gap-2 text-sm">
                                                        <span className="font-bold min-w-[20px]">{item.quantity}x</span>
                                                        <span className="font-medium text-zinc-700">{item.name}</span>
                                                    </div>
                                                    <span className="font-bold text-sm tabular-nums">€{item.total.toFixed(2)}</span>
                                                </div>
                                            ))
                                        })()}
                                    </div>
                                </ScrollArea>

                                {/* Receipt Footer */}
                                <div className="bg-zinc-50 p-4 border-t-2 border-dashed border-zinc-300">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-zinc-500 uppercase">Totale</span>
                                        <span className="text-2xl font-black text-zinc-900">€{totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* ZigZag Bottom */}
                                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[linear-gradient(45deg,transparent_75%,#09090b_75%),linear-gradient(-45deg,transparent_75%,#09090b_75%)] bg-[length:10px_10px] opacity-0"></div>
                            </div>

                            {/* Split Options - Floating above bottom */}
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all font-medium"
                                    onClick={() => { setIsSplitMode(true); setEqualSplitMode(false) }}
                                    disabled={totalAmount <= 0}
                                >
                                    <ForkKnife className="mr-2" size={18} />
                                    Dividi per Piatti
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all font-medium"
                                    onClick={() => { setEqualSplitMode(true); setIsSplitMode(false) }}
                                    disabled={totalAmount <= 0}
                                >
                                    <Users className="mr-2" size={18} />
                                    Dividi alla Romana
                                </Button>
                            </div>
                        </div>
                    )}


                    {/* Mode 2: Split by Items */}
                    {isSplitMode && (
                        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="px-5 py-3 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 sticky top-0 z-10 backdrop-blur-md">
                                <span>Seleziona Piatti</span>
                                <button className="text-amber-500 hover:text-amber-400 transition-colors" onClick={() => {
                                    if (selectedSplitItems.size === splitPayableItems.length) setSelectedSplitItems(new Set())
                                    else setSelectedSplitItems(new Set(splitPayableItems.map(i => i.id)))
                                }}>
                                    {selectedSplitItems.size === splitPayableItems.length ? 'Deseleziona Tutto' : 'Seleziona Tutto'}
                                </button>
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2 pb-6">
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
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${isSelected
                                                    ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)]'
                                                    : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/60 hover:border-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-transparent'
                                                        }`}>
                                                        {isSelected && <Check size={12} weight="bold" className="text-black" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-zinc-400'}`}>{item.name}</span>
                                                        {item.isVirtual && <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Autom</span>}
                                                    </div>
                                                </div>
                                                <span className={`font-mono font-bold ${isSelected ? 'text-amber-500' : 'text-zinc-500'}`}>€{item.price.toFixed(2)}</span>
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
                    )}


                    {/* Mode 3: Equal Split */}
                    {equalSplitMode && (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 rounded-full bg-linear-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center mb-6 shadow-xl relative">
                                <Users size={32} className="text-zinc-400" weight="duotone" />
                                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                                    {Math.max(1, session?.customer_count || 1)}
                                </div>
                            </div>

                            <h3 className="text-lg text-zinc-400 mb-1 font-medium">Quota a Persona</h3>
                            <div className="text-5xl font-black text-white tracking-tight mb-2 tabular-nums">
                                €{perPersonAmount.toFixed(2)}
                            </div>
                            <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                                Calcolato su un totale di <span className="text-zinc-300 font-bold">€{totalAmount.toFixed(2)}</span> diviso per {session?.customer_count || 1} ospiti.
                            </p>

                            <div className="mt-8 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl text-amber-500 text-sm flex items-center gap-2">
                                <Wallet size={20} weight="duotone" />
                                <span>Incassa <strong>€{perPersonAmount.toFixed(2)}</strong> da ciascuno</span>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Action Bar */}
                <div className="p-5 border-t border-white/5 bg-zinc-900/90 backdrop-blur-xl relative z-20">
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
