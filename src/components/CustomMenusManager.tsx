import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
    Plus, Trash, Calendar, Clock, CheckCircle, ForkKnife,
    Pencil, X, MagnifyingGlass, Sparkle, CopySimple,
    CalendarCheck, Check, Info, ArrowLeft
} from '@phosphor-icons/react'
import type { CustomMenu, CustomMenuSchedule, Dish, MealType, Category } from '../services/types'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CustomMenusManagerProps {
    restaurantId: string
    dishes: Dish[]
    categories: Category[]
    onDishesChange: () => void
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Gio' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sab' },
    { value: 0, label: 'Dom' }
]

const MEAL_TYPES: { value: MealType, label: string }[] = [
    { value: 'lunch', label: 'Pranzo' },
    { value: 'dinner', label: 'Cena' },
]

export default function CustomMenusManager({ restaurantId, dishes, categories, onDishesChange }: CustomMenusManagerProps) {
    const [customMenus, setCustomMenus] = useState<CustomMenu[]>([])
    const [selectedMenu, setSelectedMenu] = useState<CustomMenu | null>(null)
    const [menuDishes, setMenuDishes] = useState<string[]>([])
    const [schedules, setSchedules] = useState<CustomMenuSchedule[]>([])

    // Editor View State
    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list')
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newMenuName, setNewMenuName] = useState('')
    const [dishSearch, setDishSearch] = useState('')
    const [editorTab, setEditorTab] = useState<'dishes' | 'schedule'>('dishes')

    // Data Fetching
    const fetchCustomMenus = async () => {
        const { data } = await supabase
            .from('custom_menus')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
        if (data) setCustomMenus(data)
    }

    const fetchMenuDetails = async (menuId: string) => {
        const [dishesRes, schedulesRes] = await Promise.all([
            supabase.from('custom_menu_dishes').select('dish_id').eq('custom_menu_id', menuId),
            supabase.from('custom_menu_schedules').select('*').eq('custom_menu_id', menuId)
        ])

        if (dishesRes.data) setMenuDishes(dishesRes.data.map(d => d.dish_id))
        if (schedulesRes.data) setSchedules(schedulesRes.data)
    }

    useEffect(() => {
        if (restaurantId) fetchCustomMenus()
    }, [restaurantId])

    const handleCreateMenu = async () => {
        if (!newMenuName.trim()) return

        const { data, error } = await supabase
            .from('custom_menus')
            .insert({
                restaurant_id: restaurantId,
                name: newMenuName.trim(),
                is_active: false
            })
            .select()
            .single()

        if (error) {
            toast.error('Errore creazione menù')
        } else {
            toast.success('Menù creato')
            setNewMenuName('')
            setShowCreateDialog(false)
            fetchCustomMenus()
            if (data) openEditor(data)
        }
    }

    const openEditor = async (menu: CustomMenu) => {
        setSelectedMenu(menu)
        setViewMode('editor')
        setEditorTab('dishes')
        await fetchMenuDetails(menu.id)
    }

    const closeEditor = () => {
        setSelectedMenu(null)
        setViewMode('list')
        setDishSearch('')
    }

    const handleDeleteMenu = async (menuId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Eliminare questo menù?')) return

        const { error } = await supabase.from('custom_menus').delete().eq('id', menuId)
        if (!error) {
            toast.success('Menù eliminato')
            fetchCustomMenus()
            if (selectedMenu?.id === menuId) closeEditor()
        }
    }

    const handleApplyMenu = async (menuId: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        const { error } = await supabase.rpc('apply_custom_menu', { p_restaurant_id: restaurantId, p_menu_id: menuId })
        if (!error) {
            toast.success('Menù Attivato!')
            fetchCustomMenus()
            onDishesChange()
            if (selectedMenu) setSelectedMenu({ ...selectedMenu, is_active: true })
        } else {
            toast.error('Errore attivazione')
        }
    }

    const handleResetToFullMenu = async () => {
        const { error } = await supabase.rpc('reset_to_full_menu', { p_restaurant_id: restaurantId })
        if (!error) {
            toast.success('Menu Completo Ripristinato')
            fetchCustomMenus()
            onDishesChange()
        }
    }

    // --- Editor Logic ---
    const handleToggleDish = async (dishId: string) => {
        if (!selectedMenu) return
        const isAdding = !menuDishes.includes(dishId)

        // Optimistic update
        setMenuDishes(prev => isAdding ? [...prev, dishId] : prev.filter(id => id !== dishId))

        if (isAdding) {
            await supabase.from('custom_menu_dishes').insert({ custom_menu_id: selectedMenu.id, dish_id: dishId })
        } else {
            await supabase.from('custom_menu_dishes').delete().match({ custom_menu_id: selectedMenu.id, dish_id: dishId })
        }

        // Realtime sync if active
        if (selectedMenu.is_active) {
            await supabase.from('dishes').update({ is_active: isAdding }).eq('id', dishId)
            onDishesChange()
        }
    }

    const handleToggleSchedule = async (dayOfWeek: number, mealType: MealType) => {
        if (!selectedMenu) return
        const existing = schedules.find(s => s.day_of_week === dayOfWeek && s.meal_type === mealType)

        if (existing) {
            setSchedules(prev => prev.filter(s => s.id !== existing.id))
            await supabase.from('custom_menu_schedules').delete().eq('id', existing.id)
        } else {
            const { data } = await supabase.from('custom_menu_schedules').insert({
                custom_menu_id: selectedMenu.id,
                day_of_week: dayOfWeek,
                meal_type: mealType,
                is_active: true
            }).select().single()

            if (data) setSchedules(prev => [...prev, data])
        }
    }

    // Filter dishes
    const filteredCategories = useMemo(() => {
        if (!dishSearch) return categories
        const search = dishSearch.toLowerCase()
        return categories.filter(cat => {
            const catHasMatch = dishes.some(d => d.category_id === cat.id && d.name.toLowerCase().includes(search))
            return catHasMatch
        })
    }, [categories, dishes, dishSearch])


    // --- VIEW: LIST ---
    if (viewMode === 'list') {
        const activeMenu = customMenus.find(m => m.is_active)

        return (
        <div className="flex flex-col h-full min-h-[70vh] w-full max-w-6xl mx-auto bg-background/50 backdrop-blur-sm">

                {/* Header Section - Spaced correctly to avoid close button overlap */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-8 pt-8 pb-6 border-b bg-muted/5">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                            Menu Personalizzati
                        </h2>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            Gestisci sottomenu, eventi e limitazioni orarie.
                        </p>
                    </div>

                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogTrigger asChild>
                            <Button className="mt-4 sm:mt-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95">
                                <Plus weight="bold" className="mr-2" size={16} />
                                Nuovo Menu
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Crea Nuovo Menu</DialogTitle>
                                <DialogDescription>
                                    Assegna un nome univoco per identificare questo menu (es. "Menu Pranzo", "San Valentino").
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome del Menu</Label>
                                    <Input
                                        value={newMenuName}
                                        onChange={(e) => setNewMenuName(e.target.value)}
                                        placeholder="Inserisci nome..."
                                        className="h-11"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateMenu} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                    Crea Menu
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Active Menu Status Card */}
                    <div className={cn(
                        "relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl border-2 transition-all duration-300",
                        activeMenu
                            ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_30px_-15px_rgba(16,185,129,0.2)]"
                            : "border-slate-200 dark:border-slate-800 bg-card/50"
                    )}>
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                                activeMenu
                                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            )}>
                                {activeMenu ? <Sparkle weight="fill" size={24} /> : <ForkKnife weight="duotone" size={24} />}
                            </div>
                            <div className="space-y-1">
                                <Badge variant={activeMenu ? "default" : "outline"} className={cn(
                                    "mb-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold",
                                    activeMenu ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "text-muted-foreground"
                                )}>
                                    {activeMenu ? "Attivo Ora" : "Standard"}
                                </Badge>
                                <h3 className="font-bold text-lg">
                                    {activeMenu ? activeMenu.name : "Menu Completo (Tutti i Piatti)"}
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-lg">
                                    {activeMenu
                                        ? "I clienti vedono e possono ordinare SOLO i piatti inclusi in questo menu personalizzato."
                                        : "Nessuna restrizione attiva. I clienti visualizzano l'intero catalogo piatti abilitati."}
                                </p>
                            </div>
                        </div>

                        {activeMenu && (
                            <Button
                                variant="outline"
                                onClick={handleResetToFullMenu}
                                className="mt-4 sm:mt-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                            >
                                <X className="mr-2" size={16} /> Disattiva
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">I Tuoi Menu</h4>
                            <Separator className="flex-1" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {customMenus.map(menu => (
                                <motion.div
                                    key={menu.id}
                                    whileHover={{ y: -2 }}
                                    onClick={(e) => {
                                        if (menu.is_active) {
                                            handleResetToFullMenu()
                                        } else {
                                            handleApplyMenu(menu.id, e)
                                        }
                                    }}
                                    className={cn(
                                        "group relative flex flex-col justify-between h-[160px] p-5 rounded-xl border bg-card hover:shadow-lg transition-all cursor-pointer overflow-hidden backdrop-blur-sm",
                                        menu.is_active
                                            ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/5 dark:bg-emerald-900/10"
                                            : "hover:border-primary/50"
                                    )}
                                >
                                    {/* Action Header */}
                                    <div className="flex justify-between items-start z-10">
                                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                            <ForkKnife size={20} weight={menu.is_active ? "fill" : "regular"} />
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {/* Edit Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openEditor(menu)
                                                }}
                                                title="Modifica Menu"
                                            >
                                                <Pencil size={18} />
                                            </Button>

                                            {menu.is_active && (
                                                <div className="p-1.5 bg-emerald-500 rounded-full text-white shadow-sm ml-1">
                                                    <Check size={12} weight="bold" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-1">
                                        <h3 className="font-bold text-base truncate mb-1 pr-4">{menu.name}</h3>
                                        {menu.is_active ? (
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                ATTIVO ORA
                                            </p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                                                Clicca per attivare
                                            </p>
                                        )}
                                    </div>

                                    {/* Delete - Bottom Right */}
                                    <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                            onClick={(e) => handleDeleteMenu(menu.id, e)}
                                            title="Elimina"
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Empty State Card */}
                            <button
                                onClick={() => setShowCreateDialog(true)}
                                className="h-[160px] rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                                    <Plus size={24} />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Crea Nuovo Menu</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // --- VIEW: EDITOR (Minimal refinement) ---
    return (
        <div className="flex flex-col h-[92vh] bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b bg-muted/5 pr-12">
                {/* Added pr-12 to avoid Dialog Close X overlap */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeEditor}
                        className="h-8 w-8 rounded-full hover:bg-muted"
                        title="Torna indietro"
                    >
                        <ArrowLeft size={18} />
                    </Button>
                    <div className="h-6 w-px bg-border/50 mx-2 hidden sm:block" />
                    <div>
                        <h2 className="font-bold text-lg leading-none tracking-tight">{selectedMenu?.name}</h2>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                                {menuDishes.length} Piatti
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                                {schedules.length} Orari
                            </span>
                        </div>
                    </div>
                </div>
                {!selectedMenu?.is_active && (
                    <Button
                        size="sm"
                        onClick={() => selectedMenu && handleApplyMenu(selectedMenu.id)}
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                    >
                        <CheckCircle weight="fill" className="mr-1.5" size={14} />
                        Attiva Ora
                    </Button>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-[80px] sm:w-[220px] flex-shrink-0 border-r bg-muted/10 flex flex-col gap-3 p-4">
                    <Button
                        variant={editorTab === 'dishes' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                            "justify-start h-10 px-3 rounded-lg transition-all",
                            editorTab === 'dishes' && "bg-white dark:bg-slate-800 shadow-sm border border-border/50 text-primary font-semibold"
                        )}
                        onClick={() => setEditorTab('dishes')}
                    >
                        <ForkKnife className="sm:mr-2 shrink-0" size={18} weight={editorTab === 'dishes' ? 'fill' : 'regular'} />
                        <div className="hidden sm:flex flex-col items-start">
                            <span className="text-xs">Piatti</span>
                        </div>
                    </Button>
                    <Button
                        variant={editorTab === 'schedule' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                            "justify-start h-10 px-3 rounded-lg transition-all",
                            editorTab === 'schedule' && "bg-white dark:bg-slate-800 shadow-sm border border-border/50 text-primary font-semibold"
                        )}
                        onClick={() => setEditorTab('schedule')}
                    >
                        <CalendarCheck className="sm:mr-2 shrink-0" size={18} weight={editorTab === 'schedule' ? 'fill' : 'regular'} />
                        <div className="hidden sm:flex flex-col items-start">
                            <span className="text-xs">Orari</span>
                        </div>
                    </Button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
                    {editorTab === 'dishes' ? (
                        <>
                            <div className="p-4 border-b bg-card/50 backdrop-blur-sm z-10">
                                <div className="relative max-w-md">
                                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <Input
                                        placeholder="Cerca piatto..."
                                        value={dishSearch}
                                        onChange={(e) => setDishSearch(e.target.value)}
                                        className="h-10 pl-9 bg-muted/20 border-border/50 focus:bg-background transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-4xl mx-auto pb-10">
                                    {filteredCategories.map(cat => {
                                        const catDishes = dishes.filter(d => d.category_id === cat.id)
                                        if (dishSearch && catDishes.every(d => !d.name.toLowerCase().includes(dishSearch.toLowerCase()))) return null

                                        const visibleDishes = dishSearch
                                            ? catDishes.filter(d => d.name.toLowerCase().includes(dishSearch.toLowerCase()))
                                            : catDishes

                                        if (visibleDishes.length === 0) return null

                                        return (
                                            <div key={cat.id} className="mb-8 last:mb-0">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <h4 className="text-sm font-bold text-foreground bg-muted/50 px-3 py-1 rounded-lg uppercase tracking-wider backdrop-blur-sm sticky top-0">
                                                        {cat.name}
                                                    </h4>
                                                    <div className="h-px bg-border flex-1" />
                                                </div>

                                                <div className="grid grid-cols-1 gap-2"> {/* Changed to grid-cols-1 for better visibility in popup */}
                                                    {visibleDishes.map(dish => {
                                                        const isSelected = menuDishes.includes(dish.id)
                                                        return (
                                                            <div
                                                                key={dish.id}
                                                                onClick={() => handleToggleDish(dish.id)}
                                                                className={cn(
                                                                    "relative flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 group active:scale-[0.98]",
                                                                    isSelected
                                                                        ? "bg-emerald-50/80 border-emerald-500/50 dark:bg-emerald-950/30 dark:border-emerald-500/50 shadow-sm"
                                                                        : "bg-card hover:bg-muted/50 border-transparent shadow-sm hover:shadow-md"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                                                    <div className={cn(
                                                                        "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all",
                                                                        isSelected
                                                                            ? "bg-emerald-500 border-emerald-500 scale-110"
                                                                            : "border-muted-foreground/30 group-hover:border-primary/50"
                                                                    )}>
                                                                        {isSelected && <Check size={12} className="text-white" weight="bold" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 flex items-center justify-between">
                                                                        <p className={cn("text-sm truncate transition-colors", isSelected ? "font-semibold text-emerald-900 dark:text-emerald-100" : "font-medium text-foreground")}>{dish.name}</p>
                                                                        <p className="text-xs text-muted-foreground font-mono ml-2">€{dish.price.toFixed(2)}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 p-4 flex flex-col items-center bg-muted/5 w-full overflow-auto">
                            <div className="w-full max-w-[98%] bg-card p-6 rounded-3xl border shadow-sm">
                                <div className="text-center mb-6">
                                    <h3 className="text-xl font-bold flex items-center justify-center gap-3">
                                        <Clock weight="duotone" size={28} className="text-primary" />
                                        Programmazione Automatica
                                    </h3>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        Attiva automaticamente il menu negli orari selezionati.
                                    </p>
                                </div>

                                <div className="border rounded-2xl overflow-x-auto shadow-sm">
                                    <div className="min-w-[1100px] grid grid-cols-[100px_repeat(7,1fr)] bg-muted/20">
                                        {/* Header Row */}
                                        <div className="p-3 border-r border-b bg-muted/50"></div> {/* Corner */}
                                        {DAYS_OF_WEEK.map(day => (
                                            <div key={day.value} className="p-3 text-center text-xs font-bold text-muted-foreground uppercase border-b border-r last:border-r-0 bg-muted/50 tracking-wider">
                                                {day.label}
                                            </div>
                                        ))}

                                        {/* Rows */}
                                        {MEAL_TYPES.map((meal, index) => (
                                            <div key={meal.value} className="contents group">
                                                {/* Row Label */}
                                                <div className={cn(
                                                    "p-3 flex items-center justify-end font-semibold text-sm uppercase tracking-wider text-muted-foreground border-r bg-muted/10",
                                                    index !== MEAL_TYPES.length - 1 && "border-b"
                                                )}>
                                                    {meal.label}
                                                </div>

                                                {/* Cells */}
                                                {DAYS_OF_WEEK.map((day, dIndex) => {
                                                    const isActive = schedules.some(s => s.day_of_week === day.value && s.meal_type === meal.value)
                                                    return (
                                                        <div
                                                            key={`${day.value}-${meal.value}`}
                                                            className={cn(
                                                                "relative h-28 border-r last:border-r-0 flex items-center justify-center p-2 transition-all cursor-pointer hover:bg-muted/50",
                                                                index !== MEAL_TYPES.length - 1 && "border-b",
                                                                isActive && "bg-emerald-50/50 hover:bg-emerald-100/50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20"
                                                            )}
                                                            onClick={() => handleToggleSchedule(day.value, meal.value)}
                                                        >
                                                            <div className={cn(
                                                                "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                                                                isActive
                                                                    ? "bg-emerald-500 text-white shadow-lg scale-110"
                                                                    : "bg-transparent text-transparent border-2 border-dashed border-muted-foreground/20 group-hover:border-primary/20"
                                                            )}>
                                                                <Check size={24} weight="bold" />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-xl text-xs border border-blue-100 dark:border-blue-900/50">
                                    <Info size={20} weight="fill" className="shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        Il sistema attiverà automaticamente questo menu all'inizio del servizio selezionato. Il menu rimane attivo fino all'inizio del pasto successivo impostato nelle impostazioni.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
