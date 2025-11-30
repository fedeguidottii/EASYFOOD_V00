import { useState, useEffect, useMemo } from 'react'
import { Order, OrderItem, Table, Dish } from '../services/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Check, Clock, Minus, Plus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

import { TableSession } from '../services/types'

interface KitchenViewProps {
    orders: Order[]
    tables: Table[]
    dishes: Dish[]
    selectedCategoryIds?: string[]
    viewMode: 'table' | 'dish'
    columns: number
    onCompleteDish: (orderId: string, itemId: string) => void
    onCompleteOrder: (orderId: string) => void
    sessions: TableSession[]
}

export function KitchenView({ orders, tables, dishes, selectedCategoryIds = [], viewMode, columns, onCompleteDish, onCompleteOrder, sessions }: KitchenViewProps) {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000 * 60)
        return () => clearInterval(interval)
    }, [])

    const getTableName = (tableId?: string, sessionId?: string) => {
        // Try to find session
        if (sessionId) {
            const session = sessions.find(s => s.id === sessionId)
            if (session) {
                const table = tables.find(t => t.id === session.table_id)
                if (table) return `Tavolo ${table.number}`
            }
        }
        // Fallback if tableId is provided directly (legacy)
        if (tableId) {
            const table = tables.find(t => t.id === tableId)
            if (table) return `Tavolo ${table.number}`
        }

        return 'Tavolo ?'
    }

    const getDish = (dishId: string) => dishes.find(d => d.id === dishId)

    const isOrderComplete = (order: Order) => {
        return order.items?.every(item => item.status === 'SERVED' || item.status === 'READY')
    }

    const itemMatchesCategory = (item: OrderItem) => {
        if (!selectedCategoryIds || selectedCategoryIds.length === 0) return true
        const dish = getDish(item.dish_id)
        return dish && selectedCategoryIds.includes(dish.category_id)
    }

    const activeOrders = useMemo(() => {
        return orders
            .filter(o => ['OPEN', 'pending', 'preparing', 'ready'].includes(o.status))
            .filter(o => !isOrderComplete(o))
            .filter(o => {
                if (!selectedCategoryIds || selectedCategoryIds.length === 0) return true
                return o.items?.some(item => itemMatchesCategory(item))
            })
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }, [orders, selectedCategoryIds, dishes])

    const dishesViewData = useMemo(() => {
        const dishMap = new Map<string, { dish: Dish | undefined, items: { order: Order, item: OrderItem }[] }>()

        activeOrders.forEach(order => {
            order.items?.forEach(item => {
                if (itemMatchesCategory(item)) {
                    const existing = dishMap.get(item.dish_id) || { dish: getDish(item.dish_id), items: [] }
                    existing.items.push({ order, item })
                    dishMap.set(item.dish_id, existing)
                }
            })
        })

        return Array.from(dishMap.values())
    }, [activeOrders, dishes, selectedCategoryIds])

    return (
        <div className="p-2 h-screen flex flex-col bg-background">
            <div className="flex items-center justify-between mb-4 bg-muted/20 p-2 rounded-lg border hidden">
                {/* Controls moved to parent */}
            </div>

            <div
                className="grid gap-4 overflow-y-auto pb-20 content-start"
                style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
                }}
            >
                {viewMode === 'table' ? (
                    activeOrders.map(order => {
                        const tableName = getTableName(undefined, order.table_session_id)
                        const timeDiff = (now.getTime() - new Date(order.created_at).getTime()) / 1000 / 60

                        const visibleItems = order.items?.filter(item => itemMatchesCategory(item)) || []
                        if (visibleItems.length === 0) return null

                        return (
                            <Card
                                key={order.id}
                                className="flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-cyan-500/30 bg-slate-900/90 overflow-hidden"
                            >
                                <CardHeader className="pb-2 border-b border-cyan-500/30 bg-cyan-500/5 p-3">
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-4xl font-black text-foreground">
                                            {tableName.replace('Tavolo ', '')}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 px-2 py-1 rounded-md font-bold text-3xl bg-background border">
                                                <Clock weight="fill" className="h-8 w-8 text-muted-foreground" />
                                                {Math.floor(timeDiff)}'
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 p-3 flex flex-col gap-2">
                                    {visibleItems.map((item, idx) => {
                                        const dish = getDish(item.dish_id)
                                        const isItemDone = item.status === 'SERVED' || item.status === 'READY'

                                        return (
                                            <div
                                                key={`${item.id}-${idx}`}
                                                className={cn(
                                                    "flex items-center justify-between p-2 rounded-md border transition-all",
                                                    isItemDone
                                                        ? "opacity-30 bg-muted border-transparent"
                                                        : "bg-card border-transparent hover:bg-accent hover:border-border"
                                                )}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-4xl font-black text-primary">
                                                            {item.quantity}
                                                        </span>
                                                        <span className="text-3xl font-bold leading-tight text-foreground">
                                                            {dish?.name || '???'}
                                                        </span>
                                                    </div>
                                                    {item.note && (
                                                        <div className="mt-1 text-red-600 font-bold text-xl bg-red-50 inline-block px-2 rounded border border-red-200">
                                                            NOTE: {item.note}
                                                        </div>
                                                    )}
                                                </div>

                                                <Button
                                                    size="icon"
                                                    variant={isItemDone ? "ghost" : "default"}
                                                    className={cn(
                                                        "h-14 w-14 rounded-full flex-shrink-0 ml-2",
                                                        isItemDone ? "text-muted-foreground" : "bg-green-600 hover:bg-green-700 text-white shadow-md"
                                                    )}
                                                    onClick={() => !isItemDone && onCompleteDish(order.id, item.id)}
                                                    disabled={isItemDone}
                                                >
                                                    <Check weight="bold" className="h-8 w-8" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    dishesViewData.map((data, idx) => {
                        const allItemsDone = data.items.every(({ item }) => item.status === 'SERVED' || item.status === 'READY')
                        if (allItemsDone) return null

                        return (
                            <Card
                                key={`dish-view-${idx}`}
                                className="flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-cyan-500/30 bg-slate-900/90 overflow-hidden"
                            >
                                <CardHeader className="pb-2 border-b border-cyan-500/30 bg-cyan-500/5 p-3">
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-4xl font-black text-foreground leading-tight">
                                            {data.dish?.name}
                                        </span>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 p-3 flex flex-col gap-2">
                                    {data.items.map(({ order, item }, itemIdx) => {
                                        const tableName = getTableName(undefined, order.table_session_id)
                                        const timeDiff = (now.getTime() - new Date(order.created_at).getTime()) / 1000 / 60
                                        const isItemDone = item.status === 'SERVED' || item.status === 'READY'

                                        return (
                                            <div
                                                key={`dv-${item.id}-${itemIdx}`}
                                                className={cn(
                                                    "flex items-center justify-between p-2 rounded-md border transition-all",
                                                    isItemDone
                                                        ? "opacity-30 bg-muted border-transparent"
                                                        : "bg-card border-transparent hover:bg-accent hover:border-border"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-4xl font-black text-primary">
                                                        {item.quantity}
                                                    </span>
                                                    <span className="text-3xl font-bold text-foreground">
                                                        {tableName.replace('Tavolo ', '')}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="font-bold text-2xl text-muted-foreground">
                                                        {Math.floor(timeDiff)}'
                                                    </div>
                                                    <Button
                                                        size="icon"
                                                        variant={isItemDone ? "ghost" : "default"}
                                                        className={cn(
                                                            "h-14 w-14 rounded-full flex-shrink-0",
                                                            isItemDone ? "text-muted-foreground" : "bg-green-600 hover:bg-green-700 text-white shadow-md"
                                                        )}
                                                        onClick={() => !isItemDone && onCompleteDish(order.id, item.id)}
                                                        disabled={isItemDone}
                                                    >
                                                        <Check weight="bold" className="h-8 w-8" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
