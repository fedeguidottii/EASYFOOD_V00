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
    CalendarCheck, Check
} from '@phosphor-icons/react'
import type { CustomMenu, CustomMenuSchedule, Dish, MealType, Category } from '../services/types'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'

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
            <div className="flex flex-col h-[500px] md:h-[600px] w-full max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6 px-1">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Menu Personalizzati</h2>
                        <p className="text-sm text-muted-foreground">Crea sottomenu per eventi o orari specifici</p>
                    </div>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                                <Plus size={16} /> Nuovo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nuovo Menu</DialogTitle>
                                <DialogDescription>Dai un nome al tuo menu personalizzato</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label>Nome Menu</Label>
                                <Input
                                    value={newMenuName}
                                    onChange={(e) => setNewMenuName(e.target.value)}
                                    placeholder="Es. Menu Pranzo"
                                    className="mt-2"
                                />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateMenu}>Crea</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 px-1">
                    {/* Active Status Banner */}
                    <div className={cn(
                        "p-4 rounded-xl border flex items-center justify-between transition-all",
                        activeMenu
                            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                            : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                    )}>
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                activeMenu ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400" : "bg-slate-200 text-slate-500"
                            )}>
                                {activeMenu ? <Sparkle weight="fill" size={20} /> : <ForkKnife size={20} />}
                            </div>
                            <div>
                                <h4 className="font-medium text-sm">
                                    {activeMenu ? `Attivo: ${activeMenu.name}` : "Menu Completo Attivo"}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    {activeMenu
                                        ? "I clienti vedono solo i piatti selezionati."
                                        : "Tutti i piatti attivi sono visibili ai clienti."}
                                </p>
                            </div>
                        </div>
                        {activeMenu && (
                            <Button variant="outline" size="sm" onClick={handleResetToFullMenu} className="h-8 text-xs bg-background">
                                Ripristina Standard
                            </Button>
                        )}
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {customMenus.map(menu => (
                            <div
                                key={menu.id}
                                onClick={() => openEditor(menu)}
                                className={cn(
                                    "group relative p-4 rounded-xl border bg-background hover:shadow-md transition-all cursor-pointer flex flex-col justify-between",
                                    menu.is_active && "ring-1 ring-emerald-500 border-emerald-500"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-sm truncate pr-6">{menu.name}</h3>
                                    {menu.is_active && (
                                        <Badge className="bg-emerald-500 text-white text-[10px] h-5">ATTIVO</Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md group-hover:bg-slate-200 dark:group-hover:bg-slate-800 transition-colors">
                                        Modifica
                                    </span>
                                    <div className="flex gap-1">
                                        {!menu.is_active && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                                onClick={(e) => handleApplyMenu(menu.id, e)}
                                                title="Attiva"
                                            >
                                                <CheckCircle size={16} />
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => handleDeleteMenu(menu.id, e)}
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {customMenus.length === 0 && (
                            <div className="col-span-full py-10 text-center text-muted-foreground bg-muted/20 dashed border rounded-xl">
                                <CopySimple size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nessun menu personalizzato creato.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // --- VIEW: EDITOR ---
    return (
        <div className="flex flex-col h-[600px] -m-6">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={closeEditor} className="h-8 w-8 rounded-full">
                        <X size={18} />
                    </Button>
                    <div>
                        <h2 className="font-bold text-lg leading-none">{selectedMenu?.name}</h2>
                        <span className="text-xs text-muted-foreground">
                            {menuDishes.length} Piatti • {schedules.length} Attivazioni
                        </span>
                    </div>
                </div>
                {!selectedMenu?.is_active && (
                    <Button size="sm" onClick={() => selectedMenu && handleApplyMenu(selectedMenu.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs">
                        Attiva Ora
                    </Button>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-16 sm:w-48 border-r bg-muted/20 flex flex-col gap-1 p-2">
                    <Button
                        variant={editorTab === 'dishes' ? 'secondary' : 'ghost'}
                        className={cn("justify-start h-10 px-2 sm:px-4", editorTab === 'dishes' && "bg-background shadow-sm")}
                        onClick={() => setEditorTab('dishes')}
                    >
                        <ForkKnife className="sm:mr-2" size={18} />
                        <span className="hidden sm:inline text-xs font-medium">Piatti</span>
                    </Button>
                    <Button
                        variant={editorTab === 'schedule' ? 'secondary' : 'ghost'}
                        className={cn("justify-start h-10 px-2 sm:px-4", editorTab === 'schedule' && "bg-background shadow-sm")}
                        onClick={() => setEditorTab('schedule')}
                    >
                        <CalendarCheck className="sm:mr-2" size={18} />
                        <span className="hidden sm:inline text-xs font-medium">Orari</span>
                    </Button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden bg-background">
                    {editorTab === 'dishes' ? (
                        <>
                            <div className="p-3 border-b">
                                <div className="relative">
                                    <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                    <Input
                                        placeholder="Cerca piatto..."
                                        value={dishSearch}
                                        onChange={(e) => setDishSearch(e.target.value)}
                                        className="h-8 pl-8 text-xs bg-muted/30"
                                    />
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                {filteredCategories.map(cat => {
                                    const catDishes = dishes.filter(d => d.category_id === cat.id)
                                    if (dishSearch && catDishes.every(d => !d.name.toLowerCase().includes(dishSearch.toLowerCase()))) return null
                                    
                                    const visibleDishes = dishSearch 
                                        ? catDishes.filter(d => d.name.toLowerCase().includes(dishSearch.toLowerCase()))
                                        : catDishes

                                    if (visibleDishes.length === 0) return null

                                    return (
                                        <div key={cat.id} className="mb-6">
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 sticky top-0 bg-background py-1 z-10">
                                                {cat.name}
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {visibleDishes.map(dish => {
                                                    const isSelected = menuDishes.includes(dish.id)
                                                    return (
                                                        <div
                                                            key={dish.id}
                                                            onClick={() => handleToggleDish(dish.id)}
                                                            className={cn(
                                                                "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all active:scale-[0.98]",
                                                                isSelected 
                                                                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 ring-1 ring-emerald-500/20" 
                                                                    : "hover:bg-muted/50 border-transparent hover:border-border"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                                                                    isSelected ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground"
                                                                )}>
                                                                    {isSelected && <Check size={10} className="text-white" weight="bold" />}
                                                                </div>
                                                                <span className={cn("text-sm truncate", isSelected && "font-medium")}>{dish.name}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">€{dish.price}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex-1 p-6 flex flex-col items-center justify-center">
                            <div className="max-w-md w-full">
                                <h3 className="text-center font-semibold mb-6">Programmazione Automatica</h3>
                                <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-2">
                                    <div className="h-8"></div>
                                    {DAYS_OF_WEEK.map(day => (
                                        <div key={day.value} className="text-center text-[10px] font-bold text-muted-foreground">{day.label}</div>
                                    ))}

                                    {MEAL_TYPES.map(meal => (
                                        <>
                                            <div key={meal.value} className="h-10 flex items-center justify-end pr-2 text-xs font-medium">
                                                {meal.label}
                                            </div>
                                            {DAYS_OF_WEEK.map(day => {
                                                const isActive = schedules.some(s => s.day_of_week === day.value && s.meal_type === meal.value)
                                                return (
                                                    <button
                                                        key={`${day.value}-${meal.value}`}
                                                        onClick={() => handleToggleSchedule(day.value, meal.value)}
                                                        className={cn(
                                                            "h-10 rounded-md transition-all flex items-center justify-center border",
                                                            isActive
                                                                ? "bg-emerald-500 border-emerald-600 text-white"
                                                                : "bg-muted/30 border-transparent hover:border-border"
                                                        )}
                                                    >
                                                        {isActive && <Check size={14} weight="bold" />}
                                                    </button>
                                                )
                                            })}
                                        </>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-6">
                                    Il menu verrà attivato automaticamente negli orari selezionati.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
