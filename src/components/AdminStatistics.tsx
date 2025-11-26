import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSupabaseData } from '../hooks/useSupabaseData'
import { Restaurant, Order, User } from '../services/types'
import { ChartBar, Money, ShoppingCart, Users } from '@phosphor-icons/react'

export default function AdminStatistics() {
    const [restaurants] = useSupabaseData<Restaurant>('restaurants', [])
    const [orders] = useSupabaseData<Order>('orders', [])
    const [users] = useSupabaseData<User>('users', [])

    // Calculate total revenue (mock calculation as orders might not have total field populated correctly in all cases yet)
    const totalRevenue = (orders || [])
        .filter(o => o.status === 'completed')
        .reduce((sum, order) => sum + (order.total || 0), 0)

    const totalOrders = (orders || []).length
    const completedOrders = (orders || []).filter(o => o.status === 'completed').length
    const activeRestaurants = (restaurants || []).filter(r => r.isActive).length

    // Group revenue by restaurant
    const revenueByRestaurant = (restaurants || []).map(restaurant => {
        const restaurantOrders = (orders || []).filter(o => o.restaurantId === restaurant.id && o.status === 'completed')
        const revenue = restaurantOrders.reduce((sum, order) => sum + (order.total || 0), 0)
        return {
            name: restaurant.name,
            revenue,
            ordersCount: restaurantOrders.length
        }
    }).sort((a, b) => b.revenue - a.revenue)

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Statistiche Piattaforma</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ricavi Totali</CardTitle>
                        <Money className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">€ {totalRevenue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Da tutti i ristoranti
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ordini Totali</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrders}</div>
                        <p className="text-xs text-muted-foreground">
                            {completedOrders} completati
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ristoranti Attivi</CardTitle>
                        <ChartBar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeRestaurants}</div>
                        <p className="text-xs text-muted-foreground">
                            Su {(restaurants || []).length} totali
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utenti Totali</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(users || []).length}</div>
                        <p className="text-xs text-muted-foreground">
                            Admin e Ristoratori
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Performance Ristoranti</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {revenueByRestaurant.map((item) => (
                                <div key={item.name} className="flex items-center">
                                    <div className="w-full space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium leading-none">{item.name}</p>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">€ {item.revenue.toFixed(2)}</p>
                                                <p className="text-xs text-muted-foreground">{item.ordersCount} ordini</p>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {revenueByRestaurant.length === 0 && (
                                <p className="text-center text-muted-foreground">Nessun dato disponibile</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
