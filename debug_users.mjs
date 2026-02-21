import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iqilquhkwjrbwxydsphr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxaWxxdWhrd2pyYnd4eWRzcGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzM3NDUsImV4cCI6MjA3OTc0OTc0NX0.zeKn6WOVip3jIGrZlTjOxk_B1WeJiMtnqd62sqD-0Dg'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUsers() {
    console.log('Connecting to Supabase...')
    const { data: users, error } = await supabase.from('users').select('*')
    if (error) {
        console.error('Error fetching users:', error)
    } else {
        console.log('Users found:', users.length)
        users.forEach(u => {
            console.log(`User: ${u.name}, Email: ${u.email}, Role: ${u.role}, Hash: '${u.password_hash}'`)
        })
    }
}

checkUsers()
