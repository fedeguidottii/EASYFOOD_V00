import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Receipt, Trash, Circle, Check, Plus, Minus, ForkKnife, CurrencyEur, Clock, Users, Sparkle } from '@phosphor-icons/react'
import { Order, Table, TableSession, Restaurant, OrderItem, Dish } from '../services/types'
import { DatabaseService } from '../services/DatabaseService'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { getCurrentCopertoPrice, getCurrentAyceSettings } from '../utils/pricingUtils'

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
                    const { error: insertError } = await supabase
                        .from('order_items')
                        .insert({
                            ...originalItem,
                            id: undefined, // Let DB generate new ID
                            created_at: undefined,
                            quantity: countToPay,
                            status: 'PAID',
                            // Ensure foreign keys strictly if needed, usually ...originalItem covers it
                            order_id: originalItem.order_id,
                            dish_id: originalItem.dish_id,
                            course_number: originalItem.course_number,
                            note: originalItem.note
                        })

                    if (insertError) throw insertError
                }
            }

            // Update UI State locally to reflect changes immediately
            // For virtual items: just add to paidItemIds
            // For real items: The `orders` prop might take a moment to refresh via subscription.
            // To be instant, we hide the specific Split IDs we acted on.
            // HOWEVER: Since we modified the DB rows (decrement quantity), the `orders` refresh will eventually come.
            // But immediate feedback is nice.

            setPaidItemIds(prev => {
                const newSet = new Set(prev)
                // Hide virtuals
                virtualIdsToHide.forEach(id => newSet.add(id))

                // Hide real split items
                // We just hide the *specific split IDs* we selected.
                // Since `realItemsExpanded` is re-calculated from `orders`, 
                // when `orders` updates (qty decreases), the number of splits will decrease automatically.
                // But until then, we hide the ones we clicked.
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
            <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-hidden bg-zinc-950 border-zinc-800/50 text-zinc-100 p-0 rounded-3xl shadow-2xl shadow-black/50">
                {/* Glow effects */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <DialogHeader className="p-5 pb-0 relative z-10 flex flex-row items-center justify-between border-b border-white/5 space-y-0 text-left">
                    <div>
                        <DialogTitle className="text-xl font-medium tracking-tight flex items-center gap-2">
                            <Receipt size={24} className="text-amber-500" />
                            Conto Tavolo {table?.number}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs mt-1 font-mono">
                            Sessione #{session?.session_pin} · {session?.customer_count || 0} Ospiti
                        </DialogDescription>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <span className="font-bold text-amber-500">{table?.number}</span>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative z-10 bg-zinc-950/50 backdrop-blur-sm">
                    {/* Main Bill View */}
                    {!isSplitMode && !equalSplitMode && (
                        <div className="h-full flex flex-col p-5 space-y-6">

                            {/* Bill Preview Card */}
                            <div className="bg-white text-zinc-900 p-6 rounded-sm shadow-xl font-mono text-sm relative overflow-hidden">
                                {/* Paper texture effect */}
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] opacity-20 pointer-events-none"></div>

                                {/* Zigzag border top/bottom */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,transparent_75%,#09090b_75%),linear-gradient(-45deg,transparent_75%,#09090b_75%)] bg-[length:10px_10px] transform rotate-180 opacity-10"></div>
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,transparent_75%,#09090b_75%),linear-gradient(-45deg,transparent_75%,#09090b_75%)] bg-[length:10px_10px] opacity-10"></div>

                                <div className="text-center mb-6 border-b border-black/10 pb-4">
                                    <h3 className="font-bold text-xl uppercase tracking-widest">{restaurant?.name || 'EASYFOOD'}</h3>
                                    <p className="text-xs text-zinc-500 mt-1">{new Date().toLocaleString('it-IT')}</p>
                                </div>

                                <ScrollArea className="h-[35vh] pr-4 -mr-4">
                                    <div className="space-y-3">
                                        {/* Items List - Compact for receipt view */}
                                        {/* Group items by name/price for cleaner receipt unless they are separate in split mode */}
                                        {(() => {
                                            // Temporary grouping for receipt display
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

                                            return Array.from(displayGroups.entries()).map(([key, item]) => (
                                                <div key={key} className="flex justify-between items-baseline">
                                                    <div className="flex gap-2">
                                                        <span className="font-bold opacity-70">{item.quantity}x</span>
                                                        <span>{item.name}</span>
                                                    </div>
                                                    <span className="font-bold tabular-nums">€{item.total.toFixed(2)}</span>
                                                </div>
                                            ))
                                        })()}

                                        {splitPayableItems.length === 0 && (
                                            <p className="text-center text-zinc-400 italic py-4">Tutto saldato per questo tavolo.</p>
                                        )}
                                    </div>
                                </ScrollArea>

                                <div className="border-t-2 border-dashed border-black/10 mt-6 pt-4 space-y-2">
                                    <div className="flex justify-between items-center text-xl font-bold">
                                        <span>TOTALE</span>
                                        <span>€{totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Per-person breakdown */}
                            <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Users className="text-zinc-400" />
                                    <div className="flex flex-col">
                                        <span className="text-xs text-zinc-500 uppercase font-bold">A persona</span>
                                        <span className="text-sm font-medium text-zinc-300">Diviso {session?.customer_count || 1}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-bold text-amber-500 tabular-nums">€{perPersonAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Split By Item Mode */}
                    {isSplitMode && (
                        <div className="h-full flex flex-col">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/80">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Seleziona voci da pagare</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-500 hover:text-amber-400 text-xs h-7"
                                    onClick={() => {
                                        if (selectedSplitItems.size === splitPayableItems.length) {
                                            setSelectedSplitItems(new Set())
                                        } else {
                                            setSelectedSplitItems(new Set(splitPayableItems.map(i => i.id)))
                                        }
                                    }}
                                >
                                    {selectedSplitItems.size === splitPayableItems.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                                </Button>
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2 pb-20">
                                    {splitPayableItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selectedSplitItems.has(item.id)
                                                ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                                                : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50 hover:border-white/10'
                                                }`}
                                            onClick={() => {
                                                const newSet = new Set(selectedSplitItems)
                                                if (newSet.has(item.id)) newSet.delete(item.id)
                                                else newSet.add(item.id)
                                                setSelectedSplitItems(newSet)
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedSplitItems.has(item.id) ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`}>
                                                    {selectedSplitItems.has(item.id) && <Check size={14} weight="bold" className="text-black" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-zinc-200">{item.name}</span>
                                                        {item.isVirtual && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-500/30 text-blue-400">
                                                                AUTO
                                                            </Badge>
                                                        )}
                                                        {/* If item price is 0 (AYCE), show Badge */}
                                                        {item.price === 0 && item.dish?.is_ayce && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/30 text-amber-500">
                                                                AYCE
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-sm font-bold tabular-nums ${selectedSplitItems.has(item.id) ? 'text-amber-400' : 'text-zinc-400'}`}>
                                                €{item.price.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                    {splitPayableItems.length === 0 && (
                                        <p className="text-center text-zinc-500 text-sm py-12">Nessun elemento da pagare.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {/* Equal Split Mode (Placeholder for visual, currently handled by manually calculating) */}
                    {equalSplitMode && (
                        <div className="h-full flex flex-col p-6 items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mb-2">
                                <Users size={32} className="text-zinc-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Divisione alla Romana</h3>
                            <p className="text-zinc-400 max-w-xs text-sm">
                                Il totale di <strong className="text-white">€{totalAmount.toFixed(2)}</strong> diviso per <strong className="text-white">{Math.max(1, session?.customer_count || 1)} persone</strong> è:
                            </p>
                            <div className="text-4xl font-black text-amber-500 mt-4">
                                €{perPersonAmount.toFixed(2)}
                            </div>
                            <p className="text-xs text-zinc-500 mt-4">Usa la calcolatrice POS per incassare questa cifra da ogni commensale.</p>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="relative p-5 border-t border-white/5 bg-zinc-900/90 backdrop-blur-xl">
                    {isWaiter && !restaurant?.allow_waiter_payments ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center w-full">
                            <p className="text-red-400 font-bold mb-1">Permessi Negati</p>
                            <p className="text-xs text-red-300/70">Solo l'amministratore può segnare i tavoli come pagati.</p>
                        </div>
                    ) : (
                        <>
                            {isSplitMode || equalSplitMode ? (
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="ghost"
                                        className="h-12 px-5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                                        onClick={() => {
                                            setIsSplitMode(false)
                                            setEqualSplitMode(false)
                                            setSelectedSplitItems(new Set())
                                        }}
                                        disabled={processingPayment}
                                    >
                                        ← Indietro
                                    </Button>
                                    {isSplitMode && (
                                        <Button
                                            className="flex-1 h-12 font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-all active:scale-[0.98]"
                                            onClick={handlePaySplit}
                                            disabled={selectedSplitItems.size === 0 || processingPayment}
                                        >
                                            {processingPayment ? 'Attendere...' : `Paga €${splitTotal.toFixed(2)}`}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 w-full">
                                    <Button
                                        className="w-full h-12 font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl shadow-lg shadow-amber-500/15 transition-all active:scale-[0.98]"
                                        onClick={() => onPaymentComplete()}
                                    >
                                        <CheckCircle className="mr-2 h-5 w-5" weight="fill" />
                                        Salda Tutto · €{totalAmount.toFixed(2)}
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            className="flex-1 h-10 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl border border-white/5"
                                            onClick={() => setIsSplitMode(true)}
                                            disabled={totalAmount <= 0}
                                        >
                                            Dividi per Piatti
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="flex-1 h-10 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl border border-white/5"
                                            onClick={() => setEqualSplitMode(true)}
                                            disabled={totalAmount <= 0}
                                        >
                                            Dividi Equo
                                        </Button>
                                    </div>
                                    {onEmptyTable && (
                                        <Button
                                            variant="ghost"
                                            className="w-full h-9 text-xs text-zinc-600 hover:text-red-400 hover:bg-red-500/5 rounded-xl mt-2"
                                            onClick={onEmptyTable}
                                            disabled={totalAmount > 0}
                                        >
                                            <Trash className="mr-1.5 h-3.5 w-3.5" weight="duotone" />
                                            {totalAmount > 0 ? 'Libera Tavolo (prima salda)' : 'Libera Tavolo'}
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
