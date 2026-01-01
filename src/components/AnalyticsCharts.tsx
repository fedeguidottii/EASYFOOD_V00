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
import { TrendUp, CurrencyEur, Users, ShoppingBag, Clock, ChartLine, CalendarBlank, List, CaretDown, Star, Package, TrendDown, Minus, Check, DownloadSimple } from '@phosphor-icons/react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

  // EXPORT ANALYTICS FUNCTION (B&W OPTIMIZED)
  const handleExportAnalytics = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('REPORT ANALITICO', 14, 20)

    const dateText = dateFilter === 'custom' && customStartDate && customEndDate
      ? `Periodo: ${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
      : `Periodo: ${dateFilters.find(f => f.value === dateFilter)?.label || 'Settimana Corrente'}`

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(dateText, 14, 28)
    doc.text(`Generato il: ${new Date().toLocaleString('it-IT')}`, 14, 33)

    // Summary Data
    const summaryData = [
      ['Totale Ordini', analytics.totalOrders.toString()],
      ['Totale Ricavi', `€ ${analytics.totalRevenue.toFixed(2)}`],
      ['Scontrino Medio', `€ ${analytics.averageOrderValue.toFixed(2)}`],
      ['Ordini Attivi', analytics.activeOrders.toString()]
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Metrica', 'Valore']],
      body: summaryData,
      theme: 'grid', // Grid theme provides borders
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      styles: {
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { cellWidth: 40 }
      }
    });

    // Category Performance
    const catY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Performance per Categoria', 14, catY)

    const categoryData = analytics.categoryStats.map(c => [
      c.name,
      c.quantity.toString(),
      `€ ${c.revenue.toFixed(2)}`,
      `${c.percentage.toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: catY + 5,
      head: [['Categoria', 'Quantità', 'Ricavi', '% Ordini']],
      body: categoryData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      styles: {
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
    });

    doc.save(`Analisi_Vendite_${new Date().toISOString().split('T')[0]}.pdf`)
  }

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

    // Calculate per-dish inventory stats - include ALL dishes (removed is_active filter)
    const dishInventory = dishes
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
          price: dish.price,
          isActive: dish.is_active !== false // Track status for display
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
        {/* Filter Controls - Enhanced Glassmorphism */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-zinc-900/60 p-4 rounded-xl border border-white/5 shadow-lg backdrop-blur-xl">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Analitiche</h2>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 h-9 border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all">
                  <List size={16} />
                  Categorie
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-5 bg-amber-500/20 text-amber-500 border border-amber-500/20">
                    {activeCategoryIds.length}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-zinc-950 border-zinc-800" align="end">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                  <span className="text-xs font-medium text-zinc-400">Filtra per categoria</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => setSelectedCategories(categories.map(c => c.id))}>Tutte</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => setSelectedCategories([])}>Nessuna</Button>
                  </div>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {categories.map(category => {
                    const checked = activeCategoryIds.includes(category.id)
                    return (
                      <label key={category.id} className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-md cursor-pointer transition-colors ${checked ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-400 hover:bg-zinc-900'}`}>
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
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/20"
                        />
                        <span className="truncate">{category.name}</span>
                      </label>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
              <SelectTrigger className="w-44 h-9 border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:border-amber-500/30 transition-all focus:ring-amber-500/20">
                <CalendarBlank size={16} className="mr-2 text-amber-500/70" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                {dateFilters.map(filter => (
                  <SelectItem key={filter.value} value={filter.value} className="focus:bg-amber-500/10 focus:text-amber-500">{filter.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-36 h-9 bg-zinc-900 border-zinc-700 focus:border-amber-500/50 text-zinc-300"
                />
                <span className="text-zinc-600">-</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-36 h-9 bg-zinc-900 border-zinc-700 focus:border-amber-500/50 text-zinc-300"
                />
              </div>
            )}

            <Button
              variant="outline"
              className="gap-2 h-9 border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-800"
              onClick={handleExportAnalytics}
            >
              <DownloadSimple size={16} />
              Esporta Report
            </Button>
          </div>
        </div>

        {/* Summary Cards - Enhanced Vibrant Design */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-zinc-800/60 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-zinc-400 group-hover:text-amber-500 group-hover:border-amber-500/30 transition-colors">
                  <ShoppingBag size={22} weight="duotone" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Ordini</p>
                  <p className="text-2xl font-bold text-white tracking-tight">{analytics.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/60 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-amber-500 group-hover:text-amber-400 group-hover:border-amber-500/50 transition-colors shadow-[0_0_10px_-3px_rgba(245,158,11,0.1)]">
                  <CurrencyEur size={22} weight="duotone" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Ricavi</p>
                  <p className="text-2xl font-bold text-amber-400 tracking-tight">€{analytics.totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/60 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-zinc-400 group-hover:text-amber-500 transition-colors">
                  <TrendUp size={22} weight="duotone" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Scontrino Medio</p>
                  <p className="text-2xl font-bold text-white tracking-tight">€{analytics.averageOrderValue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/60 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border transition-colors ${inventoryData.trendAlerts?.[0]?.change > 0 ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' : inventoryData.trendAlerts?.[0]?.change < 0 ? 'bg-red-950/30 border-red-500/30 text-red-400' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'}`}>
                  {inventoryData.trendAlerts?.[0]?.change > 0 ? (
                    <TrendUp size={22} weight="duotone" />
                  ) : inventoryData.trendAlerts?.[0]?.change < 0 ? (
                    <TrendDown size={22} weight="duotone" />
                  ) : (
                    <Minus size={22} weight="bold" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Top Trend</p>
                  {inventoryData.trendAlerts && inventoryData.trendAlerts.length > 0 ? (
                    <div className="flex flex-col">
                      <p className="text-sm font-bold text-white truncate">{inventoryData.trendAlerts[0].name}</p>
                      <span className={`text-xs font-bold ${inventoryData.trendAlerts[0].change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {inventoryData.trendAlerts[0].change > 0 ? '+' : ''}{inventoryData.trendAlerts[0].change}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-zinc-600 mt-0.5">-</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Series Chart */}
          <Card className="border-zinc-800/50 bg-zinc-900/40 shadow-xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                Andamento nel Tempo
              </CardTitle>
              <Select value={timeSeriesMetric} onValueChange={(v: any) => setTimeSeriesMetric(v)}>
                <SelectTrigger className="w-36 h-8 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-amber-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                  <SelectItem value="orders">Num. Ordini</SelectItem>
                  <SelectItem value="revenue">Ricavi (€)</SelectItem>
                  <SelectItem value="average">Scontrino Medio</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-6 pl-0">
              <ResponsiveContainer width="100%" height={300}>
                {analytics.isSingleDay ? (
                  <BarChart data={analytics.dailyData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#71717a' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#71717a' }}
                      tickFormatter={(value) => timeSeriesMetric === 'orders' ? value : `€${value}`}
                      dx={-10}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }}
                      contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                      labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                      formatter={(value: number) => [
                        timeSeriesMetric === 'orders' ? value : `€${value.toFixed(2)}`,
                        timeSeriesMetric === 'orders' ? 'Ordini' : timeSeriesMetric === 'revenue' ? 'Ricavi' : 'Valore Medio'
                      ]}
                    />
                    <Bar
                      dataKey={timeSeriesMetric === 'orders' ? 'orders' : timeSeriesMetric === 'revenue' ? 'revenue' : 'averageValue'}
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                      barSize={60}
                    />
                  </BarChart>
                ) : (
                  <AreaChart data={analytics.dailyData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#71717a' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#71717a' }}
                      tickFormatter={(value) => timeSeriesMetric === 'orders' ? value : `€${value}`}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                      labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                      formatter={(value: number) => [
                        timeSeriesMetric === 'orders' ? value : `€${value.toFixed(2)}`,
                        timeSeriesMetric === 'orders' ? 'Ordini' : timeSeriesMetric === 'revenue' ? 'Ricavi' : 'Valore Medio'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={timeSeriesMetric === 'orders' ? 'orders' : timeSeriesMetric === 'revenue' ? 'revenue' : 'averageValue'}
                      stroke="#fbbf24"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorMetric)"
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Chart */}
          <Card className="border-zinc-800/50 bg-zinc-900/40 shadow-xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                Performance Categorie
              </CardTitle>
              <Select value={categoryMetric} onValueChange={(v: any) => setCategoryMetric(v)}>
                <SelectTrigger className="w-36 h-8 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-amber-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 13, fill: '#a1a1aa', fontWeight: 500 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}
                    formatter={(value: number) => [
                      categoryMetric === 'revenue' ? `€${value.toFixed(2)}` : value,
                      categoryMetric === 'revenue' ? 'Ricavi' : 'Quantità'
                    ]}
                  />
                  <Bar
                    dataKey={categoryMetric}
                    fill="#fbbf24"
                    radius={[0, 4, 4, 0]}
                    barSize={24}
                    background={{ fill: 'rgba(255,255,255,0.02)' }}
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