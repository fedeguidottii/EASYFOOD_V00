import { supabase } from '../lib/supabase'
import { User, Restaurant, Category, Dish, Table, TableSession, Order, OrderItem, Booking } from './types'

export const DatabaseService = {
    // Users
    async getUsers() {
        const { data, error } = await supabase.from('users').select('*')
        if (error) throw error
        return data as User[]
    },

    async createUser(user: Partial<User>) {
        const { error } = await supabase.from('users').insert(user)
        if (error) throw error
    },

    // Restaurants
    async getRestaurants() {
        const { data, error } = await supabase.from('restaurants').select('*')
        if (error) throw error
        return data.map((r: any) => ({
            ...r,
            isActive: r.is_active // Mappa is_active (DB) a isActive (Frontend)
        })) as Restaurant[]
    },

    async createRestaurant(restaurant: Partial<Restaurant>) {
        const payload: any = { ...restaurant }
        
        // Gestione corretta is_active
        if (restaurant.isActive !== undefined) {
            payload.is_active = restaurant.isActive
        }
        
        // Rimuovi campi frontend-only
        delete payload.isActive
        delete payload.hours
        delete payload.coverChargePerPerson
        delete payload.allYouCanEat

        const { error } = await supabase.from('restaurants').insert(payload)
        if (error) throw error
    },

    async updateRestaurant(restaurant: Partial<Restaurant>) {
        const payload: any = {}
        
        // Campi permessi per l'aggiornamento
        const allowedFields = ['name', 'address', 'phone', 'email', 'logo_url', 'owner_id']

        // Copia solo i campi presenti nell'oggetto input
        allowedFields.forEach(field => {
            if (field in restaurant) {
                payload[field] = (restaurant as any)[field]
            }
        })

        // Gestione esplicita di isActive -> is_active
        // Questo ha la priorità assoluta per evitare conflitti
        if (restaurant.isActive !== undefined) {
            payload.is_active = restaurant.isActive
        }

        const { error } = await supabase
            .from('restaurants')
            .update(payload)
            .eq('id', restaurant.id)
        
        if (error) throw error
    },

    async deleteRestaurant(restaurantId: string) {
        // 1. Elimina dipendenze complesse (Order Items)
        // Prima recuperiamo gli ID degli ordini del ristorante
        const { data: orders } = await supabase
            .from('orders')
            .select('id')
            .eq('restaurant_id', restaurantId)
        
        if (orders && orders.length > 0) {
            const orderIds = orders.map(o => o.id)
            // Elimina items collegati a questi ordini
            await supabase.from('order_items').delete().in('order_id', orderIds)
        }

        // 2. Elimina Tabelle dipendenti direttamente da restaurant_id
        await supabase.from('orders').delete().eq('restaurant_id', restaurantId)
        await supabase.from('table_sessions').delete().eq('restaurant_id', restaurantId)
        await supabase.from('bookings').delete().eq('restaurant_id', restaurantId)
        await supabase.from('dishes').delete().eq('restaurant_id', restaurantId)
        await supabase.from('categories').delete().eq('restaurant_id', restaurantId)
        await supabase.from('tables').delete().eq('restaurant_id', restaurantId)

        // 3. Infine elimina il ristorante
        const { error } = await supabase
            .from('restaurants')
            .delete()
            .eq('id', restaurantId)
            
        if (error) throw error
    },

    async updateUser(user: Partial<User>) {
        const { error } = await supabase
            .from('users')
            .update(user)
            .eq('id', user.id)
        if (error) throw error
    },

    async deleteUser(userId: string) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)
        if (error) throw error
    },

    // Storage
    async uploadLogo(file: File) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('logos')
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath)

        return data.publicUrl
    },

    // Categories
    async getCategories(restaurantId: string) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('order', { ascending: true })
        if (error) throw error
        return data as Category[]
    },

    async createCategory(category: Partial<Category>) {
        const { error } = await supabase.from('categories').insert(category)
        if (error) throw error
    },

    // Dishes
    async getDishes(restaurantId: string) {
        const { data, error } = await supabase
            .from('dishes')
            .select('*')
            .eq('restaurant_id', restaurantId)
        if (error) throw error
        return data as Dish[]
    },

    async createDish(dish: Partial<Dish>) {
        const { error } = await supabase.from('dishes').insert(dish)
        if (error) throw error
    },

    // Tables
    async getTables(restaurantId: string) {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('restaurant_id', restaurantId)
        if (error) throw error
        return data as Table[]
    },

    async createTable(table: Partial<Table>) {
        const { error } = await supabase.from('tables').insert(table)
        if (error) throw error
    },

    // Sessions
    async getActiveSession(tableId: string) {
        const { data, error } = await supabase
            .from('table_sessions')
            .select('*')
            .eq('table_id', tableId)
            .eq('status', 'OPEN')
            .single()

        if (error && error.code !== 'PGRST116') throw error
        return data as TableSession | null
    },

    async createSession(session: Partial<TableSession>) {
        const { data, error } = await supabase
            .from('table_sessions')
            .insert(session)
            .select()
            .single()
        if (error) throw error
        return data as TableSession
    },

    // Orders
    async getOrders(restaurantId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, items:order_items(*, dish:dishes(*))')
            .eq('restaurant_id', restaurantId)
            .neq('status', 'PAID')
            .neq('status', 'CANCELLED')
        if (error) throw error
        return data as Order[]
    },

    async getAllOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*, items:order_items(*, dish:dishes(*)), restaurant:restaurants(name)')
        if (error) throw error
        return data as (Order & { restaurant: { name: string } })[]
    },

    async getAllTableSessions() {
        const { data, error } = await supabase
            .from('table_sessions')
            .select('*')
        if (error) throw error
        return data as TableSession[]
    },

    async createOrder(order: Partial<Order>, items: Partial<OrderItem>[]) {
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert(order)
            .select()
            .single()

        if (orderError) throw orderError
        if (!orderData) throw new Error('Failed to create order')

        const itemsWithOrderId = items.map(item => ({
            ...item,
            order_id: orderData.id
        }))

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsWithOrderId)

        if (itemsError) throw itemsError

        return orderData
    },

    async updateOrder(orderId: string, updates: Partial<Order>) {
        const { error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)
        if (error) throw error
    },

    async updateOrderItem(itemId: string, updates: Partial<OrderItem>) {
        const { error } = await supabase
            .from('order_items')
            .update(updates)
            .eq('id', itemId)
        if (error) throw error
    },

    // Bookings
    async getBookings(restaurantId: string) {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('restaurant_id', restaurantId)
        if (error) throw error
        return data as Booking[]
    }
}
