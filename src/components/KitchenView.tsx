import { useState, useEffect, useMemo } from 'react'
import { Order, OrderItem, Table, Dish } from '../services/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Clock, Minus, Plus, Archive, X } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface KitchenViewProps {
    orders: Order[]
    tables: Table[]
    dishes: Dish[]
    onCompleteDish: (orderId: string, itemId: string) => void
    onCompleteOrder: (orderId: string) => void
}

export function KitchenView({ orders, tables, dishes, onCompleteDish, onCompleteOrder }: KitchenViewProps) {
    const [now, setNow] = useState(new Date())
    const [columns, setColumns] = useState(3) // Default 3 columns

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000 * 60)
        return () => clearInterval(interval)
    }, [])

    // Filter active orders (OPEN, pending, preparing, ready)
    // We KEEP 'ready' orders visible until they are manually archived (which might mean setting them to SERVED or CLOSED)
    // The user wants "Stop Reordering", so we sort strictly by time.
    const activeOrders = useMemo(() => {
        return orders
            .filter(o => ['OPEN', 'pending', 'preparing', 'ready'].includes(o.status))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }, [orders])

    const getTableName = (tableId?: string, sessionId?: string) => {
        // Try to find by session first
        const tableBySession = tables.find(t => t.current_session_id === sessionId)
        if (tableBySession) return tableBySession.number

        // Fallback to table_id if available (though type says table_session_id is the link)
        // Some legacy data might have table_id directly on order? The type definition usually has table_session_id.
        // We'll stick to finding the table that has this session.
        return tableBySession ? tableBySession.number : '?'
    }

    const getDish = (dishId: string) => dishes.find(d => d.id === dishId)

    const handleZoomIn = () => setColumns(prev => Math.max(1, prev - 1))
    const handleZoomOut = () => setColumns(prev => Math.min(5, prev + 1))

    // Helper to check if all items in an order are completed (SERVED or ready)
    // Actually, we are using local state for visual completion if we want to avoid re-renders moving things?
    // No, the user said "Stop Reordering". If we change status to 'ready', and we sort by 'created_at', it won't move.
    // So we can rely on the real status.
    const isOrderComplete = (order: Order) => {
        return order.items?.every(item => item.status === 'SERVED' || item.status === 'ready')
    }

    return (
        <div className="p-4 h-screen flex flex-col bg-background">
            {/* Header / Controls */}
            <div className="flex items-center justify-between mb-6 bg-muted/20 p-4 rounded-xl border">
                <div className="flex items-center gap-6">
                    <h2 className="text-3xl font-black tracking-tight">CUCINA (KDS)</h2>
                    <Badge variant="secondary" className="text-xl px-4 py-1">
                        {activeOrders.length} Comande
                    </Badge>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Zoom</span>
                    <div className="flex items-center gap-2 bg-card border rounded-lg p-1 shadow-sm">
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-12 w-12 rounded-md hover:bg-muted">
                            <Minus weight="bold" className="h-6 w-6" />
                        </Button>
                        <span className="w-8 text-center font-bold text-lg">{columns}</span>
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-12 w-12 rounded-md hover:bg-muted">
                            <Plus weight="bold" className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div
                className="grid gap-4 overflow-y-auto pb-20"
                style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
                }}
            >
                {activeOrders.map(order => {
                    const tableName = getTableName(undefined, order.table_session_id)
                    const timeDiff = (now.getTime() - new Date(order.created_at).getTime()) / 1000 / 60
                    const isLate = timeDiff > 20
                    const isNew = timeDiff < 5
                    const allDone = isOrderComplete(order)

                    return (
                        <Card
                            key={order.id}
                            className={cn(
                                "flex flex-col shadow-md border-2 transition-colors duration-300",
                                isLate && !allDone ? "border-red-500 bg-red-50/10" : "border-border",
                                isNew && !allDone ? "border-yellow-400 bg-yellow-50/10" : "",
                                allDone ? "border-green-500/50 bg-green-50/20 opacity-90" : ""
                            )}
                        >
                            {/* Card Header */}
                            <CardHeader className={cn(
                                "pb-2 border-b",
                                isLate && !allDone ? "bg-red-100/50 dark:bg-red-900/20" : "",
                                isNew && !allDone ? "bg-yellow-100/50 dark:bg-yellow-900/20" : "",
                                allDone ? "bg-green-100/50 dark:bg-green-900/20" : "bg-muted/30"
                            )}>
                                <div className="flex justify-between items-center w-full">
                                    <span className="text-4xl font-black text-foreground">
                                        {tableName}
                                    </span>

                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl font-bold text-muted-foreground">
                                            x{order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0)}
                                        </span>
                                        <div className={cn(
                                            "flex items-center gap-1 px-3 py-1 rounded-md font-bold text-xl",
                                            isLate ? "text-red-600 bg-red-100" : "text-muted-foreground bg-background/50"
                                        )}>
                                            <Clock weight="fill" className="h-5 w-5" />
                                            {Math.floor(timeDiff)}'
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            {/* Card Body */}
                            <CardContent className="flex-1 p-4 flex flex-col gap-3">
                                <div className="space-y-3 flex-1">
                                    {order.items?.map((item, idx) => {
                                        const dish = getDish(item.dish_id)
                                        const isItemDone = item.status === 'SERVED' || item.status === 'ready'

                                        return (
                                            <div
                                                key={`${item.id}-${idx}`}
                                                className={cn(
                                                    "flex items-start gap-3 p-2 rounded-lg transition-all cursor-pointer select-none",
                                                    isItemDone
                                                        ? "bg-muted/50 text-muted-foreground decoration-slate-400"
                                                        : "bg-card hover:bg-accent/50",
                                                )}
                                                onClick={() => onCompleteDish(order.id, item.id)}
                                            >
                                                <div className={cn(
                                                    "h-8 w-8 flex items-center justify-center rounded-full border-2 shrink-0 mt-0.5",
                                                    isItemDone
                                                        ? "border-green-500 bg-green-500 text-white"
                                                        : "border-muted-foreground/30"
                                                )}>
                                                    {isItemDone && <Check weight="bold" className="h-5 w-5" />}
                                                </div>

                                                <div className="flex-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={cn(
                                                            "text-2xl font-black",
                                                            isItemDone ? "text-muted-foreground/70" : "text-primary"
                                                        )}>
                                                            {item.quantity}
                                                        </span>
                                                        <span className={cn(
                                                            "text-xl font-bold leading-tight",
                                                            isItemDone ? "line-through opacity-70" : ""
                                                        )}>
                                                            {dish?.name || '???'}
                                                        </span>
                                                    </div>
                                                    {item.note && (
                                                        <div className="mt-1 text-red-600 font-bold text-lg bg-red-50 inline-block px-2 rounded">
                                                            NOTE: {item.note}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Archive Button (Only visible if all done) */}
                                {allDone && (
                                    <Button
                                        className="w-full h-14 text-xl font-bold bg-slate-800 hover:bg-slate-900 text-white mt-4 animate-in fade-in zoom-in duration-300"
                                        onClick={() => onCompleteOrder(order.id)}
                                    >
                                        <Archive className="mr-3 h-6 w-6" />
                                        ARCHIVIA
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
