import { useEffect } from 'react'
import { DatabaseService } from './DatabaseService'
import { User, Restaurant, Category, Dish, Table } from './types' // Aggiornato import tipi

export function DataInitializer() {
    useEffect(() => {
        const initializeData = async () => {
            try {
                // Check if data exists
                const users = await DatabaseService.getUsers()
                if (users && users.length > 0) return // Data already exists

                console.log('Initializing sample data...')

                // Generiamo UUID validi
                const restaurantId = crypto.randomUUID()
                const categoryId = crypto.randomUUID()
                const tableId = crypto.randomUUID()
                const adminId = crypto.randomUUID()
                const dishId = crypto.randomUUID()

                // 1. Create Restaurant
                // NOTA: Assicurati che i nomi delle proprietà (keys) coincidano con le colonne del DB su Supabase (snake_case)
                const restaurant: any = { // Uso any per flessibilità nell'insert se i tipi TypeScript non sono allineati
                    id: restaurantId,
                    name: 'Il Mio Ristorante',
                    contact: 'info@ilmioristorante.it',
                    hours: '12:00 - 23:00',
                    is_active: true, // snake_case
                    cover_charge_per_person: 2.50, // snake_case probabile
                    // Se all_you_can_eat è un campo JSONB, ok passarlo come oggetto, altrimenti servono colonne separate
                    all_you_can_eat: { enabled: false, pricePerPerson: 25.00, maxOrders: 3 },
                    created_at: new Date().toISOString()
                }

                try {
                    await DatabaseService.createRestaurant(restaurant)
                    console.log('Restaurant created')
                } catch (e) {
                    console.error('Error creating restaurant', e)
                    return; // Stop if restaurant fails
                }

                // 2. Create Admin User linked to Restaurant
                const adminUser: any = {
                    id: adminId,
                    username: 'admin',
                    password: 'admin123',
                    role: 'admin',
                    restaurant_id: restaurantId // snake_case cruciale per la Foreign Key
                }

                try {
                    await DatabaseService.createUser(adminUser)
                    console.log('Admin user created')
                } catch (e) {
                    console.error('Error creating admin user', e)
                }

                // 3. Create Menu Category
                const category: any = {
                    id: categoryId,
                    name: 'Antipasti',
                    is_active: true, // snake_case
                    restaurant_id: restaurantId, // snake_case
                    order: 1
                }

                try {
                    // CORRETTO: createCategory invece di createMenuCategory
                    await DatabaseService.createCategory(category)
                    console.log('Category created')
                } catch (e) {
                    console.error('Error creating category', e)
                }

                // 4. Create Menu Item (Dish)
                const dish: any = {
                    id: dishId,
                    name: 'Bruschetta Classica',
                    description: 'Pane tostato con pomodoro fresco, basilico e olio EVO',
                    price: 6.00,
                    category_id: categoryId, // snake_case
                    // categoryName: solitamente non si salva nel DB, è in relazione
                    is_active: true, // snake_case
                    restaurant_id: restaurantId, // snake_case
                    image: 'https://images.unsplash.com/photo-1572695157363-bc31c5d53162?auto=format&fit=crop&w=800&q=80'
                }

                try {
                    // CORRETTO: createDish invece di createMenuItem
                    await DatabaseService.createDish(dish)
                    console.log('Menu item created')
                } catch (e) {
                    console.error('Error creating menu item', e)
                }

                // 5. Create Table
                const table: any = {
                    id: tableId,
                    name: 'Tavolo 1',
                    is_active: true, // snake_case
                    pin: '1234',
                    qr_code: `${window.location.origin}?table=${tableId}`, // snake_case probabile
                    restaurant_id: restaurantId, // snake_case
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
