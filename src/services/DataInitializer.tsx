import { useEffect } from 'react'
import { DatabaseService } from './DatabaseService'
import { User, Restaurant, Category, Dish, Table } from './types'
import { v4 as uuidv4 } from 'uuid'

export function DataInitializer() {
    useEffect(() => {
        const initializeData = async () => {
            try {
                // Check if data exists
                const users = await DatabaseService.getUsers()
                if (users && users.length > 0) return // Data already exists

                console.log('Initializing sample data...')

                // 1. Create Restaurant
                const restaurantId = uuidv4() // Generate valid UUID
                const restaurant: Restaurant = {
                    id: restaurantId,
                    name: 'Il Mio Ristorante',
                    address: 'Via Roma 123',
                    owner_id: uuidv4(), // Placeholder owner
                    created_at: new Date().toISOString()
                }

                try {
                    await DatabaseService.createRestaurant(restaurant)
                    console.log('Restaurant created')
                } catch (e) {
                    console.error('Error creating restaurant', e)
                    return // Stop if restaurant creation fails
                }

                // 2. Create Admin User linked to Restaurant
                // Note: In a real app, we'd use Supabase Auth. Here we store a simple user record.
                const adminUser: User = {
                    id: uuidv4(),
                    email: 'admin@example.com',
                    name: 'Admin',
                    password_hash: 'admin123', // Simple text for demo
                    role: 'ADMIN',
                    created_at: new Date().toISOString()
                }

                try {
                    await DatabaseService.createUser(adminUser)
                    console.log('Admin user created')
                } catch (e) {
                    console.error('Error creating admin user', e)
                }

                // 3. Create Menu Category
                const categoryId = uuidv4()
                const category: Category = {
                    id: categoryId,
                    name: 'Antipasti',
                    restaurant_id: restaurantId,
                    order: 1
                }

                try {
                    await DatabaseService.createCategory(category)
                    console.log('Category created')
                } catch (e) {
                    console.error('Error creating category', e)
                }

                // 4. Create Menu Item (Dish)
                const dish: Dish = {
                    id: uuidv4(),
                    name: 'Bruschetta Classica',
                    description: 'Pane tostato con pomodoro fresco, basilico e olio EVO',
                    price: 6.00,
                    vat_rate: 10,
                    category_id: categoryId,
                    restaurant_id: restaurantId,
                    is_active: true,
                    image_url: 'https://images.unsplash.com/photo-1572695157363-bc31c5d53162?auto=format&fit=crop&w=800&q=80'
                }

                try {
                    await DatabaseService.createDish(dish)
                    console.log('Dish created')
                } catch (e) {
                    console.error('Error creating dish', e)
                }

                // 5. Create Table
                const tableId = uuidv4()
                const table: Table = {
                    id: tableId,
                    number: 'Tavolo 1',
                    restaurant_id: restaurantId,
                    token: uuidv4(),
                    pin: '1234'
                }

                try {
                    await DatabaseService.createTable(table)
                    console.log('Table created')
                } catch (e) {
                    console.error('Error creating table', e)
                }

                console.log('Data initialization complete')

                // Reload page to reflect changes (optional, but good for first load)
                window.location.reload()

            } catch (error) {
                console.error('Error initializing data:', error)
            }
        }

        initializeData()
    }, [])

    return null
}
