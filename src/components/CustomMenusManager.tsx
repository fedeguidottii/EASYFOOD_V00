import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { toast } from 'sonner'
import { Plus, Trash, Calendar, Clock, CheckCircle, Utensils } from '@phosphor-icons/react'
import type { CustomMenu, CustomMenuSchedule, Dish, MealType } from '../services/types'

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

export default function CustomMenusManager({ restaurantId, dishes }: CustomMenusManagerProps) {
    const [customMenus, setCustomMenus] = useState<CustomMenu[]>([])
    const [selectedMenu, setSelectedMenu] = useState<CustomMenu | null>(null)
    const [menuDishes, setMenuDishes] = useState<string[]>([])
    const [schedules, setSchedules] = useState<CustomMenuSchedule[]>([])

    // Create Menu Dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newMenuName, setNewMenuName] = useState('')
    const [newMenuDescription, setNewMenuDescription] = useState('')

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
        }
    }

    // Delete menu
    const handleDeleteMenu = async (menuId: string) => {
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
            await supabase
                .from('custom_menu_dishes')
                .delete()
                .eq('custom_menu_id', selectedMenu.id)
                .eq('dish_id', dishId)
        } else {
            // Add
            await supabase
                .from('custom_menu_dishes')
                .insert({
                    custom_menu_id: selectedMenu.id,
                    dish_id: dishId
                })
        }

        fetchMenuDishes(selectedMenu.id)
    }

    // Apply menu (activate it)
    const handleApplyMenu = async (menuId: string) => {
        const { error } = await supabase.rpc('apply_custom_menu', { menu_id: menuId })

        if (error) {
            toast.error('Errore applicazione menù')
            console.error(error)
        } else {
            toast.success('Menù applicato! Piatti aggiornati.')
            fetchCustomMenus()
        }
    }

    // Reset to full menu
    const handleResetToFullMenu = async () => {
        const { error } = await supabase.rpc('reset_to_full_menu', { restaurant_uuid: restaurantId })

        if (error) {
            toast.error('Errore ripristino menù completo')
            console.error(error)
        } else {
            toast.success('Menù completo ripristinato!')
            fetchCustomMenus()
        }
    }

    // Add schedule
    const handleAddSchedule = async (dayOfWeek: number | null, mealType: MealType) => {
        if (!selectedMenu) return

        const { error } = await supabase
            .from('custom_menu_schedules')
            .insert({
                custom_menu_id: selectedMenu.id,
                day_of_week: dayOfWeek,
                meal_type: mealType,
                is_active: true
            })

        if (error) {
            toast.error('Errore aggiunta pianificazione')
            console.error(error)
        } else {
            toast.success('Pianificazione aggiunta')
            fetchMenuSchedules(selectedMenu.id)
        }
    }

    // Delete schedule
    const handleDeleteSchedule = async (scheduleId: string) => {
        const { error } = await supabase
            .from('custom_menu_schedules')
            .delete()
            .eq('id', scheduleId)

        if (error) {
            toast.error('Errore eliminazione pianificazione')
        } else {
            toast.success('Pianificazione eliminata')
            if (selectedMenu) fetchMenuSchedules(selectedMenu.id)
        }
    }

    const activatedMenu = customMenus.find(m => m.is_active)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-semibold">Menù Personalizzati</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Crea menù ricorrenti e pianifica quando attivarli automaticamente
                    </p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus size={16} className="mr-2" />
                            Nuovo Menù
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crea Menù Personalizzato</DialogTitle>
                            <DialogDescription>
                                Crea un nuovo menù e seleziona quali piatti mostrare
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div>
                                <Label>Nome Menù</Label>
                                <Input
                                    value={newMenuName}
                                    onChange={(e) => setNewMenuName(e.target.value)}
                                    placeholder="es. Menù Pranzo, Menù Weekend..."
                                />
                            </div>
                            <div>
                                <Label>Descrizione (opzionale)</Label>
                                <Input
                                    value={newMenuDescription}
                                    onChange={(e) => setNewMenuDescription(e.target.value)}
                                    placeholder="Breve descrizione del menù"
                                />
                            </div>
                            <Button onClick={handleCreateMenu} className="w-full">
                                Crea Menù
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Active Menu Status */}
            {activatedMenu && (
                <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CheckCircle size={24} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
                            <div>
                                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                                    Menù Attivo: {activatedMenu.name}
                                </p>
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                    I piatti sono filtrati secondo questo menù
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleResetToFullMenu}>
                            Ripristina Menù Completo
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Menus List */}
            <div className="grid gap-4 md:grid-cols-2">
                {customMenus.map(menu => (
                    <Card
                        key={menu.id}
                        className={`cursor-pointer transition-all ${selectedMenu?.id === menu.id ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => setSelectedMenu(menu)}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {menu.name}
                                        {menu.is_active && (
                                            <Badge variant="default" className="bg-emerald-600">Attivo</Badge>
                                        )}
                                    </CardTitle>
                                    {menu.description && (
                                        <CardDescription className="mt-1">{menu.description}</CardDescription>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteMenu(menu.id)
                                    }}
                                >
                                    <Trash size={16} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <Button
                                    size="sm"
                                    variant={menu.is_active ? "outline" : "default"}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleApplyMenu(menu.id)
                                    }}
                                    disabled={menu.is_active}
                                >
                                    {menu.is_active ? 'Già Attivo' : 'Attiva Menù'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {customMenus.length === 0 && (
                    <Card className="col-span-2">
                        <CardContent className="pt-16 pb-16 text-center text-muted-foreground">
                            <Utensils size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nessun menù personalizzato creato</p>
                            <p className="text-sm mt-2">Clicca su "Nuovo Menù" per iniziare</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Menu Editor */}
            {selectedMenu && (
                <Card>
                    <CardHeader>
                        <CardTitle>Modifica Menù: {selectedMenu.name}</CardTitle>
                        <CardDescription>Seleziona i piatti da includere in questo menù</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {/* Dish Selection */}
                            <div>
                                <h4 className="font-medium mb-3">Piatti nel Menù</h4>
                                <div className="grid gap-2 max-h-96 overflow-y-auto border rounded-lg p-3">
                                    {dishes.map(dish => (
                                        <label
                                            key={dish.id}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={menuDishes.includes(dish.id)}
                                                onCheckedChange={() => handleToggleDish(dish.id)}
                                            />
                                            <span className="flex-1">{dish.name}</span>
                                            <Badge variant="outline" className="text-xs">
                                                €{dish.price.toFixed(2)}
                                            </Badge>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {menuDishes.length} piatti selezionati
                                </p>
                            </div>

                            {/* Schedule Section */}
                            <div>
                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                    <Calendar size={16} />
                                    Pianificazione Automatica
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Imposta quando questo menù deve essere attivato automaticamente
                                </p>

                                {/* Add Schedule Buttons */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {DAYS_OF_WEEK.map(day => (
                                        <Button
                                            key={day.value}
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAddSchedule(day.value, 'all')}
                                        >
                                            + {day.label}
                                        </Button>
                                    ))}
                                </div>

                                {/* Existing Schedules */}
                                {schedules.length > 0 ? (
                                    <div className="space-y-2">
                                        {schedules.map(schedule => (
                                            <div
                                                key={schedule.id}
                                                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Clock size={16} className="text-muted-foreground" />
                                                    <span className="font-medium">
                                                        {schedule.day_of_week !== null && schedule.day_of_week !== undefined
                                                            ? DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label
                                                            : 'Ogni giorno'}
                                                    </span>
                                                    <Badge variant="secondary">
                                                        {schedule.meal_type === 'lunch' ? 'Pranzo' : schedule.meal_type === 'dinner' ? 'Cena' : 'Tutto il giorno'}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive"
                                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                                >
                                                    <Trash size={14} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                                        Nessuna pianificazione impostata
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
