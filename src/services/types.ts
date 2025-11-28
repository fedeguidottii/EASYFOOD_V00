export type UserRole = 'ADMIN' | 'OWNER' | 'STAFF' | 'CUSTOMER'
export type RestaurantStaffRole = 'OWNER' | 'STAFF'
export type SessionStatus = 'OPEN' | 'CLOSED'
export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed'
export type OrderItemStatus = 'PENDING' | 'IN_PREPARATION' | 'READY' | 'SERVED'

export interface User {
    id: string
    email: string
    name?: string
    password_hash?: string
    role: UserRole
    created_at?: string
}

export interface Restaurant {
    id: string
    name: string
    address?: string
    phone?: string
    email?: string
    logo_url?: string
    owner_id: string
    created_at?: string
    // Frontend helpers
    isActive?: boolean
    hours?: string
    coverChargePerPerson?: number
    allYouCanEat?: {
        enabled: boolean
        pricePerPerson: number
        maxOrders: number
    }
}

export interface Category {
    id: string
    name: string
    restaurant_id: string
    order: number
    created_at?: string
}

export interface Dish {
    id: string
    name: string
    description?: string
    price: number
    vat_rate: number
    category_id: string
    restaurant_id: string
    is_active: boolean
    image_url?: string
    created_at?: string
    excludeFromAllYouCanEat?: boolean
}

export interface Table {
    id: string
    number: string
    restaurant_id: string
    token: string
    pin?: string
    seats?: number
    created_at?: string
    // Frontend helper properties
    status?: 'available' | 'occupied'
    current_session_id?: string
    isActive?: boolean // For frontend compatibility
    name?: string // Alias for number
    remainingOrders?: number
    customerCount?: number
}

export interface TableSession {
    id: string
    restaurant_id: string
    table_id: string
    status: SessionStatus
    opened_at: string
    closed_at?: string
}

export interface Order {
    id: string
    restaurant_id: string
    table_session_id: string
    status: OrderStatus
    total_amount: number
    created_at: string
    closed_at?: string
    // Frontend helper
    items?: OrderItem[]
}

export interface OrderItem {
    id: string
    order_id: string
    dish_id: string
    quantity: number
    note?: string
    status: OrderItemStatus
    created_at?: string
    // Frontend helper
    dish?: Dish
}

export interface Booking {
    id: string
    restaurant_id: string
    name: string
    email?: string
    phone?: string
    date_time: string
    guests: number
    notes?: string
    status: string
    created_at?: string
}
