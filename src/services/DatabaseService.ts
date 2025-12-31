import { supabase } from '../lib/supabase'
import { User, Restaurant, Category, Dish, Table, TableSession, Order, OrderItem, Booking, CartItem } from './types'

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
            isActive: r.is_active, // Mappa is_active (DB) a isActive (Frontend)
            allYouCanEat: r.all_you_can_eat,
            coverChargePerPerson: r.cover_charge_per_person,
            waiter_mode_enabled: r.waiter_mode_enabled,
            allow_waiter_payments: r.allow_waiter_payments
        })) as Restaurant[]
    },

    async createRestaurant(restaurant: Partial<Restaurant>) {
        const payload: any = { ...restaurant }

        // Gestione corretta is_active
        if (restaurant.isActive !== undefined) {
            payload.is_active = restaurant.isActive
        }
        if (restaurant.allYouCanEat !== undefined) {
            payload.all_you_can_eat = restaurant.allYouCanEat
        }
        if (restaurant.all_you_can_eat !== undefined) {
            payload.all_you_can_eat = restaurant.all_you_can_eat
        }
        if (restaurant.coverChargePerPerson !== undefined) {
            payload.cover_charge_per_person = restaurant.coverChargePerPerson
        }
        if (restaurant.waiter_mode_enabled !== undefined) {
            payload.waiter_mode_enabled = restaurant.waiter_mode_enabled
        }
        if (restaurant.allow_waiter_payments !== undefined) {
            payload.allow_waiter_payments = restaurant.allow_waiter_payments
        }
        if (restaurant.cover_charge_per_person !== undefined) {
            payload.cover_charge_per_person = restaurant.cover_charge_per_person
        }

        // Rimuovi campi frontend-only
        delete payload.isActive
        delete payload.hours
        delete payload.coverChargePerPerson
        delete payload.allYouCanEat
        delete payload.waiter_mode_enabled
        delete payload.allow_waiter_payments

        const { error } = await supabase.from('restaurants').insert(payload)
        if (error) throw error
    },

    async updateRestaurant(restaurant: Partial<Restaurant>) {
        const payload: any = {}

        // Campi permessi per l'aggiornamento
        const allowedFields = ['name', 'address', 'phone', 'email', 'logo_url', 'owner_id', 'waiter_mode_enabled', 'allow_waiter_payments', 'waiter_password', 'all_you_can_eat', 'cover_charge_per_person', 'lunch_time_start', 'dinner_time_start', 'enable_course_splitting']

        // Copia solo i campi presenti nell'oggetto input
        allowedFields.forEach(field => {
            if (field in restaurant) {
                payload[field] = (restaurant as any)[field]
            }
        })

        // Gestione esplicita di isActive -> is_active
        if (restaurant.isActive !== undefined) {
            payload.is_active = restaurant.isActive
        }
        if (restaurant.allYouCanEat !== undefined) {
            payload.all_you_can_eat = restaurant.allYouCanEat
        }
        if (restaurant.coverChargePerPerson !== undefined) {
            payload.cover_charge_per_person = restaurant.coverChargePerPerson
        }
        if (restaurant.waiter_mode_enabled !== undefined) {
            payload.waiter_mode_enabled = restaurant.waiter_mode_enabled
        }
        if (restaurant.allow_waiter_payments !== undefined) {
            payload.allow_waiter_payments = restaurant.allow_waiter_payments
        }

        const { error } = await supabase
            .from('restaurants')
            .update(payload)
            .eq('id', restaurant.id)

        if (error) throw error
    },

    // Rooms
    async getRooms(restaurantId: string) {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)
            .order('order', { ascending: true })
        if (error) throw error
        return data as any[]
    },

    async createRoom(room: Partial<any>) {
        const { error } = await supabase.from('rooms').insert(room)
        if (error) throw error
    },

    async updateRoom(roomId: string, updates: Partial<any>) {
        const { error } = await supabase
            .from('rooms')
            .update(updates)
            .eq('id', roomId)
        if (error) throw error
    },

    async deleteRoom(roomId: string) {
        const { error } = await supabase
            .from('rooms')
            .update({ is_active: false })
            .eq('id', roomId)
        if (error) throw error
    },

    async deleteRestaurant(restaurantId: string) {
        // 0. Recupera info ristorante per eliminare il logo e l'owner
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('logo_url, owner_id')
            .eq('id', restaurantId)
            .single()

        // 1. Elimina dipendenze complesse (Order Items)
        const { data: orders } = await supabase
            .from('orders')
            .select('id')
            .eq('restaurant_id', restaurantId)

        if (orders && orders.length > 0) {
            const orderIds = orders.map(o => o.id)
            await supabase.from('order_items').delete().in('order_id', orderIds)
        }

        // 2. Elimina Tabelle dipendenti direttamente da restaurant_id (Ordine Strict)
        // IMPORTANTE: Elimina restaurant_staff PRIMA di tutto il resto per liberare referenze agli utenti
        await supabase.from('restaurant_staff').delete().eq('restaurant_id', restaurantId)

        await supabase.from('orders').delete().eq('restaurant_id', restaurantId)
        await supabase.from('table_sessions').delete().eq('restaurant_id', restaurantId)
        await supabase.from('bookings').delete().eq('restaurant_id', restaurantId)
        await supabase.from('dishes').delete().eq('restaurant_id', restaurantId)
        await supabase.from('categories').delete().eq('restaurant_id', restaurantId)
        await supabase.from('tables').delete().eq('restaurant_id', restaurantId)

        // 3. Elimina logo dallo Storage se esiste
        if (restaurant?.logo_url) {
            try {
                const urlParts = restaurant.logo_url.split('/')
                const fileName = urlParts[urlParts.length - 1]

                if (fileName) {
                    await supabase.storage
                        .from('logos')
                        .remove([fileName])
                }
            } catch (e) {
                console.warn("Could not delete logo file", e)
            }
        }

        // 4. Infine elimina il ristorante
        const { error } = await supabase
            .from('restaurants')
            .delete()
            .eq('id', restaurantId)

        if (error) throw error

        // 5. Tenta di eliminare l'utente proprietario (se esiste), MA NON SE È ADMIN
        // Questo va fatto DOPO aver eliminato il ristorante e lo staff
        if (restaurant?.owner_id) {
            try {
                // Check if user is ADMIN first
                const { data: user } = await supabase.from('users').select('role').eq('id', restaurant.owner_id).single()

                if (user?.role !== 'ADMIN') {
                    await supabase.from('users').delete().eq('id', restaurant.owner_id)
                } else {
                    console.log('Skipping deletion of restaurant owner because they are ADMIN')
                }
            } catch (e) {
                console.warn("Could not auto-delete owner user", e)
                // Non lanciamo errore qui per non bloccare l'operazione se il ristorante è già andato
            }
        }
    },

    async nukeDatabase() {
        // ATTENZIONE: Ordine inverso di dipendenza
        // 1. Order Items (dipende da Orders e Dishes)
        await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 2. Orders (dipende da Restaurants e Table Sessions)
        await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 3. Sessions (dipende da Tables)
        await supabase.from('table_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 4. Bookings
        await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 5. Dishes (dipende da Categories e Restaurants)
        await supabase.from('dishes').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 6. Categories
        await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 7. Tables
        await supabase.from('tables').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 8. Staff
        await supabase.from('restaurant_staff').delete().neq('restaurant_id', '00000000-0000-0000-0000-000000000000')

        // 9. Restaurants
        await supabase.from('restaurants').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        // 10. Users (tranne ADMIN)
        await supabase.from('users').delete().neq('role', 'ADMIN')
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

    async uploadImage(file: File, bucket: string) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from(bucket)
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

    async updateCategory(category: Partial<Category>) {
        const { error } = await supabase
            .from('categories')
            .update(category)
            .eq('id', category.id)
        if (error) throw error
    },

    async deleteCategory(categoryId: string) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoryId)
        if (error) throw error
    },

    // Dishes
    async getDishes(restaurantId: string) {
        const { data, error } = await supabase
            .from('dishes')
            .select('*')
            .eq('restaurant_id', restaurantId)
        if (error) throw error
        return data.map((d: any) => ({
            ...d,
            excludeFromAllYouCanEat: d.exclude_from_all_you_can_eat
        })) as Dish[]
    },

    async createDish(dish: Partial<Dish>) {
        const payload: any = { ...dish }
        if (dish.excludeFromAllYouCanEat !== undefined) {
            payload.exclude_from_all_you_can_eat = dish.excludeFromAllYouCanEat
        }
        delete payload.excludeFromAllYouCanEat

        const { error } = await supabase.from('dishes').insert(payload)
        if (error) throw error
    },

    async updateDish(dish: Partial<Dish>) {
        const payload: any = { ...dish }
        if (dish.excludeFromAllYouCanEat !== undefined) {
            payload.exclude_from_all_you_can_eat = dish.excludeFromAllYouCanEat
        }
        delete payload.excludeFromAllYouCanEat

        const { error } = await supabase
            .from('dishes')
            .update(payload)
            .eq('id', dish.id)
        if (error) throw error
    },

    async deleteDish(id: string) {
        const { error } = await supabase
            .from('dishes')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    // Tables
    async updateSession(session: Partial<TableSession> & { id: string }) {
        const { error } = await supabase
            .from('table_sessions')
            .update(session)
            .eq('id', session.id)

        if (error) throw error
    },

    async getTables(restaurantId: string) {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('restaurant_id', restaurantId)
        if (error) throw error
        return data as Table[]
    },

    async createTable(table: Partial<Table>) {
        const { data, error } = await supabase.from('tables').insert(table).select().single()
        if (error) throw error
        return data as Table
    },

    async updateTable(tableId: string, updates: Partial<Table>) {
        const { error } = await supabase
            .from('tables')
            .update(updates)
            .eq('id', tableId)
        if (error) throw error
    },

    async deleteTable(id: string) {
        const { error } = await supabase
            .from('tables')
            .delete()
            .eq('id', id)
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

    async closeSession(sessionId: string) {
        const { error } = await supabase
            .from('table_sessions')
            .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
            .eq('id', sessionId)
        if (error) throw error
    },

    async markOrdersPaidForSession(sessionId: string) {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'PAID', closed_at: new Date().toISOString() })
            .eq('table_session_id', sessionId)
            .neq('status', 'PAID')
        if (error) throw error
    },

    async cancelSessionOrders(sessionId: string) {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'CANCELLED', closed_at: new Date().toISOString() })
            .eq('table_session_id', sessionId)
            .neq('status', 'PAID') // Don't cancel already paid orders
            .neq('status', 'COMPLETED') // Optional: decide if completed orders should be cancelled. User said "annullarsi", so likely yes if they are still "active" in some way, but usually COMPLETED means served. 
        // However, "Active Orders" usually implies PENDING/IN_PREPARATION/READY/SERVED. 
        // If we "Empty Table", we assume everything is wiped.
        // Let's cancel everything that isn't PAID.
        if (error) throw error
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

    async getSessionOrderCount(sessionId: string) {
        const { error, count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('table_session_id', sessionId)

        if (error) throw error
        return count || 0
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
    },

    async createBooking(booking: Partial<Booking>) {
        const { data, error } = await supabase
            .from('bookings')
            .insert(booking)
            .select()
            .single()

        if (error) throw error
        return data as Booking
    },

    async updateBooking(booking: Partial<Booking>) {
        const { error } = await supabase
            .from('bookings')
            .update(booking)
            .eq('id', booking.id)
        if (error) throw error
    },

    async deleteBooking(bookingId: string) {
        const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId)
        if (error) throw error
    },

    // Cart (Realtime)
    async getCartItems(sessionId: string) {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*, dish:dishes(*)')
            .eq('session_id', sessionId)
        if (error) throw error
        return data as CartItem[]
    },

    async addToCart(item: { session_id: string, dish_id: string, quantity: number, notes?: string }) {
        // Check if item exists (same dish, same notes)
        const { data: existing } = await supabase
            .from('cart_items')
            .select('*')
            .eq('session_id', item.session_id)
            .eq('dish_id', item.dish_id)
            // We might want to separate by notes too, but for now let's keep it simple: same dish = same item
            // If notes are different, it should probably be a separate line item?
            // User request: "Distingui visivamente nel carrello tra: Piatti da ordinare e Piatti già ordinati"
            // This is just adding to cart.
            .single()

        if (existing && existing.notes === item.notes) {
            // Update quantity if notes are identical
            return this.updateCartItem(existing.id, { quantity: existing.quantity + item.quantity })
        } else {
            // Insert new
            const { error } = await supabase.from('cart_items').insert(item)
            if (error) throw error
        }
    },

    async updateCartItem(itemId: string, updates: { quantity?: number, notes?: string }) {
        if (updates.quantity !== undefined && updates.quantity <= 0) {
            return this.removeFromCart(itemId)
        }
        const { error } = await supabase
            .from('cart_items')
            .update(updates)
            .eq('id', itemId)
        if (error) throw error
    },

    async removeFromCart(itemId: string) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId)
        if (error) throw error
    },

    async clearCart(sessionId: string) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('session_id', sessionId)
        if (error) throw error
    },

    async verifySessionPin(tableId: string, pin: string): Promise<boolean> {
        try {
            // Find active session for this table
            const { data: sessions, error } = await supabase
                .from('table_sessions')
                .select('session_pin')
                .eq('table_id', tableId)
                .eq('status', 'OPEN')
                .single()

            if (error || !sessions) {
                console.error('Error verifying PIN or no active session:', error)
                return false
            }

            // Robust comparison: handle string/number mismatch and whitespace
            return String(sessions.session_pin).trim() === String(pin).trim()
        } catch (error) {
            console.error('Error in verifySessionPin:', error)
            return false
        }
    },

    async getSessionOrders(sessionId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, items:order_items(*, dish:dishes(*))')
            .eq('table_session_id', sessionId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data as Order[]
    },
    async getSessionById(sessionId: string) {
        const { data, error } = await supabase
            .from('table_sessions')
            .select('*')
            .eq('id', sessionId)
            .single()
        if (error) return null
        return data as TableSession
    }
}