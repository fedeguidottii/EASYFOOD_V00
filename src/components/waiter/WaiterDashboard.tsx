import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Table, Order, TableSession, Restaurant } from '../../services/types'
import { toast } from 'sonner'
import { SignOut, User, CheckCircle, ArrowsClockwise, Receipt, Trash, Plus } from '@phosphor-icons/react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { ScrollArea } from '../ui/scroll-area'

interface WaiterDashboardProps {
    user: any
    onLogout: () => void
}

const WaiterDashboard = ({ user, onLogout }: WaiterDashboardProps) => {
    const [tables, setTables] = useState<Table[]>([])
    const [sessions, setSessions] = useState<TableSession[]>([])
    const [activeOrders, setActiveOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [restaurantId, setRestaurantId] = useState<string | null>(null)
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)

    // Sorting State
    const [sortBy, setSortBy] = useState<'alpha' | 'seats' | 'status'>('status')
    const [now, setNow] = useState(new Date())

    // Payment Dialog State
    const [selectedTableForPayment, setSelectedTableForPayment] = useState<Table | null>(null)
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)

    // Timer effect for timeline
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000) // Update every minute
        return () => clearInterval(interval)
    }, [])

    // Fetch initial data
    useEffect(() => {
        const initDashboard = async () => {
            try {
                setLoading(true)
                let rId = user.restaurant_id

                if (!rId) {
                    const { data: staffData } = await supabase
                        .from('restaurant_staff')
                        .select('restaurant_id')
                        .eq('user_id', user.id)
                        .single()
                    rId = staffData?.restaurant_id
                }

                if (!rId) {
                    const { data: restData } = await supabase
                        .from('restaurants')
                        .select('id')
                        .eq('owner_id', user.id)
                        .single()
                    rId = restData?.id
                }

                if (!rId) {
                    toast.error('Nessun ristorante associato a questo utente')
                    return
                }

                setRestaurantId(rId)

                const { data: restMeta } = await supabase
                    .from('restaurants')
                    .select('waiter_mode_enabled, allow_waiter_payments')
                    .eq('id', rId)
                    .single()
                if (restMeta) {
                    setRestaurant(restMeta as Restaurant)
                }

                const tbs = await DatabaseService.getTables(rId)
                setTables(tbs)

                const { data: sess } = await supabase
                    .from('table_sessions')
                    .select('*')
                    .eq('restaurant_id', rId)
                    .eq('status', 'OPEN')
                if (sess) setSessions(sess)

                const { data: ords } = await supabase
                    .from('orders')
                    .select('*, items:order_items(*)')
                    .eq('restaurant_id', rId)
                    .in('status', ['pending', 'preparing', 'ready', 'served', 'CANCELLED'])
                if (ords) setActiveOrders(ords)

            } catch (error) {
                console.error('Error loading waiter dashboard:', error)
                toast.error('Errore caricamento dashboard')
            } finally {
                setLoading(false)
            }
        }

        initDashboard()
    }, [user])

    // Realtime Subscriptions
    useEffect(() => {
        if (!restaurantId) return

        const channel = supabase
            .channel(`waiter-dashboard:${restaurantId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions', filter: `restaurant_id=eq.${restaurantId}` }, () => refreshData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => refreshData())
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [restaurantId])

    const refreshData = async () => {
        if (!restaurantId) return
        const { data: sess } = await supabase.from('table_sessions').select('*').eq('restaurant_id', restaurantId).eq('status', 'OPEN')
        if (sess) setSessions(sess)

        const { data: ords } = await supabase.from('orders').select('*, items:order_items(*)').eq('restaurant_id', restaurantId).in('status', ['pending', 'preparing', 'ready', 'served'])
        if (ords) setActiveOrders(ords)
    }

    const getTableTotal = (sessionId: string) => {
        const sessionOrders = activeOrders.filter(o => o.table_session_id === sessionId && o.status !== 'CANCELLED')
        return sessionOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    }

    const getDetailedTableStatus = (tableId: string): { step: 'seated' | 'waiting' | 'eating' | 'free', label: string, time: string, color: string } => {
        const session = sessions.find(s => s.table_id === tableId)
        if (!session) return { step: 'free', label: 'Libero', time: '', color: 'bg-slate-100 dark:bg-slate-800' }

        const sessionOrders = activeOrders.filter(o => o.table_session_id === session.id && o.status !== 'CANCELLED')

        // 1. Seduti (Seated) - No orders yet
        if (sessionOrders.length === 0) {
            const duration = Math.floor((now.getTime() - new Date(session.opened_at).getTime()) / 60000)
            return {
                step: 'seated',
                label: 'Seduti',
                time: `${duration}m`,
                color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' // Blue for just started
            }
        }

        // 2. Attesa Cibo (Waiting) - Has orders that are NOT fully served
        // Check if ANY order item is NOT 'SERVED' (and not 'cancelled')
        // Actually, simplify: check if there are any orders with status sent/pending/preparing/ready.
        const pendingOrders = sessionOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status))

        if (pendingOrders.length > 0) {
            // Find oldest pending order
            const oldestPending = pendingOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
            const duration = Math.floor((now.getTime() - new Date(oldestPending.created_at).getTime()) / 60000)
            return {
                step: 'waiting',
                label: 'In Attesa',
                time: `${duration}m`,
                color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' // Amber for waiting
            }
        }

        // 3. Mangiando (Eating) - All orders are 'served' (or 'completed' or 'PAID' but session is open)
        // If we get here, sessionOrders.length > 0 AND pendingOrders.length === 0
        // We can use the last served order time as a reference, or just session duration for simplicity?
        // Let's use time since last order was served (updated_at)
        const lastServed = sessionOrders.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
        const duration = lastServed ? Math.floor((now.getTime() - new Date(lastServed.updated_at).getTime()) / 60000) : 0

        return {
            step: 'eating',
            label: 'Mangiando',
            time: `${duration}m`,
            color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' // Emerald for eating
        }
    }

    const sortTables = (tables: Table[]) => {
        return [...tables].sort((a, b) => {
            if (sortBy === 'alpha') return a.number.localeCompare(b.number)
            if (sortBy === 'seats') return (b.seats || 0) - (a.seats || 0)
            if (sortBy === 'status') {
                const statusA = getDetailedTableStatus(a.id).step
                const statusB = getDetailedTableStatus(b.id).step
                const priority = { 'waiting': 3, 'seated': 2, 'eating': 1, 'free': 0 }
                return priority[statusB] - priority[statusA]
            }
            return 0
        })
    }

    const handleTableClick = (table: Table) => {
        window.location.href = `/waiter/table/${table.id}`
    }

    const openPaymentDialog = (e: React.MouseEvent, table: Table) => {
        e.stopPropagation()
        setSelectedTableForPayment(table)
        setIsPaymentDialogOpen(true)
    }

    const handleCloseTable = async (markAsPaid: boolean) => {
        if (!selectedTableForPayment) return

        const session = sessions.find(s => s.table_id === selectedTableForPayment.id)
        if (!session) return

        try {
            // Close session
            await DatabaseService.updateSession({
                ...session,
                status: 'CLOSED',
                closed_at: new Date().toISOString()
            })

            // Update orders if marking as paid
            const sessionOrders = activeOrders.filter(o => o.table_session_id === session.id)
            if (sessionOrders.length > 0) {
                await supabase
                    .from('orders')
                    .update({ status: markAsPaid ? 'PAID' : 'completed' })
                    .in('id', sessionOrders.map(o => o.id))
            }

            await DatabaseService.clearCart(session.id)

            setSessions(prev => prev.filter(s => s.id !== session.id))
            setActiveOrders(prev => prev.filter(o => o.table_session_id !== session.id))

            toast.success(markAsPaid ? 'Tavolo pagato e liberato' : 'Tavolo liberato')
            setIsPaymentDialogOpen(false)
            refreshData()
        } catch (error) {
            console.error('Error closing table:', error)
            toast.error('Errore durante la chiusura del tavolo')
        }
    }

    if (loading) return <div className="flex items-center justify-center h-screen text-2xl font-bold text-muted-foreground">Caricamento...</div>

    const sortedTables = sortTables(tables)

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 pb-24">
            {/* Header */}
            <header className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md">
                        <User size={24} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Sala</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Online</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <Button
                        variant={sortBy === 'status' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSortBy('status')}
                        className="text-xs font-bold"
                    >
                        Per Stato
                    </Button>
                    <Button
                        variant={sortBy === 'alpha' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSortBy('alpha')}
                        className="text-xs font-bold"
                    >
                        A-Z
                    </Button>
                    <Button
                        variant={sortBy === 'seats' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSortBy('seats')}
                        className="text-xs font-bold"
                    >
                        Posti
                    </Button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onLogout}>
                        <SignOut size={18} />
                    </Button>
                </div>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {sortedTables.map(table => {
                    const statusInfo = getDetailedTableStatus(table.id)
                    const session = sessions.find(s => s.table_id === table.id)

                    return (
                        <Card
                            key={table.id}
                            className={`cursor-pointer transition-all duration-200 border relative overflow-hidden active:scale-[0.98] ${statusInfo.color} ${statusInfo.step === 'free' ? 'opacity-70 hover:opacity-100 border-dashed' : 'border-solid shadow-sm'}`}
                            onClick={() => handleTableClick(table)}
                        >
                            <CardContent className="p-0 flex flex-col h-full min-h-[140px]">
                                {/* Header */}
                                <div className="p-3 flex items-start justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xl font-black text-slate-800 dark:text-white leading-none">
                                            {table.number}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium mt-1">
                                            {table.seats || 4} Posti
                                        </span>
                                    </div>

                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusInfo.step === 'free' ? 'text-slate-400 bg-slate-100 dark:bg-slate-800' :
                                        statusInfo.step === 'waiting' ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/40 animate-pulse' :
                                            statusInfo.step === 'seated' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' :
                                                'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40'
                                        }`}>
                                        {statusInfo.step === 'free' ? 'Libero' : statusInfo.time}
                                    </div>
                                </div>

                                {/* Content Logic for Timeline */}
                                <div className="flex-1 px-3 pb-3 flex flex-col justify-end gap-2">
                                    {session ? (
                                        <>
                                            {/* Status Steps */}
                                            <div className="flex items-center gap-1 mt-auto">
                                                <div className={`h-1.5 flex-1 rounded-full ${['seated', 'waiting', 'eating'].includes(statusInfo.step) ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                <div className={`h-1.5 flex-1 rounded-full ${['waiting', 'eating'].includes(statusInfo.step) ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                <div className={`h-1.5 flex-1 rounded-full ${statusInfo.step === 'eating' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                                                <span className={statusInfo.step === 'seated' ? 'text-blue-600' : ''}>Seduti</span>
                                                <span className={statusInfo.step === 'waiting' ? 'text-amber-600' : ''}>Attesa</span>
                                                <span className={statusInfo.step === 'eating' ? 'text-emerald-600' : ''}>Mangia</span>
                                            </div>

                                            {/* Action Button - Only visible if occupied */}
                                            {restaurant?.allow_waiter_payments && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="w-full mt-2 h-8 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white/50 hover:bg-white"
                                                    onClick={(e) => openPaymentDialog(e, table)}
                                                >
                                                    <Receipt size={14} className="mr-1.5" />
                                                    Conto
                                                </Button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-400">
                                            <Plus size={24} weight="bold" />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">
                            {selectedTableForPayment?.number} - Conto
                        </DialogTitle>
                        <DialogDescription>
                            Gestisci il pagamento e la chiusura del tavolo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">Totale da Saldare</span>
                        <span className="text-4xl font-black text-slate-900 dark:text-white mt-1">
                            € {selectedTableForPayment && sessions.find(s => s.table_id === selectedTableForPayment.id)
                                ? getTableTotal(sessions.find(s => s.table_id === selectedTableForPayment.id)!.id).toFixed(2)
                                : '0.00'}
                        </span>
                    </div>

                    <DialogFooter className="flex-col gap-3 sm:flex-col">
                        <Button
                            className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                            onClick={() => handleCloseTable(true)}
                        >
                            <CheckCircle className="mr-2 h-6 w-6" weight="fill" />
                            SEGNA COME PAGATO
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-12 text-base font-bold text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50"
                            onClick={() => handleCloseTable(false)}
                        >
                            <Trash className="mr-2 h-5 w-5" />
                            LIBERA (Senza Incasso)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default WaiterDashboard
