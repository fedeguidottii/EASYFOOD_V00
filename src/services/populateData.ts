import { DatabaseService } from './DatabaseService'
import { v4 as uuidv4 } from 'uuid'
import { Category, Dish, Table, Room, TableSession, Order, OrderItem, Booking } from './types'
import { subDays, addDays, setHours, setMinutes } from 'date-fns'

export const populateRestaurantData = async (restaurantId: string) => {
    console.log('Populating robust data for restaurant:', restaurantId)

    // 1. Create Rooms
    const roomsData = [
        { name: 'Sala Interna', order: 1 },
        { name: 'Terrazza Vista Mare', order: 2 }
    ]
    const createdRooms: Room[] = []
    for (const r of roomsData) {
        const id = uuidv4()
        const room: Room = { id, restaurant_id: restaurantId, name: r.name, is_active: true, order: r.order }
        await DatabaseService.createRoom(room)
        createdRooms.push(room)
    }

    // 2. Create Categories
    const categoriesData = [
        { name: 'Antipasti', order: 1 },
        { name: 'Primi Piatti', order: 2 },
        { name: 'Secondi di Carne', order: 3 },
        { name: 'Secondi di Pesce', order: 4 },
        { name: 'Pizze Gourmet', order: 5 },
        { name: 'Dolci Artigianali', order: 6 },
        { name: 'Cantina & Bevande', order: 7 }
    ]
    const createdCategories: Record<string, string> = {}
    for (const cat of categoriesData) {
        const id = uuidv4()
        await DatabaseService.createCategory({ id, name: cat.name, restaurant_id: restaurantId, order: cat.order })
        createdCategories[cat.name] = id
    }

    // 3. Create Tables
    const createdTables: Table[] = []
    // Room 1: 15 tables
    for (let i = 1; i <= 15; i++) {
        const table = await DatabaseService.createTable({
            id: uuidv4(),
            number: `${i}`,
            restaurant_id: restaurantId,
            room_id: createdRooms[0].id,
            seats: i % 2 === 0 ? 4 : 2,
            token: uuidv4(),
            pin: Math.floor(1000 + Math.random() * 9000).toString()
        })
        createdTables.push(table)
    }
    // Room 2: 10 tables
    for (let i = 16; i <= 25; i++) {
        const table = await DatabaseService.createTable({
            id: uuidv4(),
            number: `${i}`,
            restaurant_id: restaurantId,
            room_id: createdRooms[1].id,
            seats: 4,
            token: uuidv4(),
            pin: Math.floor(1000 + Math.random() * 9000).toString()
        })
        createdTables.push(table)
    }

    // 4. Create Dishes (Extended)
    const dishesRaw = [
        { name: 'Tagliere Imperiale', price: 18, cat: 'Antipasti', img: 'https://images.unsplash.com/photo-1544124499-58912cbddada?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Tartare di Tonno', price: 16, cat: 'Antipasti', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Fiori di Zucca', price: 10, cat: 'Antipasti', img: 'https://images.unsplash.com/photo-1599321955726-e048426394af?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Spaghetti alle Vongole', price: 15, cat: 'Primi Piatti', img: 'https://images.unsplash.com/photo-1551892374-ecf57bb4f1dd?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Paccheri al Ragu di Polpo', price: 16, cat: 'Primi Piatti', img: 'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Carbonara Tartufata', price: 14, cat: 'Primi Piatti', img: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Gnocchi alla Sorrentina', price: 12, cat: 'Primi Piatti', img: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Filetto al Pepe Verde', price: 24, cat: 'Secondi di Carne', img: 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Tagliata con Porcini', price: 22, cat: 'Secondi di Carne', img: 'https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Grigliata Mista di Pesce', price: 28, cat: 'Secondi di Pesce', img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Frittura di Paranza', price: 18, cat: 'Secondi di Pesce', img: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Margherita DOP', price: 8, cat: 'Pizze Gourmet', img: 'https://images.unsplash.com/photo-1574071318508-1cdbad80ad38?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Pistacchiosa', price: 14, cat: 'Pizze Gourmet', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Diavola Special', price: 10, cat: 'Pizze Gourmet', img: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Tiramisù della Casa', price: 7, cat: 'Dolci Artigianali', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Cheesecake Frutti di Bosco', price: 7, cat: 'Dolci Artigianali', img: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Cannolo Scomposto', price: 6, cat: 'Dolci Artigianali', img: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Vino Rosso - Calice', price: 6, cat: 'Cantina & Bevande', img: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Birra Artigianale 0.5L', price: 7, cat: 'Cantina & Bevande', img: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?q=80&w=1000&auto=format&fit=crop' },
        { name: 'Acqua Minerale 0.75L', price: 3, cat: 'Cantina & Bevande', img: 'https://images.unsplash.com/photo-1523362622312-64c6a2399679?q=80&w=1000&auto=format&fit=crop' }
    ]
    const createdDishes: Dish[] = []
    for (const d of dishesRaw) {
        const dish: Dish = {
            id: uuidv4(),
            restaurant_id: restaurantId,
            category_id: createdCategories[d.cat],
            name: d.name,
            price: d.price,
            vat_rate: 10,
            is_active: true,
            image_url: (d as any).img
        }
        await DatabaseService.createDish(dish)
        createdDishes.push(dish)
    }

    // 5. Create Historical Data (50 Orders)
    console.log('Generating historical orders...')
    for (let i = 0; i < 50; i++) {
        const randomTable = createdTables[Math.floor(Math.random() * createdTables.length)]
        const randomDate = subDays(new Date(), Math.floor(Math.random() * 30))
        randomDate.setHours(12 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60))

        const session = await DatabaseService.createSession({
            id: uuidv4(),
            restaurant_id: restaurantId,
            table_id: randomTable.id,
            status: 'CLOSED',
            opened_at: randomDate.toISOString(),
            closed_at: randomDate.toISOString(), // Same day for historical
            customer_count: 2 + Math.floor(Math.random() * 4)
        })

        const orderItemsCount = 2 + Math.floor(Math.random() * 5)
        let total = 0
        const itemsToInsert: Partial<OrderItem>[] = []
        for (let j = 0; j < orderItemsCount; j++) {
            const dish = createdDishes[Math.floor(Math.random() * createdDishes.length)]
            total += dish.price
            itemsToInsert.push({
                id: uuidv4(),
                dish_id: dish.id,
                quantity: 1,
                status: 'SERVED',
                created_at: randomDate.toISOString()
            })
        }

        await DatabaseService.createOrder({
            id: uuidv4(),
            restaurant_id: restaurantId,
            table_session_id: session.id,
            status: 'PAID',
            total_amount: total,
            created_at: randomDate.toISOString()
        }, itemsToInsert)
    }

    // 6. Create Active Data (5 Sessions)
    console.log('Generating active orders...')
    for (let i = 0; i < 5; i++) {
        const table = createdTables[i] // Use first few tables
        const session = await DatabaseService.createSession({
            id: uuidv4(),
            restaurant_id: restaurantId,
            table_id: table.id,
            status: 'OPEN',
            opened_at: new Date().toISOString(),
            customer_count: 2
        })
        const dish = createdDishes[Math.floor(Math.random() * createdDishes.length)]
        await DatabaseService.createOrder({
            id: uuidv4(),
            restaurant_id: restaurantId,
            table_session_id: session.id,
            status: 'OPEN',
            total_amount: dish.price,
            created_at: new Date().toISOString()
        }, [{ id: uuidv4(), dish_id: dish.id, quantity: 1, status: 'PENDING' }])
    }

    // 7. Create Bookings (20)
    console.log('Generating bookings...')
    const names = ['Marco Rossi', 'Giulia Bianchi', 'Luca Verdi', 'Elena Neri', 'Alessandro Fonti', 'Chiara Gallo', 'Roberto Esposito', 'Anna Romano']
    for (let i = 0; i < 20; i++) {
        const offset = Math.floor(Math.random() * 5) - 2 // -2 to +2 days
        const date = addDays(new Date(), offset)
        date.setHours(19 + (i % 3), (i % 4) * 15)

        await DatabaseService.createBooking({
            id: uuidv4(),
            restaurant_id: restaurantId,
            name: names[i % names.length],
            phone: '3331234567',
            guests: 2 + (i % 6),
            date_time: date.toISOString(),
            status: 'CONFIRMED',
            notes: i % 5 === 0 ? 'Tavolo vicino alla finestra' : undefined
        })
    }

    console.log('Data population complete for:', restaurantId)
}
