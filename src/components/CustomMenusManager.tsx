import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
    Plus, Trash, Calendar, Clock, CheckCircle, Utensils,
    Pencil, X, Check, CaretRight, Info, MagnifyingGlass,
    ArrowRight, Sparkle
} from '@phosphor-icons/react'
import type { CustomMenu, CustomMenuSchedule, Dish, MealType, Category } from '../services/types'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface CustomMenusManagerProps {
    restaurantId: string
    dishes: Dish[]
    categories: Category[]
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

export default function CustomMenusManager({ restaurantId, dishes, categories }: CustomMenusManagerProps) {
    const [customMenus, setCustomMenus] = useState<CustomMenu[]>([])
    const [selectedMenu, setSelectedMenu] = useState<CustomMenu | null>(null)
    const [menuDishes, setMenuDishes] = useState<string[]>([])
    const [schedules, setSchedules] = useState<CustomMenuSchedule[]>([])

    // Create Menu Dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newMenuName, setNewMenuName] = useState('')
    const [newMenuDescription, setNewMenuDescription] = useState('')

    // Editor State
    const [dishSearch, setDishSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'dishes' | 'schedule'>('dishes')

    // Data Fetching
    const fetchCustomMenus = async () => {
        const { data } = await supabase
            .from('custom_menus')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
        if (data) setCustomMenus(data)
    }

    const fetchMenuDishes = async (menuId: string) => {
        const { data } = await supabase
            .from('custom_menu_dishes')
            .select('dish_id')
            .eq('custom_menu_id', menuId)
        if (data) setMenuDishes(data.map(d => d.dish_id))
    }

    const fetchMenuSchedules = async (menuId: string) => {
        const { data } = await supabase
            .from('custom_menu_schedules')
            .select('*')
            .eq('custom_menu_id', menuId)
        if (data) setSchedules(data)
    }

    useEffect(() => {
        if (restaurantId) fetchCustomMenus()
    }, [restaurantId])

    useEffect(() => {
        if (selectedMenu) {
            fetchMenuDishes(selectedMenu.id)
            fetchMenuSchedules(selectedMenu.id)
            setActiveTab('dishes')
        }
    }, [selectedMenu])

    // Actions
    const handleCreateMenu = async () => {
        if (!newMenuName.trim()) {
            toast.error('Inserisci un nome per il menù')
            return
        }

        const { data, error } = await supabase
            .from('custom_menus')
            .insert({
                restaurant_id: restaurantId,
                name: newMenuName.trim(),
                description: newMenuDescription.trim() || null,
                is_active: false
            })
            .select()
            .single()

        if (error) {
            toast.error('Errore creazione menù')
        } else {
            toast.success('Menù creato')
            setNewMenuName('')
            setNewMenuDescription('')
            setShowCreateDialog(false)
            fetchCustomMenus()
            setSelectedMenu(data)
        }
    }

    const handleDeleteMenu = async (menuId: string) => {
        if (!confirm('Eliminare definitivamente questo menù?')) return

        const { error } = await supabase.from('custom_menus').delete().eq('id', menuId)

        if (error) {
            toast.error('Errore eliminazione')
        } else {
            toast.success('Menù eliminato')
            if (selectedMenu?.id === menuId) setSelectedMenu(null)
            fetchCustomMenus()
        }
    }

    const handleApplyMenu = async (menuId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        toast.message('Applicazione menu in corso...', { icon: '⏳' })
        const { error } = await supabase.rpc('apply_custom_menu', { p_restaurant_id: restaurantId, p_menu_id: menuId })

        if (error) {
            toast.error('Errore applicazione menù')
            console.error(error)
        } else {
            toast.success('Menù Attivato!', { description: 'I clienti vedranno solo i piatti di questo menu.' })
            fetchCustomMenus()
        }
    }

    const handleResetToFullMenu = async () => {
        toast.message('Ripristino menu completo...', { icon: '⏳' })
        const { error } = await supabase.rpc('reset_to_full_menu', { p_restaurant_id: restaurantId })

        if (error) {
            toast.error('Errore ripristino')
        } else {
            toast.success('Menu Completo Ripristinato')
            fetchCustomMenus()
        }
    }

    // Dish Management
    const handleToggleDish = async (dishId: string) => {
        if (!selectedMenu) return

        if (menuDishes.includes(dishId)) {
            // Optimistic update
            setMenuDishes(prev => prev.filter(id => id !== dishId))
            await supabase.from('custom_menu_dishes').delete().match({ custom_menu_id: selectedMenu.id, dish_id: dishId })
        } else {
            setMenuDishes(prev => [...prev, dishId])
            await supabase.from('custom_menu_dishes').insert({ custom_menu_id: selectedMenu.id, dish_id: dishId })
        }
    }

    const handleAddAllFromCategory = async (categoryId: string) => {
        if (!selectedMenu) return
        const categoryDishes = dishes.filter(d => d.category_id === categoryId).map(d => d.id)
        const newDishes = categoryDishes.filter(id => !menuDishes.includes(id))

        if (newDishes.length === 0) return // All already added

        const inserts = newDishes.map(dishId => ({ custom_menu_id: selectedMenu!.id, dish_id: dishId }))

        setMenuDishes(prev => [...prev, ...newDishes])
        await supabase.from('custom_menu_dishes').insert(inserts)
        toast.success(`Aggiunti ${newDishes.length} piatti`)
    }

    const handleRemoveAllFromCategory = async (categoryId: string) => {
        if (!selectedMenu) return
        const categoryDishes = dishes.filter(d => d.category_id === categoryId).map(d => d.id)

        setMenuDishes(prev => prev.filter(id => !categoryDishes.includes(id)))
        await supabase.from('custom_menu_dishes')
            .delete()
            .eq('custom_menu_id', selectedMenu.id)
            .in('dish_id', categoryDishes)
        toast.success(`Rimossi piatti dalla categoria`)
    }

    // Schedule Management
    const handleToggleSchedule = async (dayOfWeek: number, mealType: MealType) => {
        if (!selectedMenu) return
        const existing = schedules.find(s => s.day_of_week === dayOfWeek && s.meal_type === mealType)

        if (existing) {
            setSchedules(prev => prev.filter(s => s.id !== existing.id))
            await supabase.from('custom_menu_schedules').delete().eq('id', existing.id)
        } else {
            // Optimistic ID
            const tempId = Math.random().toString()
            const newSchedule = {
                id: tempId,
                custom_menu_id: selectedMenu.id,
                day_of_week: dayOfWeek,
                meal_type: mealType,
                is_active: true
            }
            setSchedules(prev => [...prev, newSchedule])

            const { data } = await supabase.from('custom_menu_schedules').insert({
                custom_menu_id: selectedMenu.id,
                day_of_week: dayOfWeek,
                meal_type: mealType,
                is_active: true
            }).select().single()

            if (data) {
                setSchedules(prev => prev.map(s => s.id === tempId ? data : s))
            }
        }
    }

    // Filtered Data
    const filteredDishes = useMemo(() => {
        return dishes.filter(d => d.name.toLowerCase().includes(dishSearch.toLowerCase()))
    }, [dishes, dishSearch])

    // Grouped for display
    const dishesByCategory = useMemo(() => {
        const grouped: Record<string, Dish[]> = {}
        categories.forEach(cat => grouped[cat.id] = [])
        filteredDishes.forEach(dish => {
            if (grouped[dish.category_id]) grouped[dish.category_id].push(dish)
        })
        return grouped
    }, [filteredDishes, categories])

    const activatedMenu = customMenus.find(m => m.is_active)

    // Render Editor (Full Screen Overlay)
    if (selectedMenu) {
        return (
            <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
                {/* Editor Header */}
                <div className="border-b border-border/40 bg-background/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedMenu(null)} className="rounded-full hover:bg-muted">
                            <X size={24} />
                        </Button>
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                {selectedMenu.name}
                                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">{selectedMenu.description || 'Custom Menu'}</Badge>
                            </h2>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1"><Utensils size={14} /> {menuDishes.length} Piatti</span>
                                <span className="flex items-center gap-1"><Calendar size={14} /> {schedules.length} Attivazioni</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!selectedMenu.is_active && (
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-lg shadow-emerald-500/20"
                                onClick={() => handleApplyMenu(selectedMenu.id)}
                            >
                                <CheckCircle size={18} weight="fill" className="mr-2" />
                                Attiva Ora
                            </Button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* LEFT: Navigation / Sidebar */}
                    <div className="w-full md:w-64 bg-muted/30 border-r border-border/40 p-4 flex flex-col gap-2">
                        <Button
                            variant={activeTab === 'dishes' ? 'secondary' : 'ghost'}
                            className={cn("justify-start text-lg h-12", activeTab === 'dishes' && "bg-background shadow-sm")}
                            onClick={() => setActiveTab('dishes')}
                        >
                            <Utensils className="mr-2" size={20} />
                            Selezione Piatti
                        </Button>
                        <Button
                            variant={activeTab === 'schedule' ? 'secondary' : 'ghost'}
                            className={cn("justify-start text-lg h-12", activeTab === 'schedule' && "bg-background shadow-sm")}
                            onClick={() => setActiveTab('schedule')}
                        >
                            <Calendar className="mr-2" size={20} />
                            Pianificazione
                        </Button>

                        <div className="mt-auto p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                            <h4 className="font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-2 text-sm">
                                <Info size={16} /> Nota
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                                Le modifiche vengono salvate automaticamente.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: Content Area */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                        {activeTab === 'dishes' ? (
                            <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
                                {/* Search Bar */}
                                <div className="relative mb-6">
                                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                    <Input
                                        placeholder="Cerca piatti..."
                                        value={dishSearch}
                                        onChange={(e) => setDishSearch(e.target.value)}
                                        className="pl-10 h-10 bg-background border-border/50 text-base"
                                    />
                                </div>

                                {/* Dual Column View */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0">
                                    {/* COLUMN 1: Menu Structure (Selected) */}
                                    <div className="flex flex-col h-full bg-background rounded-2xl border border-border/40 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                                            <h3 className="font-bold text-lg">Menu Selezionato</h3>
                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {menuDishes.length}
                                            </Badge>
                                        </div>
                                        <ScrollArea className="flex-1 p-4">
                                            {menuDishes.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                                                    <Utensils size={48} weight="duotone" />
                                                    <p>Nessun piatto selezionato</p>
                                                    <p className="text-sm">Seleziona i piatti dalla lista a destra</p>
                                                </div>
                                            ) : (
                                                categories.map(cat => {
                                                    const catDishes = dishes.filter(d => d.category_id === cat.id && menuDishes.includes(d.id))
                                                    if (catDishes.length === 0) return null
                                                    return (
                                                        <div key={cat.id} className="mb-6 animate-in slide-in-from-left-2 duration-300">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="font-bold text-sm text-primary uppercase tracking-wide">{cat.name}</h4>
                                                                <Button variant="ghost" size="xs" className="h-6 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleRemoveAllFromCategory(cat.id)}>Rimuovi Tutti</Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {catDishes.map(dish => (
                                                                    <div key={dish.id} onClick={() => handleToggleDish(dish.id)} className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-900/10 cursor-pointer hover:bg-destructive/5 hover:border-destructive/30 group transition-all">
                                                                        <div>
                                                                            <span className="font-medium">{dish.name}</span>
                                                                            <span className="text-muted-foreground ml-2 text-sm">€{dish.price}</span>
                                                                        </div>
                                                                        <X className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </ScrollArea>
                                    </div>

                                    {/* COLUMN 2: Available Dishes */}
                                    <div className="flex flex-col h-full bg-background rounded-2xl border border-border/40 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                                            <h3 className="font-bold text-lg">Tutti i Piatti</h3>
                                            <span className="text-xs text-muted-foreground">Clicca per aggiungere</span>
                                        </div>
                                        <ScrollArea className="flex-1 p-4">
                                            {categories.map(cat => {
                                                const catDishes = dishesByCategory[cat.id] || []
                                                const visibleDishes = catDishes.filter(d => !menuDishes.includes(d.id))
                                                if (visibleDishes.length === 0) return null

                                                return (
                                                    <div key={cat.id} className="mb-6">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">{cat.name}</h4>
                                                            <Button variant="ghost" size="xs" className="h-6 text-xs" onClick={() => handleAddAllFromCategory(cat.id)}>Aggiungi Tutti</Button>
                                                        </div>
                                                        <div className="grid gap-2">
                                                            {visibleDishes.map(dish => (
                                                                <div
                                                                    key={dish.id}
                                                                    onClick={() => handleToggleDish(dish.id)}
                                                                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all active:scale-[0.98]"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                                                            <Plus size={16} />
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium block">{dish.name}</span>
                                                                            <span className="text-muted-foreground text-xs">€{dish.price}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </ScrollArea>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 max-w-5xl mx-auto">
                                <div className="bg-background rounded-2xl border shadow-sm p-8">
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-bold">Pianificazione Settimanale</h3>
                                        <p className="text-muted-foreground">Seleziona quando attivare automaticamente questo menu.</p>
                                    </div>

                                    <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-4">
                                        {/* Header */}
                                        <div className="h-12"></div>
                                        {DAYS_OF_WEEK.map(day => (
                                            <div key={day.value} className="text-center font-bold text-muted-foreground uppercase">{day.label}</div>
                                        ))}

                                        {/* Rows */}
                                        {MEAL_TYPES.map(meal => (
                                            <>
                                                <div key={meal.value} className="h-20 flex items-center justify-end pr-4 font-bold text-primary">
                                                    {meal.label}
                                                </div>
                                                {DAYS_OF_WEEK.map(day => {
                                                    const isActive = schedules.some(s => s.day_of_week === day.value && s.meal_type === meal.value)
                                                    return (
                                                        <motion.button
                                                            key={`${day.value}-${meal.value}`}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleToggleSchedule(day.value, meal.value)}
                                                            className={cn(
                                                                "h-20 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2",
                                                                isActive
                                                                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                                    : "bg-muted/20 border-border hover:border-primary/50"
                                                            )}
                                                        >
                                                            {isActive ? <CheckCircle size={24} weight="fill" /> : <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />}
                                                            <span className="text-xs font-medium">{isActive ? 'Attivo' : '-'}</span>
                                                        </motion.button>
                                                    )
                                                })}
                                            </>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Dashboard View
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-3">
                        Menu Personalizzati
                        <Badge variant="outline" className="text-xs font-normal border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10">Premium</Badge>
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Crea menu limitati per eventi, pranzo di lavoro o festività.
                    </p>
                </div>
                <Button size="lg" onClick={() => setShowCreateDialog(true)} className="shadow-lg shadow-primary/20 rounded-full px-8">
                    <Plus weight="bold" className="mr-2 h-5 w-5" />
                    Nuovo Menu
                </Button>
            </div>

            {/* Status Hero Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl p-8">
                <div className="absolute top-0 right-0 p-48 bg-emerald-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className={cn(
                            "w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner text-4xl",
                            activatedMenu ? "bg-emerald-500 text-white shadow-emerald-500/40" : "bg-slate-700 text-slate-400"
                        )}>
                            {activatedMenu ? <Sparkle weight="fill" /> : <Utensils weight="duotone" />}
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold">
                                {activatedMenu ? activatedMenu.name : "Menu Completo (Standard)"}
                            </h3>
                            <p className="text-slate-300 mt-2 max-w-xl text-lg leading-relaxed">
                                {activatedMenu
                                    ? "Il menu attivo limita i piatti visibili ai clienti. Solo i piatti selezionati sono ordinabili."
                                    : "Attualmente tutti i piatti attivi nel database sono visibili e ordinabili dai clienti."
                                }
                            </p>
                        </div>
                    </div>

                    {activatedMenu && (
                        <Button
                            size="lg"
                            variant="secondary"
                            onClick={handleResetToFullMenu}
                            className="h-14 px-8 text-lg font-bold bg-white text-slate-900 hover:bg-slate-100 dark:bg-white dark:text-slate-900 shadow-xl"
                        >
                            Ripristina Standard
                        </Button>
                    )}
                </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <div
                    onClick={() => setShowCreateDialog(true)}
                    className="border-3 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center p-12 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:border-primary/50 transition-all group min-h-[250px]"
                >
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-primary">
                        <Plus size={32} />
                    </div>
                    <h4 className="font-bold text-lg text-muted-foreground group-hover:text-foreground">Crea Nuovo</h4>
                </div>

                {customMenus.map(menu => (
                    <motion.div
                        key={menu.id}
                        whileHover={{ y: -5 }}
                        className={cn(
                            "group relative rounded-3xl border bg-card text-card-foreground shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col min-h-[250px]",
                            menu.is_active && "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/10"
                        )}
                        onClick={() => setSelectedMenu(menu)}
                    >
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <Badge variant={menu.is_active ? "default" : "secondary"} className={cn("text-xs font-bold px-3 py-1", menu.is_active && "bg-emerald-500 hover:bg-emerald-600")}>
                                    {menu.is_active ? "ATTIVO" : "INATTIVO"}
                                </Badge>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMenu(menu.id) }}
                                >
                                    <Trash size={18} />
                                </Button>
                            </div>

                            <h3 className="text-2xl font-bold mb-2 break-words">{menu.name}</h3>
                            <p className="text-muted-foreground line-clamp-3">
                                {menu.description || "Nessuna descrizione."}
                            </p>
                        </div>

                        <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <Pencil size={14} /> Modifica
                            </span>

                            {!menu.is_active ? (
                                <Button
                                    size="sm"
                                    className="bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                    onClick={(e) => handleApplyMenu(menu.id, e)}
                                >
                                    Attiva
                                </Button>
                            ) : (
                                <span className="text-emerald-600 font-bold flex items-center gap-1 text-sm">
                                    <CheckCircle weight="fill" /> Applicato
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crea Nuovo Menu</DialogTitle>
                        <DialogDescription>Configura un nuovo menu personalizzato.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input value={newMenuName} onChange={e => setNewMenuName(e.target.value)} placeholder="Es. Menu Invernale" />
                        </div>
                        <div className="space-y-2">
                            <Label>Descrizione</Label>
                            <Input value={newMenuDescription} onChange={e => setNewMenuDescription(e.target.value)} placeholder="Opzionale" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annulla</Button>
                        <Button onClick={handleCreateMenu}>Crea Menu</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
