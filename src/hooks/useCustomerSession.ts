import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { DatabaseService } from '../services/DatabaseService'
import { TableSession, CartItem, Order, Dish, Category, Restaurant } from '../services/types'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useCustomerSession(tableId: string) {
    const [session, setSession] = useState<TableSession | null>(null)
    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [dishes, setDishes] = useState<Dish[]>([])
    const [loading, setLoading] = useState(true)

    // Ref per tracciare tutti i channel attivi e i debounce timer
    const channelsRef = useRef<RealtimeChannel[]>([])
    const cartDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const ordersDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const orderItemsDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    // Fetch initial data
    useEffect(() => {
        if (!tableId) return

        localStorage.setItem('customer_table_id', tableId)

        const initSession = async () => {
            try {
                setLoading(true)
                // 1. Get Active Session
                const activeSession = await DatabaseService.getActiveSession(tableId)
                if (!activeSession) {
                    setLoading(false)
                    return
                }
                setSession(activeSession)

                // 2. Get table info for restaurant_id
                const { data: tableData } = await supabase.from('tables').select('restaurant_id').eq('id', tableId).single()
                if (tableData && tableData.restaurant_id) {
                    // Parallel fetch: restaurant, categories, dishes, cart, orders (Issue #12)
                    const [restResult, cats, dshs, cart, sessionOrders] = await Promise.all([
                        supabase.from('restaurants').select('*').eq('id', tableData.restaurant_id).single(),
                        DatabaseService.getCategories(tableData.restaurant_id),
                        DatabaseService.getDishes(tableData.restaurant_id),
                        DatabaseService.getCartItems(activeSession.id),
                        DatabaseService.getSessionOrders(activeSession.id)
                    ])
                    if (restResult.data) {
                        setRestaurant({
                            ...restResult.data,
                            isActive: restResult.data.is_active,
                            allYouCanEat: restResult.data.all_you_can_eat,
                            coverChargePerPerson: restResult.data.cover_charge_per_person
                        })
                        localStorage.setItem('customer_restaurant_id', restResult.data.id)
                    }
                    setCategories(cats)
                    setDishes(dshs)
                    setCartItems(cart)
                    setOrders(sessionOrders)
                }

            } catch (error) {
                console.error('Error initializing customer session:', error)
                toast.error('Errore durante il caricamento del menu')
            } finally {
                setLoading(false)
            }
        }

        initSession()
    }, [tableId])

    // Listen for Session Changes (New Session or Closed Session)
    useEffect(() => {
        if (!tableId) return

        const sessionSub = supabase
            .channel(`table_sessions:${tableId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'table_sessions',
                filter: `table_id=eq.${tableId}`
            }, async (payload) => {
                // If a new session is created or current one updated
                console.log('Session update:', payload)

                // Reload session data
                const activeSession = await DatabaseService.getActiveSession(tableId)
                setSession(activeSession)

                if (activeSession) {
                    // Reload cart and orders for the new/updated session
                    const cart = await DatabaseService.getCartItems(activeSession.id)
                    setCartItems(cart)
                    const sessionOrders = await DatabaseService.getSessionOrders(activeSession.id)
                    setOrders(sessionOrders)
                } else {
                    // No active session (e.g. closed), clear data
                    setSession(null)
                    setCartItems([])
                    setOrders([])
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(sessionSub)
        }
    }, [tableId])

    // Realtime Subscriptions — dipendenza su session.id (non sull'oggetto) per evitare re-subscribe inutili
    useEffect(() => {
        // Pulire sempre i channel precedenti prima di crearne di nuovi
        channelsRef.current.forEach(ch => supabase.removeChannel(ch))
        channelsRef.current = []
        if (cartDebounceRef.current) clearTimeout(cartDebounceRef.current)
        if (ordersDebounceRef.current) clearTimeout(ordersDebounceRef.current)
        if (orderItemsDebounceRef.current) clearTimeout(orderItemsDebounceRef.current)

        if (!session) return

        const sessionId = session.id

        // Cart Subscription — con debounce per evitare refetch multipli in rapida successione
        const cartSub = supabase
            .channel(`cart:${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'cart_items',
                filter: `session_id=eq.${sessionId}`
            }, () => {
                if (cartDebounceRef.current) clearTimeout(cartDebounceRef.current)
                cartDebounceRef.current = setTimeout(async () => {
                    const updatedCart = await DatabaseService.getCartItems(sessionId)
                    setCartItems(updatedCart)
                }, 300)
            })
            .subscribe()

        // Orders Subscription — con debounce
        const ordersSub = supabase
            .channel(`orders:${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `table_session_id=eq.${sessionId}`
            }, () => {
                if (ordersDebounceRef.current) clearTimeout(ordersDebounceRef.current)
                ordersDebounceRef.current = setTimeout(async () => {
                    const updatedOrders = await DatabaseService.getSessionOrders(sessionId)
                    setOrders(updatedOrders)
                }, 300)
            })
            .subscribe()

        // Order Items Subscription — filtro per order_id della sessione, debounce 500ms
        // Nota: il filtro `order_id=in.(...)` non è supportato direttamente da Supabase realtime,
        // quindi filtriamo lato server su restaurant_id e poi rifetchiamo solo la sessione
        const orderItemsSub = supabase
            .channel(`order_items:${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, () => {
                if (orderItemsDebounceRef.current) clearTimeout(orderItemsDebounceRef.current)
                orderItemsDebounceRef.current = setTimeout(async () => {
                    const updatedOrders = await DatabaseService.getSessionOrders(sessionId)
                    setOrders(updatedOrders)
                }, 500)
            })
            .subscribe()

        channelsRef.current = [cartSub, ordersSub, orderItemsSub]

        return () => {
            if (cartDebounceRef.current) clearTimeout(cartDebounceRef.current)
            if (ordersDebounceRef.current) clearTimeout(ordersDebounceRef.current)
            if (orderItemsDebounceRef.current) clearTimeout(orderItemsDebounceRef.current)
            channelsRef.current.forEach(ch => supabase.removeChannel(ch))
            channelsRef.current = []
        }
    }, [session?.id]) // dipendenza su .id, non sull'oggetto intero

    // Cart Actions — con optimistic update per risposta UI immediata
    const addToCart = async (dish: Dish, quantity: number, notes?: string) => {
        if (!session) return

        // Optimistic update: aggiorna UI prima della risposta DB
        const tempId = `temp_${Date.now()}`
        const optimisticItem: CartItem = {
            id: tempId,
            session_id: session.id,
            dish_id: dish.id,
            dish,
            quantity,
            notes,
            course_number: 1,
            created_at: new Date().toISOString()
        }
        setCartItems(prev => {
            // Controlla se esiste già (merge)
            const existingIdx = prev.findIndex(i => i.dish_id === dish.id && i.notes === notes && i.course_number === 1)
            if (existingIdx >= 0) {
                const updated = [...prev]
                updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity }
                return updated
            }
            return [...prev, optimisticItem]
        })

        try {
            await DatabaseService.addToCart({
                session_id: session.id,
                dish_id: dish.id,
                quantity,
                notes
            })
            toast.success('Aggiunto al carrello')
            // Il realtime aggiornerà il carrello con i dati reali dal DB
        } catch (error) {
            console.error('Add to cart error:', error)
            // Revert optimistic update
            setCartItems(prev => prev.filter(i => i.id !== tempId).map(i =>
                i.dish_id === dish.id && i.notes === notes
                    ? { ...i, quantity: Math.max(1, i.quantity - quantity) }
                    : i
            ))
            toast.error('Errore durante l\'aggiunta al carrello')
        }
    }

    const removeFromCart = async (itemId: string) => {
        try {
            await DatabaseService.removeFromCart(itemId)
        } catch (error) {
            console.error('Remove from cart error:', error)
            toast.error('Errore durante la rimozione')
        }
    }

    const updateCartItem = async (itemId: string, quantity: number) => {
        try {
            await DatabaseService.updateCartItem(itemId, { quantity })
        } catch (error) {
            console.error('Update cart error:', error)
        }
    }

    const placeOrder = async () => {
        if (!session) {
            toast.error('Sessione del tavolo non trovata, aggiorna il QR e riprova')
            return
        }
        if (!restaurant) {
            toast.error('Ristorante non disponibile, riprova tra pochi secondi')
            return
        }
        if (cartItems.length === 0) return

        try {
            const totalAmount = cartItems.reduce((sum, item) => {
                const dish = dishes.find(d => d.id === item.dish_id)
                return sum + (dish?.price || 0) * item.quantity
            }, 0)

            const orderItems = cartItems.map(item => ({
                dish_id: item.dish_id,
                quantity: item.quantity,
                note: item.notes,
                status: 'PENDING' as const
            }))

            await DatabaseService.createOrder({
                restaurant_id: restaurant.id,
                table_session_id: session.id,
                status: 'OPEN',
                total_amount: totalAmount
            }, orderItems)

            // Clear cart after successful order
            await DatabaseService.clearCart(session.id)
            setCartItems([])

            toast.success('Ordine inviato in cucina!', {
                style: {
                    background: '#22c55e', // Green-500
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.1rem'
                },
                duration: 3000
            })
        } catch (error) {
            console.error('Place order error:', error)
            const message = (error as any)?.message || 'Errore durante l\'invio dell\'ordine'
            toast.error(message)
        }
    }

    const cancelOrderItem = async (orderId: string, itemId: string) => {
        try {
            await supabase
                .from('order_items')
                .update({ status: 'CANCELLED' })
                .eq('id', itemId)

            toast.success('Piatto annullato')
            // Refresh orders
            if (session) {
                const updatedOrders = await DatabaseService.getSessionOrders(session.id)
                setOrders(updatedOrders)
            }
        } catch (error) {
            console.error('Error cancelling item:', error)
            toast.error('Errore durante l\'annullamento')
        }
    }

    const cancelOrder = async (orderId: string) => {
        try {
            await supabase
                .from('orders')
                .update({ status: 'CANCELLED' })
                .eq('id', orderId)

            toast.success('Ordine annullato')
            // Refresh orders
            if (session) {
                const updatedOrders = await DatabaseService.getSessionOrders(session.id)
                setOrders(updatedOrders)
            }
        } catch (error) {
            console.error('Error cancelling order:', error)
            toast.error('Errore durante l\'annullamento')
        }
    }

    return {
        session,
        restaurant,
        categories,
        dishes,
        cartItems,
        orders,
        loading,
        addToCart,
        removeFromCart,
        updateCartItem,
        placeOrder,
        cancelOrderItem,
        cancelOrder
    }
}
