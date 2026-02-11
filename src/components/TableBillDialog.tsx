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
        }
    }, [isOpen])

    const [isSplitMode, setIsSplitMode] = useState(false)
    const [selectedSplitItems, setSelectedSplitItems] = useState<Set<string>>(new Set())
    const [processingPayment, setProcessingPayment] = useState(false)
    const [equalSplitMode, setEqualSplitMode] = useState(false)

    // Calculate Virtual Items (Coperto)
    const virtualItems = useMemo(() => {
        const items: any[] = []
        const copertoPrice = restaurant?.cover_charge_per_person || restaurant?.coverChargePerPerson || 0
        if (session && copertoPrice > 0) {
            for (let i = 0; i < (session.customer_count || 0); i++) {
                items.push({
                    id: `coperto-${session.id}-${i}`,
                    name: 'Coperto',
                    price: copertoPrice,
                    quantity: 1,
                    status: 'SERVED',
                    isVirtual: true
                })
            }
        }
        return items
    }, [session, restaurant])

    // Combine Real Orders + Virtual Items
    const splitPayableItems = useMemo(() => {
        let allItems: any[] = []
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach((item: any) => {
                    // Include items that are not explicitly cancelled
                    if (item.status !== 'CANCELLED') {
                        allItems.push({
                            ...item,
                            // Ensure price is available at item level
                            price: item.dish?.price || item.price || 0,
                            name: item.dish?.name || item.name || 'Piatto',
                            originalOrder: order
                        })
                    }
                })
            }
        })
        return [...allItems, ...virtualItems]
    }, [orders, virtualItems])

    // Group real items by order for display
    const orderGroups = useMemo(() => {
        const groups: { order: Order; items: any[] }[] = []
        orders.forEach(order => {
            const orderItems = (order.items || [])
                .filter((item: any) => item.status !== 'CANCELLED')
                .map((item: any) => ({
                    ...item,
                    price: item.dish?.price || item.price || 0,
                    name: item.dish?.name || item.name || 'Piatto',
                }))
            if (orderItems.length > 0) {
                groups.push({ order, items: orderItems })
            }
        })
        return groups
    }, [orders])

    // Calculate Totals
    const totalAmount = useMemo(() => {
        return splitPayableItems.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0)
    }, [splitPayableItems])

    const foodTotal = useMemo(() => {
        return splitPayableItems
            .filter(i => !i.isVirtual)
            .reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0)
    }, [splitPayableItems])

    const copertoTotal = useMemo(() => {
        return virtualItems.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0)
    }, [virtualItems])

    const splitTotal = useMemo(() => {
        let total = 0
        splitPayableItems.forEach(item => {
            if (selectedSplitItems.has(item.id)) {
                total += ((item.price || 0) * (item.quantity || 1))
            }
        })
        return total
    }, [splitPayableItems, selectedSplitItems])

    // Handle Split Payment
    const handlePaySplit = async () => {
        if (selectedSplitItems.size === 0) return
        setProcessingPayment(true)
        try {
            if (selectedSplitItems.size === splitPayableItems.length) {
                onPaymentComplete()
            } else {
                toast.success('Pagamento parziale registrato')
                setIsSplitMode(false)
                setSelectedSplitItems(new Set())
            }
        } catch (error) {
            console.error(error)
            toast.error('Errore durante il pagamento')
        } finally {
            setProcessingPayment(false)
        }
    }
    const [manualPeopleCount, setManualPeopleCount] = useState<string>('')

    const peopleCount = useMemo(() => {
        if (manualPeopleCount) return parseInt(manualPeopleCount) || 1
        return session?.customer_count || 1
    }, [session, manualPeopleCount])

    const perPersonAmount = useMemo(() => {
        return totalAmount / Math.max(1, peopleCount)
    }, [totalAmount, peopleCount])

    // Time since session opened
    const sessionDuration = useMemo(() => {
        if (!session?.opened_at) return null
        const opened = new Date(session.opened_at)
        const now = new Date()
        const diffMs = now.getTime() - opened.getTime()
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        if (hours > 0) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }, [session, isOpen])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-hidden bg-zinc-950 border-zinc-800/50 text-zinc-100 p-0 rounded-3xl shadow-2xl shadow-black/50">
                {/* Glow effects */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-zinc-900/80 to-transparent">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-white flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
                                <Receipt size={24} weight="duotone" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white">Conto Tavolo</span>
                                <span className="text-lg font-bold text-amber-500">#{table?.number}</span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 mt-2 flex items-center gap-4 flex-wrap">
                            <span>
                                {isSplitMode ? 'Seleziona i piatti da pagare separatamente.' :
                                    equalSplitMode ? 'Dividi il conto equamente tra i commensali.' :
                                        'Riepilogo completo degli ordini del tavolo.'}
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Session info chips */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {session?.customer_count && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 rounded-full text-[11px] text-zinc-400 font-medium">
                                <Users size={12} weight="bold" />
                                {session.customer_count} persone
                            </div>
                        )}
                        {sessionDuration && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 rounded-full text-[11px] text-zinc-400 font-medium">
                                <Clock size={12} weight="bold" />
                                {sessionDuration}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 rounded-full text-[11px] text-zinc-400 font-medium">
                            <ForkKnife size={12} weight="bold" />
                            {splitPayableItems.filter(i => !i.isVirtual).length} piatti
                        </div>
                    </div>
                </div>

                <div className="relative p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-220px)]">
                    {/* Total Display */}
                    <div className="relative py-6 px-6 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none" />

                        <span className="relative text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">
                            {isSplitMode ? 'Totale Selezionato' : equalSplitMode ? 'Quota a Persona' : 'Totale da Saldare'}
                        </span>
                        <div className="relative flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-amber-500">€</span>
                            <span className="text-5xl font-black text-white tracking-tight tabular-nums">
                                {isSplitMode ? splitTotal.toFixed(2) : equalSplitMode ? perPersonAmount.toFixed(2) : totalAmount.toFixed(2)}
                            </span>
                        </div>
                        {equalSplitMode && (
                            <span className="relative text-xs text-zinc-500 mt-2">
                                Totale €{totalAmount.toFixed(2)} ÷ {peopleCount} = €{perPersonAmount.toFixed(2)}/persona
                            </span>
                        )}
                        {/* Subtotal breakdown */}
                        {!isSplitMode && !equalSplitMode && (foodTotal > 0 || copertoTotal > 0) && (
                            <div className="relative flex items-center gap-4 mt-3">
                                {foodTotal > 0 && (
                                    <span className="text-[11px] text-zinc-500">
                                        <ForkKnife size={10} weight="bold" className="inline mr-1" />
                                        Piatti €{foodTotal.toFixed(2)}
                                    </span>
                                )}
                                {copertoTotal > 0 && (
                                    <span className="text-[11px] text-blue-400/70">
                                        <Sparkle size={10} weight="fill" className="inline mr-1" />
                                        Coperto €{copertoTotal.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Items List - Main View (grouped by order) */}
                    {!isSplitMode && !equalSplitMode && (
                        <div className="space-y-4">
                            {/* Orders grouped by time */}
                            {orderGroups.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                            <ForkKnife size={14} weight="duotone" />
                                            Dettaglio Ordini
                                        </h3>
                                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                                            {orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        {orderGroups.map((group, gIdx) => (
                                            <div key={group.order.id || gIdx} className="rounded-2xl border border-white/5 bg-zinc-900/30 overflow-hidden">
                                                {/* Order header with timestamp */}
                                                <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/30 border-b border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={12} className="text-zinc-600" />
                                                        <span className="text-[10px] text-zinc-500 font-medium">
                                                            {group.order.created_at
                                                                ? new Date(group.order.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                                                                : 'N/D'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-zinc-600 font-medium">
                                                        €{group.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                {/* Items */}
                                                <div className="divide-y divide-white/5">
                                                    {group.items.map((item, idx) => (
                                                        <div key={item.id || idx} className="flex justify-between items-center py-2.5 px-4 hover:bg-white/[0.02] transition-colors">
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                {item.quantity > 1 && (
                                                                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-bold flex items-center justify-center">
                                                                        {item.quantity}
                                                                    </span>
                                                                )}
                                                                <span className="text-sm font-medium text-zinc-200 truncate">
                                                                    {item.name}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-bold text-zinc-300 tabular-nums flex-shrink-0 ml-4">
                                                                €{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Coperto section (separate) */}
                            {virtualItems.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-blue-400/60 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkle size={14} weight="fill" />
                                        Coperto
                                    </h3>
                                    <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 overflow-hidden">
                                        <div className="flex justify-between items-center py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold flex items-center justify-center">
                                                    {virtualItems.length}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-zinc-200">Coperto</span>
                                                    <span className="text-[10px] text-blue-400/60">€{(virtualItems[0]?.price || 0).toFixed(2)} × {virtualItems.length} persone</span>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-blue-300 tabular-nums">
                                                €{copertoTotal.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty state */}
                            {splitPayableItems.length === 0 && (
                                <div className="py-12 flex flex-col items-center justify-center text-zinc-600 rounded-2xl border border-white/5 bg-zinc-900/30">
                                    <ForkKnife size={40} className="mb-3 opacity-30" />
                                    <p className="text-sm">Nessun ordine da saldare</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Equal Split Controls */}
                    {equalSplitMode && (
                        <div className="space-y-4">
                            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-4">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Numero di Persone</label>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-xl border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                                        onClick={() => setManualPeopleCount(Math.max(1, peopleCount - 1).toString())}
                                    >
                                        <Minus size={20} weight="bold" />
                                    </Button>
                                    <div className="flex-1 h-14 flex items-center justify-center bg-black/50 rounded-xl border border-zinc-700 font-mono text-3xl font-bold text-white">
                                        {peopleCount}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-xl border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                                        onClick={() => setManualPeopleCount((peopleCount + 1).toString())}
                                    >
                                        <Plus size={20} weight="bold" />
                                    </Button>
                                </div>
                            </div>

                            {/* Per-person breakdown */}
                            <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-400 font-medium">Totale conto</span>
                                    <span className="text-sm font-bold text-zinc-300 tabular-nums">€{totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-zinc-400 font-medium">Diviso per</span>
                                    <span className="text-sm font-bold text-zinc-300">{peopleCount} persone</span>
                                </div>
                                <div className="border-t border-amber-500/20 mt-3 pt-3 flex items-center justify-between">
                                    <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">A persona</span>
                                    <span className="text-lg font-black text-amber-400 tabular-nums">€{perPersonAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Split List */}
                    {isSplitMode && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Seleziona voci</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-amber-500 hover:text-amber-400 h-7"
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

                            <ScrollArea className="max-h-[40vh]">
                                <div className="space-y-2 pr-2">
                                    {splitPayableItems.map((item, idx) => (
                                        <div
                                            key={item.id || `idx-${idx}`}
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
                                                        {item.quantity > 1 && (
                                                            <Badge className="text-[9px] h-4 px-1.5 bg-zinc-800 text-zinc-400">
                                                                x{item.quantity}
                                                            </Badge>
                                                        )}
                                                        {item.isVirtual && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-500/30 text-blue-400">
                                                                COPERTO
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-sm font-bold tabular-nums ${selectedSplitItems.has(item.id) ? 'text-amber-400' : 'text-zinc-400'}`}>
                                                €{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                    {splitPayableItems.length === 0 && (
                                        <p className="text-center text-zinc-500 text-sm py-8">Nessun elemento da pagare.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="relative p-6 pt-4 border-t border-white/5 bg-gradient-to-t from-zinc-900/80 to-transparent">
                    {isWaiter && !restaurant?.allow_waiter_payments ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                            <p className="text-red-400 font-bold mb-1">Permessi Negati</p>
                            <p className="text-xs text-red-300/70">Solo l'amministratore può segnare i tavoli come pagati.</p>
                        </div>
                    ) : (
                        <>
                            {isSplitMode || equalSplitMode ? (
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-14 rounded-2xl border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                        onClick={() => {
                                            setIsSplitMode(false)
                                            setEqualSplitMode(false)
                                            setSelectedSplitItems(new Set())
                                        }}
                                        disabled={processingPayment}
                                    >
                                        Indietro
                                    </Button>
                                    {isSplitMode && (
                                        <Button
                                            className="flex-[2] h-14 text-base font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-2xl shadow-lg shadow-amber-500/20"
                                            onClick={handlePaySplit}
                                            disabled={selectedSplitItems.size === 0 || processingPayment}
                                        >
                                            {processingPayment ? 'Attendere...' : `Paga €${splitTotal.toFixed(2)}`}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Button
                                        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98]"
                                        onClick={() => onPaymentComplete()}
                                    >
                                        <CheckCircle className="mr-2 h-6 w-6" weight="fill" />
                                        Salda Tutto · €{totalAmount.toFixed(2)}
                                    </Button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="secondary"
                                            className="h-12 text-sm font-bold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-xl border border-white/5 transition-all active:scale-[0.98]"
                                            onClick={() => setIsSplitMode(true)}
                                        >
                                            Dividi per Piatti
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="h-12 text-sm font-bold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-xl border border-white/5 transition-all active:scale-[0.98]"
                                            onClick={() => setEqualSplitMode(true)}
                                        >
                                            Dividi Equo
                                        </Button>
                                    </div>
                                    {onEmptyTable && (
                                        <Button
                                            variant="ghost"
                                            className="w-full h-11 text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl mt-2 transition-all"
                                            onClick={onEmptyTable}
                                            disabled={totalAmount > 0}
                                        >
                                            <Trash className="mr-2 h-4 w-4" weight="duotone" />
                                            {totalAmount > 0 ? 'Libera Tavolo (prima salda il conto)' : 'Libera Tavolo'}
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
