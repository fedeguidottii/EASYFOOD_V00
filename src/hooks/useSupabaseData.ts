import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseData<T>(
    tableName: string,
    initialData: T[] = [],
    filter?: { column: string; value: string }
) {
    const [data, setData] = useState<T[]>(initialData)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        const fetchData = async () => {
            let query = supabase.from(tableName).select('*')
            if (filter) {
                query = query.eq(filter.column, filter.value)
            }

            const { data: result, error } = await query
            if (error) {
                console.error(`Error fetching ${tableName}:`, error)
                return
            }

            if (isMounted) {
                setData(result as T[])
                setLoading(false)
            }
        }

        fetchData()

        // Realtime subscription
        const channel = supabase
            .channel(`${tableName}_changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                    filter: filter ? `"${filter.column}"=eq.${filter.value}` : undefined
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setData((prev) => [...prev, payload.new as T])
                    } else if (payload.eventType === 'UPDATE') {
                        setData((prev) =>
                            prev.map((item: any) => (item.id === payload.new.id ? payload.new : item))
                        )
                    } else if (payload.eventType === 'DELETE') {
                        setData((prev) => prev.filter((item: any) => item.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            isMounted = false
            supabase.removeChannel(channel)
        }
    }, [tableName, filter?.column, filter?.value])

    return [data, loading] as const
}
