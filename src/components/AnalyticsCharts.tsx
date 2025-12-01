import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from 'recharts'
import { TrendUp, CurrencyEur, Users, ShoppingBag, Clock, ChartLine, CalendarBlank, List, CaretDown } from '@phosphor-icons/react'
import type { Order, Dish, Category, OrderItem } from '../services/types'
import AIAnalyticsSection from './AIAnalyticsSection'

interface AnalyticsChartsProps {
  orders: Order[]
  completedOrders: Order[]
  dishes: Dish[]
  categories: Category[]
}

type DateFilter = 'today' | 'yesterday' | 'week' | '2weeks' | 'month' | '3months' | 'custom'

const dateFilters: { value: DateFilter, label: string }[] = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'week', label: 'Ultima Settimana' },
  { value: '2weeks', label: 'Ultime 2 Settimane' },
  { value: 'month', label: 'Ultimo Mese' },
  { value: '3months', label: 'Ultimi 3 Mesi' },
  { value: 'custom', label: 'Personalizzato' }
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

  // Chart Toggles
  const [timeSeriesMetric, setTimeSeriesMetric] = useState<'orders' | 'revenue' | 'average'>('orders')
  const [categoryMetric, setCategoryMetric] = useState<'quantity' | 'revenue'>('revenue')

  // Update selected categories when categories change
  useEffect(() => {
    setSelectedCategories(categories.map(c => c.id))
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
        return { start: weekAgo.getTime(), end: now.getTime() } // Fallback to week
    }
  }

  const dateRange = getDateRange(dateFilter)
  const { start, end } = dateRange

  // Combine active and completed orders for comprehensive analytics
  const allOrders = useMemo(() => [...completedOrders, ...orders], [completedOrders, orders])

  const dateFilteredOrders = allOrders.filter(order => {
    const orderTime = new Date(order.created_at).getTime()
    return orderTime >= start && orderTime <= end
  })

  // If selectedCategories is empty, it means NONE (unless it's the very first render before effect, but effect runs fast).
  // However, for UX, usually "no filter" means "all". But here we have explicit "All" and "None" buttons.
  // If "None" is clicked, selectedCategories is [].
  // If we want [] to mean "Show Nothing", we just use selectedCategories.
  // If we want [] to mean "Show All" (default), then "None" button is useless.
  // The user complained "Nessuna" doesn't work. So they expect it to show NOTHING (or maybe just reset?).
  // "Dicevo tutte, ho nessuna. Questi due pulsanti non funzionano." -> "I meant all, or none. These two buttons don't work."
  // If I click None, I expect 0 categories selected.
  // So I should NOT fallback to all categories if empty.
  // BUT, I need to initialize it to ALL. (Which the useEffect does).
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

    // Check if we're looking at a single day
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

    // Most ordered dishes (filtered by selected categories)
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
      .slice(0, 50) // Show top 50

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

  return (
    <>
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

            <div className="h-6 w-px bg-border mx-1" />

            <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFilters.map(filter => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 h-9">
                    <CalendarBlank size={16} />
                    Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Data Inizio</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">Data Fine</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Ordini Totali</p>
                  <p className="text-3xl font-bold text-foreground">{analytics.totalOrders}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                  <ShoppingBag size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Ricavi Totali</p>
                  <p className="text-3xl font-bold text-foreground">€{analytics.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                  <CurrencyEur size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Scontrino Medio</p>
                  <p className="text-3xl font-bold text-foreground">€{analytics.averageOrderValue.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
                  <TrendUp size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Ordini in Corso</p>
                  <p className="text-3xl font-bold text-foreground">{analytics.activeOrders}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                  <Clock size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Consolidated Time Series Chart */}
          <Card className="shadow-lg border-none overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-muted/10">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChartLine size={20} className="text-primary" />
                Andamento Temporale
              </CardTitle>
              <Select value={timeSeriesMetric} onValueChange={(v: any) => setTimeSeriesMetric(v)}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Numero Ordini</SelectItem>
                  <SelectItem value="revenue">Ricavi (€)</SelectItem>
                  <SelectItem value="average">Valore Medio (€)</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={350}>
                {analytics.isSingleDay ? (
                  // Use BarChart for single day
                  <BarChart data={analytics.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    <Bar
                      dataKey={timeSeriesMetric === 'orders' ? 'orders' : timeSeriesMetric === 'revenue' ? 'revenue' : 'averageValue'}
                      fill="#C9A152"
                      radius={[8, 8, 0, 0]}
                      barSize={100}
                    />
                  </BarChart>
                ) : (
                  // Use AreaChart for multiple days
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

          {/* Consolidated Category Chart */}
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
      </div>

      <AIAnalyticsSection
        orders={dateFilteredOrders}
        dishes={dishes}
        categories={categories}
      />
    </>
  )
}