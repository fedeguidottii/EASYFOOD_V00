import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash, Calendar, Clock, CheckCircle, Utensils, Pencil, X, Check } from '@phosphor-icons/react'
import type { CustomMenu, CustomMenuSchedule, Dish, MealType } from '../services/types'
import { cn } from '@/lib/utils'

interface CustomMenusManagerProps {
    restaurantId: string
    dishes: Dish[]
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lunedì' },
    { value: 2, label: 'Martedì' },
    { value: 3, label: 'Mercoledì' },
    { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' },
    { value: 6, label: 'Sabato' },
    { value: 0, label: 'Domenica' }
]

const MEAL_TYPES: { value: MealType, label: string }[] = [
    { value: 'lunch', label: 'Pranzo' },
    { value: 'dinner', label: 'Cena' },
    { value: 'all', label: 'Tutto il Giorno' }
]

export default function CustomMenusManager({ restaurantId, dishes }: CustomMenusManagerProps) {
    const [customMenus, setCustomMenus] = useState<CustomMenu[]>([])
    const [selectedMenu, setSelectedMenu] = useState<CustomMenu | null>(null)
    const [menuDishes, setMenuDishes] = useState<string[]>([])
    const [schedules, setSchedules] = useState<CustomMenuSchedule[]>([])

    // Create Menu Dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newMenuName, setNewMenuName] = useState('')
    const [newMenuDescription, setNewMenuDescription] = useState('')
    const [isEditing, setIsEditing] = useState(false)

    // Fetch custom menus
    const fetchCustomMenus = async () => {
        const { data } = await supabase
            .from('custom_menus')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })

        if (data) setCustomMenus(data)
    }

    // Fetch dishes for a menu
    const fetchMenuDishes = async (menuId: string) => {
        const { data } = await supabase
            .from('custom_menu_dishes')
            .select('dish_id')
            .eq('custom_menu_id', menuId)

        if (data) setMenuDishes(data.map(d => d.dish_id))
    }

    // Fetch schedules for a menu
    const fetchMenuSchedules = async (menuId: string) => {
        const { data } = await supabase
            .from('custom_menu_schedules')
            .select('*')
            .eq('custom_menu_id', menuId)
            .order('day_of_week')

        if (data) setSchedules(data)
    }

    useEffect(() => {
        if (restaurantId) fetchCustomMenus()
    }, [restaurantId])

    useEffect(() => {
        if (selectedMenu) {
            fetchMenuDishes(selectedMenu.id)
            fetchMenuSchedules(selectedMenu.id)
            setIsEditing(true)
        } else {
            setIsEditing(false)
        }
    }, [selectedMenu])

    // Create new menu
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
            console.error(error)
        } else {
            toast.success('Menù creato')
            setNewMenuName('')
            setNewMenuDescription('')
            setShowCreateDialog(false)
            fetchCustomMenus()
            setSelectedMenu(data) // Open immediately
        }
    }

    // Delete menu
    const handleDeleteMenu = async (menuId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo menù?')) return

        const { error } = await supabase
            .from('custom_menus')
            .delete()
            .eq('id', menuId)

        if (error) {
            toast.error('Errore eliminazione menù')
        } else {
            toast.success('Menù eliminato')
            if (selectedMenu?.id === menuId) setSelectedMenu(null)
            fetchCustomMenus()
        }
    }

    // Toggle dish in menu
    const handleToggleDish = async (dishId: string) => {
        if (!selectedMenu) return

        if (menuDishes.includes(dishId)) {
            // Remove
            const { error } = await supabase
                .from('custom_menu_dishes')
                .delete()
                .eq('custom_menu_id', selectedMenu.id)
                .eq('dish_id', dishId)

            if (!error) setMenuDishes(prev => prev.filter(id => id !== dishId))
        } else {
            // Add
            const { error } = await supabase
                .from('custom_menu_dishes')
                .insert({
                    custom_menu_id: selectedMenu.id,
                    dish_id: dishId
                })

            if (!error) setMenuDishes(prev => [...prev, dishId])
        }
    }

    // Apply menu (activate it)
    const handleApplyMenu = async (menuId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()

        toast.loading('Applicazione menu in corso...')
        const { error } = await supabase.rpc('apply_custom_menu', { p_restaurant_id: restaurantId, p_menu_id: menuId })

        toast.dismiss()
        if (error) {
            toast.error('Errore applicazione menù')
            console.error(error)
        } else {
            toast.success('Menù applicato con successo!')
            fetchCustomMenus()
        }
    }

    // Reset to full menu
    const handleResetToFullMenu = async () => {
        toast.loading('Ripristino menu completo...')
        const { error } = await supabase.rpc('reset_to_full_menu', { p_restaurant_id: restaurantId })

        toast.dismiss()
        if (error) {
            toast.error('Errore ripristino menù completo')
            console.error(error)
        } else {
            toast.success('Menù completo ripristinato!')
            fetchCustomMenus()
        }
    }

    // Add schedule
    const handleToggleSchedule = async (dayOfWeek: number, mealType: MealType) => {
        if (!selectedMenu) return

        // Check if exists
        const existing = schedules.find(s => s.day_of_week === dayOfWeek && s.meal_type === mealType)

        if (existing) {
            // Delete
            await supabase.from('custom_menu_schedules').delete().eq('id', existing.id)
            setSchedules(prev => prev.filter(s => s.id !== existing.id))
        } else {
            // Add (first remove conflicting 'all' if trying to add 'lunch' or 'dinner', or vice versa)
            // Ideally we should manage conflicts, but for simplicity let's just add
            const { data, error } = await supabase
                .from('custom_menu_schedules')
                .insert({
                    custom_menu_id: selectedMenu.id,
                    day_of_week: dayOfWeek,
                    meal_type: mealType,
                    is_active: true
                })
                .select()
                .single()

            if (data) setSchedules(prev => [...prev, data])
            if (error) toast.error("Errore pianificazione")
        }
    }

    const activatedMenu = customMenus.find(m => m.is_active)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        Menu Personalizzati
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Gestisci menu speciali, carte vini, o menu stagionali ricorrenti.
                    </p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button size="lg" className="shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">
                            <Plus weight="bold" className="mr-2 h-5 w-5" />
                            Crea Nuovo Menu
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <DialogHeader>
                            <DialogTitle>Crea Menù Personalizzato</DialogTitle>
                            <DialogDescription>
                                Dai un nome al tuo menu (es. "Menu Invernale", "Speciale Sabato")
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Nome Menù</Label>
                                <Input
                                    value={newMenuName}
                                    onChange={(e) => setNewMenuName(e.target.value)}
                                    placeholder="es. Pranzo di Lavoro"
                                    className="bg-muted/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrizione (opzionale)</Label>
                                <Input
                                    value={newMenuDescription}
                                    onChange={(e) => setNewMenuDescription(e.target.value)}
                                    placeholder="Visibile solo allo staff"
                                    className="bg-muted/50"
                                />
                            </div>
                            <Button onClick={handleCreateMenu} className="w-full mt-2" size="lg">
                                Crea e Configura
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Active Status Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/40 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner",
                            activatedMenu
                                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        )}>
                            {activatedMenu ? <CheckCircle weight="fill" className="w-8 h-8" /> : <Utensils weight="duotone" className="w-8 h-8" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">
                                {activatedMenu ? `Menu Attivo: ${activatedMenu.name}` : "Menu Completo Attivo"}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                                {activatedMenu
                                    ? "I clienti vedranno solo i piatti inclusi in questo menu personalizzato."
                                    : "Attualmente è visibile l'intero listino piatti del ristorante."
                                }
                            </p>
                        </div>
                    </div>
                    {activatedMenu && (
                        <Button
                            variant="outline"
                            onClick={handleResetToFullMenu}
                            className="bg-white/80 dark:bg-black/20 backdrop-blur-sm border-emerald-200 dark:border-emerald-800 hover:bg-white dark:hover:bg-black/40 text-emerald-700 dark:text-emerald-300 shadow-sm"
                        >
                            Ripristina Menu Completo
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Menu Grid */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {customMenus.map(menu => (
                    <Card
                        key={menu.id}
                        className={cn(
                            "group hover:shadow-xl transition-all duration-300 border-l-4 overflow-hidden relative cursor-pointer",
                            menu.is_active
                                ? "border-l-emerald-500 border-y-slate-200 border-r-slate-200 dark:border-y-slate-800 dark:border-r-slate-800 bg-emerald-50/10 dark:bg-emerald-900/10"
                                : "border-l-transparent hover:border-l-slate-300 dark:hover:border-l-slate-600 border-slate-200 dark:border-slate-800"
                        )}
                        onClick={() => setSelectedMenu(menu)}
                    >
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex justify-between items-start">
                                <Badge variant={menu.is_active ? "default" : "secondary"} className={cn("mb-2", menu.is_active ? "bg-emerald-500 hover:bg-emerald-600" : "")}>
                                    {menu.is_active ? "ATTIVO ORA" : "INATTIVO"}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive p-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteMenu(menu.id)
                                    }}
                                >
                                    <Trash size={16} />
                                </Button>
                            </div>
                            <CardTitle className="text-xl flex items-center justify-between">
                                <span className="line-clamp-1" title={menu.name}>{menu.name}</span>
                            </CardTitle>
                            <CardDescription className="line-clamp-2 min-h-[40px]">
                                {menu.description || "Nessuna descrizione"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="flex items-center justify-between mt-2 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Pencil size={12} /> Modifica
                                </span>
                                {menu.is_active ? (
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <CheckCircle weight="fill" /> Applicato
                                    </span>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="h-8 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800"
                                        onClick={(e) => handleApplyMenu(menu.id, e)}
                                    >
                                        Attiva Menu
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Add New Card (Empty State) */}
                <Card
                    className="border-dashed border-2 border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer flex flex-col items-center justify-center p-8 transition-colors min-h-[220px]"
                    onClick={() => setShowCreateDialog(true)}
                >
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
                        <Plus size={32} />
                    </div>
                    <p className="font-semibold text-muted-foreground">Crea Nuovo Menu</p>
                </Card>
            </div>

            {/* EDIT SIDE SHEET */}
            <Sheet open={!!selectedMenu} onOpenChange={(open) => !open && setSelectedMenu(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto bg-white dark:bg-slate-950 p-0 border-l border-slate-200 dark:border-slate-800">
                    {selectedMenu && (
                        <div className="flex flex-col h-full">
                            {/* Sheet Header */}
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
                                <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline" className="bg-background">Editor Menu</Badge>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedMenu(null)}>
                                        <X size={20} />
                                    </Button>
                                </div>
                                <SheetTitle className="text-3xl font-bold">{selectedMenu.name}</SheetTitle>
                                <SheetDescription className="text-base mt-1">Configura piatti e pianificazione</SheetDescription>

                                {!selectedMenu.is_active && (
                                    <Button
                                        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                                        onClick={() => handleApplyMenu(selectedMenu.id)}
                                    >
                                        <CheckCircle weight="fill" className="mr-2 text-lg" />
                                        Attiva Questo Menu Ora
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 p-6 space-y-10">
                                {/* 1. Dish Selection */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-bold flex items-center gap-2">
                                            <Utensils className="text-emerald-500" />
                                            Selezione Piatti
                                        </h4>
                                        <Badge variant="secondary">{menuDishes.length} selezionati</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        I piatti non selezionati verranno nascosti quando questo menu è attivo.
                                    </p>

                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <div className="max-h-[400px] overflow-y-auto p-2 grid gap-1">
                                            {dishes.length === 0 ? (
                                                <p className="p-8 text-center text-muted-foreground">Nessun piatto nel database.</p>
                                            ) : (
                                                dishes.map(dish => {
                                                    const isSelected = menuDishes.includes(dish.id)
                                                    return (
                                                        <div
                                                            key={dish.id}
                                                            onClick={() => handleToggleDish(dish.id)}
                                                            className={cn(
                                                                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border",
                                                                isSelected
                                                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 shadow-sm"
                                                                    : "hover:bg-white dark:hover:bg-slate-800 border-transparent"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                                                                isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-600"
                                                            )}>
                                                                {isSelected && <Check size={12} weight="bold" />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={cn("font-medium text-sm", isSelected ? "text-emerald-900 dark:text-emerald-100" : "text-foreground")}>{dish.name}</p>
                                                            </div>
                                                            <div className="font-mono text-xs font-semibold text-muted-foreground">
                                                                €{dish.price.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* 2. Weekly Scheduler */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-bold flex items-center gap-2">
                                            <Calendar className="text-indigo-500" />
                                            Pianificazione Settimanale
                                        </h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Clicca sulle celle per attivare automaticamente questo menu in giorni e orari specifici.
                                    </p>

                                    <div className="overflow-x-auto pb-4">
                                        <div className="min-w-[500px] grid grid-cols-[100px_repeat(7,1fr)] gap-2">
                                            {/* Header Row: Days */}
                                            <div className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-2">Orario</div>
                                            {DAYS_OF_WEEK.map(day => (
                                                <div key={day.value} className="text-center font-bold text-xs text-muted-foreground uppercase tracking-wider py-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                                                    {day.label.slice(0, 3)}
                                                </div>
                                            ))}

                                            {/* Meal Rows */}
                                            {MEAL_TYPES.filter(m => m.value !== 'all').map(meal => (
                                                <>
                                                    <div key={meal.value} className="font-medium text-sm py-3 flex items-center">
                                                        {meal.label}
                                                    </div>
                                                    {DAYS_OF_WEEK.map(day => {
                                                        const isActive = schedules.some(s => s.day_of_week === day.value && s.meal_type === meal.value)
                                                        return (
                                                            <button
                                                                key={`${day.value}-${meal.value}`}
                                                                onClick={() => handleToggleSchedule(day.value, meal.value)}
                                                                className={cn(
                                                                    "h-12 rounded-lg transition-all duration-200 border-2 flex items-center justify-center",
                                                                    isActive
                                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                                                        : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                                )}
                                                            >
                                                                {isActive && <Check weight="bold" />}
                                                            </button>
                                                        )
                                                    })}
                                                </>
                                            ))}
                                        </div>
                                    </div>

                                    {schedules.length > 0 && (
                                        <div className="p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/20 text-xs text-indigo-600 dark:text-indigo-400">
                                            <p className="font-medium flex items-center gap-2">
                                                <Clock weight="fill" />
                                                Automazione Attiva
                                            </p>
                                            <p className="mt-1 opacity-90">
                                                Il sistema verificherà ogni minuto e applicherà questo menu negli orari selezionati.
                                                Assicurati che la Dashboard sia aperta su almeno un dispositivo.
                                            </p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
