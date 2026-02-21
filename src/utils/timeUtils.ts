import type { Restaurant, WeeklyServiceSchedule, DayMealConfig } from '../services/types'

export function isRestaurantOpen(restaurant: Restaurant | null | undefined): boolean {
    if (!restaurant) return false

    // If weekly_service_hours is not fully configured, fallback to always open for safety unless they specifically disable it
    if (!restaurant.weekly_service_hours) return true

    const schedule = restaurant.weekly_service_hours as WeeklyServiceSchedule

    // If the entire feature is disabled via the master switch, then it's always open (i.e. feature is off) 
    // OR if we want 'disabled' to mean 'closed', we check that. Let's assume disabled = not enforcing hours.
    if (!schedule.enabled) return true

    // Get current time in Italy timezone (or system local time for simplicity in this web app context)
    const now = new Date()
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const currentDay = days[now.getDay()]
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    if (!schedule.useWeeklySchedule) {
        // Fallback to basic logic if needed, but since we always provide lunch defaults in our WeeklyServiceHoursEditor,
        // we can just say "always open" if they chose not to use the weekly schedule to avoid breaking legacy setups.
        return true
    }

    const todaySchedule = schedule.schedule?.[currentDay]
    if (!todaySchedule) return false // If no schedule for today, closed.

    const lunch = todaySchedule.lunch
    const dinner = todaySchedule.dinner

    const isTimeInRange = (time: string, start?: string, end?: string) => {
        if (!start || !end) return false
        return time >= start && time <= end
    }

    const lunchOpen = lunch?.enabled && isTimeInRange(currentTimeStr, lunch.start, lunch.end)
    const dinnerOpen = dinner?.enabled && isTimeInRange(currentTimeStr, dinner.start, dinner.end)

    return Boolean(lunchOpen || dinnerOpen)
}
