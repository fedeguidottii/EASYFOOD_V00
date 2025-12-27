import { useState, useEffect, useMemo } from 'react'
import { Order, OrderItem, Table, Dish } from '../services/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Check, Clock, Info } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { TableSession } from '../services/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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
    const [selectedDishInfo, setSelectedDishInfo] = useState<{ dish: Dish | undefined, itemId?: string } | null>(null)

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000 * 60)
        return () => clearInterval(interval)
    }, [])

    const getTableName = (tableId?: string, sessionId?: string) => {
        if (sessionId) {
            const session = sessions.find(s => s.id === sessionId)
            if (session) {
                const table = tables.find(t => t.id === session.table_id)
                if (table) return `${table.number}`
            }
        }
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
        <div className="h-[calc(100vh-180px)] w-full overflow-hidden bg-background relative">
            <div
                className="w-full h-full overflow-y-auto px-2 origin-top-left transition-all duration-200"
                style={{
                    transform: `scale(${zoom})`,
                    width: `${100 / zoom}%`,
                    paddingBottom: `${100 / zoom}px` // Extra padding to prevent clipping
                }}
            >
                <div
                    className="grid gap-4 content-start pb-20"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
                >
                    {viewMode === 'table' ? (() => {
                        const ordersByTable = new Map<string, { tableName: string, orders: Order[] }>()

                        activeOrders.forEach(order => {
                            const tableName = getTableName(undefined, order.table_session_id)
                            const tableKey = tableName || 'unknown'

                            if (!ordersByTable.has(tableKey)) {
                                ordersByTable.set(tableKey, { tableName, orders: [] })
                            }
                            ordersByTable.get(tableKey)!.orders.push(order)
                        })

                        return Array.from(ordersByTable.values()).map(({ tableName, orders: tableOrders }) => {
                            const allItems = tableOrders.flatMap(order =>
                                (order.items?.filter(item => itemMatchesCategory(item)) || []).map(item => ({
                                    ...item,
                                    orderId: order.id,
                                    orderCreatedAt: order.created_at
                                }))
                            )

                            if (allItems.length === 0) return null

                            const oldestOrder = tableOrders.reduce((oldest, current) =>
                                new Date(current.created_at).getTime() < new Date(oldest.created_at).getTime() ? current : oldest
                            )
                            const timeDiff = (now.getTime() - new Date(oldestOrder.created_at).getTime()) / 1000 / 60
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
                                    className="flex flex-col rounded-2xl border-0 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl shadow-lg transition-all duration-300 hover:scale-[1.01] h-fit"
                                >
                                    <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 border-b border-white/5 shrink-0">
                                        <div className="flex justify-between items-center w-full">
                                            <span className="text-4xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent drop-shadow-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[60%]">
                                                {tableName}
                                            </span>

                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-2xl bg-slate-800/80 border border-white/10 shadow-inner">
                                                    <Clock weight="fill" className="h-7 w-7 text-amber-400" />
                                                    <span className="text-white">{formatTime(timeDiff)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="flex-1 p-4 flex flex-col gap-1">
                                        {courseNumbers.map((courseNum, courseIdx) => (
                                            <div key={courseNum}>
                                                {itemsByCourse[courseNum].map((item, idx) => {
                                                    const dish = getDish(item.dish_id)
                                                    const isItemDone = item.status === 'SERVED' || item.status === 'READY'
                                                    const dishName = dish?.name || `❓ Sconosciuto`

                                                    return (
                                                        <div
                                                            key={`${item.id}-${idx}`}
                                                            className={cn(
                                                                "flex items-center justify-between p-3 rounded-xl border transition-all duration-300 mb-2 group relative",
                                                                isItemDone
                                                                    ? "opacity-40 bg-slate-800/30 border-transparent scale-[0.98]"
                                                                    : "bg-gradient-to-r from-slate-800/60 to-slate-700/40 border-white/5 hover:from-slate-700/70 hover:to-slate-600/50 hover:border-white/10 hover:shadow-lg hover:shadow-emerald-500/5"
                                                            )}
                                                        >
                                                            <div
                                                                className="flex-1 cursor-pointer"
                                                                onClick={() => setSelectedDishInfo({ dish, itemId: item.id })}
                                                            >
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className={cn(
                                                                        "text-4xl font-black transition-colors duration-300 shrink-0",
                                                                        isItemDone ? "text-slate-500" : "text-emerald-400 group-hover:text-emerald-300"
                                                                    )}>
                                                                        {item.quantity}
                                                                    </span>
                                                                    <div className="flex flex-col">
                                                                        <span className={cn(
                                                                            "text-3xl font-bold leading-tight transition-colors duration-300 line-clamp-2",
                                                                            isItemDone ? "text-slate-500" : "text-white group-hover:text-slate-100"
                                                                        )}>
                                                                            {dishName}
                                                                        </span>
                                                                        {!dish && <span className="text-xs text-red-400">ID: {item.dish_id.slice(0, 8)}...</span>}
                                                                    </div>
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

                                                {hasMultipleCourses && courseIdx < courseNumbers.length - 1 && (
                                                    // Divider
                                                    <div className="my-4 flex items-center gap-3 opacity-60">
                                                        <div className="flex-1 h-px bg-slate-500/50" />
                                                        <span className="text-xs font-bold uppercase text-slate-500">Portata Succ.</span>
                                                        <div className="flex-1 h-px bg-slate-500/50" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Sticky Complete Button */}
                                        {!allItemsDone && (
                                            <div className="sticky bottom-0 mt-auto pt-2 pb-1 bg-slate-900/0 backdrop-blur-none z-10">
                                                <Button
                                                    className="w-full h-14 text-xl font-bold rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
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
                                            </div>
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
                                    className="flex flex-col shadow-lg border border-cyan-500/30 bg-slate-900/90 overflow-hidden h-fit"
                                >
                                    <CardHeader className="pb-2 border-b border-cyan-500/30 bg-cyan-500/5 p-3 shrink-0">
                                        <div
                                            className="flex justify-between items-center w-full cursor-pointer hover:opacity-80"
                                            onClick={() => setSelectedDishInfo({ dish: data.dish })}
                                        >
                                            <span className="text-3xl font-black text-foreground leading-tight line-clamp-2">
                                                {data.dish?.name || 'Piatto Sconosciuto'}
                                            </span>
                                            {!data.dish && <Info className="text-red-400" />}
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
                                                        <div className="font-bold text-2xl text-muted-foreground whitespace-nowrap">
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

            {/* Dish Info Dialog */}
            <Dialog open={!!selectedDishInfo} onOpenChange={(open) => !open && setSelectedDishInfo(null)}>
                <DialogContent className="bg-slate-900 text-white border-slate-700">
                    <DialogHeader>
                        <DialogTitle>{selectedDishInfo?.dish?.name || 'Dettagli Piatto Sconosciuto'}</DialogTitle>
                        <DialogDescription>
                            Info dettagliate
                        </DialogDescription>
                    </DialogHeader>
                    <div>
                        {selectedDishInfo?.dish ? (
                            <div className="space-y-4">
                                {selectedDishInfo.dish.image_url && (
                                    <img src={selectedDishInfo.dish.image_url} alt="Dish" className="w-full h-48 object-cover rounded-xl" />
                                )}
                                <p className="text-lg text-slate-300">{selectedDishInfo.dish.description || 'Nessuna descrizione.'}</p>
                                {selectedDishInfo.dish.allergens && selectedDishInfo.dish.allergens.length > 0 && (
                                    <div className="p-3 bg-red-950/30 rounded-lg border border-red-500/20">
                                        <p className="font-bold text-red-400">Allergeni:</p>
                                        <p className="text-red-200">{selectedDishInfo.dish.allergens.join(', ')}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-950/30 rounded-xl border border-yellow-500/20 text-yellow-200">
                                <p>⚠ Attenzione: Questo piatto non esiste più nel database (ID: {selectedDishInfo?.itemId || '?'})</p>
                                <p className="text-sm mt-2">Potrebbe essere stato eliminato dal menu.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
