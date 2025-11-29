import { useState, useEffect } from 'react'
import { Order, OrderItem, Table, Dish } from '../services/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Check, Clock } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'

interface KitchenViewProps {
    orders: Order[]
    tables: Table[]
    dishes: Dish[]
    onCompleteDish: (orderId: string, itemId: string) => void
    onCompleteOrder: (orderId: string) => void
}

export function KitchenView({ orders, tables, dishes, onCompleteDish }: KitchenViewProps) {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000 * 60)
        return () => clearInterval(interval)
    }, [])

    const activeOrders = orders.filter(o => o.status === 'OPEN' || o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')

    const getTableName = (tableId?: string) => {
        const table = tables.find(t => t.id === tableId)
        return table ? table.number : 'Unknown Table'
    }

    const getDish = (dishId: string) => dishes.find(d => d.id === dishId)

    const allItems: { orderId: string, item: OrderItem, tableName: string, orderCreatedAt: string }[] = []

    activeOrders.forEach(order => {
        const table = tables.find(t => t.current_session_id === order.table_session_id)
            || tables.find(t => t.id === (order as any).table_id)

        const tableName = table ? table.number : 'Tavolo ?'

        order.items?.forEach(item => {
            if (item.status !== 'SERVED') {
                allItems.push({
                    orderId: order.id,
                    item,
                    tableName,
                    orderCreatedAt: order.created_at
                })
            }
        })
    })

    const sortedItems = allItems.sort((a, b) => new Date(a.orderCreatedAt).getTime() - new Date(b.orderCreatedAt).getTime())

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">Cucina</h2>
                    <Badge variant="secondary" className="text-lg px-3">
                        {sortedItems.length} Piatti in attesa
                    </Badge>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedItems.map((entry, idx) => {
                    const dish = getDish(entry.item.dish_id)
                    if (!dish) return null

                    return (
                        <Card key={`${entry.orderId}-${entry.item.id}-${idx}`} className="overflow-hidden border-2 hover:border-primary/50 transition-all shadow-sm">
                            <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="text-base font-semibold px-3 py-1 bg-background">
                                            {entry.tableName}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                            <Clock weight="fill" />
                                            {formatDistanceToNow(new Date(entry.orderCreatedAt), { addSuffix: true, locale: it })}
                                        </div>
                                    </div>

                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-2xl font-bold text-primary">{entry.item.quantity}x</span>
                                        <h3 className="text-xl font-bold leading-tight">{dish.name}</h3>
                                    </div>

                                    {entry.item.note && (
                                        <div className="mt-3 bg-red-50 text-red-600 border border-red-100 p-2 rounded-md text-sm font-medium italic">
                                            ⚠️ {entry.item.note}
                                        </div>
                                    )}
                                </div>

                                <Button
                                    size="lg"
                                    className="w-full font-bold text-lg h-12 bg-green-600 hover:bg-green-700 text-white shadow-md mt-auto"
                                    onClick={() => onCompleteDish(entry.orderId, entry.item.id)}
                                >
                                    <Check weight="bold" className="mr-2 h-5 w-5" />
                                    COMPLETA
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
