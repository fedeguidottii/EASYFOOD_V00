import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatabaseService } from '../services/DatabaseService'
import { Order, TableSession, Restaurant } from '../services/types'
import { ChartBar, Money, ShoppingCart, Users, Clock, Fire, Calendar, TrendUp, Storefront, Eye, Funnel } from '@phosphor-icons/react'
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, eachDayOfInterval, isSameDay, subDays } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { it } from 'date-fns/locale'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface AdminStatisticsProps {
    onImpersonate?: (restaurantId: string) => void
}

interface GlobalStats {
    totalRevenue: number
    totalOrders: number
    totalCustomers: number
    activeOrders: number
    totalRestaurants: number
    activeSessions: number
    revenueByRestaurant: { id: string; name: string; revenue: number; orders: number }[]
    peakHours: { hour: number; count: number }[]
    growthData: { date: string; restaurants: number; orders: number }[]
}

export default function AdminStatistics({ onImpersonate }: AdminStatisticsProps) {
    const [stats, setStats] = useState<GlobalStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true)
                const [allOrders, allSessions, allRestaurants] = await Promise.all([
                    DatabaseService.getAllOrders(),
                    DatabaseService.getAllTableSessions(),
                    DatabaseService.getRestaurants()
                ])

                const start = startOfDay(parseISO(startDate))
                const end = endOfDay(parseISO(endDate))

                // 1. Filtered Data
                const filteredOrders = allOrders.filter(o => {
                    if (!o.created_at) return false
                    try {
                        const date = parseISO(o.created_at)
                        return isWithinInterval(date, { start, end })
                    } catch { return false }
                })

                const filteredSessions = allSessions.filter(s => {
                    const dateStr = s.created_at || s.opened_at
                    if (!dateStr) return false
                    try {
                        const date = parseISO(dateStr)
                        return isWithinInterval(date, { start, end })
                    } catch { return false }
                })

                // 2. Calculations
                const totalRevenue = filteredOrders
                    .filter(o => o.status === 'PAID')
                    .reduce((sum, o) => sum + (o.total_amount || 0), 0)

                const totalOrders = filteredOrders.length
                const activeOrders = filteredOrders.filter(o => o.status === 'OPEN').length
                const totalCustomers = filteredSessions.length
                const totalRestaurants = allRestaurants.length
                const activeSessions = allSessions.filter(s => s.status === 'OPEN').length

                // 3. Rankings (with IDs for impersonation)
                const restaurantMap = new Map<string, { id: string; name: string; revenue: number; orders: number }>()

                filteredOrders.forEach(order => {
                    const restaurantId = order.restaurant_id
                    const restaurantName = order.restaurant?.name || 'Sconosciuto'
                    const current = restaurantMap.get(restaurantId) || { id: restaurantId, name: restaurantName, revenue: 0, orders: 0 }

                    if (order.status === 'PAID') {
                        current.revenue += (order.total_amount || 0)
                    }
                    current.orders += 1
                    restaurantMap.set(restaurantId, current)
                })

                const revenueByRestaurant = Array.from(restaurantMap.values())
                    .sort((a, b) => b.revenue - a.revenue)

                // 4. Peak Hours
                const hoursMap = new Array(24).fill(0)
                filteredOrders.forEach(order => {
                    if (order.created_at) {
                        try {
                            const hour = new Date(order.created_at).getHours()
                            hoursMap[hour]++
                        } catch { }
                    }
                })
                const peakHours = hoursMap.map((count, hour) => ({ hour, count }))

                // 5. Growth Tracking
                const days = eachDayOfInterval({ start, end })
                const growthData = days.map(day => {
                    const cumulativeRes = allRestaurants.filter(r => r.created_at && parseISO(r.created_at) <= endOfDay(day)).length
                    const dailyOrders = filteredOrders.filter(o => o.created_at && isSameDay(parseISO(o.created_at), day)).length
                    return {
                        date: format(day, 'dd MMM', { locale: it }),
                        restaurants: cumulativeRes,
                        orders: dailyOrders
                    }
                })

                setStats({
                    totalRevenue,
                    totalOrders,
                    totalCustomers,
                    activeOrders,
                    totalRestaurants,
                    activeSessions,
                    revenueByRestaurant,
                    peakHours,
                    growthData
                })
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [startDate, endDate])

    if (loading) return (
        <div className="p-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-zinc-500 text-sm tracking-widest uppercase animate-pulse">Analisi dati in corso...</p>
        </div>
    )

    if (!stats) return <div className="p-12 text-center text-zinc-500">Nessun dato disponibile.</div>

    return (
        <div className="space-y-8 relative z-10 pb-20">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-zinc-900/40 p-6 rounded-2xl border border-white/5 backdrop-blur-xl shadow-2xl">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <ChartBar className="text-amber-500" size={28} />
                        Panoramica Analytics
                    </h2>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Global Platform Performance</p>
                </div>

                <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 px-3">
                        <Calendar className="text-zinc-500" size={18} />
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Intervallo:</span>
                    </div>
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-white text-sm w-36 h-9 focus-visible:ring-0"
                    />
                    <div className="w-4 h-px bg-zinc-700" />
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-white text-sm w-36 h-9 focus-visible:ring-0"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-amber-500 hover:bg-amber-500/10">
                        <Funnel size={18} />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <KPICard title="Revenue Totale" value={`€ ${stats.totalRevenue.toLocaleString()}`} subtitle="Incasso periodo" icon={<Money size={24} />} color="amber" />
                <KPICard title="Partner Attivi" value={stats.totalRestaurants.toString()} subtitle="Ristoranti registrati" icon={<Storefront size={24} />} color="amber" />
                <KPICard title="Volume Ordini" value={stats.totalOrders.toString()} subtitle={`Media ${Math.round(stats.totalOrders / (stats.growthData.length || 1))} / giorno`} icon={<ShoppingCart size={24} />} color="amber" />
                <KPICard title="Sessioni Live" value={stats.activeSessions.toString()} subtitle="Tavoli attivi ora" icon={<Fire size={24} weight="fill" />} color="orange" isLive />
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Growth Chart */}
                <Card className="bg-zinc-900/40 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendUp className="text-amber-500" />
                                Crescita Piattaforma
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 text-amber-500">CUMULATIVO</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.growthData}>
                                <defs>
                                    <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                                    itemStyle={{ color: '#f59e0b' }}
                                />
                                <Area type="monotone" dataKey="restaurants" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRes)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Order Volume Chart */}
                <Card className="bg-zinc-900/40 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="text-blue-500" />
                                Volume Ordini Giornalieri
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold border-blue-500/30 text-blue-500">GIORNALIERO</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.growthData}>
                                <defs>
                                    <linearGradient id="colorOrd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                                    itemStyle={{ color: '#3b82f6' }}
                                />
                                <Area type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOrd)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Rankings */}
                <Card className="col-span-2 bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
                    <CardHeader className="border-b border-white/5 pb-6">
                        <CardTitle className="text-xl font-bold text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl">
                                    <ChartBar className="text-amber-500" size={20} />
                                </div>
                                Performance Partner
                            </div>
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">TOP RANKING</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {stats.revenueByRestaurant.slice(0, 10).map((item, index) => (
                                <div key={item.id} className="group relative">
                                    <div className="flex items-center mb-3">
                                        <div className="w-10 font-bold text-amber-500/20 text-lg italic">#{index + 1}</div>
                                        <div className="flex-1 flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-base font-bold text-zinc-100 group-hover:text-amber-500 transition-colors uppercase tracking-tight">{item.name}</p>
                                                    {onImpersonate && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-amber-500/10 text-amber-500 rounded-lg"
                                                            onClick={() => onImpersonate(item.id)}
                                                        >
                                                            <Eye size={16} />
                                                        </Button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">{item.orders} ORDINI COMPLETATI</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-black text-amber-500 tabular-nums">€ {item.revenue.toLocaleString('it-IT')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all duration-1000 ease-out"
                                            style={{ width: `${stats.totalRevenue > 0 ? (item.revenue / stats.totalRevenue) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Peak Hours Breakdown */}
                <Card className="col-span-1 bg-zinc-900/40 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-lg font-bold text-white">
                            <Clock className="text-amber-500" /> Distribuzione Oraria
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 mt-4">
                            {stats.peakHours.filter(h => h.count > 0 || [12, 13, 20, 21].includes(h.hour)).map((item) => {
                                const max = Math.max(...stats.peakHours.map(i => i.count)) || 1
                                return (
                                    <div key={item.hour} className="flex items-center gap-4">
                                        <span className="w-12 text-xs font-bold text-zinc-500 tabular-nums">{item.hour}:00</span>
                                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${item.count / max > 0.8 ? 'bg-amber-500' : 'bg-zinc-700'}`}
                                                style={{ width: `${(item.count / max) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-zinc-400 w-6 text-right">{item.count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function KPICard({ title, value, subtitle, icon, color, isLive }: { title: string, value: string, subtitle: string, icon: any, color: string, isLive?: boolean }) {
    const colorClass = color === 'amber' ? 'text-amber-500' : 'text-orange-500'
    const shadowClass = color === 'amber' ? 'shadow-amber-500/20' : 'shadow-orange-500/20'

    return (
        <Card className="bg-zinc-900/50 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] hover:border-amber-500/20 transition-all group overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl bg-${color}-500/10 ${colorClass}`}>
                        {icon}
                    </div>
                    {isLive && (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">LIVE</span>
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-300 transition-colors">{title}</h3>
                    <div className={`text-3xl font-black mt-1 ${colorClass} tracking-tight tabular-nums`}>{value}</div>
                    <p className="text-[10px] text-zinc-400 font-bold mt-2 uppercase tracking-widest flex items-center gap-1">
                        {subtitle}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}


