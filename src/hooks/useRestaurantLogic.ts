import { useSupabaseData } from './useSupabaseData'
import { DatabaseService } from '../services/DatabaseService'
import { Order, Table, Dish } from '../services/types'
import { toast } from 'sonner'

export function useRestaurantLogic(restaurantId: string) {
    const [orders] = useSupabaseData<Order>('orders', [], { column: 'restaurant_id', value: restaurantId })
    const [tables] = useSupabaseData<Table>('tables', [], { column: 'restaurant_id', value: restaurantId })
    const [dishes] = useSupabaseData<Dish>('dishes', [], { column: 'restaurant_id', value: restaurantId })

    const updateOrderStatus = async (orderId: string, status: Order['status']) => {
        try {
            await DatabaseService.updateOrder(orderId, { status })
            toast.success(`Ordine aggiornato a ${status}`)
        } catch (error) {
            console.error(error)
            toast.error('Errore aggiornamento ordine')
        }
    }

    const updateOrderItemStatus = async (itemId: string, status: any) => {
        // Implementation for item status update if needed
        console.log('Update item status', itemId, status)
    }

    return {
        orders,
        tables,
        dishes,
        updateOrderStatus,
        updateOrderItemStatus
    }
}
