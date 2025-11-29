
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iqilquhkwjrbwxydsphr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxaWxxdWhrd2pyYnd4eWRzcGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzM3NDUsImV4cCI6MjA3OTc0OTc0NX0.zeKn6WOVip3jIGrZlTjOxk_B1WeJiMtnqd62sqD-0Dg'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugOrderInsert() {
    console.log('Debugging Order Insert...')

    // 1. Get a restaurant
    const { data: restaurant } = await supabase.from('restaurants').select('id').limit(1).single()
    if (!restaurant) {
        console.error('No restaurant found')
        return
    }
    console.log('Restaurant ID:', restaurant.id)

    // 2. Get a table
    const { data: table } = await supabase.from('tables').select('id').eq('restaurant_id', restaurant.id).limit(1).single()
    if (!table) {
        console.error('No table found')
        return
    }
    console.log('Table ID:', table.id)

    // 3. Create a session (if needed, or use existing)
    let sessionId
    const { data: session } = await supabase.from('table_sessions').select('id').eq('table_id', table.id).eq('status', 'OPEN').limit(1).single()

    if (session) {
        sessionId = session.id
        console.log('Found Open Session:', sessionId)
    } else {
        console.log('Creating new session...')
        const { data: newSession, error: sessionError } = await supabase.from('table_sessions').insert({
            restaurant_id: restaurant.id,
            table_id: table.id,
            status: 'OPEN',
            opened_at: new Date().toISOString()
        }).select().single()

        if (sessionError) {
            console.error('Error creating session:', sessionError)
            return
        }
        sessionId = newSession.id
        console.log('Created Session:', sessionId)
    }

    // 4. Try to insert Order
    console.log('Attempting to insert Order...')
    const { data: order, error: orderError } = await supabase.from('orders').insert({
        restaurant_id: restaurant.id,
        table_session_id: sessionId,
        status: 'pending',
        total_amount: 10.0,
        created_at: new Date().toISOString()
    }).select().single()

    if (orderError) {
        console.error('ORDER INSERT ERROR:', orderError)
    } else {
        console.log('Order Inserted Successfully:', order.id)

        // 5. Try to insert Order Items
        console.log('Attempting to insert Order Items...')
        const { data: dish } = await supabase.from('dishes').select('id').eq('restaurant_id', restaurant.id).limit(1).single()

        if (dish) {
            const { error: itemError } = await supabase.from('order_items').insert({
                order_id: order.id,
                dish_id: dish.id,
                quantity: 1,
                status: 'PENDING'
            })

            if (itemError) {
                console.error('ORDER ITEM INSERT ERROR:', itemError)
            } else {
                console.log('Order Item Inserted Successfully')
            }
        }
    }
}

debugOrderInsert()
