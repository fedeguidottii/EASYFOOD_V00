import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash } from '@phosphor-icons/react'
import type { Table, Booking, User } from '../services/types'
import { DatabaseService } from '../services/DatabaseService'

interface TimelineReservationsProps {
  user: User
  restaurantId: string
  tables: Table[]
  bookings: Booking[]
  selectedDate: string // Passed from parent
  openingTime?: string
  closingTime?: string
  onRefresh?: () => void
  onEditBooking?: (booking: Booking) => void
  onDeleteBooking?: (bookingId: string) => void
}

interface TimeSlot {
  time: string
  hour: number
  minute: number
}

interface ReservationBlock {
  booking: Booking
  startMinutes: number
  duration: number
  table: Table
}

const COLORS = ['#C9A152', '#8B7355', '#F4E6D1', '#E8C547', '#D4B366', '#A68B5B', '#F0D86F', '#C09853']

export default function TimelineReservations({ user, restaurantId, tables, bookings, selectedDate, openingTime = '10:00', closingTime = '23:00', onRefresh, onEditBooking, onDeleteBooking }: TimelineReservationsProps) {
  const [showReservationDialog, setShowReservationDialog] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ tableId: string, time: string } | null>(null)

  // New reservation form state
  const [newReservation, setNewReservation] = useState({
    name: '',
    phone: '',
    guests: 2,
    time: '',
    tableId: ''
  })

  // Filter tables for this restaurant
  const restaurantTables = tables.filter(t => t.restaurant_id === restaurantId)

  // Filter bookings for selected date
  const localBookings = bookings.filter(b => b.restaurant_id === restaurantId && b.status !== 'CANCELLED')

  const dayBookings = localBookings?.filter(res => {
    if (!res.date_time) return false
    const date = res.date_time.split('T')[0]
    return date === selectedDate
  }) || []

  // Timeline configuration
  const startHour = parseInt(openingTime.split(':')[0])
  const endHour = parseInt(closingTime.split(':')[0])

  const TIMELINE_START_MINUTES = startHour * 60
  const TIMELINE_END_MINUTES = endHour * 60
  const TIMELINE_DURATION = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES

  // Generate time slots (every 60 mins)
  const timeSlots: TimeSlot[] = []
  for (let hour = startHour; hour < endHour; hour++) {
    timeSlots.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      hour,
      minute: 0
    })
  }

  const timelineRef = useRef<HTMLDivElement>(null)

  // Helper to convert time string (HH:MM) to minutes from start of day
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Helper to convert minutes to time string
  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Calculate position and width for a reservation block
  const getBlockStyle = (startMinutes: number, duration: number) => {
    const relativeStart = startMinutes - TIMELINE_START_MINUTES
    const left = (relativeStart / TIMELINE_DURATION) * 100
    const width = (duration / TIMELINE_DURATION) * 100

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - Math.max(0, left), width)}%`
    }
  }

  // Prepare reservation blocks
  const getReservationBlocks = (): ReservationBlock[] => {
    return dayBookings
      .map(booking => {
        const table = restaurantTables.find(t => t.id === booking.table_id)
        if (!table) return null // Skip if table not found

        // Fix: Use local time instead of UTC string parsing
        // We parse the string manually to ignore timezone conversions
        // Expected format: YYYY-MM-DDTHH:MM:SS or similar ISO
        const timePart = booking.date_time.split('T')[1] // Get HH:MM:SS...
        if (!timePart) return null

        const [hoursStr, minutesStr] = timePart.split(':')
        const hours = parseInt(hoursStr, 10)
        const minutes = parseInt(minutesStr, 10)

        const startMinutes = hours * 60 + minutes
        const duration = 120 // Default 2 hours

        return {
          booking,
          startMinutes,
          duration,
          table
        }
      })
      .filter((block): block is ReservationBlock => block !== null)
  }

  const reservationBlocks = getReservationBlocks()

  // Check for conflicts
  const hasConflict = (tableId: string, time: string, durationMinutes: number = 120) => {
    const newStart = timeToMinutes(time)
    const newEnd = newStart + durationMinutes

    return reservationBlocks.some(block => {
      if (block.table.id !== tableId) return false

      const blockEnd = block.startMinutes + block.duration

      // Check overlap
      return (newStart < blockEnd && newEnd > block.startMinutes)
    })
  }

  const handleTimelineClick = (e: React.MouseEvent, tableId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = (clickX / rect.width) * 100

    const totalMinutes = TIMELINE_DURATION

    const clickedMinutes = TIMELINE_START_MINUTES + (percentage / 100) * totalMinutes

    // Round to nearest 60 minutes
    const roundedMinutes = Math.round(clickedMinutes / 60) * 60
    const clickedTime = minutesToTime(roundedMinutes)

    // Check for conflicts
    if (hasConflict(tableId, clickedTime, 120)) {
      toast.error('Orario già occupato')
      return
    }

    setSelectedTimeSlot({ tableId, time: clickedTime })
    setNewReservation(prev => ({
      ...prev,
      tableId,
      time: clickedTime
    }))
    setShowReservationDialog(true)
  }

  const handleCreateReservation = async () => {
    if (!newReservation.name || !newReservation.guests || !newReservation.time || !newReservation.tableId) {
      toast.error('Compila tutti i campi')
      return
    }

    try {
      const dateTime = `${selectedDate}T${newReservation.time}:00`

      await DatabaseService.createBooking({
        restaurant_id: restaurantId,
        table_id: newReservation.tableId,
        date_time: dateTime,
        guests: Number(newReservation.guests),
        status: 'CONFIRMED',
        name: newReservation.name,
        phone: newReservation.phone,
        notes: ''
      })

      toast.success('Prenotazione creata')
      setShowReservationDialog(false)
      setNewReservation({ name: '', phone: '', guests: 2, time: '', tableId: '' })
      onRefresh?.()
    } catch (error) {
      console.error('Error creating reservation:', error)
      toast.error('Errore creazione prenotazione')
    }
  }

  // Current time indicator position
  const getCurrentTimePosition = () => {
    const now = new Date()
    // Only show if selected date is today
    const todayStr = now.toISOString().split('T')[0]
    if (todayStr !== selectedDate) return -1

    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    if (currentMinutes < TIMELINE_START_MINUTES || currentMinutes > TIMELINE_END_MINUTES) {
      return -1
    }

    const relativeCurrent = currentMinutes - TIMELINE_START_MINUTES
    return (relativeCurrent / TIMELINE_DURATION) * 100
  }

  const currentTimePos = getCurrentTimePosition()

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-muted-foreground">Timeline</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          {dayBookings.length} prenotazioni
        </div>
      </div>

      {/* Timeline Header - Time Labels */}
      <div className="relative pl-32 pr-4">
        <div className="flex justify-between text-xs text-muted-foreground border-b border-border/50 pb-2">
          {timeSlots.map((slot, i) => (
            <div key={i} className="flex flex-col items-center" style={{ width: `${100 / timeSlots.length}%` }}>
              <span>{slot.time}</span>
              <div className="h-2 w-px bg-border/50 mt-1"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Grid */}
      <Card className="shadow-professional">
        <CardContent className="p-0">
          <div className="relative">
            {/* Current Time Indicator */}
            {currentTimePos >= 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: `calc(8rem + ${currentTimePos} * (100% - 9rem) / 100)` }} // Adjusted for padding/margin
              >
                <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500"></div>
              </div>
            )}

            {/* Table Rows */}
            {restaurantTables.map((table, tableIndex) => (
              <div key={table.id} className="relative">
                {/* Table Name */}
                <div className="absolute left-0 top-0 bottom-0 w-32 flex items-center justify-center border-r border-border/50 bg-muted/10 z-10">
                  <span className="font-medium text-sm">Tavolo {table.number}</span>
                  <span className="text-xs text-muted-foreground ml-2">({table.seats}p)</span>
                </div>

                {/* Timeline Row */}
                <div
                  className="ml-32 h-16 border-b border-border/20 relative cursor-crosshair hover:bg-muted/20 transition-colors"
                  onClick={(e) => handleTimelineClick(e, table.id)}
                  ref={tableIndex === 0 ? timelineRef : undefined}
                >
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {timeSlots.map((_, i) => (
                      <div key={i} className="h-full border-r border-border/10 flex-1"></div>
                    ))}
                  </div>

                  {/* Reservation Blocks */}
                  {reservationBlocks
                    .filter(block => block.table.id === table.id)
                    .map((block, i) => {
                      const isCompleted = block.booking.status === 'COMPLETED'
                      const colorIndex = i % COLORS.length
                      const bgColor = isCompleted ? '#e5e7eb' : COLORS[colorIndex]
                      const textColor = isCompleted ? '#9ca3af' : (['#F4E6D1', '#F0D86F'].includes(bgColor) ? '#000' : '#fff')

                      return (
                        <div
                          key={block.booking.id}
                          className={`absolute top-2 bottom-2 rounded-md shadow-sm border border-black/10 flex items-center justify-between px-2 overflow-hidden transition-all hover:shadow-md hover:scale-[1.02] z-20 ${isCompleted ? 'opacity-60' : ''}`}
                          style={{
                            left: `${getBlockStyle(block.startMinutes, block.duration).left}`,
                            width: `${getBlockStyle(block.startMinutes, block.duration).width}`,
                            backgroundColor: bgColor,
                            color: textColor
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditBooking?.(block.booking)
                          }}
                        >
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-bold text-xs truncate">{block.booking.name}</span>
                            <span className="text-[10px] truncate opacity-90">{block.booking.guests} ospiti</span>
                          </div>

                          {!isCompleted && onDeleteBooking && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-black/10 rounded-full shrink-0 ml-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm('Sei sicuro di voler eliminare questa prenotazione?')) {
                                  onDeleteBooking(block.booking.id)
                                }
                              }}
                            >
                              <Trash size={12} weight="bold" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}

            {restaurantTables.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nessun tavolo configurato. Aggiungi tavoli nelle impostazioni.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* New Reservation Dialog */}
      <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Prenotazione</DialogTitle>
            <DialogDescription>
              Aggiungi una prenotazione per il {selectedDate} alle {newReservation.time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="res-name">Nome Cliente</Label>
                <Input
                  id="res-name"
                  value={newReservation.name}
                  onChange={(e) => setNewReservation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-phone">Telefono</Label>
                <Input
                  id="res-phone"
                  value={newReservation.phone}
                  onChange={(e) => setNewReservation(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Telefono"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="res-guests">Ospiti</Label>
                <Input
                  id="res-guests"
                  type="number"
                  min="1"
                  value={newReservation.guests}
                  onChange={(e) => setNewReservation(prev => ({ ...prev, guests: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-time">Orario</Label>
                <Input
                  id="res-time"
                  type="time"
                  value={newReservation.time}
                  onChange={(e) => setNewReservation(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-table">Tavolo</Label>
              <Select
                value={newReservation.tableId}
                onValueChange={(val) => setNewReservation(prev => ({ ...prev, tableId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tavolo" />
                </SelectTrigger>
                <SelectContent>
                  {restaurantTables.map(t => (
                    <SelectItem key={t.id} value={t.id}>Tavolo {t.number} ({t.seats}p)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-4" onClick={handleCreateReservation}>
              <Plus size={16} className="mr-2" />
              Crea Prenotazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}