import { useEffect } from 'react'
import { DatabaseService } from './DatabaseService'
import { User, Restaurant, MenuCategory, MenuItem, Table, Order, Reservation } from './types'

export function DataInitializer() {
    useEffect(() => {
        const initializeData = async () => {
            try {
                // Check if data exists
                const users = await DatabaseService.getUsers()
                if (users && users.length > 0) return // Data already exists

                console.log('Initializing sample data...')

                // 1. Create Restaurant
                const restaurantId = 'restaurant-1'
                const restaurant: Restaurant = {
                    id: restaurantId,
                    name: 'Il Mio Ristorante',
                    contact: 'info@ilmioristorante.it',
                    hours: '12:00 - 23:00',
                    isActive: true,
                    coverChargePerPerson: 2.50,
                    allYouCanEat: { enabled: false, pricePerPerson: 25.00, maxOrders: 3 },
                    createdAt: new Date().toISOString()
                }

                try {
                    await DatabaseService.createRestaurant(restaurant)
                    console.log('Restaurant created')
                } catch (e) {
                    console.error('Error creating restaurant', e)
                }

                // 2. Create Admin User linked to Restaurant
                const adminUser: User = {
                    id: 'admin-1',
                    username: 'admin',
                    password: 'admin123',
                    role: 'admin',
                    restaurantId: restaurantId
                }

                try {
                    await DatabaseService.createUser(adminUser)
                    console.log('Admin user created')
                } catch (e) {
                    console.error('Error creating admin user', e)
                }

                // 3. Create Menu Category
                const categoryId = 'cat-1'
                const category: MenuCategory = {
                    id: categoryId,
                    name: 'Antipasti',
                    isActive: true,
                    restaurantId: restaurantId,
                    order: 1
                }

                try {
                    await DatabaseService.createMenuCategory(category)
                    console.log('Category created')
                } catch (e) {
                    console.error('Error creating category', e)
                }

                // 4. Create Menu Item
                const menuItem: MenuItem = {
                    id: 'item-1',
                    name: 'Bruschetta Classica',
                    description: 'Pane tostato con pomodoro fresco, basilico e olio EVO',
                    price: 6.00,
                    categoryId: categoryId,
                    categoryName: 'Antipasti',
                    isActive: true,
                    restaurantId: restaurantId,
                    image: 'https://images.unsplash.com/photo-1572695157363-bc31c5d53162?auto=format&fit=crop&w=800&q=80'
                }

                try {
                    await DatabaseService.createMenuItem(menuItem)
                    console.log('Menu item created')
                } catch (e) {
                    console.error('Error creating menu item', e)
                }

                // 5. Create Table
                const tableId = 'table-1'
                const table: Table = {
                    id: tableId,
                    name: 'Tavolo 1',
                    isActive: false,
                    pin: '1234',
                    qrCode: `${window.location.origin}?table=${tableId}`,
                    restaurantId: restaurantId,
                    status: 'available'
                }

                try {
                    await DatabaseService.createTable(table)
                    console.log('Table created')
                } catch (e) {
                    console.error('Error creating table', e)
                }

                console.log('Data initialization complete')
            } catch (error) {
                console.error('Error initializing data:', error)
            }
        }

        initializeData()
    }, [])

    return null
}
