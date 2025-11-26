import { useEffect } from 'react'
import { DatabaseService } from './DatabaseService'
import { User, Restaurant, Category, Dish, Table } from './types'
import { v4 as uuidv4 } from 'uuid'

export function DataInitializer() {
    // Automatic initialization disabled - run seed.sql on Supabase instead
    // useEffect(() => {
    const initializeData = async () => {
        try {
            console.log('Checking existing data...')

            // 1. Check/Create Restaurant
            let restaurantId: string
            const restaurants = await DatabaseService.getRestaurants()

            if (restaurants && restaurants.length > 0) {
                console.log('Restaurant already exists, using existing one.')
                restaurantId = restaurants[0].id
            } else {
                console.log('Creating new restaurant...')
                restaurantId = uuidv4()
                const restaurant: Restaurant = {
                    id: restaurantId,
                    name: 'Il Mio Ristorante',
                    address: 'Via Roma 123',
                    owner_id: uuidv4(),
                    created_at: new Date().toISOString()
                }
                await DatabaseService.createRestaurant(restaurant)
                console.log('Restaurant created')
            }

            // 2. Check/Create Admin User
            const users = await DatabaseService.getUsers()
            const adminExists = users?.some(u => u.role === 'ADMIN')

            if (!adminExists) {
                console.log('Creating admin user...')
                const adminUser: User = {
                    id: uuidv4(),
                    email: 'admin@example.com',
                    name: 'Admin',
                    password_hash: 'admin123',
                    role: 'ADMIN',
                    created_at: new Date().toISOString()
                }
                await DatabaseService.createUser(adminUser)
                console.log('Admin user created')
            } else {
                console.log('Admin user already exists')
            }

            // 3. Check/Create Categories (Idempotent check by name)
            const categories = await DatabaseService.getCategories(restaurantId)
            let categoryId: string

            if (categories && categories.length > 0) {
                categoryId = categories[0].id
            } else {
                categoryId = uuidv4()
                await DatabaseService.createCategory({
                    id: categoryId,
                    name: 'Antipasti',
                    restaurant_id: restaurantId,
                    order: 1
                })
                console.log('Category created')
            }

            // 4. Check/Create Dishes
            const dishes = await DatabaseService.getDishes(restaurantId)
            if (!dishes || dishes.length === 0) {
                await DatabaseService.createDish({
                    id: uuidv4(),
                    name: 'Bruschetta Classica',
                    description: 'Pane tostato con pomodoro fresco, basilico e olio EVO',
                    price: 6.00,
                    vat_rate: 10,
                    category_id: categoryId,
                    restaurant_id: restaurantId,
                    is_active: true,
                    image_url: 'https://images.unsplash.com/photo-1572695157363-bc31c5d53162?auto=format&fit=crop&w=800&q=80'
                })
                console.log('Dish created')
            } else {
                console.log('Dish already exists')
            }

            // 5. Check/Create Tables
            const tables = await DatabaseService.getTables(restaurantId)
            if (!tables || tables.length === 0) {
                await DatabaseService.createTable({
                    id: uuidv4(),
                    number: 'Tavolo 1',
                    restaurant_id: restaurantId,
                    token: uuidv4(),
                    pin: '1234'
                })
                console.log('Table created')
            } else {
                console.log('Table already exists')
            }

            console.log('Data initialization check complete')

            // Reload page to reflect changes (optional, but good for first load)
            window.location.reload()

        } catch (error) {
            console.error('Error initializing data:', error)
        }
    }

    // initializeData()
    // }, [])

    return null
}
