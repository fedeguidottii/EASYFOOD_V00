export type UserRole = 'ADMIN' | 'OWNER' | 'STAFF' | 'CUSTOMER'
export type RestaurantStaffRole = 'OWNER' | 'STAFF'
export type SessionStatus = 'OPEN' | 'CLOSED'
export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed'
export type OrderItemStatus = 'PENDING' | 'IN_PREPARATION' | 'READY' | 'SERVED' | 'pending' | 'preparing' | 'ready' | 'served'

export interface User {
    id: string
    email: string
    name?: string
    password_hash?: string
    role: UserRole
    created_at?: string
    restaurant_id?: string
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
    // Mapped from DB
    all_you_can_eat?: {
        enabled: boolean
        pricePerPerson: number
        maxOrders: number
    }
    cover_charge_per_person?: number
    waiter_mode_enabled?: boolean
    allow_waiter_payments?: boolean

    waiter_password?: string
    // Schedule Configuration
    lunch_time_start?: string
    lunch_time_end?: string
    dinner_time_start?: string
    dinner_time_end?: string
    enable_course_splitting?: boolean
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
    // Mapped from DB
    // Mapped from DB
    exclude_from_all_you_can_eat?: boolean
    is_ayce?: boolean
    allergens?: string[]
}

export interface Table {
    id: string
    number: string
    restaurant_id: string
    token: string
    pin?: string
    seats?: number
    room_id?: string
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
    session_pin?: string
    customer_count?: number
    created_at: string
}

export interface Room {
    id: string
    restaurant_id: string
    name: string
    is_active: boolean
    order?: number
    created_at?: string
}

export interface Order {
    id: string
    restaurant_id: string
    table_session_id: string
    status: OrderStatus
    total_amount: number
    created_at: string
    updated_at?: string
    closed_at?: string
    // Frontend helper
    items?: OrderItem[]
    table_id?: string // Helper
}

export interface OrderItem {
    id: string
    order_id: string
    dish_id: string
    quantity: number
    note?: string
    status: OrderItemStatus
    created_at?: string
    course_number?: number // Numero della portata (1 = prima portata, 2 = seconda, ecc.)
    // Frontend helper
    dish?: Dish
}

export interface Booking {
    id: string
    restaurant_id: string
    table_id?: string
    name: string
    email?: string
    phone?: string
    date_time: string
    guests: number
    notes?: string
    status: string
    created_at?: string
}

export interface CartItem {
    id: string
    session_id: string
    dish_id: string
    quantity: number
    notes?: string
    created_at?: string
    course_number?: number // Numero della portata
    // Frontend helper
    dish?: Dish
}

// Settings per il ristorante (reservation duration, etc.)
export interface RestaurantSettings {
    default_reservation_duration?: number // Durata in minuti (default 120)
}

// Custom Menus System
export type MealType = 'lunch' | 'dinner' | 'all'

export interface CustomMenu {
    id: string
    restaurant_id: string
    name: string
    description?: string
    is_active: boolean
    created_at?: string
    updated_at?: string
}

export interface CustomMenuDish {
    id: string
    custom_menu_id: string
    dish_id: string
    created_at?: string
}

export interface CustomMenuSchedule {
    id: string
    custom_menu_id: string
    day_of_week?: number // 0=Sunday, 1=Monday, ..., 6=Saturday, null=any day
    meal_type: MealType
    start_time?: string
    end_time?: string
    is_active: boolean
    created_at?: string
}
