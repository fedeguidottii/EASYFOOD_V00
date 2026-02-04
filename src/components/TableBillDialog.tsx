import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Receipt, Trash, Circle, Check, Plus, Minus } from '@phosphor-icons/react'
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
    // 4. Reset Split Mode when dialog opens
    useEffect(() => {
        if (isOpen) {
            setIsSplitMode(false)
            setEqualSplitMode(false)
            setSelectedSplitItems(new Set())
        }
    }, [isOpen])

    const [equalSplitMode, setEqualSplitMode] = useState(false)
    const [manualPeopleCount, setManualPeopleCount] = useState<string>('')

    const peopleCount = useMemo(() => {
        if (manualPeopleCount) return parseInt(manualPeopleCount) || 1
        return session?.customer_count || 1
    }, [session, manualPeopleCount])

    const perPersonAmount = useMemo(() => {
        return totalAmount / Math.max(1, peopleCount)
    }, [totalAmount, peopleCount])

    // ... Render ...
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100 p-6">
                <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                        <span className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl text-base text-amber-500 font-mono">#{table?.number}</span>
                        Gestione Conto
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        {isSplitMode ? 'Seleziona i piatti e i coperti da pagare.' :
                            equalSplitMode ? 'Calcola la quota per persona.' :
                                'Riepilogo ordini e gestione pagamento.'}
                    </DialogDescription>
                </DialogHeader>

                {/* Total Display */}
                <div className="py-6 flex flex-col items-center justify-center bg-black/30 rounded-xl border border-white/5 my-4">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        {isSplitMode ? 'Totale Selezionato' : equalSplitMode ? 'Quota a Persona' : 'Totale da Saldare'}
                    </span>
                    <span className="text-4xl font-black text-white tracking-tight flex items-start gap-1">
                        <span className="text-xl text-amber-500 mt-1">€</span>
                        {isSplitMode ? splitTotal.toFixed(2) : equalSplitMode ? perPersonAmount.toFixed(2) : totalAmount.toFixed(2)}
                    </span>
                    {equalSplitMode && (
                        <span className="text-xs text-zinc-500 mt-2">
                            Totale Conto: €{totalAmount.toFixed(2)} diviso {peopleCount} persone
                        </span>
                    )}
                    {!isSplitMode && !equalSplitMode && virtualItems.length > 0 && (
                        <span className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500/50"></span>
                            Include {virtualItems.length} coperti/extra non ancora saldati
                        </span>
                    )}
                </div>

                {/* Main View Order Summary */}
                {!isSplitMode && !equalSplitMode && (
                    <ScrollArea className="flex-1 max-h-[30vh] mb-4 pr-2 border rounded-lg border-white/5 bg-zinc-900/50 p-2">
                        <div className="space-y-1">
                            {splitPayableItems.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-center py-2 px-2 border-b border-white/5 last:border-0">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-zinc-300">
                                            {item.dish?.name} {item.quantity > 1 && `x${item.quantity}`}
                                        </span>
                                        {item.isVirtual && <span className="text-[9px] text-blue-400">AUTO</span>}
                                    </div>
                                    <span className="text-sm font-mono text-zinc-400">€{((item.dish?.price || 0) * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                            {splitPayableItems.length === 0 && <p className="text-center text-zinc-500 py-4 text-xs">Nessun ordine da saldare</p>}
                        </div>
                    </ScrollArea>
                )}

                {/* Equal Split Controls */}
                {equalSplitMode && (
                    <div className="mb-6 space-y-4">
                        <div className="flex flex-col gap-2 bg-zinc-900 p-4 rounded-xl border border-white/5">
                            <label className="text-xs font-medium text-zinc-400">Numero di Persone</label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 border-zinc-700 bg-zinc-800"
                                    onClick={() => setManualPeopleCount(Math.max(1, peopleCount - 1).toString())}
                                >
                                    <Minus size={16} />
                                </Button>
                                <div className="flex-1 text-center bg-black/50 h-10 flex items-center justify-center rounded-md border border-zinc-700 font-mono text-lg">
                                    {peopleCount}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 border-zinc-700 bg-zinc-800"
                                    onClick={() => setManualPeopleCount((peopleCount + 1).toString())}
                                >
                                    <Plus size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Split List */}
                {isSplitMode && (
                    <ScrollArea className="flex-1 max-h-[40vh] mb-4 pr-2">
                        <div className="space-y-2">
                            {splitPayableItems.map((item, idx) => (
                                <div
                                    key={item.id || `idx-${idx}`}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedSplitItems.has(item.id)
                                        ? 'bg-amber-500/10 border-amber-500/50'
                                        : 'bg-zinc-900 border-white/5 hover:bg-zinc-800'
                                        }`}
                                    onClick={() => {
                                        const newSet = new Set(selectedSplitItems)
                                        if (newSet.has(item.id)) newSet.delete(item.id)
                                        else newSet.add(item.id)
                                        setSelectedSplitItems(newSet)
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedSplitItems.has(item.id) ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`}>
                                            {selectedSplitItems.has(item.id) && <Check size={14} weight="bold" className="text-black" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-zinc-200">{item.dish?.name}</span>
                                                {item.isVirtual && (
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-blue-500/30 text-blue-400">
                                                        AUTO
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-zinc-500">€{(item.dish?.price || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-amber-500">€{((item.dish?.price || 0) * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                            {splitPayableItems.length === 0 && (
                                <p className="text-center text-zinc-500 text-sm py-8">Nessun elemento da pagare.</p>
                            )}
                        </div>
                    </ScrollArea>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-2">
                    {isWaiter && !restaurant?.allow_waiter_payments ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                            <p className="text-red-400 font-bold mb-1">Permessi Negati</p>
                            <p className="text-xs text-red-300/70">Solo l'amministratore può segnare i tavoli come pagati.</p>
                        </div>
                    ) : (
                        <>
                            {isSplitMode || equalSplitMode ? (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-12 rounded-xl"
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
                                            className="flex-[2] h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl"
                                            onClick={handlePaySplit}
                                            disabled={selectedSplitItems.size === 0 || processingPayment}
                                        >
                                            {processingPayment ? 'Attendere...' : 'Paga Selezionati'}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            className="w-full h-14 text-base font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl"
                                            onClick={() => onPaymentComplete()}
                                        >
                                            <CheckCircle className="mr-2 h-5 w-5" weight="fill" />
                                            SALDA TUTTO (€{totalAmount.toFixed(2)})
                                        </Button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="secondary"
                                                className="h-12 text-sm font-bold bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
                                                onClick={() => setIsSplitMode(true)}
                                            >
                                                DIVIDI (Seleziona)
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                className="h-12 text-sm font-bold bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
                                                onClick={() => setEqualSplitMode(true)}
                                            >
                                                DIVIDI (Equo)
                                            </Button>
                                        </div>
                                    </div>
                                    {onEmptyTable && (
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 text-sm font-bold bg-transparent border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 rounded-xl mt-2"
                                            onClick={onEmptyTable}
                                            disabled={totalAmount > 0}
                                        >
                                            <Trash className="mr-2 h-4 w-4" weight="duotone" />
                                            LIBERA TAVOLO {totalAmount > 0 ? '(Saldo Pendente)' : ''}
                                        </Button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
