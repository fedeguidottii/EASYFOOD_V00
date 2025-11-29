import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DatabaseService } from '../services/DatabaseService'
import { TableSession, CartItem, Order, Dish, Category, Restaurant } from '../services/types'
import { toast } from 'sonner'

export function useCustomerSession(tableId: string) {
    const [session, setSession] = useState<TableSession | null>(null)
    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [dishes, setDishes] = useState<Dish[]>([])
    const [loading, setLoading] = useState(true)

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

                // 2. Get Restaurant Info (via table -> restaurant)
                // We need to fetch the table first to get restaurant_id
                const { data: tableData } = await supabase.from('tables').select('restaurant_id').eq('id', tableId).single()
                if (tableData) {
                    const { data: restData } = await supabase.from('restaurants').select('*').eq('id', tableData.restaurant_id).single()
                    if (restData) {
                        setRestaurant({
                            ...restData,
                            isActive: restData.is_active,
                            allYouCanEat: restData.all_you_can_eat,
                            coverChargePerPerson: restData.cover_charge_per_person
                        })
                        localStorage.setItem('customer_restaurant_id', restData.id)
                    }

                    // 3. Get Menu (Categories & Dishes)
                    if (tableData.restaurant_id) {
                        const cats = await DatabaseService.getCategories(tableData.restaurant_id)
                        setCategories(cats)
                        const dshs = await DatabaseService.getDishes(tableData.restaurant_id)
                        setDishes(dshs)
                    }
                }

                // 4. Get Cart Items
                const cart = await DatabaseService.getCartItems(activeSession.id)
                setCartItems(cart)

                // 5. Get Past Orders
                const sessionOrders = await DatabaseService.getSessionOrders(activeSession.id)
                setOrders(sessionOrders)

            } catch (error) {
                console.error('Error initializing customer session:', error)
                toast.error('Errore durante il caricamento del menu')
            } finally {
                setLoading(false)
            }
        }

        initSession()
    }, [tableId])

    // Realtime Subscriptions
    useEffect(() => {
        if (!session) return

        // Cart Subscription
        const cartSub = supabase
            .channel(`cart:${session.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `session_id=eq.${session.id}` }, async () => {
                const updatedCart = await DatabaseService.getCartItems(session.id)
                setCartItems(updatedCart)
            })
            .subscribe()

        // Orders Subscription
        const ordersSub = supabase
            .channel(`orders:${session.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_session_id=eq.${session.id}` }, async () => {
                const updatedOrders = await DatabaseService.getSessionOrders(session.id)
                setOrders(updatedOrders)
            })
            .subscribe()

        // Order Items Subscription (to update status of items in orders)
        const orderItemsSub = supabase
            .channel(`order_items:${session.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, async (payload) => {
                // We can't easily filter by session_id here as order_items doesn't have it.
                // But we can just refresh orders if we suspect it's for us, or just refresh periodically.
                // For now, let's just refresh orders if the order_id matches one of ours.
                // This might be expensive if many users. A better way is to rely on the orders fetch which includes items.
                // Actually, if an item status changes, the order itself might not change, so we do need to listen to items.
                // Let's just refresh all orders for simplicity.
                const updatedOrders = await DatabaseService.getSessionOrders(session.id)
                setOrders(updatedOrders)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(cartSub)
            supabase.removeChannel(ordersSub)
            supabase.removeChannel(orderItemsSub)
        }
    }, [session])

    // Cart Actions
    const addToCart = async (dish: Dish, quantity: number, notes?: string) => {
        if (!session) return
        try {
            await DatabaseService.addToCart({
                session_id: session.id,
                dish_id: dish.id,
                quantity,
                notes
            })
            toast.success('Aggiunto al carrello')
        } catch (error) {
            console.error('Add to cart error:', error)
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
