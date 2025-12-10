import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DatabaseService } from '../../services/DatabaseService'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Calendar, Users, Clock, CaretRight, CheckCircle, Storefront, MapPin, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Restaurant, Room, Table } from '../../services/types'

const PublicReservationPage = () => {
    const { restaurantId } = useParams()

    // State
    const [step, setStep] = useState<'details' | 'confirm' | 'success'>('details')
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [rooms, setRooms] = useState<Room[]>([])
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

    useEffect(() => {
        if (!restaurantId) return

        const fetchData = async () => {
            try {
                const { data: rData } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
                if (rData) setRestaurant(rData)

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
            const tables = await DatabaseService.getTables(restaurantId)

            // Fetch existing bookings for that day - FIX: use date_time field
            const { data: existingBookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .gte('date_time', `${date}T00:00:00`)
                .lte('date_time', `${date}T23:59:59`)
                .neq('status', 'CANCELLED')

            const requestedDateTime = new Date(`${date}T${time}`)
            const durationMs = 120 * 60 * 1000 // 2 hours
            const reqStart = requestedDateTime.getTime()
            const reqEnd = reqStart + durationMs

            const suitableTables = tables.filter(t => {
                // Capacity check
                if ((t.seats || 4) < parseInt(pax)) return false

                // Room check
                if (selectedRoomId !== 'any' && t.room_id !== selectedRoomId) return false

                // Availability check - FIX: use date_time field
                const isOccupied = existingBookings?.some(b => {
                    if (b.table_id !== t.id) return false

                    const bStart = new Date(b.date_time).getTime()
                    const bEnd = bStart + durationMs

                    // Check Overlap
                    return (reqStart < bEnd && reqEnd > bStart)
                })

                return !isOccupied
            })

            // Sort by best fit (capacity closest to pax)
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
        const table = await findOptimalTable()
        setLoading(false)

        if (table) {
            setAssignedTable(table)
            setStep('confirm')
        } else {
            setNoAvailability(true)
            toast.error("Nessun tavolo disponibile per i criteri selezionati.")
        }
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="animate-pulse text-white/60">Caricamento...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center">
            <Card className="w-full max-w-md border border-white/10 shadow-2xl bg-slate-900/80 backdrop-blur-xl overflow-hidden">

                {/* Header with gradient */}
                <div className="relative h-40 bg-gradient-to-br from-primary via-primary/80 to-emerald-600 flex items-center justify-center">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTI4IDBhMjggMjggMCAxIDAgNTYgMCAyOCAyOCAwIDEgMC01NiAwIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-30"></div>
                    <Storefront size={64} className="text-white/30" weight="duotone" />
                </div>

                <CardHeader className="text-center -mt-16 relative z-10 pb-2">
                    <div className="w-28 h-28 mx-auto bg-slate-800 rounded-full p-1.5 shadow-2xl border-4 border-slate-900 flex items-center justify-center mb-3">
                        {restaurant?.logo_url ? (
                            <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <Storefront size={48} className="text-primary" weight="duotone" />
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">{restaurant?.name || 'Prenota Tavolo'}</CardTitle>
                    <CardDescription className="text-white/60">Prenota il tuo tavolo in pochi secondi</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 pt-4 pb-8">
                    {step === 'details' && (
                        <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                            {/* Step Indicator */}
                            <div className="flex items-center justify-center gap-2 text-xs text-white/50 mb-2">
                                <span className="bg-primary text-white px-2 py-1 rounded-full font-medium">Passo 1 di 2</span>
                                <span>Inserisci i tuoi dati</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-white/70">Data</Label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-3 top-3 text-white/40" />
                                        <Input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-primary/50"
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/70">Ora</Label>
                                    <div className="relative">
                                        <Clock size={16} className="absolute left-3 top-3 text-white/40" />
                                        <Input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-primary/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white/70">Numero Persone</Label>
                                <div className="relative">
                                    <Users size={16} className="absolute left-3 top-3 text-white/40" />
                                    <Input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={pax}
                                        onChange={(e) => setPax(e.target.value)}
                                        className="pl-9 bg-white/5 border-white/10 text-white focus:border-primary/50"
                                    />
                                </div>
                            </div>

                            {rooms.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-white/70">Preferenza Sala (Opzionale)</Label>
                                    <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <MapPin size={16} className="mr-2 text-white/40" />
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

                            <div className="border-t border-white/10 pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-white/70">Nome e Cognome *</Label>
                                    <Input
                                        placeholder="Mario Rossi"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white focus:border-primary/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-white/70">Telefono *</Label>
                                    <Input
                                        type="tel"
                                        placeholder="+39 333 1234567"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white focus:border-primary/50"
                                    />
                                </div>
                            </div>

                            {noAvailability && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3">
                                    <Warning size={20} className="text-red-400" />
                                    <p className="text-sm text-red-300">Nessun tavolo disponibile. Prova a cambiare orario o sala.</p>
                                </div>
                            )}

                            <Button
                                onClick={handleCheckAvailability}
                                className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20"
                                disabled={loading}
                            >
                                {loading ? 'Verifica disponibilità...' : 'Verifica Disponibilità'}
                                <CaretRight className="ml-2" weight="bold" />
                            </Button>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            {/* Step Indicator */}
                            <div className="flex items-center justify-center gap-2 text-xs text-white/50 mb-2">
                                <span className="bg-emerald-600 text-white px-2 py-1 rounded-full font-medium">Passo 2 di 2</span>
                                <span>Conferma la prenotazione</span>
                            </div>

                            {/* Confirmation Banner */}
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                                <p className="text-amber-300 font-medium text-sm">⚠️ La prenotazione NON è ancora confermata</p>
                                <p className="text-amber-200/60 text-xs mt-1">Premi il pulsante qui sotto per completare</p>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <h3 className="text-white font-semibold text-center mb-4">Riepilogo Prenotazione</h3>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/50">👤 Nome:</span>
                                    <span className="text-white font-medium">{name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/50">📞 Telefono:</span>
                                    <span className="text-white font-medium">{phone}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/50">👥 Persone:</span>
                                    <span className="text-white font-medium">{pax}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/50">📅 Data:</span>
                                    <span className="text-white font-medium">{new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/50">🕐 Ora:</span>
                                    <span className="text-white font-medium">{time}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Button
                                    onClick={handleConfirmBooking}
                                    className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/30"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Conferma in corso...' : '✓ CONFERMA PRENOTAZIONE'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setStep('details')}
                                    className="w-full text-white/60 hover:text-white hover:bg-white/5"
                                    disabled={submitting}
                                >
                                    ← Torna indietro
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center space-y-6 animate-in zoom-in-95 fade-in duration-500 py-6">
                            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                                <CheckCircle size={56} weight="fill" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-white">Prenotazione Confermata!</h3>
                                <p className="text-white/60 max-w-[280px] mx-auto">
                                    Ti aspettiamo il <span className="text-white font-medium">{new Date(date).toLocaleDateString('it-IT')}</span> alle <span className="text-white font-medium">{time}</span>.
                                </p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white/40">
                                <p>Riceverai una conferma al numero {phone}</p>
                            </div>
                            <Button
                                onClick={() => window.location.reload()}
                                variant="outline"
                                className="w-full border-white/20 text-white hover:bg-white/10"
                            >
                                Nuova Prenotazione
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <p className="mt-6 text-xs text-white/20">Powered by EasyFood</p>
        </div>
    )
}

export default PublicReservationPage
