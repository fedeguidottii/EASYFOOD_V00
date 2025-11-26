import { DatabaseService } from './DatabaseService'
import { v4 as uuidv4 } from 'uuid'
import { Category, Dish, Table } from './types'

export const populateRestaurantData = async (restaurantId: string) => {
    console.log('Populating data for restaurant:', restaurantId)

    // 1. Create Categories
    const categoriesData = [
        { name: 'Antipasti', order: 1 },
        { name: 'Primi', order: 2 },
        { name: 'Secondi', order: 3 },
        { name: 'Dolci', order: 4 },
        { name: 'Bevande', order: 5 }
    ]

    const createdCategories: Record<string, string> = {} // name -> id

    for (const cat of categoriesData) {
        const id = uuidv4()
        const newCategory: Category = {
            id,
            name: cat.name,
            restaurant_id: restaurantId,
            order: cat.order
        }
        await DatabaseService.createCategory(newCategory)
        createdCategories[cat.name] = id
    }

    // 2. Create Tables
    const tablesData = [
        { name: 'Tavolo 1' },
        { name: 'Tavolo 2' },
        { name: 'Tavolo 3' },
        { name: 'Tavolo 4' },
        { name: 'Tavolo Esterno 1' }
    ]

    for (const t of tablesData) {
        const tableId = uuidv4()
        const newTable: Table = {
            id: tableId,
            number: t.name,
            restaurant_id: restaurantId,
            token: uuidv4() // Generate a token for QR
        }
        await DatabaseService.createTable(newTable)
    }

    // 3. Create Dishes
    const items = [
        { name: 'Bruschetta', description: 'Pane tostato con pomodoro e basilico', price: 6.00, category: 'Antipasti' },
        { name: 'Carbonara', description: 'Spaghetti, guanciale, uova, pecorino, pepe', price: 12.00, category: 'Primi' },
        { name: 'Amatriciana', description: 'Bucatini, guanciale, pomodoro, pecorino', price: 11.00, category: 'Primi' },
        { name: 'Tagliata di Manzo', description: 'Rucola e grana', price: 18.00, category: 'Secondi' },
        { name: 'Tiramisù', description: 'Classico', price: 6.00, category: 'Dolci' },
        { name: 'Acqua Naturale', description: '0.75L', price: 2.50, category: 'Bevande' },
        { name: 'Coca Cola', description: '33cl', price: 3.00, category: 'Bevande' }
    ]

    for (const item of items) {
        const categoryId = createdCategories[item.category]
        if (!categoryId) continue

        const newDish: Dish = {
            id: uuidv4(),
            name: item.name,
            description: item.description,
            price: item.price,
            vat_rate: 10,
            category_id: categoryId,
            restaurant_id: restaurantId,
            is_active: true
        }
        await DatabaseService.createDish(newDish)
    }

    console.log('Data population complete')
}
