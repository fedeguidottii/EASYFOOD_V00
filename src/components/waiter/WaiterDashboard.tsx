import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Table, Order, TableSession, Restaurant } from '../../services/types'
import { toast } from 'sonner'
import { SignOut, User, CheckCircle, ArrowsClockwise, Receipt, Trash } from '@phosphor-icons/react'
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

    // Payment Dialog State
    const [selectedTableForPayment, setSelectedTableForPayment] = useState<Table | null>(null)
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)

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

    const getSessionDuration = (openedAt: string) => {
        const start = new Date(openedAt)
        const now = new Date()
        const diff = Math.floor((now.getTime() - start.getTime()) / 60000)
        if (diff < 60) return `${diff} min`
        const hours = Math.floor(diff / 60)
        const mins = diff % 60
        return `${hours}h ${mins}m`
    }

    const getTableStatus = (tableId: string) => {
        const session = sessions.find(s => s.table_id === tableId)
        if (!session) return 'free'
        return 'occupied'
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'free': return 'bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg'
            case 'occupied': return 'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/40 dark:to-slate-900 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/30 dark:ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
            default: return 'bg-slate-100 dark:bg-slate-800'
        }
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
                const status = markAsPaid ? 'PAID' : 'completed' // Or just 'completed' if not paid? User said "Segna come Pagato" -> PAID. "Libera Tavolo" -> maybe just closed?
                // Actually "Libera Tavolo" usually implies payment is handled or skipped. 
                // Let's assume "Segna come Pagato" sets status='PAID'.
                // "Libera Tavolo" just closes session. But what about orders? They should probably be closed too.

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 md:p-5 rounded-2xl shadow-lg border border-white/20 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                        <User size={28} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Gestione Sala</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></span>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Cameriere Online</p>
                        </div>
                    </div>
                </div>
                <Button variant="outline" size="lg" className="font-bold border-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-950/30" onClick={onLogout}>
                    <SignOut size={20} className="mr-2" />
                    Esci
                </Button>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {tables.map(table => {
                    const status = getTableStatus(table.id)
                    const session = sessions.find(s => s.table_id === table.id)
                    const total = session ? getTableTotal(session.id) : 0
                    const duration = session ? getSessionDuration(session.opened_at) : ''

                    return (
                        <Card
                            key={table.id}
                            className={`cursor-pointer transition-all duration-300 border-2 relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${getStatusColor(status)}`}
                            onClick={() => handleTableClick(table)}
                        >
                            <CardContent className="p-0 flex flex-col h-full">
                                {/* Header */}
                                <div className="p-4 flex items-center justify-between border-b border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white whitespace-nowrap">
                                            {table.number}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                                            <User size={14} weight="bold" />
                                            <span className="text-sm font-bold">{table.seats || 4}</span>
                                        </div>
                                    </div>
                                    {status === 'occupied' ? (
                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30">
                                            Attivo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-500 dark:text-slate-400 font-medium border-slate-300 dark:border-slate-600">
                                            Libero
                                        </Badge>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-4 flex flex-col justify-between">
                                    {session ? (
                                        <>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <User size={16} className="text-slate-400" weight="fill" />
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{session.customer_count || 0} coperti</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ArrowsClockwise size={16} className="text-slate-400" />
                                                    <span className="text-slate-500 dark:text-slate-400">{duration}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                                                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                                    €{total.toFixed(2)}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center">
                                            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Clicca per ordinare</p>
                                        </div>
                                    )}
                                </div>

                                {/* Payment Button - Always visible for occupied tables, but only functional if allowed */}
                                {status === 'occupied' && (
                                    <div className="p-3 pt-0 flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-10 font-bold border-2 text-sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleTableClick(table)
                                            }}
                                        >
                                            Ordina
                                        </Button>
                                        {restaurant?.allow_waiter_payments && (
                                            <Button
                                                size="sm"
                                                className="flex-1 h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                                                onClick={(e) => openPaymentDialog(e, table)}
                                            >
                                                <Receipt size={16} className="mr-1" weight="fill" />
                                                Conto
                                            </Button>
                                        )}
                                    </div>
                                )}
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

                    <div className="py-4">
                        <div className="flex justify-between items-center mb-4 p-4 bg-muted/30 rounded-lg border">
                            <span className="text-lg font-medium">Totale da Pagare</span>
                            <span className="text-3xl font-black text-primary">
                                € {selectedTableForPayment && sessions.find(s => s.table_id === selectedTableForPayment.id)
                                    ? getTableTotal(sessions.find(s => s.table_id === selectedTableForPayment.id)!.id).toFixed(2)
                                    : '0.00'}
                            </span>
                        </div>

                        {/* Order Summary could go here if needed */}
                    </div>

                    <DialogFooter className="flex-col gap-3 sm:flex-col">
                        <Button
                            className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleCloseTable(true)}
                        >
                            <CheckCircle className="mr-2 h-5 w-5" weight="fill" />
                            SEGNA COME PAGATO
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-12 text-lg font-bold border-2"
                            onClick={() => handleCloseTable(false)}
                        >
                            <Trash className="mr-2 h-5 w-5" />
                            LIBERA TAVOLO (Senza Pagamento)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default WaiterDashboard
