import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Calendar, Users, Clock, CaretRight, CheckCircle, Storefront, MapPin, Warning, Utensils, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Restaurant, Room, Table, Category, Dish } from '../../services/types'
import { motion, AnimatePresence } from 'framer-motion'

const PublicReservationPage = () => {
    const { restaurantId } = useParams()

    // State
    const [step, setStep] = useState<'details' | 'confirm' | 'success'>('details')
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [rooms, setRooms] = useState<Room[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [dishes, setDishes] = useState<Dish[]>([])
    
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Form Data
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [pax, setPax] = useState('2')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [time, setTime] = useState('19:30')
    const [selectedRoomId, setSelectedRoomId] = useState<string>('any')
    const [notes, setNotes] = useState('')

    // Assigned Table (calculated - internal only)
    const [assignedTable, setAssignedTable] = useState<Table | null>(null)
    const [noAvailability, setNoAvailability] = useState(false)
    const [alternativeTimes, setAlternativeTimes] = useState<string[]>([])

    useEffect(() => {
        if (!restaurantId) return

        const fetchData = async () => {
            try {
                // Fetch Restaurant Info
                const { data: rData } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
                if (rData) setRestaurant(rData)

                // Fetch Rooms
                const { data: roomsData } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('restaurant_id', restaurantId)
                    .eq('is_active', true)
                    .order('order')
                if (roomsData) setRooms(roomsData)

                // Fetch Menu for Preview
                const { data: catData } = await supabase
                  .from('categories')
                  .select('*')
                  .eq('restaurant_id', restaurantId)
                  .order('order')
                if (catData) setCategories(catData)

                const { data: dishData } = await supabase
                  .from('dishes')
                  .select('*')
                  .eq('restaurant_id', restaurantId)
                  .eq('is_available', true)
                if (dishData) setDishes(dishData)

                setLoading(false)
            } catch (err) {
                console.error("Error loading reservation data", err)
                toast.error("Errore caricamento dati ristorante")
                setLoading(false)
            }
        }
        fetchData()
    }, [restaurantId])

    const checkTimeSlot = async (checkTime: string, checkDate: string, checkRooms: string, checkPax: number) => {
         try {
            const tables = await DatabaseService.getTables(restaurantId!)

            // Fetch existing bookings for that day
            const { data: existingBookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .gte('date_time', `${checkDate}T00:00:00`)
                .lte('date_time', `${checkDate}T23:59:59`)
                .neq('status', 'CANCELLED')

            const requestedDateTime = new Date(`${checkDate}T${checkTime}`)
            const durationMs = 120 * 60 * 1000 // 2 hours
            const reqStart = requestedDateTime.getTime()
            const reqEnd = reqStart + durationMs

            const suitableTables = tables.filter(t => {
                // Capacity check
                if ((t.seats || 4) < checkPax) return false

                // Room check
                if (checkRooms !== 'any' && t.room_id !== checkRooms) return false

                // Availability check
                const isOccupied = existingBookings?.some(b => {
                    if (b.table_id !== t.id) return false
                    const bStart = new Date(b.date_time).getTime()
                    const bEnd = bStart + durationMs
                    return (reqStart < bEnd && reqEnd > bStart)
                })

                return !isOccupied
            })

            // Sort by best fit
            suitableTables.sort((a, b) => (a.seats || 0) - (b.seats || 0))
            return suitableTables.length > 0 ? suitableTables[0] : null
        } catch (err) {
            console.error("Algorithm error", err)
            return null
        }
    }

    const handleCheckAvailability = async () => {
        if (!name.trim() || !phone.trim() || !date || !time) {
            toast.error("Compila tutti i campi obbligatori")
            return
        }

        setLoading(true)
        setNoAvailability(false)
        setAlternativeTimes([])
        
        const table = await checkTimeSlot(time, date, selectedRoomId, parseInt(pax))

        if (table) {
            setAssignedTable(table)
            setStep('confirm')
        } else {
            // Check for alternatives
            setNoAvailability(true)
            const alternatives: string[] = []
            
            // Generate some times around the selected time
            const baseTime = new Date(`${date}T${time}`)
            const offsets = [-60, -30, 30, 60] // Minutes
            
            for (const offset of offsets) {
                const altDate = new Date(baseTime.getTime() + offset * 60000)
                const altTimeStr = altDate.toTimeString().substring(0, 5) // "HH:MM"
                
                // Very basic check to ensure it's still same day (or handle appropriately)
                if (altDate.getDate() !== baseTime.getDate()) continue;

                const altTable = await checkTimeSlot(altTimeStr, date, selectedRoomId, parseInt(pax))
                if (altTable) {
                    alternatives.push(altTimeStr)
                }
            }
            
            setAlternativeTimes(alternatives)
            toast.error("Tavolo non disponibile per l'orario selezionato.")
        }
        setLoading(false)
    }

    const handleConfirmBooking = async () => {
        if (!assignedTable || !restaurantId) return

        try {
            setSubmitting(true)
            const bookingDate = new Date(`${date}T${time}`).toISOString()

            await DatabaseService.createBooking({
                restaurant_id: restaurantId,
                table_id: assignedTable.id,
                name: name.trim(),
                phone: phone.trim(),
                guests: parseInt(pax),
                date_time: bookingDate,
                status: 'CONFIRMED',
                notes: notes ? `[Self-Service] ${notes}` : `[Self-Service]`
            })

            setStep('success')
        } catch (err) {
            console.error(err)
            toast.error("Impossibile completare la prenotazione")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading && !restaurant) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-emerald-500">
                 <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="animate-pulse">Caricamento...</p>
                 </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            
            {/* Hero Section */}
            <div className="relative h-64 md:h-80 w-full bg-slate-900 overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/90 z-10" />
                 {restaurant?.cover_image_url ? (
                     <img src={restaurant.cover_image_url} alt="Cover" className="w-full h-full object-cover opacity-60" />
                 ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <Storefront size={64} className="text-slate-700" />
                    </div>
                 )}
                 
                 <div className="absolute bottom-0 left-0 w-full p-6 z-20 flex flex-col items-center md:items-start md:pl-10 lg:pl-20">
                    <div className="w-24 h-24 bg-slate-900 rounded-full p-1 shadow-2xl border-4 border-slate-800 mb-4 overflow-hidden">
                        {restaurant?.logo_url ? (
                            <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                <Storefront size={32} className="text-emerald-500" />
                            </div>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{restaurant?.name || 'Prenotazioni'}</h1>
                    <p className="text-slate-300 max-w-md text-center md:text-left">
                        Reserve your table online instantly.
                    </p>
                 </div>
            </div>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Form */}
                <div className="lg:col-span-2 space-y-6">
                    <AnimatePresence mode="wait">
                    {step === 'details' && (
                        <motion.div 
                            key="details"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Card className="bg-slate-900/50 border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">1</div>
                                        <CardTitle className="text-xl">Dettagli Prenotazione</CardTitle>
                                    </div>
                                    <CardDescription>Inserisci i tuoi dati per verificare la disponibilità</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Data e Ora</Label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        type="date"
                                                        value={date}
                                                        onChange={(e) => setDate(e.target.value)}
                                                        className="pl-10 bg-slate-950 border-slate-700 focus:border-emerald-500"
                                                        min={new Date().toISOString().split('T')[0]}
                                                    />
                                                </div>
                                                <div className="relative w-32">
                                                    <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        type="time"
                                                        value={time}
                                                        onChange={(e) => setTime(e.target.value)}
                                                        className="pl-10 bg-slate-950 border-slate-700 focus:border-emerald-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Ospiti & Sala</Label>
                                            <div className="flex gap-2">
                                                 <div className="relative w-24">
                                                    <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        value={pax}
                                                        onChange={(e) => setPax(e.target.value)}
                                                        className="pl-10 bg-slate-950 border-slate-700 focus:border-emerald-500"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200">
                                                            <SelectValue placeholder="Sala" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="any">Qualsiasi Sala</SelectItem>
                                                            {rooms.map(r => (
                                                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-800">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-slate-300">Nome Completo *</Label>
                                                <Input
                                                    placeholder="Mario Rossi"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="bg-slate-950 border-slate-700 focus:border-emerald-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-300">Telefono *</Label>
                                                <Input
                                                    type="tel"
                                                    placeholder="+39 333 ..."
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    className="bg-slate-950 border-slate-700 focus:border-emerald-500"
                                                />
                                            </div>
                                        </div>
                                         <div className="space-y-2">
                                            <Label className="text-slate-300">Note aggiuntive</Label>
                                            <Input
                                                placeholder="Intolleranze, seggiolone, ecc..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="bg-slate-950 border-slate-700 focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    {noAvailability && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <Warning size={24} className="text-red-400" />
                                                <div>
                                                    <p className="font-medium text-red-200">Nessun tavolo disponibile alle {time}</p>
                                                    <p className="text-sm text-red-300/60">Prova un altro orario o un'altra data.</p>
                                                </div>
                                            </div>
                                            
                                            {alternativeTimes.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-sm text-slate-300 mb-2">Orari alternativi disponibili per oggi:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {alternativeTimes.map(t => (
                                                            <Button 
                                                                key={t} 
                                                                variant="outline" 
                                                                size="sm"
                                                                className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                                                onClick={() => {
                                                                    setTime(t)
                                                                    setNoAvailability(false)
                                                                    setAlternativeTimes([])
                                                                }}
                                                            >
                                                                {t}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    <Button
                                        onClick={handleCheckAvailability}
                                        disabled={loading}
                                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-lg shadow-lg shadow-emerald-900/50 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        {loading ? 'Verifica...' : 'Continua'}
                                        <CaretRight weight="bold" className="ml-2" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {step === 'confirm' && (
                        <motion.div 
                            key="confirm"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <Card className="bg-slate-900/50 border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">2</div>
                                        <CardTitle className="text-xl">Conferma Prenotazione</CardTitle>
                                    </div>
                                    <CardDescription>Rivedi i dettagli prima di confermare. Nessun pagamento richiesto.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-800 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                                <Calendar size={24} weight="duotone" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-400">Data e Ora</p>
                                                <p className="text-lg font-semibold text-white">
                                                    {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                                <p className="text-emerald-400 font-bold text-xl">{time}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="h-px bg-slate-800" />
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3">
                                                <Users className="text-slate-400" />
                                                <div>
                                                    <p className="text-xs text-slate-400">Ospiti</p>
                                                    <p className="font-medium text-slate-200">{pax} Persone</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <MapPin className="text-slate-400" />
                                                <div>
                                                    <p className="text-xs text-slate-400">Sala</p>
                                                    <p className="font-medium text-slate-200">
                                                        {selectedRoomId === 'any' 
                                                            ? 'Miglior tavolo disponibile' 
                                                            : rooms.find(r => r.id === selectedRoomId)?.name}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900 p-4 rounded-lg">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">I Vostri Dati</p>
                                            <p className="text-slate-300 font-medium">{name}</p>
                                            <p className="text-slate-400 text-sm">{phone}</p>
                                            {notes && <p className="text-emerald-400/80 text-sm mt-1">Note: {notes}</p>}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep('details')}
                                            className="flex-1 h-14 text-slate-400 hover:text-white hover:bg-white/5"
                                        >
                                            Indietro
                                        </Button>
                                        <Button
                                            onClick={handleConfirmBooking}
                                            disabled={submitting}
                                            className="flex-[2] h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-lg shadow-emerald-900/50"
                                        >
                                            {submitting ? 'Conferma in corso...' : 'Conferma Prenotazione'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {step === 'success' && (
                         <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-6"
                        >
                            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
                                <CheckCircle size={48} className="text-white" weight="fill" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-2">Prenotazione Confermata!</h2>
                                <p className="text-slate-300">
                                    Ti aspettiamo il <span className="text-white font-medium">{new Date(date).toLocaleDateString('it-IT')}</span> alle <span className="text-white font-medium">{time}</span>.
                                </p>
                            </div>
                            
                            <Button 
                                onClick={() => window.location.reload()}
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            >
                                Effettua un'altra prenotazione
                            </Button>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>

                {/* Right Column: Menu Preview (Sticky) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 space-y-6">
                         <div className="flex items-center justify-between text-slate-400 mb-2">
                            <h3 className="font-semibold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                                <Utensils size={16} />
                                Menu Anteprima
                            </h3>
                         </div>

                         <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {categories.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Utensils size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>Menu non disponibile online al momento.</p>
                                </div>
                            ) : (
                                categories.map(cat => {
                                    const catDishes = dishes.filter(d => d.category_id === cat.id)
                                    if (catDishes.length === 0) return null
                                    
                                    return (
                                        <div key={cat.id} className="p-4 border-b border-slate-800/50 last:border-0">
                                            <h4 className="text-emerald-500 font-bold mb-3 text-sm">{cat.name}</h4>
                                            <div className="space-y-3">
                                                {catDishes.slice(0, 3).map(dish => (
                                                    <div key={dish.id} className="flex justify-between items-start gap-4">
                                                        <div>
                                                            <p className="text-slate-200 text-sm font-medium leading-tight">{dish.name}</p>
                                                            {dish.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{dish.description}</p>}
                                                        </div>
                                                        <span className="text-slate-300 text-sm font-semibold whitespace-nowrap">€ {dish.price.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {catDishes.length > 3 && (
                                                     <p className="text-xs text-emerald-500/60 italic text-center pt-1">
                                                        + altri {catDishes.length - 3} piatti
                                                     </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                         </div>

                         <div className="bg-slate-800/50 rounded-lg p-4 flex gap-3 items-start border border-slate-700/50">
                            <Info size={20} className="text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Il menu potrebbe subire variazioni in base alla disponibilità dei prodotti freschi.
                            </p>
                         </div>
                    </div>
                </div>

            </main>
        </div>
    )
}

export default PublicReservationPage
