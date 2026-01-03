import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Table, Order, TableSession, Restaurant, Room } from '../../services/types'
import { toast } from 'sonner'
import { SignOut, User, CheckCircle, ArrowsClockwise, Receipt, Trash, Plus, BellRinging, Clock, Pencil, House, Funnel, GearSix } from '@phosphor-icons/react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { ScrollArea } from '../ui/scroll-area'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface WaiterDashboardProps {
    user: any
    onLogout: () => void
}

const WaiterDashboard = ({ user, onLogout }: WaiterDashboardProps) => {
    const [tables, setTables] = useState<Table[]>([])
    const [rooms, setRooms] = useState<any[]>([])
    const [sessions, setSessions] = useState<TableSession[]>([])
    const [activeOrders, setActiveOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [restaurantId, setRestaurantId] = useState<string | null>(null)
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [activatingTable, setActivatingTable] = useState(false)

    // Sorting State
    const [sortBy, setSortBy] = useState<'alpha' | 'seats' | 'status'>('status')
    const [now, setNow] = useState(new Date())

    // Payment Dialog State
    const [selectedTableForPayment, setSelectedTableForPayment] = useState<Table | null>(null)
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
    const [isReadyDrawerOpen, setIsReadyDrawerOpen] = useState(false)
    const [selectedTable, setSelectedTable] = useState<Table | null>(null)
    const [isTableModalOpen, setIsTableModalOpen] = useState(false)

    // Room Filter State
    const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all')

    // Table/Room Management State
    const [isManageDialogOpen, setIsManageDialogOpen] = useState(false)
    const [isAddTableDialogOpen, setIsAddTableDialogOpen] = useState(false)
    const [isEditTableDialogOpen, setIsEditTableDialogOpen] = useState(false)
    const [tableToEdit, setTableToEdit] = useState<Table | null>(null)
    const [newTableNumber, setNewTableNumber] = useState('')
    const [newTableSeats, setNewTableSeats] = useState('4')
    const [newTableRoomId, setNewTableRoomId] = useState<string>('')

    const [isAddRoomDialogOpen, setIsAddRoomDialogOpen] = useState(false)
    const [isEditRoomDialogOpen, setIsEditRoomDialogOpen] = useState(false)
    const [roomToEdit, setRoomToEdit] = useState<Room | null>(null)
    const [newRoomName, setNewRoomName] = useState('')

    // Quick Order State
    const [isQuickOrderDialogOpen, setIsQuickOrderDialogOpen] = useState(false)
    const [selectedTableForQuickOrder, setSelectedTableForQuickOrder] = useState<Table | null>(null)

    // Ready Items View Mode (like gestione ordini)
    const [readyViewMode, setReadyViewMode] = useState<'table' | 'dish'>('table')

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

                // Fetch rooms
                const rms = await DatabaseService.getRooms(rId)
                setRooms(rms)

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
            return acc + (order.items?.filter(i => i.status?.toLowerCase() === 'ready').length || 0)
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
        o.items?.filter(i => i.status?.toLowerCase() === 'ready').map(i => ({ ...i, tableId: sessions.find(s => s.id === o.table_session_id)?.table_id, order_id: o.id }))
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
        setSelectedTable(table)
        setIsTableModalOpen(true)
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

    // Activate a free table (create session)
    const activateTable = async (table: Table) => {
        if (!restaurantId) return
        setActivatingTable(true)
        try {
            const pin = Math.floor(1000 + Math.random() * 9000).toString()
            const newSession = await DatabaseService.createSession({
                table_id: table.id,
                restaurant_id: restaurantId,
                status: 'OPEN',
                session_pin: pin,
                opened_at: new Date().toISOString(),
                customer_count: table.seats || 2
            })
            setSessions(prev => [...prev, newSession])
            toast.success(`Tavolo ${table.number} attivato! PIN: ${pin}`)
            setIsTableModalOpen(false)
            refreshData()
        } catch (error) {
            console.error('Error activating table:', error)
            toast.error('Errore attivazione tavolo')
        } finally {
            setActivatingTable(false)
        }
    }

    // TABLE MANAGEMENT FUNCTIONS
    const handleAddTable = async () => {
        if (!restaurantId || !newTableNumber.trim()) {
            toast.error('Inserisci un numero/nome per il tavolo')
            return
        }
        try {
            const newTable = await DatabaseService.createTable({
                restaurant_id: restaurantId,
                number: newTableNumber.trim(),
                seats: parseInt(newTableSeats) || 4,
                room_id: newTableRoomId || undefined,
                is_active: true
            })
            setTables(prev => [...prev, newTable])
            setNewTableNumber('')
            setNewTableSeats('4')
            setNewTableRoomId('')
            setIsAddTableDialogOpen(false)
            toast.success(`Tavolo "${newTableNumber}" creato!`)
        } catch (error) {
            console.error('Error creating table:', error)
            toast.error('Errore nella creazione del tavolo')
        }
    }

    const handleEditTable = async () => {
        if (!tableToEdit) return
        try {
            await DatabaseService.updateTable(tableToEdit.id, {
                number: newTableNumber.trim(),
                seats: parseInt(newTableSeats) || 4,
                room_id: newTableRoomId || undefined
            })
            setTables(prev => prev.map(t => t.id === tableToEdit.id ? {
                ...t,
                number: newTableNumber.trim(),
                seats: parseInt(newTableSeats) || 4,
                room_id: newTableRoomId || undefined
            } : t))
            setTableToEdit(null)
            setIsEditTableDialogOpen(false)
            toast.success('Tavolo aggiornato!')
        } catch (error) {
            console.error('Error updating table:', error)
            toast.error('Errore nell\'aggiornamento del tavolo')
        }
    }

    const handleDeleteTable = async (tableId: string) => {
        const session = sessions.find(s => s.table_id === tableId)
        if (session) {
            toast.error('Impossibile eliminare un tavolo con una sessione attiva')
            return
        }
        try {
            await DatabaseService.deleteTable(tableId)
            setTables(prev => prev.filter(t => t.id !== tableId))
            setIsEditTableDialogOpen(false)
            setTableToEdit(null)
            toast.success('Tavolo eliminato!')
        } catch (error) {
            console.error('Error deleting table:', error)
            toast.error('Errore nell\'eliminazione del tavolo')
        }
    }

    const openEditTableDialog = (table: Table) => {
        setTableToEdit(table)
        setNewTableNumber(table.number)
        setNewTableSeats(String(table.seats || 4))
        setNewTableRoomId(table.room_id || '')
        setIsEditTableDialogOpen(true)
    }

    // ROOM MANAGEMENT FUNCTIONS
    const handleAddRoom = async () => {
        if (!restaurantId || !newRoomName.trim()) {
            toast.error('Inserisci un nome per la sala')
            return
        }
        try {
            await DatabaseService.createRoom({
                restaurant_id: restaurantId,
                name: newRoomName.trim(),
                is_active: true,
                order: rooms.length
            })
            const updatedRooms = await DatabaseService.getRooms(restaurantId)
            setRooms(updatedRooms)
            setNewRoomName('')
            setIsAddRoomDialogOpen(false)
            toast.success(`Sala "${newRoomName}" creata!`)
        } catch (error) {
            console.error('Error creating room:', error)
            toast.error('Errore nella creazione della sala')
        }
    }

    const handleEditRoom = async () => {
        if (!roomToEdit || !newRoomName.trim()) return
        try {
            await DatabaseService.updateRoom(roomToEdit.id, {
                name: newRoomName.trim()
            })
            setRooms(prev => prev.map(r => r.id === roomToEdit.id ? { ...r, name: newRoomName.trim() } : r))
            setRoomToEdit(null)
            setIsEditRoomDialogOpen(false)
            toast.success('Sala aggiornata!')
        } catch (error) {
            console.error('Error updating room:', error)
            toast.error('Errore nell\'aggiornamento della sala')
        }
    }

    const handleDeleteRoom = async (roomId: string) => {
        const tablesInRoom = tables.filter(t => t.room_id === roomId)
        if (tablesInRoom.length > 0) {
            toast.error('Impossibile eliminare una sala con tavoli assegnati. Riassegna prima i tavoli.')
            return
        }
        try {
            await DatabaseService.deleteRoom(roomId)
            setRooms(prev => prev.filter(r => r.id !== roomId))
            setIsEditRoomDialogOpen(false)
            setRoomToEdit(null)
            toast.success('Sala eliminata!')
        } catch (error) {
            console.error('Error deleting room:', error)
            toast.error('Errore nell\'eliminazione della sala')
        }
    }

    const openEditRoomDialog = (room: Room) => {
        setRoomToEdit(room)
        setNewRoomName(room.name)
        setIsEditRoomDialogOpen(true)
    }

    // Filtered tables based on room selection
    const filteredTables = selectedRoomFilter === 'all'
        ? tables
        : selectedRoomFilter === 'no-room'
            ? tables.filter(t => !t.room_id)
            : tables.filter(t => t.room_id === selectedRoomFilter)

    if (loading) return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-amber-500">
            <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="font-medium tracking-widest uppercase text-xs">Caricamento...</p>
        </div>
    )

    const sortedTables = sortTables(filteredTables)
    const readyCount = readyItems.length

    // Helper function to render a table card
    const renderTableCard = (table: Table) => {
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
                                {/* PIN Display */}
                                <div className="absolute top-0 right-4 text-xs font-mono text-amber-500/70 bg-black/30 px-2 py-1 rounded-lg border border-amber-500/20">
                                    PIN: {session.session_pin || '----'}
                                </div>

                                {/* Status Steps Visualization */}
                                <div className="flex items-center gap-1 mt-auto">
                                    <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${['seated', 'waiting', 'eating'].includes(statusInfo.step) ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-zinc-800'}`}></div>
                                    <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${['waiting', 'eating'].includes(statusInfo.step) ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-zinc-800'}`}></div>
                                    <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${statusInfo.step === 'eating' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`}></div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="flex-1 h-9 text-xs font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all rounded-xl"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedTableForQuickOrder(table)
                                            setIsQuickOrderDialogOpen(true)
                                        }}
                                    >
                                        <Plus size={14} className="mr-1" />
                                        Ordina
                                    </Button>
                                    {restaurant?.allow_waiter_payments && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 h-9 text-xs font-bold border border-white/10 bg-black/20 hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all rounded-xl"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openPaymentDialog(e, table)
                                            }}
                                        >
                                            <Receipt size={14} className="mr-1" />
                                            Conto
                                        </Button>
                                    )}
                                </div>
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
    }

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

                    {/* Room Filter */}
                    <Select value={selectedRoomFilter} onValueChange={setSelectedRoomFilter}>
                        <SelectTrigger className="w-[140px] h-10 bg-zinc-900/80 border-white/5 text-xs font-bold rounded-xl">
                            <House size={16} className="mr-2 text-amber-500" />
                            <SelectValue placeholder="Sala" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800">
                            <SelectItem value="all">Tutte le Sale</SelectItem>
                            <SelectItem value="no-room">Senza Sala</SelectItem>
                            {rooms.map(room => (
                                <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Management Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 h-10 w-10 p-0 rounded-xl"
                        onClick={() => setIsManageDialogOpen(true)}
                    >
                        <GearSix size={20} weight="duotone" />
                    </Button>

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

            {/* Tables grouped by Room */}
            <div className="relative z-10 space-y-8">
                {(() => {
                    // Group tables by room
                    const tablesByRoom = new Map<string, Table[]>()
                    const noRoomTables: Table[] = []

                    sortedTables.forEach(table => {
                        if (table.room_id) {
                            const existing = tablesByRoom.get(table.room_id) || []
                            existing.push(table)
                            tablesByRoom.set(table.room_id, existing)
                        } else {
                            noRoomTables.push(table)
                        }
                    })

                    // Render each room section
                    const roomSections: React.ReactNode[] = []

                    // Render rooms in order
                    rooms.forEach(room => {
                        const roomTables = tablesByRoom.get(room.id) || []
                        if (roomTables.length > 0) {
                            roomSections.push(
                                <div key={room.id} className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-white">{room.name}</h3>
                                        <div className="flex-1 h-px bg-white/10" />
                                        <span className="text-xs text-zinc-500">{roomTables.length} tavoli</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {roomTables.map(table => renderTableCard(table))}
                                    </div>
                                </div>
                            )
                        }
                    })

                    // No-room tables
                    if (noRoomTables.length > 0) {
                        roomSections.push(
                            <div key="no-room" className="space-y-4">
                                {rooms.length > 0 && (
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-white">Sala Principale</h3>
                                        <div className="flex-1 h-px bg-white/10" />
                                        <span className="text-xs text-zinc-500">{noRoomTables.length} tavoli</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {noRoomTables.map(table => renderTableCard(table))}
                                </div>
                            </div>
                        )
                    }

                    return roomSections
                })()}
            </div>

            {/* Ready Items Drawer - Matching gestione ordini interface */}
            <Dialog open={isReadyDrawerOpen} onOpenChange={setIsReadyDrawerOpen}>
                <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 h-[85vh] flex flex-col p-0 overflow-hidden">
                    {/* Header - Same style as gestione ordini */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 pb-4 gap-4 border-b border-white/10 shrink-0">
                        <div>
                            <h2 className="text-2xl font-light text-white tracking-tight">Piatti <span className="font-bold text-amber-500">Pronti</span></h2>
                            <p className="text-sm text-zinc-400 mt-1 uppercase tracking-wider font-medium">Pronti da servire ai tavoli</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* View Mode Toggle - Same as gestione ordini */}
                            <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/5 shadow-2xl shadow-black/80 backdrop-blur-3xl">
                                <Button
                                    variant={readyViewMode === 'table' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setReadyViewMode('table')}
                                    className={`h-9 px-4 text-xs font-bold rounded-xl transition-all duration-300 ${readyViewMode === 'table' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Tavoli
                                </Button>
                                <Button
                                    variant={readyViewMode === 'dish' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setReadyViewMode('dish')}
                                    className={`h-9 px-4 text-xs font-bold rounded-xl transition-all duration-300 ${readyViewMode === 'dish' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Piatti
                                </Button>
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 p-4">
                        {readyItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
                                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                                    <CheckCircle size={32} weight="duotone" className="opacity-20" />
                                </div>
                                <p>Tutto tranquillo, nessun piatto in attesa</p>
                            </div>
                        ) : readyViewMode === 'table' ? (
                            /* TABLE VIEW - Group by table */
                            <div className="space-y-4">
                                {(() => {
                                    // Group by table
                                    const byTable = new Map<string, typeof readyItems>()
                                    readyItems.forEach(item => {
                                        const tableId = item.tableId || 'unknown'
                                        const existing = byTable.get(tableId) || []
                                        byTable.set(tableId, [...existing, item])
                                    })

                                    return Array.from(byTable.entries()).map(([tableId, items]) => {
                                        const table = tables.find(t => t.id === tableId)
                                        return (
                                            <div key={tableId} className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                                                {/* Table Header */}
                                                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/30">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl font-bold text-white font-serif">{table?.number || '?'}</span>
                                                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                                                            {items.length} piatti pronti
                                                        </Badge>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl"
                                                        onClick={() => items.forEach(item => handleMarkAsServed(item.order_id, item.id))}
                                                    >
                                                        <CheckCircle size={16} className="mr-2" weight="fill" />
                                                        Segna tutti serviti
                                                    </Button>
                                                </div>
                                                {/* Items */}
                                                <div className="p-3 space-y-2">
                                                    {items.map((item, idx) => (
                                                        <div key={item.id + idx} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                                            <div className="flex-1">
                                                                <p className="font-bold text-white">{item.quantity}x {item.dish?.name || 'Piatto'}</p>
                                                                {item.notes && <p className="text-xs text-yellow-500/80 italic mt-1">Note: {item.notes}</p>}
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                className="h-10 w-10 rounded-full bg-amber-500 hover:bg-amber-400 text-black p-0"
                                                                onClick={() => handleMarkAsServed(item.order_id, item.id)}
                                                            >
                                                                <CheckCircle size={20} weight="fill" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        ) : (
                            /* DISH VIEW - Group by dish */
                            <div className="space-y-4">
                                {(() => {
                                    // Group by dish
                                    const byDish = new Map<string, typeof readyItems>()
                                    readyItems.forEach(item => {
                                        const dishName = item.dish?.name || 'Altro'
                                        const existing = byDish.get(dishName) || []
                                        byDish.set(dishName, [...existing, item])
                                    })

                                    return Array.from(byDish.entries()).map(([dishName, items]) => {
                                        const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0)
                                        return (
                                            <div key={dishName} className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                                                {/* Dish Header */}
                                                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/30">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl font-bold text-white">{dishName}</span>
                                                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                                                            {totalQty}x totali
                                                        </Badge>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl"
                                                        onClick={() => items.forEach(item => handleMarkAsServed(item.order_id, item.id))}
                                                    >
                                                        <CheckCircle size={16} className="mr-2" weight="fill" />
                                                        Segna tutti
                                                    </Button>
                                                </div>
                                                {/* Items by table */}
                                                <div className="p-3 space-y-2">
                                                    {items.map((item, idx) => {
                                                        const table = tables.find(t => t.id === item.tableId)
                                                        return (
                                                            <div key={item.id + idx} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                                                <div className="flex-1 flex items-center gap-3">
                                                                    <Badge variant="outline" className="bg-black/40 text-amber-500 border-amber-500/20 px-2 py-1 rounded-lg text-xs">
                                                                        Tavolo {table?.number || '?'}
                                                                    </Badge>
                                                                    <span className="text-white font-medium">{item.quantity}x</span>
                                                                    {item.notes && <span className="text-xs text-yellow-500/80 italic">({item.notes})</span>}
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-10 w-10 rounded-full bg-amber-500 hover:bg-amber-400 text-black p-0"
                                                                    onClick={() => handleMarkAsServed(item.order_id, item.id)}
                                                                >
                                                                    <CheckCircle size={20} weight="fill" />
                                                                </Button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        )}
                    </ScrollArea>

                    <div className="p-4 border-t border-white/5 bg-zinc-900/80 shrink-0">
                        <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-10 font-medium rounded-xl" onClick={() => setIsReadyDrawerOpen(false)}>
                            Chiudi
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-6">
                    <DialogHeader className="pb-4">
                        <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                            <span className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl text-base text-amber-500 font-mono">#{selectedTableForPayment?.number}</span>
                            Gestione Conto
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Gestisci il pagamento e la chiusura del tavolo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 flex flex-col items-center justify-center bg-black/30 rounded-xl border border-white/5 my-4">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Totale da Saldare</span>
                        <span className="text-4xl font-black text-white tracking-tight flex items-start gap-1">
                            <span className="text-xl text-amber-500 mt-1">€</span>
                            {selectedTableForPayment && sessions.find(s => s.table_id === selectedTableForPayment.id)
                                ? getTableTotal(sessions.find(s => s.table_id === selectedTableForPayment.id)!.id).toFixed(2)
                                : '0.00'}
                        </span>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl"
                            onClick={() => handleCloseTable(true)}
                        >
                            <CheckCircle className="mr-2 h-5 w-5" weight="fill" />
                            SEGNA COME PAGATO
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-12 text-sm font-bold bg-transparent border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 rounded-xl"
                            onClick={() => handleCloseTable(false)}
                        >
                            <Trash className="mr-2 h-4 w-4" weight="duotone" />
                            LIBERA (Senza Incasso)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Table Management Modal */}
            <Dialog open={isTableModalOpen} onOpenChange={setIsTableModalOpen}>
                <DialogContent className="sm:max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden max-h-[85vh]">
                    {selectedTable && (() => {
                        const session = sessions.find(s => s.table_id === selectedTable.id)
                        const tableOrders = session
                            ? activeOrders.filter(o => o.table_session_id === session.id && o.status !== 'CANCELLED')
                            : []
                        const tableTotal = session ? getTableTotal(session.id) : 0
                        const statusInfo = getDetailedTableStatus(selectedTable.id)

                        return (
                            <>
                                {/* Header */}
                                <div className="p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-white/5">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                                            <span className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-2xl text-amber-500 font-serif">{selectedTable.number}</span>
                                            <div className="flex flex-col">
                                                <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Gestione Tavolo</span>
                                                <span className={`text-sm font-medium ${statusInfo.step === 'free' ? 'text-zinc-500' :
                                                    statusInfo.step === 'seated' ? 'text-blue-400' :
                                                        statusInfo.step === 'waiting' ? 'text-amber-400' :
                                                            'text-emerald-400'
                                                    }`}>
                                                    {statusInfo.label} {statusInfo.time && `• ${statusInfo.time}`}
                                                </span>
                                            </div>
                                        </DialogTitle>
                                    </DialogHeader>
                                </div>

                                {/* Content */}
                                <ScrollArea className="flex-1 max-h-[50vh]">
                                    <div className="p-4">
                                        {!session ? (
                                            <div className="text-center py-12">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-900 flex items-center justify-center">
                                                    <User size={32} className="text-zinc-700" />
                                                </div>
                                                <p className="text-zinc-500 mb-2">Tavolo libero</p>
                                                <p className="text-xs text-zinc-600">Nessun cliente seduto</p>
                                            </div>
                                        ) : tableOrders.length === 0 ? (
                                            <div className="text-center py-12">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                    <Clock size={32} className="text-blue-500" />
                                                </div>
                                                <p className="text-zinc-400 mb-2">Clienti appena seduti</p>
                                                <p className="text-xs text-zinc-500">In attesa di ordinare</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Ordini attivi</h4>
                                                {tableOrders.map(order => (
                                                    <div key={order.id} className="bg-zinc-900/80 border border-white/5 rounded-xl p-4">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <Badge variant="outline" className={`text-[10px] ${order.status?.toLowerCase() === 'ready' ? 'text-amber-400 border-amber-500/30' :
                                                                order.status === 'served' ? 'text-emerald-400 border-emerald-500/30' :
                                                                    'text-blue-400 border-blue-500/30'
                                                                }`}>
                                                                {order.status?.toLowerCase() === 'ready' ? 'Pronto' :
                                                                    order.status === 'served' ? 'Servito' :
                                                                        order.status === 'preparing' ? 'In Preparazione' : 'In Attesa'}
                                                            </Badge>
                                                            <span className="text-xs text-zinc-500">
                                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {order.items?.map(item => (
                                                                <div key={item.id} className="flex justify-between items-center text-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-amber-500 font-bold">{item.quantity}x</span>
                                                                        <span className={item.status === 'served' ? 'text-zinc-500 line-through' : 'text-white'}>
                                                                            {item.dish?.name || 'Piatto'}
                                                                        </span>
                                                                        {item.status?.toLowerCase() === 'ready' && (
                                                                            <Badge className="bg-amber-500 text-black text-[8px] px-1">PRONTO</Badge>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-zinc-400">€{((item.dish?.price || 0) * item.quantity).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-between">
                                                            <span className="text-xs text-zinc-500">Subtotale</span>
                                                            <span className="text-sm font-bold text-white">€{(order.total_amount || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>

                                {/* Footer */}
                                {session && (
                                    <div className="p-4 border-t border-white/5 bg-zinc-900/50 space-y-3">
                                        <div className="flex justify-between items-center py-3 px-4 bg-black/30 rounded-xl">
                                            <span className="text-sm font-bold text-zinc-400">Totale Tavolo</span>
                                            <span className="text-2xl font-black text-amber-500">€{tableTotal.toFixed(2)}</span>
                                        </div>

                                        {restaurant?.allow_waiter_payments && (
                                            <Button
                                                className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 rounded-xl"
                                                onClick={() => {
                                                    setIsTableModalOpen(false)
                                                    setSelectedTableForPayment(selectedTable)
                                                    setIsPaymentDialogOpen(true)
                                                }}
                                            >
                                                <Receipt size={20} className="mr-2" />
                                                Vai al Conto
                                            </Button>
                                        )}

                                        <Button
                                            variant="outline"
                                            className="w-full h-10 text-sm border-white/10 text-zinc-400 hover:text-white"
                                            onClick={() => setIsTableModalOpen(false)}
                                        >
                                            Chiudi
                                        </Button>
                                    </div>
                                )}

                                {!session && (
                                    <div className="p-4 border-t border-white/5 space-y-3">
                                        <Button
                                            className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 rounded-xl"
                                            onClick={() => activateTable(selectedTable)}
                                            disabled={activatingTable}
                                        >
                                            {activatingTable ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                    Attivazione...
                                                </div>
                                            ) : (
                                                <>
                                                    <Plus size={20} className="mr-2" weight="bold" />
                                                    Attiva Tavolo
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full h-10 border-white/10 text-zinc-400"
                                            onClick={() => setIsTableModalOpen(false)}
                                        >
                                            Chiudi
                                        </Button>
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </DialogContent>
            </Dialog>

            {/* Management Dialog - Main Menu */}
            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="sm:max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden max-h-[85vh] flex flex-col">
                    <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-zinc-900/50 shrink-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-3">
                            <GearSix size={24} className="text-amber-500" />
                            Gestione Tavoli e Sale
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Aggiungi, modifica o elimina tavoli e sale
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-6">
                            {/* Tables Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Tavoli ({tables.length})</h3>
                                    <Button size="sm" onClick={() => { setIsManageDialogOpen(false); setIsAddTableDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-400 text-black font-bold">
                                        <Plus size={16} className="mr-1" /> Aggiungi
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {tables.map(table => {
                                        const room = rooms.find(r => r.id === table.room_id)
                                        const session = sessions.find(s => s.table_id === table.id)
                                        return (
                                            <div key={table.id} className="flex items-center justify-between p-3 bg-zinc-900/80 rounded-xl border border-white/5">
                                                <div>
                                                    <span className="font-bold text-white">{table.number}</span>
                                                    <span className="text-xs text-zinc-500 ml-2">{table.seats} posti</span>
                                                    {room && <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/30 text-amber-400">{room.name}</Badge>}
                                                    {session && <Badge className="ml-2 text-[10px] bg-green-500/20 text-green-400 border-green-500/30">Attivo</Badge>}
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-500" onClick={() => { setIsManageDialogOpen(false); openEditTableDialog(table); }}>
                                                    <Pencil size={16} />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Rooms Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Sale ({rooms.length})</h3>
                                    <Button size="sm" onClick={() => { setIsManageDialogOpen(false); setIsAddRoomDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-400 text-black font-bold">
                                        <Plus size={16} className="mr-1" /> Aggiungi
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {rooms.length === 0 ? (
                                        <p className="text-sm text-zinc-600 text-center py-4">Nessuna sala configurata</p>
                                    ) : rooms.map(room => {
                                        const tablesInRoom = tables.filter(t => t.room_id === room.id).length
                                        return (
                                            <div key={room.id} className="flex items-center justify-between p-3 bg-zinc-900/80 rounded-xl border border-white/5">
                                                <div>
                                                    <span className="font-bold text-white">{room.name}</span>
                                                    <span className="text-xs text-zinc-500 ml-2">{tablesInRoom} tavoli</span>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-500" onClick={() => { setIsManageDialogOpen(false); openEditRoomDialog(room); }}>
                                                    <Pencil size={16} />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-4 border-t border-white/5 shrink-0">
                        <Button variant="outline" className="w-full border-white/10 text-zinc-400" onClick={() => setIsManageDialogOpen(false)}>Chiudi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Table Dialog */}
            <Dialog open={isAddTableDialogOpen} onOpenChange={setIsAddTableDialogOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Nuovo Tavolo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome/Numero Tavolo</Label>
                            <Input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="Es. 1, A1, Terrazza 1" className="bg-black/20 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <Label>Posti</Label>
                            <Input type="number" value={newTableSeats} onChange={(e) => setNewTableSeats(e.target.value)} placeholder="4" className="bg-black/20 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <Label>Sala (opzionale)</Label>
                            <Select value={newTableRoomId} onValueChange={setNewTableRoomId}>
                                <SelectTrigger className="bg-black/20 border-white/10">
                                    <SelectValue placeholder="Nessuna sala" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800">
                                    <SelectItem value="">Nessuna sala</SelectItem>
                                    {rooms.map(room => <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsAddTableDialogOpen(false)} className="border-white/10">Annulla</Button>
                        <Button onClick={handleAddTable} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">Crea Tavolo</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Table Dialog */}
            <Dialog open={isEditTableDialogOpen} onOpenChange={setIsEditTableDialogOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Modifica Tavolo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome/Numero Tavolo</Label>
                            <Input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} className="bg-black/20 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <Label>Posti</Label>
                            <Input type="number" value={newTableSeats} onChange={(e) => setNewTableSeats(e.target.value)} className="bg-black/20 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <Label>Sala</Label>
                            <Select value={newTableRoomId} onValueChange={setNewTableRoomId}>
                                <SelectTrigger className="bg-black/20 border-white/10">
                                    <SelectValue placeholder="Nessuna sala" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800">
                                    <SelectItem value="">Nessuna sala</SelectItem>
                                    {rooms.map(room => <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between gap-2">
                        <Button variant="destructive" onClick={() => tableToEdit && handleDeleteTable(tableToEdit.id)} className="mr-auto">
                            <Trash size={16} className="mr-1" /> Elimina
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditTableDialogOpen(false)} className="border-white/10">Annulla</Button>
                        <Button onClick={handleEditTable} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">Salva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Room Dialog */}
            <Dialog open={isAddRoomDialogOpen} onOpenChange={setIsAddRoomDialogOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Nuova Sala</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Sala</Label>
                            <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Es. Terrazza, Sala Interna" className="bg-black/20 border-white/10" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsAddRoomDialogOpen(false)} className="border-white/10">Annulla</Button>
                        <Button onClick={handleAddRoom} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">Crea Sala</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Room Dialog */}
            <Dialog open={isEditRoomDialogOpen} onOpenChange={setIsEditRoomDialogOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Modifica Sala</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Sala</Label>
                            <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="bg-black/20 border-white/10" />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between gap-2">
                        <Button variant="destructive" onClick={() => roomToEdit && handleDeleteRoom(roomToEdit.id)} className="mr-auto">
                            <Trash size={16} className="mr-1" /> Elimina
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditRoomDialogOpen(false)} className="border-white/10">Annulla</Button>
                        <Button onClick={handleEditRoom} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">Salva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default WaiterDashboard
