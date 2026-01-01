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
import { TrendUp, CurrencyEur, Users, ShoppingBag, Clock, ChartLine, CalendarBlank, List, CaretDown, Star, Package, TrendDown, Minus, Check } from '@phosphor-icons/react'
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
  const [inventorySortBy, setInventorySortBy] = useState<'quantity' | 'revenue' | 'category' | 'price'>('quantity')

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

    // Filter orders for inventory period (excluding cancelled)
    const inventoryOrders = allOrders.filter(order => {
      const orderTime = new Date(order.created_at).getTime()
      return orderTime >= invStart && orderTime <= invEnd && order.status !== 'CANCELLED'
    })

    // Calculate historical average (limit to last 2 years for relevance) - EXCLUDE CURRENT PERIOD
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000)
    const historicalOrders = allOrders.filter(order => {
      const orderTime = new Date(order.created_at).getTime()
      // STRICTLY BEFORE the start of the current inventory period
      return orderTime >= twoYearsAgo && orderTime < invStart && order.status !== 'CANCELLED'
    })

    const historicalDays = historicalOrders.length > 0
      ? Math.max(1, Math.ceil((invStart - Math.max(twoYearsAgo, new Date(Math.min(...historicalOrders.map(o => new Date(o.created_at).getTime()))).getTime())) / (24 * 60 * 60 * 1000)))
      : 1

    // Calculate per-dish inventory stats - filter by active status and selected categories
    const dishInventory = dishes
      .filter(dish => dish.is_active !== false) // Include all active dishes
      .filter(dish => inventoryCategories.length === 0 || inventoryCategories.includes(dish.category_id)) // Filter by selected categories
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
          percentageChange = 100 // New dish with sales (or significant increase from zero)
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
      .sort((a, b) => {
        switch (inventorySortBy) {
          case 'quantity':
            return b.periodQuantity - a.periodQuantity
          case 'revenue':
            return (b.periodQuantity * b.price) - (a.periodQuantity * a.price)
          case 'category':
            return a.category.localeCompare(b.category)
          case 'price':
            return b.price - a.price
          default:
            return b.periodQuantity - a.periodQuantity
        }
      })

    // Generate trend alerts for significant variations (>15% or <-15%)
    const trendAlerts = dishInventory
      .filter(dish => Math.abs(dish.percentageChange) >= 15 && dish.periodQuantity > 0)
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
  }, [allOrders, dishes, categories, inventoryPeriod, inventoryCustomStart, inventoryCustomEnd, inventorySortBy, inventoryCategories])

  return (
    <>
      {/* All analytics content in a single view */}
      <div className="space-y-8">
        {/* Filter Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-card/50 p-4 rounded-xl shadow-sm backdrop-blur-sm">
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

        {/* Summary Cards - Unified Dark Minimal Design */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-zinc-800/50 bg-zinc-900/80 shadow-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700/50">
                  <ShoppingBag size={22} className="text-zinc-400" weight="duotone" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Ordini</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-0.5">{analytics.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/50 bg-zinc-900/80 shadow-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700/50">
                  <CurrencyEur size={22} className="text-amber-500" weight="duotone" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Ricavi</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-0.5">€{analytics.totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/50 bg-zinc-900/80 shadow-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700/50">
                  <TrendUp size={22} className="text-zinc-400" weight="duotone" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Scontrino Medio</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-0.5">€{analytics.averageOrderValue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/50 bg-zinc-900/80 shadow-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${inventoryData.trendAlerts?.[0]?.change > 0 ? 'bg-emerald-950/50 border-emerald-800/50' : inventoryData.trendAlerts?.[0]?.change < 0 ? 'bg-red-950/50 border-red-800/50' : 'bg-zinc-800 border-zinc-700/50'}`}>
                  {inventoryData.trendAlerts?.[0]?.change > 0 ? (
                    <TrendUp size={22} className="text-emerald-400" weight="duotone" />
                  ) : inventoryData.trendAlerts?.[0]?.change < 0 ? (
                    <TrendDown size={22} className="text-red-400" weight="duotone" />
                  ) : (
                    <Minus size={22} className="text-zinc-400" weight="bold" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Trend Periodo</p>
                  {inventoryData.trendAlerts && inventoryData.trendAlerts.length > 0 ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-base font-bold text-zinc-100 truncate">{inventoryData.trendAlerts[0].name}</p>
                      <span className={`text-sm font-bold ${inventoryData.trendAlerts[0].change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {inventoryData.trendAlerts[0].change > 0 ? '+' : ''}{inventoryData.trendAlerts[0].change}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-base font-medium text-zinc-600 mt-0.5">Nessun trend</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Series Chart */}
          <Card className="border-zinc-800/50 bg-zinc-900/80 shadow-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-800/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-200">
                <ChartLine size={18} className="text-amber-500" weight="duotone" />
                Andamento nel Tempo
              </CardTitle>
              <Select value={timeSeriesMetric} onValueChange={(v: any) => setTimeSeriesMetric(v)}>
                <SelectTrigger className="w-36 h-8 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
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
          <Card className="border-zinc-800/50 bg-zinc-900/80 shadow-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-800/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-200">
                <List size={18} className="text-amber-500" weight="duotone" />
                Performance Categorie
              </CardTitle>
              <Select value={categoryMetric} onValueChange={(v: any) => setCategoryMetric(v)}>
                <SelectTrigger className="w-36 h-8 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 500 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#27272a', opacity: 0.5 }}
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                    labelStyle={{ color: '#f4f4f5' }}
                    itemStyle={{ color: '#f4f4f5' }}
                    formatter={(value: number) => [
                      categoryMetric === 'revenue' ? `€${value.toFixed(2)}` : value,
                      categoryMetric === 'revenue' ? 'Ricavi' : 'Quantità'
                    ]}
                  />
                  <Bar
                    dataKey={categoryMetric}
                    fill="#f59e0b"
                    radius={[0, 6, 6, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* REDESIGNED INVENTORY SECTION */}
        <Card className="shadow-2xl border-none overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 ring-1 ring-white/5">
          <CardHeader className="border-b border-white/5 pb-4 bg-black/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-inner">
                  <Package size={24} className="text-amber-500" weight="duotone" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white tracking-tight">
                    Analisi Magazzino
                  </CardTitle>
                  <p className="text-sm text-zinc-400 mt-1">
                    Confronto vendite vs periodo precedente (2 anni)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Category Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all">
                      <List size={16} className="mr-2 opacity-70" />
                      Categorie
                      {inventoryCategories.length > 0 && inventoryCategories.length < categories.length && (
                        <Badge variant="secondary" className="ml-2 h-5 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {inventoryCategories.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 bg-zinc-900 border-zinc-800" align="end">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Filtra per categoria</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => setInventoryCategories(categories.map(c => c.id))}>Tutte</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => setInventoryCategories([])}>Nessuna</Button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {categories.map(category => {
                        const checked = inventoryCategories.includes(category.id)
                        return (
                          <div
                            key={category.id}
                            className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg cursor-pointer transition-all ${checked ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                            onClick={() => {
                              if (checked) {
                                setInventoryCategories(prev => prev.filter(id => id !== category.id))
                              } else {
                                setInventoryCategories(prev => Array.from(new Set([...prev, category.id])))
                              }
                            }}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`}>
                              {checked && <Check size={10} className="text-black" weight="bold" />}
                            </div>
                            <span className="truncate flex-1">{category.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Period Selector */}
                <Select value={inventoryPeriod} onValueChange={(v: InventoryPeriod) => setInventoryPeriod(v)}>
                  <SelectTrigger className="w-[140px] h-9 border-zinc-700 bg-zinc-800/50 text-zinc-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                    {inventoryPeriods.map(period => (
                      <SelectItem key={period.value} value={period.value} className="focus:bg-zinc-800 focus:text-white">{period.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort Selector */}
                <Select value={inventorySortBy} onValueChange={(v: any) => setInventorySortBy(v)}>
                  <SelectTrigger className="w-[160px] h-9 border-zinc-700 bg-zinc-800/50 text-zinc-300">
                    <span className="opacity-50 mr-2 text-xs uppercase">Ordina:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                    <SelectItem value="quantity" className="focus:bg-zinc-800 focus:text-white">Piatti Venduti</SelectItem>
                    <SelectItem value="revenue" className="focus:bg-zinc-800 focus:text-white">Incassi Totali</SelectItem>
                    <SelectItem value="category" className="focus:bg-zinc-800 focus:text-white">Categoria</SelectItem>
                    <SelectItem value="price" className="focus:bg-zinc-800 focus:text-white">Prezzo Listino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Inputs */}
            {inventoryPeriod === 'custom' && (
              <div className="flex justify-end mt-4 gap-2">
                <Input
                  type="date"
                  value={inventoryCustomStart}
                  onChange={(e) => setInventoryCustomStart(e.target.value)}
                  className="w-auto h-8 bg-zinc-900 border-zinc-700 text-xs"
                />
                <span className="text-zinc-500 self-center">-</span>
                <Input
                  type="date"
                  value={inventoryCustomEnd}
                  onChange={(e) => setInventoryCustomEnd(e.target.value)}
                  className="w-auto h-8 bg-zinc-900 border-zinc-700 text-xs"
                />
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 gap-px bg-white/5 border-b border-white/5">
              {[
                { label: "Porzioni Vendute", value: inventoryData.totalPortions, icon: <Package size={16} weight="fill" className="text-blue-400" /> },
                { label: "Piatti Analizzati", value: inventoryData.dishes.length, icon: <List size={16} weight="bold" className="text-zinc-400" /> },
                { label: "Giorni Analizzati", value: inventoryData.periodDays, icon: <CalendarBlank size={16} weight="fill" className="text-zinc-400" /> },
                { label: "Piatti Attivi", value: inventoryData.dishes.filter(d => d.periodQuantity > 0).length, icon: <Check size={16} weight="bold" className="text-emerald-400" /> },
              ].map((stat, i) => (
                <div key={i} className="p-4 flex flex-col items-center justify-center bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center gap-2 mb-1 opacity-70">
                    {stat.icon}
                    <span className="text-[10px] uppercase font-bold text-zinc-400">{stat.label}</span>
                  </div>
                  <span className="text-xl font-bold text-white">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-zinc-950/30 border-b border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <div className="col-span-4 pl-2">Piatto / Categoria</div>
              <div className="col-span-2 text-center">Prezzo</div>
              <div className="col-span-2 text-center">Vendite Tot.</div>
              <div className="col-span-2 text-center">Media / GG</div>
              <div className="col-span-2 text-right pr-2">Trend (vs 2 Anni)</div>
            </div>

            {/* Scrollable List */}
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              {inventoryData.dishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                  <Package size={48} weight="duotone" className="mb-4 opacity-20" />
                  <p>Nessun dato disponibile</p>
                </div>
              ) : (
                inventoryData.dishes.map((dish, i) => (
                  <div
                    key={dish.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Dish Info */}
                    <div className="col-span-4 pl-2 min-w-0">
                      <p className="font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">{dish.name}</p>
                      <Badge variant="outline" className="mt-1 text-[10px] h-5 px-1.5 border-zinc-800 text-zinc-500 bg-zinc-900/50">
                        {dish.category}
                      </Badge>
                    </div>

                    {/* Price */}
                    <div className="col-span-2 text-center">
                      <span className="text-sm text-zinc-400">€{dish.price.toFixed(2)}</span>
                    </div>

                    {/* Sales */}
                    <div className="col-span-2 text-center">
                      <span className={`text-sm font-bold ${dish.periodQuantity > 0 ? 'text-white' : 'text-zinc-600'}`}>
                        {dish.periodQuantity}
                      </span>
                    </div>

                    {/* Avg/Day */}
                    <div className="col-span-2 flex flex-col items-center justify-center">
                      <span className="text-sm font-semibold text-zinc-300">{dish.periodAvgPerDay}</span>
                      <span className="text-[10px] text-zinc-600">storico: {dish.allTimeAvgPerDay}</span>
                    </div>

                    {/* Trend */}
                    <div className="col-span-2 flex justify-end pr-2">
                      <div className={`
                          flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border
                          ${dish.percentageChange === 0 ? 'bg-zinc-900/50 text-zinc-500 border-zinc-800' : ''}
                          ${dish.percentageChange > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                          ${dish.percentageChange < 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : ''}
                       `}>
                        {dish.percentageChange > 0 ? <TrendUp weight="bold" /> : dish.percentageChange < 0 ? <TrendDown weight="bold" /> : <Minus />}
                        {Math.abs(dish.percentageChange)}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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