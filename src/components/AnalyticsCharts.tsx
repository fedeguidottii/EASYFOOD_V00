import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from 'recharts'
import { TrendUp, CurrencyEur, Users, ShoppingBag, Clock, ChartLine, CalendarBlank, List, CaretDown, Star, Package, TrendDown, Minus } from '@phosphor-icons/react'
import type { Order, Dish, Category, OrderItem } from '../services/types'
import AIAnalyticsSection from './AIAnalyticsSection'

interface AnalyticsChartsProps {
  orders: Order[]
  completedOrders: Order[]
  dishes: Dish[]
  categories: Category[]
}

type DateFilter = 'today' | 'yesterday' | 'week' | '2weeks' | 'month' | '3months' | 'custom'
type InventoryPeriod = '1day' | '2days' | '7days' | '2weeks' | '1month' | '3months' | 'custom'

const dateFilters: { value: DateFilter, label: string }[] = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'week', label: 'Ultima Settimana' },
  { value: '2weeks', label: 'Ultime 2 Settimane' },
  { value: 'month', label: 'Ultimo Mese' },
  { value: '3months', label: 'Ultimi 3 Mesi' },
  { value: 'custom', label: 'Personalizzato' }
]

const inventoryPeriods: { value: InventoryPeriod, label: string, days: number }[] = [
  { value: '1day', label: '1 Giorno', days: 1 },
  { value: '2days', label: '2 Giorni', days: 2 },
  { value: '7days', label: '7 Giorni', days: 7 },
  { value: '2weeks', label: '2 Settimane', days: 14 },
  { value: '1month', label: '1 Mese', days: 30 },
  { value: '3months', label: '3 Mesi', days: 90 },
  { value: 'custom', label: 'Personalizzato', days: 0 }
]

const COLORS = ['#C9A152', '#8B7355', '#F4E6D1', '#E8C547', '#D4B366', '#A68B5B', '#F0D86F', '#C09853']

interface DailyData {
  date: string
  orders: number
  revenue: number
  averageValue: number
}

interface HourlyData {
  hour: string
  orders: number
  revenue: number
}

type FilteredOrder = Order & { filteredItems?: OrderItem[]; filteredAmount?: number }

export default function AnalyticsCharts({ orders, completedOrders, dishes, categories }: AnalyticsChartsProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('week')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'overview' | 'inventory'>('overview')

  // Inventory state
  const [inventoryPeriod, setInventoryPeriod] = useState<InventoryPeriod>('7days')
  const [inventoryCustomStart, setInventoryCustomStart] = useState('')
  const [inventoryCustomEnd, setInventoryCustomEnd] = useState('')
  const [inventoryCategories, setInventoryCategories] = useState<string[]>([])

  // Chart Toggles
  const [timeSeriesMetric, setTimeSeriesMetric] = useState<'orders' | 'revenue' | 'average'>('orders')
  const [categoryMetric, setCategoryMetric] = useState<'quantity' | 'revenue'>('revenue')

  // Update selected categories when categories change
  useEffect(() => {
    setSelectedCategories(categories.map(c => c.id))
    setInventoryCategories(categories.map(c => c.id))
  }, [categories])

  // Helper function to get date range
  const getDateRange = (filter: DateFilter) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    switch (filter) {
      case 'today':
        return { start: today.getTime(), end: now.getTime() }
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return { start: yesterday.getTime(), end: today.getTime() - 1 }
      case 'week':
        return { start: weekAgo.getTime(), end: now.getTime() }
      case '2weeks':
        const twoWeeksAgo = new Date(today)
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
        return { start: twoWeeksAgo.getTime(), end: now.getTime() }
      case 'month':
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return { start: monthAgo.getTime(), end: now.getTime() }
      case '3months':
        const threeMonthsAgo = new Date(today)
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        return { start: threeMonthsAgo.getTime(), end: now.getTime() }
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate)
          const endDate = new Date(customEndDate)
          endDate.setHours(23, 59, 59, 999)
          return { start: startDate.getTime(), end: endDate.getTime() }
        }
        return { start: weekAgo.getTime(), end: now.getTime() }
    }
  }

  // Helper function to get inventory date range
  const getInventoryDateRange = (period: InventoryPeriod) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (period === 'custom' && inventoryCustomStart && inventoryCustomEnd) {
      const startDate = new Date(inventoryCustomStart)
      const endDate = new Date(inventoryCustomEnd)
      endDate.setHours(23, 59, 59, 999)
      return { start: startDate.getTime(), end: endDate.getTime() }
    }

    const periodInfo = inventoryPeriods.find(p => p.value === period)
    const days = periodInfo?.days || 7
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - days)

    return { start: startDate.getTime(), end: now.getTime() }
  }

  const dateRange = getDateRange(dateFilter)
  const { start, end } = dateRange

  // Combine active and completed orders for comprehensive analytics
  const allOrders = useMemo(() => [...completedOrders, ...orders], [completedOrders, orders])

  const dateFilteredOrders = allOrders.filter(order => {
    const orderTime = new Date(order.created_at).getTime()
    return orderTime >= start && orderTime <= end
  })

  const activeCategoryIds = selectedCategories

  const categoryFilteredOrders: FilteredOrder[] = dateFilteredOrders.map(order => {
    const filteredItems = (order.items || []).filter((item: OrderItem) => {
      const dish = dishes.find(d => d.id === item.dish_id)
      return dish ? activeCategoryIds.includes(dish.category_id) : false
    })

    const filteredAmount = filteredItems.reduce((sum, item) => {
      const dish = dishes.find(d => d.id === item.dish_id)
      return sum + (dish?.price || 0) * item.quantity
    }, 0)

    return { ...order, filteredItems, filteredAmount }
  }).filter(order => (order.filteredItems || []).length > 0)

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalOrders = categoryFilteredOrders.length
    const totalRevenue = categoryFilteredOrders.reduce((sum, order) => sum + (order.filteredAmount || order.total_amount || 0), 0)
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const activeOrdersCount = orders.filter(order => order.status === 'OPEN').length

    // Daily data for charts
    const dailyData: DailyData[] = []
    const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)))

    const isSingleDay = days === 1 || dateFilter === 'today' || dateFilter === 'yesterday'

    for (let i = 0; i < days; i++) {
      const dayStart = start + (i * 24 * 60 * 60 * 1000)
      const dayEnd = dayStart + (24 * 60 * 60 * 1000)
      const dayOrders = categoryFilteredOrders.filter(order => {
        const orderTime = new Date(order.created_at).getTime()
        return orderTime >= dayStart && orderTime < dayEnd
      })

      const date = new Date(dayStart)
      const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.filteredAmount || order.total_amount || 0), 0)
      dailyData.push({
        date: isSingleDay ? 'Oggi' : date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
        orders: dayOrders.length,
        revenue: dayRevenue,
        averageValue: dayOrders.length > 0 ? dayRevenue / dayOrders.length : 0
      })
    }

    // Category analysis
    const categoryStats = categories
      .filter(category => activeCategoryIds.includes(category.id))
      .map(category => {
        const categoryOrders = categoryFilteredOrders.flatMap(order =>
          (order.filteredItems || []).filter(item => {
            const dish = dishes.find(d => d.id === item.dish_id)
            return dish?.category_id === category.id
          })
        )

        const totalQuantity = categoryOrders.reduce((sum, item) => sum + item.quantity, 0)
        const totalRevenue = categoryOrders.reduce((sum, item) => {
          const dish = dishes.find(d => d.id === item.dish_id)
          return sum + (dish?.price || 0) * item.quantity
        }, 0)

        return {
          name: category.name,
          quantity: totalQuantity,
          revenue: totalRevenue,
          percentage: totalOrders > 0 ? (categoryOrders.length / totalOrders) * 100 : 0
        }
      }).filter(cat => cat.quantity > 0)
      .sort((a, b) => categoryMetric === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity)

    // Most ordered dishes
    const dishStats = dishes
      .filter(dish => activeCategoryIds.includes(dish.category_id))
      .map(dish => {
        const dishOrders = categoryFilteredOrders.flatMap(order =>
          (order.filteredItems || []).filter(item => item.dish_id === dish.id)
        )

        const totalQuantity = dishOrders.reduce((sum, item) => sum + item.quantity, 0)
        const totalRevenue = totalQuantity * dish.price
        const category = categories.find(c => c.id === dish.category_id)

        return {
          name: dish.name,
          category: category?.name || 'Unknown',
          quantity: totalQuantity,
          revenue: totalRevenue
        }
      }).filter(dish => dish.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 50)

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      activeOrders: activeOrdersCount,
      dailyData,
      categoryStats,
      dishStats,
      isSingleDay
    }
  }, [categoryFilteredOrders, orders, categories, dishes, dateFilter, start, end, activeCategoryIds, categoryMetric])

  // Inventory (Magazzino) calculations
  const inventoryData = useMemo(() => {
    const { start: invStart, end: invEnd } = getInventoryDateRange(inventoryPeriod)
    const periodDays = Math.max(1, Math.ceil((invEnd - invStart) / (24 * 60 * 60 * 1000)))

    // Filter orders for inventory period
    const inventoryOrders = allOrders.filter(order => {
      const orderTime = new Date(order.created_at).getTime()
      return orderTime >= invStart && orderTime <= invEnd
    })

    // Calculate historical average (limit to last 2 years for relevance)
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000)
    const historicalOrders = allOrders.filter(order => {
      const orderTime = new Date(order.created_at).getTime()
      return orderTime >= twoYearsAgo
    })

    const historicalDays = historicalOrders.length > 0
      ? Math.max(1, Math.ceil((Date.now() - Math.max(twoYearsAgo, new Date(Math.min(...historicalOrders.map(o => new Date(o.created_at).getTime()))).getTime())) / (24 * 60 * 60 * 1000)))
      : 1

    // Calculate per-dish inventory stats - include ALL active dishes
    const dishInventory = dishes
      .filter(dish => dish.is_active !== false) // Include all active dishes
      .map(dish => {
        // Current period
        const periodSales = inventoryOrders.flatMap(order =>
          (order.items || []).filter(item => item.dish_id === dish.id)
        )
        const periodQuantity = periodSales.reduce((sum, item) => sum + item.quantity, 0)
        const periodAvgPerDay = periodQuantity / periodDays

        // Historical average (last 2 years)
        const historicalSales = historicalOrders.flatMap(order =>
          (order.items || []).filter(item => item.dish_id === dish.id)
        )
        const historicalQuantity = historicalSales.reduce((sum, item) => sum + item.quantity, 0)
        const historicalAvgPerDay = historicalQuantity / historicalDays

        // Calculate percentage change
        let percentageChange = 0
        if (historicalAvgPerDay > 0) {
          percentageChange = ((periodAvgPerDay - historicalAvgPerDay) / historicalAvgPerDay) * 100
        } else if (periodAvgPerDay > 0) {
          percentageChange = 100 // New dish with sales
        }

        const category = categories.find(c => c.id === dish.category_id)

        return {
          id: dish.id,
          name: dish.name,
          category: category?.name || 'Sconosciuta',
          categoryId: dish.category_id,
          periodQuantity,
          periodAvgPerDay: Math.round(periodAvgPerDay * 100) / 100,
          allTimeAvgPerDay: Math.round(historicalAvgPerDay * 100) / 100,
          percentageChange: Math.round(percentageChange * 10) / 10,
          price: dish.price
        }
      })
      .sort((a, b) => b.periodQuantity - a.periodQuantity)

    // Generate trend alerts for significant variations (>30% or <-30%)
    const trendAlerts = dishInventory
      .filter(dish => Math.abs(dish.percentageChange) >= 30 && dish.periodQuantity > 0)
      .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
      .slice(0, 2) // Top 2 significant changes
      .map(dish => ({
        name: dish.name,
        category: dish.category,
        change: dish.percentageChange
      }))

    return {
      dishes: dishInventory,
      periodDays,
      totalPortions: dishInventory.reduce((sum, d) => sum + d.periodQuantity, 0),
      trendAlerts
    }
  }, [allOrders, dishes, categories, inventoryPeriod, inventoryCustomStart, inventoryCustomEnd])

  return (
    <>
      {/* All analytics content in a single view */}
      <div className="space-y-8">
        {/* Filter Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-card/50 p-4 rounded-xl border shadow-sm backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-foreground">Analitiche</h2>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 h-9 border-dashed">
                  <List size={16} />
                  Categorie
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-5">
                    {activeCategoryIds.length}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <span className="text-xs font-medium text-muted-foreground">Filtra per categoria</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedCategories(categories.map(c => c.id))}>Tutte</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedCategories([])}>Nessuna</Button>
                  </div>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {categories.map(category => {
                    const checked = activeCategoryIds.includes(category.id)
                    return (
                      <label key={category.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories(prev => Array.from(new Set([...prev, category.id])))
                            } else {
                              setSelectedCategories(prev => prev.filter(id => id !== category.id))
                            }
                          }}
                          className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                        />
                        <span className="truncate">{category.name}</span>
                      </label>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
              <SelectTrigger className="w-44 h-9">
                <CalendarBlank size={16} className="mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFilters.map(filter => (
                  <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-36 h-9"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-36 h-9"
                />
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-lg border-none bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <ShoppingBag size={24} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Ordini</p>
                  <p className="text-3xl font-bold tracking-tight">{analytics.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-gradient-to-br from-green-500/5 to-green-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <CurrencyEur size={24} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Ricavi</p>
                  <p className="text-3xl font-bold tracking-tight">€{analytics.totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-gradient-to-br from-blue-500/5 to-blue-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <TrendUp size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Scontrino Medio</p>
                  <p className="text-3xl font-bold tracking-tight">€{analytics.averageOrderValue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-gradient-to-br from-orange-500/5 to-orange-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <Clock size={24} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Ordini Attivi</p>
                  <p className="text-3xl font-bold tracking-tight">{analytics.activeOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Series Chart */}
          <Card className="shadow-lg border-none overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-muted/10">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChartLine size={20} className="text-primary" />
                Andamento nel Tempo
              </CardTitle>
              <Select value={timeSeriesMetric} onValueChange={(v: any) => setTimeSeriesMetric(v)}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Num. Ordini</SelectItem>
                  <SelectItem value="revenue">Ricavi (€)</SelectItem>
                  <SelectItem value="average">Scontrino Medio</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                {analytics.isSingleDay ? (
                  <BarChart data={analytics.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(value) => timeSeriesMetric === 'orders' ? value : `€${value}`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [
                        timeSeriesMetric === 'orders' ? value : `€${value.toFixed(2)}`,
                        timeSeriesMetric === 'orders' ? 'Ordini' : timeSeriesMetric === 'revenue' ? 'Ricavi' : 'Valore Medio'
                      ]}
                    />
                    <Bar
                      dataKey={timeSeriesMetric === 'orders' ? 'orders' : timeSeriesMetric === 'revenue' ? 'revenue' : 'averageValue'}
                      fill="#C9A152"
                      radius={[8, 8, 0, 0]}
                      barSize={100}
                    />
                  </BarChart>
                ) : (
                  <AreaChart data={analytics.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A152" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C9A152" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(value) => timeSeriesMetric === 'orders' ? value : `€${value}`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [
                        timeSeriesMetric === 'orders' ? value : `€${value.toFixed(2)}`,
                        timeSeriesMetric === 'orders' ? 'Ordini' : timeSeriesMetric === 'revenue' ? 'Ricavi' : 'Valore Medio'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={timeSeriesMetric === 'orders' ? 'orders' : timeSeriesMetric === 'revenue' ? 'revenue' : 'averageValue'}
                      stroke="#C9A152"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorMetric)"
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Chart */}
          <Card className="shadow-lg border-none overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-muted/10">
              <CardTitle className="flex items-center gap-2 text-lg">
                <List size={20} className="text-primary" />
                Performance Categorie
              </CardTitle>
              <Select value={categoryMetric} onValueChange={(v: any) => setCategoryMetric(v)}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Per Ricavi (€)</SelectItem>
                  <SelectItem value="quantity">Per Quantità</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={analytics.categoryStats}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'var(--foreground)', fontWeight: 500 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [
                      categoryMetric === 'revenue' ? `€${value.toFixed(2)}` : value,
                      categoryMetric === 'revenue' ? 'Ricavi' : 'Quantità'
                    ]}
                  />
                  <Bar
                    dataKey={categoryMetric}
                    fill="#C9A152"
                    radius={[0, 4, 4, 0]}
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Best Selling Dishes List */}
        <Card className="shadow-lg border-none">
          <CardHeader className="bg-muted/10 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users size={20} className="text-primary" />
                Classifica Piatti
              </CardTitle>
              <Badge variant="outline" className="font-normal">
                Top {analytics.dishStats.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div>
              {analytics.dishStats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nessun dato disponibile per i filtri selezionati</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {analytics.dishStats.map((dish, index) => (
                    <div
                      key={dish.name}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                          ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-muted text-muted-foreground'}
                        `}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{dish.name}</p>
                          <p className="text-xs text-muted-foreground">{dish.category}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-6">
                        <div className="hidden sm:block">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Venduti</p>
                          <p className="font-bold">{dish.quantity}</p>
                        </div>
                        <div className="min-w-[80px]">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Incasso</p>
                          <p className="font-bold text-primary">€{dish.revenue.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* INTEGRATED INVENTORY SECTION */}
        <Card className="shadow-lg border-none overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Package size={24} className="text-primary" />
                  Analisi Magazzino
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitora le porzioni vendute e confronta con la media storica (ultimi 2 anni)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Period Selector */}
                <Select value={inventoryPeriod} onValueChange={(v: InventoryPeriod) => setInventoryPeriod(v)}>
                  <SelectTrigger className="w-40 h-10">
                    <CalendarBlank size={16} className="mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryPeriods.map(period => (
                      <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Custom Date Range */}
                {inventoryPeriod === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={inventoryCustomStart}
                      onChange={(e) => setInventoryCustomStart(e.target.value)}
                      className="w-36 h-10"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="date"
                      value={inventoryCustomEnd}
                      onChange={(e) => setInventoryCustomEnd(e.target.value)}
                      className="w-36 h-10"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-muted/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{inventoryData.totalPortions}</p>
                <p className="text-xs text-muted-foreground font-medium">Porzioni Totali</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">{inventoryData.dishes.length}</p>
                <p className="text-xs text-muted-foreground font-medium">Piatti nel Menù</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">{inventoryData.periodDays}</p>
                <p className="text-xs text-muted-foreground font-medium">Giorni Periodo</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">{inventoryData.dishes.filter(d => d.periodQuantity > 0).length}</p>
                <p className="text-xs text-muted-foreground font-medium">Piatti Venduti</p>
              </div>
            </div>

            {/* Trend Alerts */}
            {inventoryData.trendAlerts && inventoryData.trendAlerts.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={18} className="text-amber-500" weight="fill" />
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Variazioni Significative</span>
                </div>
                <div className="grid gap-2">
                  {inventoryData.trendAlerts.map((alert, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background/60 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${alert.change > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          {alert.change > 0 ? <TrendUp size={20} className="text-green-600 dark:text-green-400" /> : <TrendDown size={20} className="text-red-600 dark:text-red-400" />}
                        </div>
                        <div>
                          <p className="font-semibold">{alert.name}</p>
                          <p className="text-xs text-muted-foreground">{alert.category}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${alert.change > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {alert.change > 0 ? '+' : ''}{alert.change}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scrollable Inventory Table */}
            {inventoryData.dishes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">Nessun dato disponibile</p>
                <p className="text-sm">Seleziona almeno una categoria per visualizzare i dati</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Piatto</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Venduti</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media Periodo</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media Storica</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variazione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {inventoryData.dishes.map((dish, index) => (
                        <tr key={dish.id} className={`hover:bg-muted/20 transition-colors ${dish.periodQuantity === 0 ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${dish.periodQuantity > 0 && index < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                }`}>
                                {dish.periodQuantity > 0 ? index + 1 : '-'}
                              </div>
                              <span className="font-medium text-sm">{dish.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs font-normal">
                              {dish.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold text-lg ${dish.periodQuantity === 0 ? 'text-muted-foreground' : ''}`}>{dish.periodQuantity}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold">{dish.periodAvgPerDay}/gg</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-muted-foreground">{dish.allTimeAvgPerDay}/gg</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${dish.percentageChange > 10
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : dish.percentageChange < -10
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-muted text-muted-foreground'
                              }`}>
                              {dish.percentageChange > 0 ? (
                                <TrendUp size={14} />
                              ) : dish.percentageChange < 0 ? (
                                <TrendDown size={14} />
                              ) : (
                                <Minus size={14} />
                              )}
                              {dish.percentageChange > 0 ? '+' : ''}{dish.percentageChange}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AIAnalyticsSection
        orders={dateFilteredOrders}
        dishes={dishes}
        categories={categories}
      />
    </>
  )
}