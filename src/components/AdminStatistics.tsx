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

    if (loading) return (
        <div className="p-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-zinc-500 text-sm tracking-widest uppercase animate-pulse">Analisi dati in corso...</p>
        </div>
    )
    if (!stats) return <div className="p-12 text-center text-zinc-500">Nessun dato disponibile per il periodo selezionato.</div>

    return (
        <div className="space-y-8 relative z-10">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Panoramica <span className="text-amber-500">Globale</span></h2>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Real-time Performance Metrics</p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl hover:border-amber-500/20 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-amber-500/70 transition-colors">Fatturato Totale</CardTitle>
                        <Money className="h-5 w-5 text-amber-500/50" weight="duotone" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500 tracking-tight">€ {stats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] text-zinc-600 font-medium mt-1 uppercase tracking-wider">Totale incassato (completi)</p>
                    </CardContent>
                </Card>
                <Card className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl hover:border-amber-500/20 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-amber-500/70 transition-colors">Clienti Totali</CardTitle>
                        <Users className="h-5 w-5 text-amber-500/50" weight="duotone" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500 tracking-tight">{stats.totalCustomers}</div>
                        <p className="text-[10px] text-zinc-600 font-medium mt-1 uppercase tracking-wider">Sessioni tavolo completate</p>
                    </CardContent>
                </Card>
                <Card className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl hover:border-amber-500/20 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-amber-500/70 transition-colors">Ordini Totali</CardTitle>
                        <ShoppingCart className="h-5 w-5 text-amber-500/50" weight="duotone" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500 tracking-tight">{stats.totalOrders}</div>
                        <p className="text-[10px] text-zinc-600 font-medium mt-1 uppercase tracking-wider">Volume ordini totale</p>
                    </CardContent>
                </Card>
                <Card className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl hover:border-amber-500/20 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-amber-500/70 transition-colors">In Corso</CardTitle>
                        <Fire className="h-5 w-5 text-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]" weight="fill" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500 tracking-tight">{stats.activeOrders}</div>
                        <p className="text-[10px] text-zinc-600 font-medium mt-1 uppercase tracking-wider">Ordini attivi nei locali</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Rankings */}
                <Card className="col-span-1 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <ChartBar className="text-amber-500" />
                            Classifica Ristoranti
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {stats.revenueByRestaurant.map((item, index) => (
                                <div key={item.name} className="group">
                                    <div className="flex items-center mb-2">
                                        <div className="w-8 font-bold text-amber-500/40 text-sm">#{index + 1}</div>
                                        <div className="flex-1 flex items-center justify-between">
                                            <p className="text-sm font-bold text-zinc-100 group-hover:text-amber-500 transition-colors">{item.name}</p>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-amber-500">€ {item.revenue.toLocaleString()}</p>
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{item.orders} ordini</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all duration-1000"
                                            style={{ width: `${stats.totalRevenue > 0 ? (item.revenue / stats.totalRevenue) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Peak Hours */}
                <Card className="col-span-1 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
                            <Clock className="text-amber-500" /> Orari di Affluenza
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-end gap-1.5 mt-4 px-2">
                            {stats.peakHours.map((item) => {
                                const max = Math.max(...stats.peakHours.map(i => i.count))
                                const height = max > 0 ? (item.count / max) * 100 : 0
                                return (
                                    <div key={item.hour} className="flex-1 flex flex-col items-center group">
                                        <div
                                            className="w-full bg-amber-500/10 group-hover:bg-amber-500/40 transition-all rounded-t-lg relative border-t border-amber-500/0 group-hover:border-amber-500/50"
                                            style={{ height: `${height}%` }}
                                        >
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                {item.count} ORDINI
                                            </div>
                                        </div>
                                        <div className="text-[9px] font-bold text-zinc-600 mt-2">
                                            {item.hour.toString().padStart(2, '0')}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-center text-[10px] text-zinc-600 mt-6 uppercase tracking-[0.2em] font-bold">Distribuzione ordini (24h)</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
