import { useEffect } from 'react'
import { DatabaseService } from './DatabaseService'

export function DataInitializer() {
    useEffect(() => {
        const initializeData = async () => {
            try {
                // Controlla se esistono già utenti per evitare duplicati
                const users = await DatabaseService.getUsers()
                if (users && users.length > 0) return

                console.log('Avvio inizializzazione dati corretta...')

                // 1. Generazione ID validi (UUID)
                const adminId = crypto.randomUUID()
                const restaurantId = crypto.randomUUID()
                const categoryId = crypto.randomUUID()
                const dishId = crypto.randomUUID()
                const tableId = crypto.randomUUID()

                // 2. Creazione Utente Admin
                // NOTA: La password è salvata in password_hash per questo esempio
                const adminUser: any = {
                    id: adminId,
                    email: 'admin@easyfood.it',
                    name: 'admin',          // Questo serve per il login come "username"
                    password_hash: 'admin123', // Questo serve per il login come "password"
                    role: 'ADMIN',          // Deve essere MAIUSCOLO come da DB
                    created_at: new Date().toISOString()
                }

                await DatabaseService.createUser(adminUser)
                console.log('Utente admin creato')

                // 3. Creazione Ristorante
                const restaurant: any = {
                    id: restaurantId,
                    name: 'Il Mio Ristorante',
                    owner_id: adminId,      // Collega il ristorante all'admin
                    address: 'Via Roma 1',
                    created_at: new Date().toISOString()
                }

                await DatabaseService.createRestaurant(restaurant)
                console.log('Ristorante creato')

                // 4. Creazione Categoria
                const category: any = {
                    id: categoryId,
                    name: 'Antipasti',
                    restaurant_id: restaurantId, // snake_case
                    "order": 1,
                    created_at: new Date().toISOString()
                }

                await DatabaseService.createCategory(category)
                console.log('Categoria creata')

                // 5. Creazione Piatto
                const dish: any = {
                    id: dishId,
                    name: 'Bruschetta Classica',
                    description: 'Pane tostato con pomodoro',
                    price: 6.00,
                    vat_rate: 10,
                    category_id: categoryId,    // snake_case
                    restaurant_id: restaurantId,// snake_case
                    is_active: true,
                    created_at: new Date().toISOString()
                }

                await DatabaseService.createDish(dish)
                console.log('Piatto creato')

                // 6. Creazione Tavolo
                const table: any = {
                    id: tableId,
                    number: 'Tavolo 1',
                    restaurant_id: restaurantId, // snake_case
                    token: crypto.randomUUID(),
                    created_at: new Date().toISOString()
                }

                await DatabaseService.createTable(table)
                console.log('Tavolo creato')

                console.log('Inizializzazione completata con successo!')
                
            } catch (error) {
                console.error('Errore critico inizializzazione:', error)
            }
        }

        initializeData()
    }, [])

    return null
}
