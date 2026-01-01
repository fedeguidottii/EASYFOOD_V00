import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Calendar, Users, Clock, CaretRight, CheckCircle, Storefront, MapPin, Warning, ForkKnife, Info, Eye, ArrowLeft } from '@phosphor-icons/react'
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
    const [showMenuPreview, setShowMenuPreview] = useState(false)

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
            // Use restaurant's duration setting or default to 120 (2 hours)
            const durationMinutes = restaurant?.reservation_duration || 120
            const durationMs = durationMinutes * 60 * 1000
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
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-amber-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <p className="animate-pulse text-zinc-400">Caricamento...</p>
                </div>
            </div>
        )
    }

    // Menu Preview Modal
    if (showMenuPreview) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100">
                <div className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-lg border-b border-zinc-800/50">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setShowMenuPreview(false)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                            <ArrowLeft className="mr-2" size={18} />
                            Torna alla Prenotazione
                        </Button>
                        <h1 className="text-lg font-bold text-zinc-100">Anteprima Menu</h1>
                        <div className="w-20" />
                    </div>
                </div>
                <div className="container mx-auto px-4 py-8 max-w-2xl">
                    {categories.map(cat => {
                        const catDishes = dishes.filter(d => d.category_id === cat.id && d.is_active)
                        if (catDishes.length === 0) return null

                        return (
                            <div key={cat.id} className="mb-8">
                                <h2 className="text-amber-500 font-bold text-lg mb-4 pb-2 border-b border-zinc-800">{cat.name}</h2>
                                <div className="space-y-4">
                                    {catDishes.map(dish => (
                                        <div key={dish.id} className="flex justify-between items-start gap-4 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-zinc-100 font-medium">{dish.name}</p>
                                                {dish.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{dish.description}</p>}
                                            </div>
                                            <span className="text-amber-500 font-bold whitespace-nowrap">€{dish.price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

            {/* Hero Section - Minimal */}
            <div className="relative py-12 md:py-16 w-full bg-zinc-900/50 border-b border-zinc-800/50">
                <div className="container mx-auto px-4 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-zinc-800 rounded-2xl p-1 shadow-2xl border border-zinc-700/50 mb-6 overflow-hidden flex items-center justify-center">
                        {restaurant?.logo_url ? (
                            <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                            <Storefront size={32} className="text-amber-500" weight="duotone" />
                        )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-2 tracking-tight">{restaurant?.name || 'Prenotazioni'}</h1>
                    <p className="text-zinc-500 text-sm">
                        Prenota il tuo tavolo online in pochi click.
                    </p>
                </div>
            </div>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">

                <AnimatePresence mode="wait">
                    {step === 'details' && (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            <Card className="bg-zinc-900/80 border-zinc-800/50 shadow-xl overflow-hidden">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm font-bold">1</div>
                                        <CardTitle className="text-lg text-zinc-100">Dettagli Prenotazione</CardTitle>
                                    </div>
                                    <CardDescription className="text-zinc-500 text-sm">Inserisci i tuoi dati per verificare la disponibilità.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {/* Date & Time */}
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs uppercase tracking-wide font-semibold">Data e Ora</Label>
                                        <div className="flex gap-3">
                                            <div className="relative flex-1">
                                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                                <Input
                                                    type="date"
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className="pl-10 h-11 bg-zinc-950 border-zinc-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-zinc-100"
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                            <div className="relative w-28">
                                                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                                <Input
                                                    type="time"
                                                    value={time}
                                                    onChange={(e) => setTime(e.target.value)}
                                                    className="pl-10 h-11 bg-zinc-950 border-zinc-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-zinc-100"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Guests & Room */}
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs uppercase tracking-wide font-semibold">Ospiti & Sala</Label>
                                        <div className="flex gap-3">
                                            <div className="relative w-20">
                                                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={pax}
                                                    onChange={(e) => setPax(e.target.value)}
                                                    className="pl-10 h-11 bg-zinc-950 border-zinc-800 focus:border-amber-500/50 text-zinc-100"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                                    <SelectTrigger className="h-11 bg-zinc-950 border-zinc-800 text-zinc-300">
                                                        <SelectValue placeholder="Sala" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                                        <SelectItem value="any">Qualsiasi Sala</SelectItem>
                                                        {rooms.map(r => (
                                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-800/50 pt-5 space-y-4">
                                        {/* Name */}
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400 text-xs uppercase tracking-wide font-semibold">Nome Completo *</Label>
                                            <Input
                                                placeholder="Mario Rossi"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="h-11 bg-zinc-950 border-zinc-800 focus:border-amber-500/50 text-zinc-100 placeholder:text-zinc-600"
                                            />
                                        </div>
                                        {/* Phone */}
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400 text-xs uppercase tracking-wide font-semibold">Telefono *</Label>
                                            <Input
                                                type="tel"
                                                placeholder="+39 333 ..."
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="h-11 bg-zinc-950 border-zinc-800 focus:border-amber-500/50 text-zinc-100 placeholder:text-zinc-600"
                                            />
                                        </div>
                                        {/* Notes */}
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400 text-xs uppercase tracking-wide font-semibold">Note aggiuntive</Label>
                                            <Input
                                                placeholder="Intolleranze, seggiolone, ecc..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="h-11 bg-zinc-950 border-zinc-800 focus:border-amber-500/50 text-zinc-100 placeholder:text-zinc-600"
                                            />
                                        </div>
                                    </div>

                                    {noAvailability && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="bg-red-950/30 border border-red-500/20 rounded-xl p-4"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <Warning size={20} className="text-red-400" />
                                                <div>
                                                    <p className="font-medium text-red-200 text-sm">Nessun tavolo disponibile alle {time}</p>
                                                    <p className="text-xs text-red-300/60">Prova un altro orario o un'altra data.</p>
                                                </div>
                                            </div>

                                            {alternativeTimes.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-zinc-400 mb-2">Orari alternativi disponibili:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {alternativeTimes.map(t => (
                                                            <Button
                                                                key={t}
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
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

                                    {/* Menu Preview Button */}
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowMenuPreview(true)}
                                        className="w-full h-11 border-zinc-700 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5"
                                    >
                                        <Eye className="mr-2" size={16} />
                                        Vedi Anteprima Menu
                                    </Button>

                                    <Button
                                        onClick={handleCheckAvailability}
                                        disabled={loading}
                                        className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-zinc-950 font-bold text-base shadow-lg shadow-amber-900/30 transition-all"
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
                            <Card className="bg-zinc-900/80 border-zinc-800/50 shadow-xl overflow-hidden">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm font-bold">2</div>
                                        <CardTitle className="text-lg text-zinc-100">Conferma Prenotazione</CardTitle>
                                    </div>
                                    <CardDescription className="text-zinc-500 text-sm">Rivedi i dettagli prima di confermare.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="bg-zinc-950/50 rounded-xl p-5 border border-zinc-800/50 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                                <Calendar size={20} weight="duotone" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Data e Ora</p>
                                                <p className="text-base font-semibold text-zinc-100 mt-0.5">
                                                    {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                                <p className="text-amber-500 font-bold text-xl">{time}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-zinc-800/50" />

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3">
                                                <Users size={18} className="text-zinc-500" />
                                                <div>
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Ospiti</p>
                                                    <p className="font-medium text-zinc-200">{pax} Persone</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <MapPin size={18} className="text-zinc-500" />
                                                <div>
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Sala</p>
                                                    <p className="font-medium text-zinc-200">
                                                        {selectedRoomId === 'any'
                                                            ? 'Miglior tavolo'
                                                            : rooms.find(r => r.id === selectedRoomId)?.name}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900/80 p-4 rounded-lg border border-zinc-800/50">
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2">I Vostri Dati</p>
                                            <p className="text-zinc-200 font-medium">{name}</p>
                                            <p className="text-zinc-400 text-sm">{phone}</p>
                                            {notes && <p className="text-amber-500/80 text-sm mt-1">Note: {notes}</p>}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep('details')}
                                            className="flex-1 h-12 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                        >
                                            Indietro
                                        </Button>
                                        <Button
                                            onClick={handleConfirmBooking}
                                            disabled={submitting}
                                            className="flex-[2] h-12 bg-amber-600 hover:bg-amber-700 text-zinc-950 font-bold text-base shadow-lg shadow-amber-900/30"
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
                            className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30">
                                <CheckCircle size={40} className="text-zinc-950" weight="fill" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-100 mb-2">Prenotazione Confermata!</h2>
                                <p className="text-zinc-400">
                                    Ti aspettiamo il <span className="text-zinc-100 font-medium">{new Date(date).toLocaleDateString('it-IT')}</span> alle <span className="text-amber-500 font-bold">{time}</span>.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => setShowMenuPreview(true)}
                                    variant="outline"
                                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                >
                                    <ForkKnife className="mr-2" size={16} />
                                    Scopri il Menu
                                </Button>
                                <Button
                                    onClick={() => window.location.reload()}
                                    variant="ghost"
                                    className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                                >
                                    Effettua un'altra prenotazione
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-zinc-600 text-xs border-t border-zinc-800/30">
                Powered by EASYFOOD
            </footer>
        </div>
    )
}

export default PublicReservationPage
