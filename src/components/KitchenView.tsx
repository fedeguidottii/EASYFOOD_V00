import { useState, useEffect } from 'react'
import { Order, OrderItem, Table, Dish } from '../services/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Check, Clock, Fire } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'

interface KitchenViewProps {
    orders: Order[]
    tables: Table[]
    dishes: Dish[]
    onCompleteDish: (orderId: string, itemId: string) => void
    onCompleteOrder: (orderId: string) => void
}

export function KitchenView({ orders, tables, dishes, onCompleteDish, onCompleteOrder }: KitchenViewProps) {
    const [groupByDish, setGroupByDish] = useState(false)
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000 * 60) // Update every minute
        return () => clearInterval(interval)
    }, [])

    // Filter active orders (OPEN) and items that are not SERVED
    const activeOrders = orders.filter(o => o.status === 'OPEN' || o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')

    // Helper to get table name
    const getTableName = (tableId?: string) => {
        const table = tables.find(t => t.id === tableId)
        return table ? table.number : 'Unknown Table'
    }

    // Helper to get dish details
    const getDish = (dishId: string) => dishes.find(d => d.id === dishId)

    // Grouping Logic
    const renderContent = () => {
        if (groupByDish) {
            // Group by Dish ID
            const dishGroups: Record<string, { dish: Dish, items: { orderId: string, item: OrderItem, tableName: string, orderCreatedAt: string }[] }> = {}

            activeOrders.forEach(order => {
                order.items?.forEach(item => {
                    if (item.status !== 'SERVED') {
                        if (!dishGroups[item.dish_id]) {
                            const dish = getDish(item.dish_id)
                            if (dish) {
                                dishGroups[item.dish_id] = { dish, items: [] }
                            }
                        }
                        if (dishGroups[item.dish_id]) {
                            dishGroups[item.dish_id].items.push({
                                orderId: order.id,
                                item,
                                tableName: getTableName(order.table_id || (order as any).table_session?.table_id), // Fallback if table_id is missing on order
                                orderCreatedAt: order.created_at
                            })
                        }
                    }
                })
            })

            return (
                <div className="space-y-4">
                    {Object.values(dishGroups).map(group => (
                        <Card key={group.dish.id} className="w-full">
                            <CardHeader className="pb-2 bg-muted/20">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <Fire className="w-6 h-6 text-orange-500" />
                                        {group.dish.name}
                                        <Badge variant="secondary" className="ml-2 text-lg">
                                            x{group.items.reduce((acc, curr) => acc + curr.item.quantity, 0)}
                                        </Badge>
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="space-y-2">
                                    {group.items.map((entry, idx) => (
                                        <div key={`${entry.orderId}-${entry.item.id}-${idx}`} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <Badge variant="outline" className="text-base px-3 py-1">
                                                    {entry.tableName}
                                                </Badge>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {entry.item.quantity}x {group.dish.name}
                                                    </span>
                                                    {entry.item.note && (
                                                        <span className="text-sm text-muted-foreground italic">
                                                            Note: {entry.item.note}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDistanceToNow(new Date(entry.orderCreatedAt), { addSuffix: true, locale: it })}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => onCompleteDish(entry.orderId, entry.item.id)}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                <Check className="w-4 h-4 mr-1" />
                                                Pronto
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )
        } else {
            // Group by Table (Default)
            const tableGroups: Record<string, { tableName: string, items: { orderId: string, item: OrderItem, orderCreatedAt: string }[] }> = {}

            activeOrders.forEach(order => {
                const table = tables.find(t => t.current_session_id === order.table_session_id)
                    || tables.find(t => t.id === (order as any).table_id)

                const tableId = table?.id || 'unknown'
                const tableName = table?.number || 'Tavolo ?'

                if (!tableGroups[tableId]) {
                    tableGroups[tableId] = { tableName, items: [] }
                }

                order.items?.forEach(item => {
                    if (item.status !== 'SERVED') {
                        tableGroups[tableId].items.push({
                            orderId: order.id,
                            item,
                            orderCreatedAt: order.created_at
                        })
                    }
                })
            })

            return (
                <div className="space-y-6">
                    {Object.entries(tableGroups).map(([tableId, group]) => (
                        <div key={tableId} className="space-y-2">
                            <h3 className="text-lg font-bold text-primary flex items-center gap-2 border-b pb-2">
                                {group.tableName}
                                <Badge variant="outline" className="ml-auto">
                                    {group.items.length} Piatti in attesa
                                </Badge>
                            </h3>
                            <div className="space-y-2">
                                {group.items.map((entry, idx) => {
                                    const dish = getDish(entry.item.dish_id)
                                    if (!dish) return null

                                    return (
                                        <div key={`${entry.orderId}-${entry.item.id}-${idx}`} className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-lg">
                                                        {entry.item.quantity}x {dish.name}
                                                    </span>
                                                    {entry.item.note && (
                                                        <span className="text-red-500 font-medium italic flex items-center gap-1">
                                                            ⚠️ {entry.item.note}
                                                        </span>
                                                    )}
                                                    <span className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                        <Clock className="w-4 h-4" />
                                                        {formatDistanceToNow(new Date(entry.orderCreatedAt), { addSuffix: true, locale: it })}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                size="lg"
                                                onClick={() => onCompleteDish(entry.orderId, entry.item.id)}
                                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8"
                                            >
                                                PRONTO
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )
        }
    }

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">Cucina</h2>
                    <Badge variant="secondary" className="text-lg px-3">
                        {activeOrders.reduce((acc, o) => acc + (o.items?.filter(i => i.status !== 'SERVED').length || 0), 0)} Piatti in attesa
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="group-mode" className="font-medium">Raggruppa per Piatto</Label>
                    <Switch
                        id="group-mode"
                        checked={groupByDish}
                        onCheckedChange={setGroupByDish}
                    />
                </div>
            </div>

            {renderContent()}
        </div>
    )
}
