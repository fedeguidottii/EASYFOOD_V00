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
            case 'free': return 'bg-white hover:bg-gray-50 border-gray-200'
            case 'occupied': return 'bg-green-100 border-green-300'
            default: return 'bg-gray-100'
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
        <div className="min-h-screen bg-gray-100 p-4">
            {/* Header */}
            <header className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                        <User size={24} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">SALA</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-sm font-medium text-muted-foreground">Online</p>
                        </div>
                    </div>
                </div>
                <Button variant="destructive" size="lg" className="font-bold" onClick={onLogout}>
                    <SignOut size={20} className="mr-2" />
                    ESCI
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
                            className={`cursor-pointer transition-all duration-200 shadow-sm hover:shadow-xl border-2 relative overflow-hidden ${getStatusColor(status)} h-48`}
                            onClick={() => handleTableClick(table)}
                        >
                            <CardContent className="p-0 h-full flex flex-col justify-between relative">
                                {/* Table Number */}
                                <div className="absolute top-3 left-4">
                                    <span className="text-5xl font-black text-gray-900 opacity-90">{table.number}</span>
                                </div>

                                {/* Status Indicators */}
                                <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                    {status === 'occupied' && (
                                        <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 text-xs shadow-sm">
                                            OCCUPATO
                                        </Badge>
                                    )}
                                    {status === 'free' && (
                                        <Badge variant="outline" className="bg-white text-gray-500 border-gray-300 font-bold px-2 py-1 text-xs">
                                            LIBERO
                                        </Badge>
                                    )}
                                    {session && (
                                        <div className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-white/50 px-2 py-1 rounded-full mt-1">
                                            <ArrowsClockwise size={14} />
                                            {duration}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Info */}
                                <div className="mt-auto p-4 w-full flex items-end justify-between bg-gradient-to-t from-black/5 to-transparent">
                                    <div className="flex items-center gap-1 text-gray-700 font-bold">
                                        <User size={18} weight="fill" />
                                        <span>{session?.customer_count || '-'}</span>
                                    </div>

                                    {status === 'occupied' && (
                                        <div className="text-2xl font-black text-gray-900">
                                            € {total.toFixed(2)}
                                        </div>
                                    )}
                                </div>

                                {/* Quick Actions - Payment Button */}
                                {status === 'occupied' && restaurant?.allow_waiter_payments && (
                                    <div className="absolute bottom-3 left-3 z-10">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-12 w-12 rounded-full shadow-md bg-white hover:bg-blue-50 text-blue-700 border-2 border-blue-100 hover:border-blue-300 transition-colors"
                                            onClick={(e) => openPaymentDialog(e, table)}
                                            title="Conto / Chiudi Tavolo"
                                        >
                                            <Receipt size={24} weight="fill" />
                                        </Button>
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
