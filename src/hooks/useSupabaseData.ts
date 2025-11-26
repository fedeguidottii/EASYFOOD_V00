import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseData<T>(
    tableName: string,
    initialData: T[] = [],
    filter?: { column: string; value: string },
    mapper?: (item: any) => T
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
                const mappedData = mapper ? result.map(mapper) : result as T[]
                setData(mappedData)
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
                        const newItem = mapper ? mapper(payload.new) : payload.new as T
                        setData((prev) => [...prev, newItem])
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedItem = mapper ? mapper(payload.new) : payload.new as T
                        setData((prev) =>
                            prev.map((item: any) => (item.id === (payload.new as any).id ? updatedItem : item))
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
