import { useSupabaseData } from './useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { Order, OrderItem, Table, Dish, TableSession } from '../services/types'
import { v4 as uuidv4 } from 'uuid'

export function useRestaurantLogic(restaurantId: string) {
    // Fetch orders with items (handled by DatabaseService.getOrders query)
    const [orders] = useSupabaseData<Order>('orders', [], { column: 'restaurant_id', value: restaurantId })
    const [tables] = useSupabaseData<Table>('tables', [], { column: 'restaurant_id', value: restaurantId })
    const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId })

    const createOrder = async (tableId: string, items: { dishId: string; quantity: number; note?: string }[]) => {
        if (!items.length) return

        // 1. Get or Create Session
        let session = await DatabaseService.getActiveSession(tableId)
        if (!session) {
            session = await DatabaseService.createSession({
                id: uuidv4(),
                restaurant_id: restaurantId,
                table_id: tableId,
                status: 'OPEN',
                opened_at: new Date().toISOString()
            })
        }

        // 2. Calculate Total
        let total = 0
        items.forEach(item => {
            const dish = dishes?.find(d => d.id === item.dishId)
            if (dish) {
                total += dish.price * item.quantity
            }
        })

        // 3. Prepare Order Data
        const orderId = uuidv4()
        const newOrder: Partial<Order> = {
            id: orderId,
            restaurant_id: restaurantId,
            table_session_id: session.id,
            status: 'OPEN',
            total_amount: total,
            created_at: new Date().toISOString()
        }

        // 4. Prepare Order Items
        const newItems: Partial<OrderItem>[] = items.map(item => ({
            id: uuidv4(),
            dish_id: item.dishId,
            quantity: item.quantity,
            note: item.note,
            status: 'PENDING',
            created_at: new Date().toISOString()
        }))

        // 5. Save to DB
        await DatabaseService.createOrder(newOrder, newItems)
    }

    const updateOrderStatus = async (orderId: string, status: Order['status']) => {
        await DatabaseService.updateOrder(orderId, { status })
    }

    const updateOrderItemStatus = async (itemId: string, status: OrderItem['status']) => {
        await DatabaseService.updateOrderItem(itemId, { status })
    }

    return {
        orders,
        tables,
        dishes,
        createOrder,
        updateOrderStatus,
        updateOrderItemStatus
    }
}
