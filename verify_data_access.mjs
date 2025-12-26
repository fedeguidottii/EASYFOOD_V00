import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iqilquhkwjrbwxydsphr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxaWxxdWhrd2pyYnd4eWRzcGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzM3NDUsImV4cCI6MjA3OTc0OTc0NX0.zeKn6WOVip3jIGrZlTjOxk_B1WeJiMtnqd62sqD-0Dg'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
    console.log('--- Checking Restaurants ---')
    const { data: restaurants, error: rError } = await supabase.from('restaurants').select('id, name').limit(5)
    if (rError) console.error('Error fetching restaurants:', rError)
    else console.log(`Restaurants found: ${restaurants.length}`, restaurants)

    console.log('\n--- Checking Dishes ---')
    const { data: dishes, error: dError } = await supabase.from('dishes').select('id, name').limit(5)
    if (dError) console.error('Error fetching dishes:', dError)
    else console.log(`Dishes found: ${dishes.length}`, dishes)

    console.log('\n--- Checking Orders ---')
    const { data: orders, error: oError } = await supabase.from('orders').select('id, status').limit(5)
    if (oError) console.error('Error fetching orders:', oError)
    else console.log(`Orders found: ${orders.length}`, orders)
}

checkTables()
