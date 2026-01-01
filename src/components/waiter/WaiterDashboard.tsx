import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Table, Order, TableSession, Restaurant } from '../../services/types'
import { toast } from 'sonner'
import { SignOut, User, CheckCircle, ArrowsClockwise, Receipt, Trash, Plus, BellRinging, Clock } from '@phosphor-icons/react'
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
    const [isReadyDrawerOpen, setIsReadyDrawerOpen] = useState(false)

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
        if (!session) return { step: 'free', label: 'Libero', time: '', color: 'bg-zinc-900/40 border-zinc-800' }

        const sessionOrders = activeOrders.filter(o => o.table_session_id === session.id && o.status !== 'CANCELLED')

        // 1. Seduti (Seated) - No orders yet
        if (sessionOrders.length === 0) {
            const duration = Math.floor((now.getTime() - new Date(session.opened_at).getTime()) / 60000)
            return {
                step: 'seated',
                label: 'Seduti',
                time: `${duration}m`,
                color: 'bg-blue-900/10 border-blue-500/20 ring-1 ring-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]'
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
                color: 'bg-amber-900/10 border-amber-500/30 ring-1 ring-amber-500/20 shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)] animate-pulse-slow'
            }
        }

        // 3. Mangiando (Eating) - All orders served
        const lastServed = sessionOrders.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0]
        const duration = lastServed ? Math.floor((now.getTime() - new Date(lastServed.updated_at || lastServed.created_at).getTime()) / 60000) : 0

        return {
            step: 'eating',
            label: 'Mangiando',
            time: `${duration}m`,
            color: 'bg-emerald-900/10 border-emerald-500/20 ring-1 ring-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]'
        }
    }

    // Sound Logic for "Ready" items
    const prevReadyCountRef = useRef(0)
    useEffect(() => {
        const currentReadyCount = activeOrders.reduce((acc, order) => {
            return acc + (order.items?.filter(i => i.status === 'ready').length || 0)
        }, 0)

        if (currentReadyCount > prevReadyCountRef.current) {
            // Play sound - simple beep using Audio API or similar
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') // Simple bell sound
            audio.play().catch(e => console.log('Audio play failed', e))
            toast.success('Ci sono piatti pronti da servire!', { icon: '🔔' })
        }
        prevReadyCountRef.current = currentReadyCount
    }, [activeOrders])

    const handleMarkAsServed = async (orderId: string, itemId: string) => {
        await supabase
            .from('order_items')
            .update({ status: 'served' })
            .eq('id', itemId)

        // Optimistic update
        setActiveOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                return {
                    ...o,
                    items: o.items?.map(i => i.id === itemId ? { ...i, status: 'served' } : i)
                }
            }
            return o
        }))
        toast.success('Piatto segnato come servito')
    }

    const readyItems = activeOrders.flatMap(o =>
        o.items?.filter(i => i.status === 'ready').map(i => ({ ...i, tableId: sessions.find(s => s.id === o.table_session_id)?.table_id }))
    ).filter(i => i !== undefined) as any[]

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

    if (loading) return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-amber-500">
            <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="font-medium tracking-widest uppercase text-xs">Caricamento...</p>
        </div>
    )

    const sortedTables = sortTables(tables)
    const readyCount = readyItems.length

    return (
        <div className="min-h-screen bg-zinc-950 p-4 md:p-6 pb-24 text-zinc-100 font-sans selection:bg-amber-500/30">
            {/* Background Ambience */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-zinc-950 to-zinc-950 pointer-events-none" />
            <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none brightness-100 contrast-150 mix-blend-overlay"></div>

            {/* Header */}
            <header className="relative z-10 flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-zinc-900/50 backdrop-blur-xl p-4 rounded-3xl border border-white/5 shadow-2xl">
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 ring-1 ring-white/10">
                        <User size={28} weight="duotone" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Gestione Sala</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            <p className="text-sm font-medium text-zinc-400">Sistema Attivo</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {/* Ready Items Button */}
                    <Button
                        variant={readyCount > 0 ? "default" : "outline"}
                        size="sm"
                        className={`md:mr-4 h-10 px-4 rounded-xl font-bold transition-all shadow-lg ${readyCount > 0
                            ? 'bg-amber-500 hover:bg-amber-400 text-black border-transparent animate-pulse shadow-amber-500/20'
                            : 'text-zinc-400 bg-zinc-900/50 border-white/5 hover:bg-zinc-800 hover:text-white'
                            }`}
                        onClick={() => setIsReadyDrawerOpen(true)}
                    >
                        {readyCount > 0 ? (
                            <BellRinging size={20} weight="fill" className="mr-2 animate-bounce" />
                        ) : (
                            <CheckCircle size={20} className="mr-2" />
                        )}
                        Pronti: {readyCount}
                    </Button>

                    <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSortBy('status')}
                            className={`text-xs font-bold h-8 rounded-lg transition-all ${sortBy === 'status' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Stato
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSortBy('alpha')}
                            className={`text-xs font-bold h-8 rounded-lg transition-all ${sortBy === 'alpha' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            A-Z
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSortBy('seats')}
                            className={`text-xs font-bold h-8 rounded-lg transition-all ${sortBy === 'seats' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Posti
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2 hidden md:block"></div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 w-10 p-0 rounded-xl"
                        onClick={onLogout}
                    >
                        <SignOut size={20} weight="duotone" />
                    </Button>
                </div>
            </header>

            {/* Grid */}
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sortedTables.map(table => {
                    const statusInfo = getDetailedTableStatus(table.id)
                    const session = sessions.find(s => s.table_id === table.id)

                    return (
                        <Card
                            key={table.id}
                            className={`
                                group cursor-pointer transition-all duration-500 relative overflow-hidden border
                                ${statusInfo.color}
                                ${statusInfo.step === 'free'
                                    ? 'hover:border-amber-500/30 hover:bg-zinc-900/60 hover:shadow-lg hover:shadow-amber-500/5'
                                    : 'hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/50'}
                            `}
                            onClick={() => handleTableClick(table)}
                        >
                            <CardContent className="p-0 flex flex-col h-full min-h-[160px]">
                                {/* Header */}
                                <div className="p-4 flex items-start justify-between z-10 relative">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-3xl font-bold text-white leading-none tracking-tight font-serif">
                                                {table.number}
                                            </span>
                                            {statusInfo.step !== 'free' && (
                                                <div className="h-2 w-2 rounded-full bg-current opacity-50 animate-pulse"></div>
                                            )}
                                        </div>
                                        <span className="text-xs text-zinc-500 font-medium mt-1 flex items-center gap-1">
                                            <User size={12} weight="fill" />
                                            {table.seats || 4} Posti
                                        </span>
                                    </div>

                                    {/* Status Badge */}
                                    <div className={`
                                        px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm border backdrop-blur-md
                                        ${statusInfo.step === 'free' ? 'text-zinc-500 bg-zinc-900/80 border-white/5' :
                                            statusInfo.step === 'waiting' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                                statusInfo.step === 'seated' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                                                    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                        }
                                    `}>
                                        {statusInfo.step === 'free' ? 'Libero' : (
                                            <div className="flex items-center gap-1">
                                                <Clock size={12} weight="bold" />
                                                {statusInfo.time}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content Logic for Timeline */}
                                <div className="flex-1 px-4 pb-4 flex flex-col justify-end gap-3 z-10 relative">
                                    {session ? (
                                        <>
                                            {/* Status Steps Visualization */}
                                            <div className="flex items-center gap-1 mt-auto">
                                                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${['seated', 'waiting', 'eating'].includes(statusInfo.step) ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-zinc-800'}`}></div>
                                                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${['waiting', 'eating'].includes(statusInfo.step) ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-zinc-800'}`}></div>
                                                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${statusInfo.step === 'eating' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`}></div>
                                            </div>

                                            {/* Action Button - Only visible if occupied */}
                                            {restaurant?.allow_waiter_payments && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="w-full mt-2 h-9 text-xs font-bold border border-white/10 bg-black/20 hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all rounded-xl"
                                                    onClick={(e) => openPaymentDialog(e, table)}
                                                >
                                                    <Receipt size={14} className="mr-2" />
                                                    Conto
                                                </Button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-end justify-end h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="bg-amber-500 text-black p-2 rounded-full shadow-lg shadow-amber-500/20 transform group-hover:scale-110 transition-transform">
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

            {/* Ready Items Drawer */}
            <Dialog open={isReadyDrawerOpen} onOpenChange={setIsReadyDrawerOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 h-[80vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
                                <BellRinging size={24} weight="fill" />
                            </div>
                            <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Pronti da Servire</span>
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Piatti pronti dalla cucina. Segna come serviti.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-4 bg-zinc-950/50">
                        <div className="space-y-3">
                            {readyItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
                                    <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                                        <CheckCircle size={32} weight="duotone" className="opacity-20" />
                                    </div>
                                    <p>Tutto tranquillo, nessun piatto in attesa</p>
                                </div>
                            ) : (
                                readyItems.map((item, idx) => {
                                    const table = tables.find(t => t.id === item.tableId)
                                    return (
                                        <div key={item.id + idx} className="bg-zinc-900/80 border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="bg-black/40 text-amber-500 border-amber-500/20 text-[10px] px-2 py-0.5 rounded-lg">
                                                        Tavolo {table?.number || '?'}
                                                    </Badge>
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="font-bold text-lg text-white font-serif">{item.quantity}x {item.dish?.name || 'Piatto'}</p>
                                                {item.notes && <p className="text-sm text-yellow-500/80 italic mt-0.5">Note: {item.notes}</p>}
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-12 w-12 rounded-full bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 p-0 transition-transform hover:scale-105 active:scale-95"
                                                onClick={() => handleMarkAsServed(item.order_id, item.id)}
                                            >
                                                <CheckCircle size={24} weight="fill" />
                                            </Button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t border-white/5 bg-zinc-900/80 backdrop-blur-xl">
                        <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-12 font-medium" onClick={() => setIsReadyDrawerOpen(false)}>
                            Chiudi
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden">
                    <div className="p-6 pb-2 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-white/5">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl text-lg text-amber-500 font-serif">#{selectedTableForPayment?.number}</span>
                                <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Gestione Conto</span>
                            </DialogTitle>
                            <DialogDescription className="text-zinc-500 mt-2">
                                Gestisci il pagamento e la chiusura del tavolo.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-8 flex flex-col items-center justify-center bg-black/20 rounded-2xl border border-white/5 mb-4 mt-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-amber-500/5 blur-xl"></div>
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 relative z-10">Totale da Saldare</span>
                            <span className="text-5xl font-black text-white tracking-tight flex items-start gap-1 relative z-10">
                                <span className="text-2xl text-amber-500 mt-2">€</span>
                                {selectedTableForPayment && sessions.find(s => s.table_id === selectedTableForPayment.id)
                                    ? getTableTotal(sessions.find(s => s.table_id === selectedTableForPayment.id)!.id).toFixed(2)
                                    : '0.00'}
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-3 p-6 bg-zinc-950">
                        <Button
                            className="w-full h-14 text-lg font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 rounded-xl transition-all hover:scale-[1.02]"
                            onClick={() => handleCloseTable(true)}
                        >
                            <CheckCircle className="mr-2 h-6 w-6" weight="fill" />
                            SEGNA COME PAGATO
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-14 text-base font-bold bg-transparent border-white/5 text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 rounded-xl transition-all"
                            onClick={() => handleCloseTable(false)}
                        >
                            <Trash className="mr-2 h-5 w-5" weight="duotone" />
                            LIBERA (Senza Incasso)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default WaiterDashboard
