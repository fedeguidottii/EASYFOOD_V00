import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Table, Order, TableSession } from '../../services/types'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { SignOut, ArrowsClockwise, User, ForkKnife, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'

interface WaiterDashboardProps {
    user: any
    onLogout: () => void
}

const WaiterDashboard = ({ user, onLogout }: WaiterDashboardProps) => {
    const navigate = useNavigate()
    const [tables, setTables] = useState<Table[]>([])
    const [sessions, setSessions] = useState<TableSession[]>([])
    const [activeOrders, setActiveOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [restaurantId, setRestaurantId] = useState<string | null>(null)

    // Fetch initial data
    useEffect(() => {
        const initDashboard = async () => {
            try {
                setLoading(true)
                // Assuming user is staff, find their restaurant
                // For now, we might need a way to get restaurant_id from user metadata or a staff table query
                // If we don't have it easily, we might need to ask the user to select or fetch from 'restaurant_staff'

                // Fallback: fetch the first restaurant owned by this user if they are owner too, 
                // or query restaurant_staff.

                // Let's try to get restaurant_id from a direct query if possible
                const { data: staffData } = await supabase
                    .from('restaurant_staff')
                    .select('restaurant_id')
                    .eq('user_id', user.id)
                    .single()

                let rId = staffData?.restaurant_id

                if (!rId) {
                    // Fallback for Owner testing as Waiter
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

                // Fetch Tables
                const tbs = await DatabaseService.getTables(rId)
                setTables(tbs)

                // Fetch Active Sessions
                // We need a method for this, or just query directly
                const { data: sess } = await supabase
                    .from('table_sessions')
                    .select('*')
                    .eq('restaurant_id', rId)
                    .eq('status', 'OPEN')

                if (sess) setSessions(sess)

                // Fetch Active Orders
                // We want orders that are not completed/paid/cancelled
                const { data: ords } = await supabase
                    .from('orders')
                    .select('*, items:order_items(*)')
                    .eq('restaurant_id', rId)
                    .in('status', ['pending', 'preparing', 'ready', 'served']) // Filter active statuses

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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions', filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
                // Refresh sessions
                refreshData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
                // Refresh orders
                refreshData()
            })
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

    const getTableStatus = (tableId: string) => {
        const session = sessions.find(s => s.table_id === tableId)
        if (!session) return 'free'

        const orders = activeOrders.filter(o => o.table_session_id === session.id)
        if (orders.length > 0) return 'occupied'

        return 'occupied-no-orders' // Session open but no active orders (maybe just seated)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'free': return 'bg-white border-gray-200 hover:border-primary/50'
            case 'occupied': return 'bg-green-50 border-green-500 text-green-700'
            case 'occupied-no-orders': return 'bg-blue-50 border-blue-300 text-blue-700'
            default: return 'bg-gray-100'
        }
    }

    const handleTableClick = (table: Table) => {
        // Navigate to order taking mode
        navigate(`/waiter/table/${table.id}`)
    }

    const handleMarkAsPaid = async (e: React.MouseEvent, tableId: string) => {
        e.stopPropagation()
        const session = sessions.find(s => s.table_id === tableId)
        if (!session) return

        if (confirm('Confermi che il tavolo ha pagato e vuoi liberarlo?')) {
            try {
                // Close session
                await DatabaseService.updateSession({ ...session, status: 'CLOSED', closed_at: new Date().toISOString() })

                // Mark all active orders as PAID
                const sessionOrders = activeOrders.filter(o => o.table_session_id === session.id)
                if (sessionOrders.length > 0) {
                    // We need a way to update multiple orders or loop
                    // DatabaseService might not have updateOrder status exposed easily for batch
                    // We can use supabase directly
                    await supabase
                        .from('orders')
                        .update({ status: 'PAID' }) // Use uppercase if DB expects it, or lowercase. Types say 'PAID' is valid.
                        .in('id', sessionOrders.map(o => o.id))
                }

                toast.success('Tavolo liberato e ordini pagati')
                refreshData()
            } catch (error) {
                console.error('Error closing table:', error)
                toast.error('Errore durante la chiusura del tavolo')
            }
        }
    }

    if (loading) return <div className="flex items-center justify-center h-screen">Caricamento...</div>

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm border border-border/40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User size={20} weight="duotone" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Cameriere</h1>
                        <p className="text-xs text-muted-foreground">Dashboard Tavoli</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onLogout}>
                    <SignOut size={20} />
                </Button>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {tables.map(table => {
                    const status = getTableStatus(table.id)
                    const session = sessions.find(s => s.table_id === table.id)

                    return (
                        <Card
                            key={table.id}
                            className={`cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md border-2 ${getStatusColor(status)}`}
                            onClick={() => handleTableClick(table)}
                        >
                            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[150px] relative">
                                <div className="text-3xl font-bold mb-2">{table.number}</div>

                                {status === 'free' && (
                                    <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-full">Libero</span>
                                )}

                                {status === 'occupied' && (
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                            Occupato
                                        </Badge>
                                        <span className="text-xs font-medium mt-1">{session?.customer_count || '?'} Persone</span>
                                    </div>
                                )}

                                {status === 'occupied-no-orders' && (
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                            In Attesa
                                        </Badge>
                                    </div>
                                )}

                                {/* Quick Actions for Occupied Tables */}
                                {(status === 'occupied' || status === 'occupied-no-orders') && (
                                    <div className="absolute top-2 right-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 bg-white/80 hover:bg-white text-green-600 hover:text-green-700 shadow-sm rounded-full"
                                            onClick={(e) => handleMarkAsPaid(e, table.id)}
                                            title="Segna come pagato / Libera"
                                        >
                                            <CheckCircle size={18} weight="fill" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}

export default WaiterDashboard
