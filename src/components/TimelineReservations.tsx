import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash, MagnifyingGlass as Search, Check } from '@phosphor-icons/react'
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
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ tableId: string, time: string } | null>(null)
  const [showDragConfirmDialog, setShowDragConfirmDialog] = useState(false)

  // Smart table search states
  const [showSmartSearch, setShowSmartSearch] = useState(false)
  const [searchTime, setSearchTime] = useState('')
  const [searchGuests, setSearchGuests] = useState<number>(2)
  const [availableTables, setAvailableTables] = useState<Table[]>([])
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null)

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

        // FIX: Correct time parsing to show actual booking time
        // Parse the time correctly from ISO format
        const dateStr = booking.date_time.includes('T') ? booking.date_time.split('T')[1] : booking.date_time
        const timeParts = dateStr.split(':')
        const hours = parseInt(timeParts[0], 10)
        const minutes = parseInt(timeParts[1], 10)

        // Calculate start minutes from the actual reservation time
        const startMinutes = hours * 60 + minutes

        // Standard 2-hour duration for reservations
        const duration = 120

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

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, bookingId: string) => {
    e.dataTransfer.setData('bookingId', bookingId)
    setDraggedBookingId(bookingId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, tableId: string) => {
    e.preventDefault()
    const bookingId = e.dataTransfer.getData('bookingId')
    if (!bookingId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = (clickX / rect.width) * 100
    const totalMinutes = TIMELINE_DURATION
    const clickedMinutes = TIMELINE_START_MINUTES + (percentage / 100) * totalMinutes
    const roundedMinutes = Math.round(clickedMinutes / 15) * 15 // Snap to 15 mins
    const newTime = minutesToTime(roundedMinutes)

    // Check conflicts
    if (hasConflict(tableId, newTime, 120)) { // Assuming 2h duration
      toast.error('Orario occupato o sovrapposto')
      return
    }

    setDropTarget({ tableId, time: newTime })
    setShowDragConfirmDialog(true)
  }

  const confirmMove = async () => {
    if (!draggedBookingId || !dropTarget) return

    try {
      const dateTime = `${selectedDate}T${dropTarget.time}:00`
      await DatabaseService.updateBooking({
        id: draggedBookingId,
        table_id: dropTarget.tableId,
        date_time: dateTime
      })
      toast.success('Prenotazione spostata')
      onRefresh?.()
    } catch (error) {
      console.error('Move error:', error)
      toast.error('Errore spostamento')
    } finally {
      setShowDragConfirmDialog(false)
      setDraggedBookingId(null)
      setDropTarget(null)
    }
  }

  // Complete booking handler
  const handleCompleteBooking = async (bookingId: string) => {
    try {
      await DatabaseService.updateBooking({
        id: bookingId,
        status: 'COMPLETED'
      })
      toast.success('Prenotazione completata! 👍')
      onRefresh?.()
    } catch (error) {
      console.error('Complete error:', error)
      toast.error('Errore completamento prenotazione')
    }
  }

  // Smart table search handler
  const handleSmartSearch = () => {
    if (!searchTime) {
      toast.error('Seleziona un orario')
      return
    }

    // Find available tables for the selected time and guest count
    const available = restaurantTables.filter(table => {
      // Check capacity
      if (table.seats < searchGuests) return false

      // Check if there's a conflict at this time
      return !hasConflict(table.id, searchTime, 120)
    })

    setAvailableTables(available)

    if (available.length === 0) {
      toast.error('Nessun tavolo disponibile per questo orario')
    } else {
      toast.success(`${available.length} tavolo/i disponibile/i`)
      // Highlight the first available table
      if (available.length > 0) {
        setHighlightedTableId(available[0].id)
        // Clear highlight after 5 seconds
        setTimeout(() => setHighlightedTableId(null), 5000)
      }
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-muted-foreground">Timeline</h3>
          <div className="text-sm text-muted-foreground">
            {dayBookings.length} prenotazioni
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSmartSearch(true)}
          className="gap-2"
        >
          <Search size={16} />
          Ricerca Tavolo Intelligente
        </Button>
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
            {restaurantTables.map((table, tableIndex) => {
              // Check if table has any bookings today
              const hasBookings = reservationBlocks.some(block => block.table.id === table.id)
              const isHighlighted = highlightedTableId === table.id
              const isAvailable = availableTables.some(t => t.id === table.id)

              let tableColor = hasBookings ? 'bg-green-50 border-green-200 text-green-800' : 'bg-muted/10'
              if (isHighlighted) {
                tableColor = 'bg-yellow-100 border-yellow-400 text-yellow-900 animate-pulse'
              } else if (isAvailable && searchTime) {
                tableColor = 'bg-emerald-100 border-emerald-400 text-emerald-900'
              }

              return (
              <div key={table.id} className="relative">
                {/* Table Name with capacity and status */}
                <div className={`absolute left-0 top-0 bottom-0 w-32 flex flex-col items-center justify-center border-r-2 border-border/50 z-10 transition-all duration-300 ${tableColor}`}>
                  <span className="font-bold text-base">{table.number}</span>
                  <span className="text-xs font-semibold text-muted-foreground mt-0.5">
                    👥 {table.seats} posti
                  </span>
                  {isAvailable && searchTime && (
                    <Badge className="mt-1 text-[10px] bg-emerald-600">Disponibile</Badge>
                  )}
                </div>

                {/* Timeline Row */}
                <div
                  className="ml-32 h-16 border-b border-border/20 relative cursor-crosshair hover:bg-muted/20 transition-colors"
                  onClick={(e) => handleTimelineClick(e, table.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, table.id)}
                  ref={tableIndex === 0 ? timelineRef : undefined}
                >
                  {/* Enhanced Grid Lines - Thicker and more visible */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {timeSlots.map((_, i) => (
                      <div key={i} className="h-full border-r-2 border-slate-200 dark:border-slate-700 flex-1"></div>
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

                      // Check if booking time has passed (can be completed)
                      const now = new Date()
                      const bookingTime = new Date(block.booking.date_time)
                      const canComplete = !isCompleted && now >= bookingTime

                      return (
                        <div
                          key={block.booking.id}
                          draggable={!isCompleted}
                          onDragStart={(e) => handleDragStart(e, block.booking.id)}
                          className={`absolute top-2 bottom-2 rounded-md shadow-sm border border-black/10 flex items-center justify-between px-2 overflow-hidden transition-all hover:shadow-md hover:scale-[1.02] z-20 ${isCompleted ? 'opacity-60' : 'cursor-move'} ${canComplete ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
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

                          <div className="flex items-center gap-1 shrink-0">
                            {canComplete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-green-500/20 rounded-full shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCompleteBooking(block.booking.id)
                                }}
                                title="Segna come completata"
                              >
                                <Check size={14} weight="bold" className="text-green-600" />
                              </Button>
                            )}
                            {!isCompleted && onDeleteBooking && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-black/10 rounded-full shrink-0"
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
                        </div>
                      )
                    })}
                </div>
              </div>
            )
            })}

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

      {/* Drag Confirm Dialog */}
      <Dialog open={showDragConfirmDialog} onOpenChange={setShowDragConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Spostamento</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler spostare la prenotazione?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Nuovo Orario: <strong>{dropTarget?.time}</strong></p>
            <p>Nuovo Tavolo: <strong>{restaurantTables.find(t => t.id === dropTarget?.tableId)?.number}</strong></p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDragConfirmDialog(false)}>Annulla</Button>
            <Button onClick={confirmMove}>Conferma</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Table Search Dialog */}
      <Dialog open={showSmartSearch} onOpenChange={setShowSmartSearch}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ricerca Tavolo Intelligente</DialogTitle>
            <DialogDescription>
              Trova il tavolo perfetto per orario e numero di ospiti
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-time">Orario Prenotazione</Label>
              <Input
                id="search-time"
                type="time"
                value={searchTime}
                onChange={(e) => setSearchTime(e.target.value)}
                className="text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-guests">Numero Ospiti</Label>
              <Input
                id="search-guests"
                type="number"
                min="1"
                max="20"
                value={searchGuests}
                onChange={(e) => setSearchGuests(parseInt(e.target.value) || 1)}
                className="text-lg"
              />
            </div>

            {availableTables.length > 0 && (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100 mb-2">
                  Tavoli Disponibili:
                </h4>
                <div className="space-y-1">
                  {availableTables.map(table => (
                    <div key={table.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{table.number}</span>
                      <span className="text-muted-foreground">Capacità: {table.seats} posti</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSmartSearch(false)
                  setAvailableTables([])
                  setHighlightedTableId(null)
                  setSearchTime('')
                  setSearchGuests(2)
                }}
                className="flex-1"
              >
                Chiudi
              </Button>
              <Button
                onClick={handleSmartSearch}
                className="flex-1 gap-2"
              >
                <Search size={16} />
                Cerca
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}