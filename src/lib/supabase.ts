import { createClient } from '@supabase/supabase-js'

// These will be replaced by the user's actual keys
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://iqilquhkwjrbwxydsphr.supabase.co"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxaWxxdWhrd2pyYnd4eWRzcGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzM3NDUsImV4cCI6MjA3OTc0OTc0NX0.zeKn6WOVip3jIGrZlTjOxk_B1WeJiMtnqd62sqD-0Dg"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)