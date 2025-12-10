import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Calendar, Users, Clock, CaretRight, CheckCircle, Storefront, MapPin } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Restaurant, Room, Table, Booking } from '../../services/types'

const PublicReservationPage = () => {
    const { restaurantId } = useParams()
    const navigate = useNavigate()

    // State
    const [step, setStep] = useState<'details' | 'confirm' | 'success'>('details')
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)

    // Form Data
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [pax, setPax] = useState('2')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [time, setTime] = useState('19:30')
    const [selectedRoomId, setSelectedRoomId] = useState<string>('any')
    const [notes, setNotes] = useState('')

    // Assigned Table (calculated)
    const [assignedTable, setAssignedTable] = useState<Table | null>(null)

    useEffect(() => {
        if (!restaurantId) return

        const fetchData = async () => {
            try {
                // Fetch Restaurant Info (using simple query or getRestaurants)
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

                setLoading(false)
            } catch (err) {
                console.error("Error loading reservation data", err)
                toast.error("Errore caricamento dati ristorante")
                setLoading(false)
            }
        }
        fetchData()
    }, [restaurantId])

    const findOptimalTable = async () => {
        if (!restaurantId) return null

        try {
            // 1. Fetch all tables
            const tables = await DatabaseService.getTables(restaurantId)

            // 2. Fetch existing bookings for that day
            // We fetch ALL bookings for simplicity, or filter by range if possible. 
            // For now, simple fetch.
            const { data: existingBookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .gte('date', `${date}T00:00:00`)
                .lte('date', `${date}T23:59:59`)
                .neq('status', 'CANCELLED')

            // 3. Filter Logic
            const requestedDateTime = new Date(`${date}T${time}`)
            // Default duration 2 hours (120 mins)
            const durationMs = 120 * 60 * 1000
            const reqStart = requestedDateTime.getTime()
            const reqEnd = reqStart + durationMs

            // Filter tables
            const suitableTables = tables.filter(t => {
                // Capacity check
                if ((t.seats || 4) < parseInt(pax)) return false

                // Room check
                if (selectedRoomId !== 'any' && t.room_id !== selectedRoomId) return false

                // Availability check
                const isOccupied = existingBookings?.some(b => {
                    if (b.table_id !== t.id) return false

                    const bStart = new Date(b.date).getTime()
                    // Assuming booking duration is stored or default 2h
                    const bEnd = bStart + durationMs // Simplified assumption

                    // Check Overlap
                    // (StartA < EndB) and (EndA > StartB)
                    return (reqStart < bEnd && reqEnd > bStart)
                })

                return !isOccupied
            })

            // 4. Sort by best fit (capacity closest to pax)
            suitableTables.sort((a, b) => (a.seats || 0) - (b.seats || 0))

            return suitableTables.length > 0 ? suitableTables[0] : null

        } catch (err) {
            console.error("Algorithm error", err)
            return null
        }
    }

    const handleCheckAvailability = async () => {
        if (!name || !phone || !date || !time) {
            toast.error("Compila tutti i campi obbligatori")
            return
        }

        setLoading(true)
        const table = await findOptimalTable()
        setLoading(false)

        if (table) {
            setAssignedTable(table)
            setStep('confirm')
        } else {
            toast.error("Nessun tavolo disponibile per i criteri selezionati. Prova a cambiare orario o sala.")
        }
    }

    const handleConfirmBooking = async () => {
        if (!assignedTable || !restaurantId) return

        try {
            setLoading(true)
            const bookingDate = new Date(`${date}T${time}`).toISOString()

            await DatabaseService.createBooking({
                restaurant_id: restaurantId,
                table_id: assignedTable.id,
                name: name,
                phone: phone,
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
            setLoading(false)
        }
    }

    if (loading && !restaurant) {
        return <div className="min-h-screen flex items-center justify-center bg-background">Caricamento...</div>
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
            <Card className="w-full max-w-md border-none shadow-xl bg-card">

                {/* Header Image / Branding */}
                <div className="h-32 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-t-xl flex items-center justify-center">
                    <Storefront size={48} className="text-white/20" weight="duotone" />
                </div>

                <CardHeader className="text-center -mt-12 relative z-10">
                    <div className="w-24 h-24 mx-auto bg-card rounded-full p-2 shadow-lg flex items-center justify-center mb-2">
                        {restaurant?.logo_url ? (
                            <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <Storefront size={40} className="text-primary" weight="duotone" />
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold">{restaurant?.name || 'Prenota Tavolo'}</CardTitle>
                    <CardDescription>Prenotazione Online Veloce</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 pt-2">
                    {step === 'details' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Data</Label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                        <Input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="pl-9"
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Ora</Label>
                                    <div className="relative">
                                        <Clock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                        <Input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Numero Persone</Label>
                                <div className="relative">
                                    <Users size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={pax}
                                        onChange={(e) => setPax(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            {rooms.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Preferenza Sala (Opzionale)</Label>
                                    <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                        <SelectTrigger className="pl-9 relative">
                                            <MapPin size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                            <SelectValue placeholder="Qualsiasi Sala" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="any">Qualsiasi Sala</SelectItem>
                                            {rooms.map(r => (
                                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2 pt-2 border-t">
                                <Label>Nome e Cognome</Label>
                                <Input
                                    placeholder="Mario Rossi"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Telefono</Label>
                                <Input
                                    type="tel"
                                    placeholder="+39 333 1234567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>

                            <Button onClick={handleCheckAvailability} className="w-full h-12 text-base mt-2" disabled={loading}>
                                {loading ? 'Verifica...' : 'Continua'} <CaretRight className="ml-2" weight="bold" />
                            </Button>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300 text-center">
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                                <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-1">Tavolo Assegnato</p>
                                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {assignedTable?.number}
                                </p>
                                {selectedRoomId !== 'any' && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {rooms.find(r => r.id === assignedTable?.room_id)?.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 text-left bg-muted/30 p-4 rounded-lg">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ospiti:</span>
                                    <span className="font-medium">{pax} Persone</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Data:</span>
                                    <span className="font-medium">{new Date(date).toLocaleDateString('it-IT')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ora:</span>
                                    <span className="font-medium">{time}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Nome:</span>
                                    <span className="font-medium">{name}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Button onClick={handleConfirmBooking} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base" disabled={loading}>
                                    {loading ? 'Conferma...' : 'Conferma Prenotazione'}
                                </Button>
                                <Button variant="ghost" onClick={() => setStep('details')} className="w-full" disabled={loading}>
                                    Modifica Dati
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center space-y-6 animate-in zoom-in-95 fade-in duration-500 py-8">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400">
                                <CheckCircle size={48} weight="fill" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold">Prenotazione Confermata!</h3>
                                <p className="text-muted-foreground max-w-[250px] mx-auto">
                                    Ti aspettiamo il {new Date(date).toLocaleDateString('it-IT')} alle {time}.
                                </p>
                            </div>
                            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                                Nuova Prenotazione
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <p className="mt-8 text-xs text-muted-foreground/50">Powered by EasyFood</p>
        </div>
    )
}

export default PublicReservationPage
