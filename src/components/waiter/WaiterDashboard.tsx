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

                // FIX: Added 'OPEN' to the status list so new orders are counted!
                const { data: ords } = await supabase
                    .from('orders')
                    .select('*, items:order_items(*)')
                    .eq('restaurant_id', rId)
                    .in('status', ['OPEN', 'pending', 'preparing', 'ready', 'served', 'CANCELLED'])
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

        // FIX: Added 'OPEN' here too
        const { data: ords } = await supabase.from('orders').select('*, items:order_items(*)').eq('restaurant_id', restaurantId).in('status', ['OPEN', 'pending', 'preparing', 'ready', 'served'])
        if (ords) setActiveOrders(ords)
    }

    const getTableTotal = (sessionId: string) => {
        const sessionOrders = activeOrders.filter(o => o.table_session_id === sessionId && o.status !== 'CANCELLED')
        return sessionOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    }

    const getDetailedTableStatus = (tableId: string): { step: 'seated' | 'waiting' | 'eating' | 'free', label: string, time: string, color: string } => {
        const session = sessions.find(s => s.table_id === tableId)
        if (!session) return { step: 'free', label: 'Libero', time: '', color: 'bg-slate-900/40 border-slate-800' }

        const sessionOrders = activeOrders.filter(o => o.table_session_id === session.id && o.status !== 'CANCELLED')

        // 1. Seduti (Seated) - No orders yet
        if (sessionOrders.length === 0) {
            const duration = Math.floor((now.getTime() - new Date(session.opened_at).getTime()) / 60000)
            return {
                step: 'seated',
                label: 'Seduti',
                time: `${duration}m`,
                color: 'bg-blue-900/20 border-blue-800 ring-1 ring-blue-500/20'
            }
        }

        // 2. Attesa Cibo (Waiting) - Has orders that are NOT fully served
        const pendingOrders = sessionOrders.filter(o => ['OPEN', 'pending', 'preparing', 'ready'].includes(o.status))

        if (pendingOrders.length > 0) {
            const oldestPending = pendingOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
            const duration = Math.floor((now.getTime() - new Date(oldestPending.created_at).getTime()) / 60000)
            return {
                step: 'waiting',
                label: 'In Attesa',
                time: `${duration}m`,
                color: 'bg-amber-900/20 border-amber-800 ring-1 ring-amber-500/20 animate-pulse-slow'
            }
        }

        // 3. Mangiando (Eating) - All orders served
        const lastServed = sessionOrders.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
        const duration = lastServed ? Math.floor((now.getTime() - new Date(lastServed.updated_at).getTime()) / 60000) : 0

        return {
            step: 'eating',
            label: 'Mangiando',
            time: `${duration}m`,
            color: 'bg-emerald-900/20 border-emerald-800 ring-1 ring-emerald-500/20'
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
        <div className="min-h-screen bg-slate-950 p-4 md:p-6 pb-24 text-white">
            {/* Header */}
            <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-slate-900/50 backdrop-blur-xl p-4 rounded-3xl border border-slate-800/50 shadow-2xl">
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-500/10">
                        <User size={28} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Gestione Sala</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <p className="text-sm font-medium text-slate-400">Sistema Attivo</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <Button
                        variant={sortBy === 'status' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSortBy('status')}
                        className={`text-xs font-bold h-9 rounded-xl ${sortBy === 'status' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        Stato
                    </Button>
                    <Button
                        variant={sortBy === 'alpha' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSortBy('alpha')}
                        className={`text-xs font-bold h-9 rounded-xl ${sortBy === 'alpha' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        A-Z
                    </Button>
                    <Button
                        variant={sortBy === 'seats' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSortBy('seats')}
                        className={`text-xs font-bold h-9 rounded-xl ${sortBy === 'seats' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        Posti
                    </Button>

                    <div className="h-6 w-px bg-slate-800 mx-2"></div>

                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 px-3 rounded-xl" onClick={onLogout}>
                        <SignOut size={18} />
                    </Button>
                </div>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sortedTables.map(table => {
                    const statusInfo = getDetailedTableStatus(table.id)
                    const session = sessions.find(s => s.table_id === table.id)

                    return (
                        <Card
                            key={table.id}
                            className={`
                                group cursor-pointer transition-all duration-300 relative overflow-hidden border
                                ${statusInfo.color}
                                ${statusInfo.step === 'free'
                                    ? 'hover:border-slate-700 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-emerald-500/5'
                                    : 'shadow-xl shadow-black/20 hover:scale-[1.02]'}
                            `}
                            onClick={() => handleTableClick(table)}
                        >
                            <CardContent className="p-0 flex flex-col h-full min-h-[160px]">
                                {/* Header */}
                                <div className="p-4 flex items-start justify-between z-10 relative">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-bold text-white leading-none tracking-tight">
                                                {table.number}
                                            </span>
                                            {statusInfo.step !== 'free' && (
                                                <div className="h-2 w-2 rounded-full bg-current opacity-50 animate-pulse"></div>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-1">
                                            <User size={12} weight="bold" />
                                            {table.seats || 4} Posti
                                        </span>
                                    </div>

                                    <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm border ${statusInfo.step === 'free' ? 'text-slate-500 bg-slate-800 border-slate-700' :
                                            statusInfo.step === 'waiting' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                                statusInfo.step === 'seated' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                                                    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                        }`}>
                                        {statusInfo.step === 'free' ? 'Libero' : statusInfo.time}
                                    </div>
                                </div>

                                {/* Content Logic for Timeline */}
                                <div className="flex-1 px-4 pb-4 flex flex-col justify-end gap-3 z-10 relative">
                                    {session ? (
                                        <>
                                            {/* Status Steps */}
                                            <div className="flex items-center gap-1.5 mt-auto">
                                                <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${['seated', 'waiting', 'eating'].includes(statusInfo.step) ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-slate-800'}`}></div>
                                                <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${['waiting', 'eating'].includes(statusInfo.step) ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-slate-800'}`}></div>
                                                <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${statusInfo.step === 'eating' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-800'}`}></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                                <span className={`transition-colors duration-300 ${statusInfo.step === 'seated' ? 'text-blue-400' : ''}`}>Seduti</span>
                                                <span className={`transition-colors duration-300 ${statusInfo.step === 'waiting' ? 'text-amber-400' : ''}`}>Attesa</span>
                                                <span className={`transition-colors duration-300 ${statusInfo.step === 'eating' ? 'text-emerald-400' : ''}`}>Mangia</span>
                                            </div>

                                            {/* Action Button - Only visible if occupied */}
                                            {restaurant?.allow_waiter_payments && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="w-full mt-2 h-9 text-xs font-bold border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-all"
                                                    onClick={(e) => openPaymentDialog(e, table)}
                                                >
                                                    <Receipt size={14} className="mr-2" />
                                                    Conto
                                                </Button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-end justify-end h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="bg-slate-800 p-2 rounded-full text-emerald-500 shadow-lg">
                                                <Plus size={20} weight="bold" />
                                            </div>
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
                <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="bg-slate-800 px-3 py-1 rounded-lg text-lg text-slate-300">#{selectedTableForPayment?.number}</span>
                            Gestione Conto
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Gestisci il pagamento e la chiusura del tavolo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-8 flex flex-col items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-800 mb-2 mt-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Totale da Saldare</span>
                        <span className="text-5xl font-black text-white tracking-tight flex items-start gap-1">
                            <span className="text-2xl text-emerald-500 mt-1">€</span>
                            {selectedTableForPayment && sessions.find(s => s.table_id === selectedTableForPayment.id)
                                ? getTableTotal(sessions.find(s => s.table_id === selectedTableForPayment.id)!.id).toFixed(2)
                                : '0.00'}
                        </span>
                    </div>

                    <DialogFooter className="flex-col gap-3 sm:flex-col mt-4">
                        <Button
                            className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 rounded-xl"
                            onClick={() => handleCloseTable(true)}
                        >
                            <CheckCircle className="mr-2 h-6 w-6" weight="fill" />
                            SEGNA COME PAGATO
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-14 text-base font-bold bg-transparent border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 rounded-xl transition-all"
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
