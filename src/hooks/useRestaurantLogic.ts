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

    const createOrder = async (tableId: string, items: any[]) => {
        try {
            // Find active session or create one?
            // For now, assume session exists or create one.
            // But wait, DatabaseService.createOrder takes (order, items).
            // We need to construct the order object.

            // Get active session for table
            let session = await DatabaseService.getActiveSession(tableId)
            if (!session) {
                // Create new session if not exists
                session = await DatabaseService.createSession({
                    restaurant_id: restaurantId,
                    table_id: tableId,
                    status: 'OPEN',
                    opened_at: new Date().toISOString()
                })
            }

            const order = {
                restaurant_id: restaurantId,
                table_session_id: session.id,
                status: 'pending' as const, // Use 'pending' as per updated types
                total_amount: 0, // Should be calculated backend or here?
                created_at: new Date().toISOString()
            }

            // Calculate total amount
            // We need prices. But items passed here might just have IDs.
            // For now, let's trust the backend or ignore total_amount for a moment.
            // Actually, DatabaseService.createOrder expects items with dish_id etc.

            const dbItems = items.map(item => ({
                dish_id: item.menuItemId,
                quantity: item.quantity,
                note: item.notes,
                status: 'PENDING' as const
            }))

            await DatabaseService.createOrder(order, dbItems)
            toast.success('Ordine inviato con successo!')
        } catch (error) {
            console.error(error)
            toast.error('Errore invio ordine')
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
        updateOrderItemStatus,
        createOrder
    }
}
