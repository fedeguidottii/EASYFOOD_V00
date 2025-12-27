import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatabaseService } from '../services/DatabaseService'
import { Order, TableSession } from '../services/types'
import { ChartBar, Money, ShoppingCart, Users, Clock, Fire } from '@phosphor-icons/react'

interface GlobalStats {
    totalRevenue: number
    totalOrders: number
    totalCustomers: number
    activeOrders: number
    revenueByRestaurant: { name: string; revenue: number; orders: number }[]
    peakHours: { hour: number; count: number }[]
}

export default function AdminStatistics() {
    const [stats, setStats] = useState<GlobalStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [allOrders, allSessions] = await Promise.all([
                    DatabaseService.getAllOrders(),
                    DatabaseService.getAllTableSessions()
                ])

                // 1. Basic Totals
                const totalRevenue = allOrders
                    .filter(o => o.status === 'PAID')
                    .reduce((sum, o) => sum + (o.total_amount || 0), 0)

                const totalOrders = allOrders.length
                const activeOrders = allOrders.filter(o => o.status === 'OPEN').length
                const totalCustomers = allSessions.length // Approximation based on sessions

                // 2. Rankings
                const restaurantMap = new Map<string, { name: string; revenue: number; orders: number }>()

                allOrders.forEach(order => {
                    const restaurantName = order.restaurant?.name || 'Sconosciuto'
                    const current = restaurantMap.get(restaurantName) || { name: restaurantName, revenue: 0, orders: 0 }

                    if (order.status === 'PAID') {
                        current.revenue += (order.total_amount || 0)
                    }
                    current.orders += 1
                    restaurantMap.set(restaurantName, current)
                })

                const revenueByRestaurant = Array.from(restaurantMap.values())
                    .sort((a, b) => b.revenue - a.revenue)

                // 3. Peak Hours
                const hoursMap = new Array(24).fill(0)
                allOrders.forEach(order => {
                    if (order.created_at) {
                        const hour = new Date(order.created_at).getHours()
                        hoursMap[hour]++
                    }
                })
                const peakHours = hoursMap.map((count, hour) => ({ hour, count }))

                setStats({
                    totalRevenue,
                    totalOrders,
                    totalCustomers,
                    activeOrders,
                    revenueByRestaurant,
                    peakHours
                })
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) return <div className="p-8 text-center">Caricamento statistiche...</div>
    if (!stats) return <div className="p-8 text-center">Nessun dato disponibile</div>

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Panoramica Globale</h2>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fatturato Totale</CardTitle>
                        <Money className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">€ {stats.totalRevenue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Totale incassato</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clienti Totali</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                        <p className="text-xs text-muted-foreground">Sessioni tavolo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ordini Totali</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalOrders}</div>
                        <p className="text-xs text-muted-foreground">Tutti gli ordini</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Corso</CardTitle>
                        <Fire className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeOrders}</div>
                        <p className="text-xs text-muted-foreground">Ordini aperti ora</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Rankings */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Classifica Ristoranti (Fatturato)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.revenueByRestaurant.map((item, index) => (
                                <div key={item.name} className="flex items-center">
                                    <div className="w-8 font-bold text-muted-foreground">#{index + 1}</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium leading-none">{item.name}</p>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">€ {item.revenue.toFixed(2)}</p>
                                                <p className="text-xs text-muted-foreground">{item.orders} ordini</p>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${stats.totalRevenue > 0 ? (item.revenue / stats.totalRevenue) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Peak Hours */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock /> Orari di Affluenza
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-end gap-1">
                            {stats.peakHours.map((item) => {
                                const max = Math.max(...stats.peakHours.map(i => i.count))
                                const height = max > 0 ? (item.count / max) * 100 : 0
                                return (
                                    <div key={item.hour} className="flex-1 flex flex-col items-center group">
                                        <div
                                            className="w-full bg-primary/20 group-hover:bg-primary transition-all rounded-t-sm relative"
                                            style={{ height: `${height}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-md">
                                                {item.count} ordini
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-1 rotate-0">
                                            {item.hour}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-center text-xs text-muted-foreground mt-4">Distribuzione ordini per ora del giorno (0-23)</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
