import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts'
import { TrendUp, CurrencyEur, Users, ShoppingBag, Clock, ChartLine, CalendarBlank, List } from '@phosphor-icons/react'
import type { Order, Dish, Category, OrderItem } from '../services/types'

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

  // Combine all orders for analysis (completed + active if needed, but usually analytics is on completed)
  // But the original code combined them.
  // Let's use completedOrders for revenue and trends, and orders for "Active Orders" KPI.
  // Actually, original code combined `completedOrders` and `orderHistory` (which was empty).
  // Here we just have `completedOrders`.

  const dateFilteredOrders = completedOrders.filter(order => {
    const orderTime = new Date(order.created_at).getTime()
    return orderTime >= start && orderTime <= end
  })

  const activeCategoryIds = selectedCategories.length > 0 ? selectedCategories : categories.map(c => c.id)

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
    const activeOrdersCount = orders.filter(order => (order.items || []).some(item => {
      const dish = dishes.find(d => d.id === item.dish_id)
      return dish ? activeCategoryIds.includes(dish.category_id) : false
    })).length

    // Daily data for charts
    const dailyData: DailyData[] = []
    const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)))

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
        date: date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
        orders: dayOrders.length,
        revenue: dayRevenue,
        averageValue: dayOrders.length > 0 ? dayRevenue / dayOrders.length : 0
      })
    }

    // Hourly data for today
    const hourlyData: HourlyData[] = []
    if (dateFilter === 'today') {
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date()
        hourStart.setHours(hour, 0, 0, 0)
        const hourEnd = new Date()
        hourEnd.setHours(hour, 59, 59, 999)

        const hourOrders = categoryFilteredOrders.filter(order => {
          const orderTime = new Date(order.created_at).getTime()
          return orderTime >= hourStart.getTime() && orderTime <= hourEnd.getTime()
        })

        hourlyData.push({
          hour: `${hour}:00`,
          orders: hourOrders.length,
          revenue: hourOrders.reduce((sum, order) => sum + (order.filteredAmount || order.total_amount || 0), 0)
        })
      }
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
      .slice(0, 10)

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      activeOrders: activeOrdersCount,
      dailyData,
      hourlyData,
      categoryStats,
      dishStats
    }
  }, [categoryFilteredOrders, orders, categories, dishes, dateFilter, start, end, activeCategoryIds])

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground">Analitiche Dettagliate</h2>
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <List size={16} />
                Categorie ({activeCategoryIds.length}/{categories.length || 0})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="flex items-center justify-between mb-3">
                <Button size="sm" variant="ghost" onClick={() => setSelectedCategories(categories.map(c => c.id))}>Tutte</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedCategories([])}>Pulisci</Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {categories.map(category => {
                  const checked = activeCategoryIds.includes(category.id)
                  return (
                    <label key={category.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
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
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="truncate">{category.name}</span>
                    </label>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
            <SelectTrigger className="w-48">
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
                <Button variant="outline" className="gap-2">
                  <CalendarBlank size={16} />
                  Scegli Date
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
        <Card className="shadow-professional">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ordini Totali</p>
                <p className="text-2xl font-bold text-primary">{analytics.totalOrders}</p>
              </div>
              <ShoppingBag size={24} className="text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-professional">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ricavi</p>
                <p className="text-2xl font-bold text-primary">€{analytics.totalRevenue.toFixed(2)}</p>
              </div>
              <CurrencyEur size={24} className="text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-professional">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scontrino Medio</p>
                <p className="text-2xl font-bold text-primary">€{analytics.averageOrderValue.toFixed(2)}</p>
              </div>
              <TrendUp size={24} className="text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-professional">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ordini in Corso</p>
                <p className="text-2xl font-bold text-primary">{analytics.activeOrders}</p>
              </div>
              <Clock size={24} className="text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Orders Trend Chart */}
        <Card className="shadow-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartLine size={20} />
              Andamento Ordini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {analytics.dailyData.length === 1 ? (
                // Single day - use bar chart instead of line/area
                <BarChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#C9A152" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="orders" stroke="#C9A152" fill="#C9A152" fillOpacity={0.3} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Trend Chart */}
        <Card className="shadow-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrencyEur size={20} />
              Andamento Ricavi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {analytics.dailyData.length === 1 ? (
                // Single day - use bar chart instead of line/area
                <BarChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Ricavi']} />
                  <Bar dataKey="revenue" fill="#8B7355" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Ricavi']} />
                  <Area type="monotone" dataKey="revenue" stroke="#8B7355" fill="#8B7355" fillOpacity={0.3} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Orders (Today only) */}
        {dateFilter === 'today' && (
          <Card className="shadow-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} />
                Ordini per Ora (Oggi)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#C9A152" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Average Order Value */}
        <Card className="shadow-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendUp size={20} />
              Valore Medio Ordine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {analytics.dailyData.length === 1 ? (
                // Single day - use bar chart
                <BarChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Valore Medio']} />
                  <Bar dataKey="averageValue" fill="#D4B366" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Valore Medio']} />
                  <Line type="monotone" dataKey="averageValue" stroke="#D4B366" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartLine size={20} />
              Vendite per Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.categoryStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="quantity"
                >
                  {analytics.categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Revenue */}
        <Card className="shadow-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrencyEur size={20} />
              Ricavi per Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.categoryStats} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Ricavi']} />
                <Bar dataKey="revenue" fill="#C9A152" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Most Ordered Dishes Pie Chart */}
      {analytics.dishStats.length > 0 && (
        <Card className="shadow-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag size={20} />
              Top 10 Piatti - Grafico a Torta
              <Badge variant="outline" className="ml-2">
                Categorie: {selectedCategories.length > 0 ? selectedCategories.join(', ') : 'Nessuna'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={analytics.dishStats.slice(0, 8)} // Limit to top 8 for readability
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, quantity }) => `${name} (${quantity}x)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="quantity"
                >
                  {analytics.dishStats.slice(0, 8).map((entry, index) => (
                    <Cell key={`dish-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value}x`, 'Quantità']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Dishes */}
      <Card className="shadow-professional">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Piatti Più Ordinati
            </CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Filtra Categorie ({selectedCategories.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Categorie</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedCategories(categories.map(c => c.name))}
                        className="h-6 px-2 text-xs"
                      >
                        Tutte
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedCategories([])}
                        className="h-6 px-2 text-xs"
                      >
                        Nessuna
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`cat-${category.id}`}
                          checked={selectedCategories.includes(category.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, category.name])
                            } else {
                              setSelectedCategories(selectedCategories.filter(c => c !== category.name))
                            }
                          }}
                          className="rounded"
                        />
                        <label htmlFor={`cat-${category.id}`} className="text-sm font-medium">
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.dishStats.map((dish, index) => (
              <div key={dish.name} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div>
                    <p className="font-semibold">{dish.name}</p>
                    <p className="text-sm text-muted-foreground">{dish.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{dish.quantity}x</p>
                  <p className="text-sm text-muted-foreground">€{dish.revenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {analytics.dishStats.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nessun dato disponibile per il periodo selezionato
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}