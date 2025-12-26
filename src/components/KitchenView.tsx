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

    onCompleteDish: (orderId: string, itemId: string) => void
    onCompleteOrder: (orderId: string) => void
    sessions: TableSession[]
    zoom?: number
}

export function KitchenView({ orders, tables, dishes, selectedCategoryIds = [], viewMode, onCompleteDish, onCompleteOrder, sessions, zoom = 1 }: KitchenViewProps) {
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
                if (table) return `${table.number}`
            }
        }
        // Fallback if tableId is provided directly (legacy)
        if (tableId) {
            const table = tables.find(t => t.id === tableId)
            if (table) return `${table.number}`
        }

        return '?'
    }

    const formatTime = (minutes: number) => {
        const mins = Math.max(0, Math.floor(minutes))
        if (mins >= 60) {
            const hours = Math.floor(mins / 60)
            const remainingMins = mins % 60
            return `${hours}h ${remainingMins}'`
        }
        return `${mins}'`
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
        <div
            className="h-[calc(100vh-180px)] w-full overflow-hidden bg-background relative"
        >
            <div
                className="w-full h-full overflow-y-auto px-2 pb-20 origin-top-left transition-all duration-200"
                style={{
                    zoom: zoom // Try using native zoom property for better layout handling if supported, or fallback to transform
                }}
            >
                <div
                    className="grid gap-4 content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                >
                    {viewMode === 'table' ? (() => {
                        // Group orders by table (via session)
                        const ordersByTable = new Map<string, { tableName: string, orders: Order[] }>()

                        activeOrders.forEach(order => {
                            const tableName = getTableName(undefined, order.table_session_id)
                            const tableKey = tableName

                            if (!ordersByTable.has(tableKey)) {
                                ordersByTable.set(tableKey, { tableName, orders: [] })
                            }
                            ordersByTable.get(tableKey)!.orders.push(order)
                        })

                        return Array.from(ordersByTable.values()).map(({ tableName, orders: tableOrders }) => {
                            // Collect all items from all orders for this table
                            const allItems = tableOrders.flatMap(order =>
                                (order.items?.filter(item => itemMatchesCategory(item)) || []).map(item => ({
                                    ...item,
                                    orderId: order.id,
                                    orderCreatedAt: order.created_at
                                }))
                            )

                            if (allItems.length === 0) return null

                            // Calculate time diff from oldest order
                            const oldestOrder = tableOrders.reduce((oldest, current) =>
                                new Date(current.created_at).getTime() < new Date(oldest.created_at).getTime() ? current : oldest
                            )
                            const timeDiff = (now.getTime() - new Date(oldestOrder.created_at).getTime()) / 1000 / 60

                            // Check if all items are completed
                            const allItemsDone = allItems.every(item => item.status === 'SERVED' || item.status === 'READY')

                            // Group items by course_number
                            const itemsByCourse: { [key: number]: typeof allItems } = {}
                            allItems.forEach(item => {
                                const courseNum = (item as any).course_number || 1
                                if (!itemsByCourse[courseNum]) itemsByCourse[courseNum] = []
                                itemsByCourse[courseNum].push(item)
                            })
                            const courseNumbers = Object.keys(itemsByCourse).map(Number).sort((a, b) => a - b)
                            const hasMultipleCourses = courseNumbers.length > 1

                            return (
                                <Card
                                    key={`table-${tableName}`}
                                    className="flex flex-col overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:shadow-[0_12px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] hover:scale-[1.01]"
                                >
                                    <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 border-b border-white/5">
                                        <div className="flex justify-between items-center w-full">
                                            <span className="text-4xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent drop-shadow-sm whitespace-nowrap">
                                                {tableName}
                                            </span>

                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-2xl bg-slate-800/80 border border-white/10 shadow-inner">
                                                    <Clock weight="fill" className="h-7 w-7 text-amber-400" />
                                                    <span className="text-white">{formatTime(timeDiff)}</span>
                                                </div>
                                                {tableOrders.length > 1 && (
                                                    <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                                                        {tableOrders.length} ordini
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="flex-1 p-4 flex flex-col gap-1">
                                        {courseNumbers.map((courseNum, courseIdx) => (
                                            <div key={courseNum}>
                                                {/* Items in this course */}
                                                {itemsByCourse[courseNum].map((item, idx) => {
                                                    const dish = getDish(item.dish_id)
                                                    const isItemDone = item.status === 'SERVED' || item.status === 'READY'

                                                    if (!dish) {
                                                        console.warn('Dish not found for order item:', item.dish_id, item)
                                                    }

                                                    return (
                                                        <div
                                                            key={`${item.id}-${idx}`}
                                                            className={cn(
                                                                "flex items-center justify-between p-3 rounded-xl border transition-all duration-300 mb-2 group",
                                                                isItemDone
                                                                    ? "opacity-40 bg-slate-800/30 border-transparent scale-[0.98]"
                                                                    : "bg-gradient-to-r from-slate-800/60 to-slate-700/40 border-white/5 hover:from-slate-700/70 hover:to-slate-600/50 hover:border-white/10 hover:shadow-lg hover:shadow-emerald-500/5"
                                                            )}
                                                        >
                                                            <div className="flex-1">
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className={cn(
                                                                        "text-4xl font-black transition-colors duration-300",
                                                                        isItemDone ? "text-slate-500" : "text-emerald-400 group-hover:text-emerald-300"
                                                                    )}>
                                                                        {item.quantity}
                                                                    </span>
                                                                    <span className={cn(
                                                                        "text-3xl font-bold leading-tight transition-colors duration-300",
                                                                        isItemDone ? "text-slate-500" : "text-white group-hover:text-slate-100"
                                                                    )}>
                                                                        {dish?.name || `Piatto non trovato (${item.dish_id.slice(0, 8)}...)`}
                                                                    </span>
                                                                </div>
                                                                {item.note && (
                                                                    <div className="mt-2 text-red-400 font-bold text-lg bg-red-950/50 inline-block px-3 py-1 rounded-lg border border-red-500/30 shadow-lg shadow-red-500/10">
                                                                        ⚠️ {item.note}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <Button
                                                                size="icon"
                                                                variant={isItemDone ? "ghost" : "default"}
                                                                className={cn(
                                                                    "h-14 w-14 rounded-full flex-shrink-0 ml-3 transition-all duration-300",
                                                                    isItemDone
                                                                        ? "text-slate-600 bg-transparent"
                                                                        : "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-110 active:scale-95"
                                                                )}
                                                                onClick={() => !isItemDone && onCompleteDish(item.orderId, item.id)}
                                                                disabled={isItemDone}
                                                            >
                                                                <Check weight="bold" className="h-8 w-8" />
                                                            </Button>
                                                        </div>
                                                    )
                                                })}

                                                {/* Elegant divider between courses */}
                                                {hasMultipleCourses && courseIdx < courseNumbers.length - 1 && (
                                                    <div className="my-4 flex items-center gap-3">
                                                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-500/50 to-transparent" />
                                                        <div className="flex gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500/50" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500/50" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500/50" />
                                                        </div>
                                                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-500/50 to-transparent" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Complete All Button */}
                                        {!allItemsDone && (
                                            <Button
                                                className="w-full mt-4 h-14 text-xl font-bold rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                                onClick={() => {
                                                    // Mark all items as served for all orders in this table
                                                    allItems.forEach(item => {
                                                        if (item.status !== 'SERVED' && item.status !== 'READY') {
                                                            onCompleteDish(item.orderId, item.id)
                                                        }
                                                    })
                                                }}
                                            >
                                                <Check weight="bold" className="h-7 w-7 mr-2" />
                                                Completa Tutto
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })
                    })() : (
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
                                                            {tableName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="font-bold text-2xl text-muted-foreground">
                                                            {formatTime(timeDiff)}
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
        </div>
    )
}
