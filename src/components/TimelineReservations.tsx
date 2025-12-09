import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Trash, MagnifyingGlass as Search, Check, Clock, ArrowRight } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  reservationDuration?: number // Duration in minutes, default 120
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

export default function TimelineReservations({ user, restaurantId, tables, bookings, selectedDate, openingTime = '10:00', closingTime = '23:00', reservationDuration = 120, onRefresh, onEditBooking, onDeleteBooking }: TimelineReservationsProps) {
  const [showReservationDialog, setShowReservationDialog] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ tableId: string, time: string } | null>(null)
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ tableId: string, time: string } | null>(null)
  const [showDragConfirmDialog, setShowDragConfirmDialog] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null)
  const [showArriveConfirmDialog, setShowArriveConfirmDialog] = useState(false)
  const [bookingToArrive, setBookingToArrive] = useState<Booking | null>(null)
  const [dragOffsetMinutes, setDragOffsetMinutes] = useState(0)

  // Smart table search states
  const [showSmartSearch, setShowSmartSearch] = useState(false)
  const [searchTime, setSearchTime] = useState('')
  const [searchGuests, setSearchGuests] = useState<number | string>(2)
  const [availableTables, setAvailableTables] = useState<Table[]>([])
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null)

  // Table sorting/filtering state
  const [tableSortBy, setTableSortBy] = useState<'name' | 'capacity' | 'status'>('name')

  // New reservation form state
  const [newReservation, setNewReservation] = useState<{
    name: string
    phone: string
    guests: number | string
    time: string
    tableId: string
  }>({
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

        // Parse the time correctly from ISO format
        const dateStr = booking.date_time.includes('T') ? booking.date_time.split('T')[1] : booking.date_time
        const timeParts = dateStr.split(':')
        const hours = parseInt(timeParts[0], 10)
        const minutes = parseInt(timeParts[1], 10)

        // Calculate start minutes from the actual reservation time
        const startMinutes = hours * 60 + minutes

        // Use configurable duration from settings
        const duration = reservationDuration

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

  // Sort tables based on selected filter
  const sortedTables = [...restaurantTables].sort((a, b) => {
    if (tableSortBy === 'name') {
      return a.number.localeCompare(b.number)
    } else if (tableSortBy === 'capacity') {
      return (b.seats || 4) - (a.seats || 4) // Descending
    } else if (tableSortBy === 'status') {
      // Check if tables are occupied
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const isToday = selectedDate === now.toISOString().split('T')[0]

      const aOccupied = isToday && reservationBlocks.some(block =>
        block.table.id === a.id &&
        currentMinutes >= block.startMinutes &&
        currentMinutes < block.startMinutes + block.duration
      )

      const bOccupied = isToday && reservationBlocks.some(block =>
        block.table.id === b.id &&
        currentMinutes >= block.startMinutes &&
        currentMinutes < block.startMinutes + block.duration
      )

      // Occupied tables first
      if (aOccupied && !bOccupied) return -1
      if (!aOccupied && bOccupied) return 1
      return 0
    }
    return 0
  })

  // Check for conflicts
  const hasConflict = (tableId: string, time: string, durationMinutes: number = reservationDuration, excludeBookingId?: string) => {
    const newStart = timeToMinutes(time)
    const newEnd = newStart + durationMinutes

    const blocksToCheck = reservationBlocks.filter(block => block.table.id === tableId && block.booking.id !== excludeBookingId)

    return blocksToCheck.some(block => {
      const blockEnd = block.startMinutes + block.duration
      return (newStart < blockEnd && newEnd > block.startMinutes)
    })
  }

  // Hover state for ghost block
  const [hoveredSlot, setHoveredSlot] = useState<{ tableId: string, time: string, startMinutes: number } | null>(null)

  const handleTimelineMouseMove = (e: React.MouseEvent, tableId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = (clickX / rect.width) * 100
    const totalMinutes = TIMELINE_DURATION
    const mouseMinutes = TIMELINE_START_MINUTES + (percentage / 100) * totalMinutes

    // Snap to 15 mins
    const roundedMinutes = Math.round(mouseMinutes / 15) * 15
    const snappedTime = minutesToTime(roundedMinutes)

    setHoveredSlot({
      tableId,
      time: snappedTime,
      startMinutes: roundedMinutes
    })
  }

  const handleTimelineMouseLeave = () => {
    setHoveredSlot(null)
  }

  const handleTimelineClick = (e: React.MouseEvent, tableId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = (clickX / rect.width) * 100
    const totalMinutes = TIMELINE_DURATION
    const clickedMinutes = TIMELINE_START_MINUTES + (percentage / 100) * totalMinutes

    // Round to nearest 15 minutes (was 60)
    const roundedMinutes = Math.round(clickedMinutes / 15) * 15
    const clickedTime = minutesToTime(roundedMinutes)

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

  // ... (keep creating handleCreateReservation)

  // ... (keep drag handlers)

  // ... (keep render loop)

  const currentTimePos = getCurrentTimePosition()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-muted-foreground">Timeline</h3>
          <div className="text-sm text-muted-foreground">
            {dayBookings.length} prenotazioni
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={tableSortBy === 'name' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTableSortBy('name')}
              className="h-8 text-xs"
            >
              A-Z
            </Button>
            <Button
              variant={tableSortBy === 'capacity' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTableSortBy('capacity')}
              className="h-8 text-xs"
            >
              Capacità
            </Button>
            <Button
              variant={tableSortBy === 'status' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTableSortBy('status')}
              className="h-8 text-xs"
            >
              Stato
            </Button>
          </div>
          <Button variant="outline" onClick={() => setShowSmartSearch(true)} className="gap-2">
            <Search size={16} />
            Ricerca Tavolo
          </Button>
        </div>
      </div>

      <Card className="shadow-none border-0 bg-transparent">
        <CardContent className="p-0">
          <div className="relative">

            {/* HEADER: TIMES */}
            <div className="flex ml-40 h-12 relative border-b border-border/20">
              {timeSlots.map((slot, i) => {
                const minutes = slot.hour * 60 + slot.minute
                const relativeStart = minutes - TIMELINE_START_MINUTES
                const left = (relativeStart / TIMELINE_DURATION) * 100

                return (
                  <div
                    key={i}
                    className="absolute bottom-0 transform -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${left}%` }}
                  >
                    <span className="text-xs font-bold text-muted-foreground mb-1 bg-background px-1">{slot.time}</span>
                    <div className="h-2 w-px bg-border/20"></div>
                  </div>
                )
              })}
            </div>

            {/* BODY: TABLES & GRID */}
            {sortedTables.map((table, tableIndex) => {
              // Status Logic
              const now = new Date()
              const currentMinutes = now.getHours() * 60 + now.getMinutes()
              const isToday = selectedDate === now.toISOString().split('T')[0]

              const isCurrentlyOccupied = isToday && reservationBlocks.some(block => {
                if (block.table.id !== table.id) return false
                const bookingEnd = block.startMinutes + block.duration
                return currentMinutes >= block.startMinutes && currentMinutes < bookingEnd
              })
              const isAvailable = availableTables.some(t => t.id === table.id)

              // UPDATED COLORS: RED for Occupied, GREEN for Free (approx)
              let borderClass = 'border-l-4 border-l-slate-300 dark:border-l-slate-700'
              let bgClass = 'bg-card'

              if (isCurrentlyOccupied) {
                borderClass = 'border-l-4 border-l-red-500'
                bgClass = 'bg-red-50/50 dark:bg-red-950/20'
              } else if (isAvailable && searchTime) {
                borderClass = 'border-l-4 border-l-green-500' // Explicitly available via search
                bgClass = 'bg-green-50/50 dark:bg-green-950/20'
              } else {
                // Default Free
                borderClass = 'border-l-4 border-l-emerald-500/50'
              }

              return (
                <div key={table.id} className={`flex h-24 border-b border-border/10 ${bgClass} ${borderClass}`}>

                  {/* LEFT COLUMN: TABLE INFO */}
                  <div className="w-40 shrink-0 flex flex-col justify-center px-4 border-r border-border/10 relative">
                    <span className="font-bold text-lg text-foreground">{table.number}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      Users: {table.seats || 4}
                    </div>
                    {isCurrentlyOccupied && <Badge variant="destructive" className="mt-2 w-fit text-[10px] px-1 py-0 h-4">Occupato</Badge>}
                  </div>

                  {/* RIGHT COLUMN: TIMELINE STRIP */}
                  <div
                    className="flex-1 relative cursor-crosshair group"
                    onClick={(e) => handleTimelineClick(e, table.id)}
                    onMouseMove={(e) => handleTimelineMouseMove(e, table.id)}
                    onMouseLeave={handleTimelineMouseLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, table.id)}
                  >
                    {/* GHOST BLOCK ON HOVER */}
                    {hoveredSlot && hoveredSlot.tableId === table.id && !draggedBookingId && (
                      <div
                        className="absolute top-2 bottom-2 rounded-md bg-primary/20 border-2 border-primary/50 border-dashed z-0 pointer-events-none transition-all duration-75 ease-out"
                        style={{
                          left: `${getBlockStyle(hoveredSlot.startMinutes, 120).left}`, // Default duration 120 for visualization
                          width: `${getBlockStyle(hoveredSlot.startMinutes, 120).width}`
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded shadow-sm font-bold whitespace-nowrap">
                          {hoveredSlot.time}
                        </div>
                      </div>
                    )}

                    {/* GRID LINES (Absolute) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {timeSlots.map((slot, i) => {
                        const minutes = slot.hour * 60 + slot.minute
                        const relativeStart = minutes - TIMELINE_START_MINUTES
                        const left = (relativeStart / TIMELINE_DURATION) * 100

                        return (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-border/20 dashed"
                            style={{ left: `${left}%` }}
                          ></div>
                        )
                      })}
                    </div>

                    {/* CURRENT TIME INDICATOR */}
                    {currentTimePos >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                        style={{ left: `${currentTimePos}%` }}
                      ></div>
                    )}

                    {/* RESERVATION BLOCKS */}
                    {reservationBlocks
                      .filter(block => block.table.id === table.id)
                      .map((block, i) => {
                        const isCompleted = block.booking.status === 'COMPLETED'
                        const colorIndex = i % COLORS.length
                        const bgColor = COLORS[colorIndex]

                        // FIXED: Opacity for completed items - "becomes too transparent" -> use opacity-80 or 90 instead of 40
                        return (
                          <div
                            key={block.booking.id}
                            draggable={!isCompleted}
                            onDragStart={(e) => handleDragStart(e, block.booking.id, block.duration)}
                            className={`absolute top-2 bottom-2 rounded-md border border-white/20 shadow-sm px-2 flex flex-col justify-center overflow-hidden transition-all hover:z-20 hover:scale-[1.02] ${isCompleted ? 'opacity-70 grayscale' : 'shadow-md'}`}
                            style={{
                              left: `${getBlockStyle(block.startMinutes, block.duration).left}`,
                              width: `${getBlockStyle(block.startMinutes, block.duration).width}`,
                              backgroundColor: bgColor,
                              color: ['#F4E6D1', '#F0D86F'].includes(bgColor) ? '#000' : '#fff'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditBooking?.(block.booking)
                            }}
                          >
                            <div className="font-bold text-base truncate leading-tight"> {/* INCREASED FONT SIZE */}
                              {block.booking.name}
                            </div>
                            <div className="text-sm truncate opacity-90 mt-1 font-medium"> {/* INCREASED FONT SIZE */}
                              {minutesToTime(block.startMinutes)} • {block.booking.guests}p
                            </div>

                            {!isCompleted && (
                              <div className="absolute top-1 right-1 flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 text-current p-0 mb-1"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteReservation(block.booking)
                                  }}
                                  title="Elimina Prenotazione"
                                >
                                  <Trash size={12} weight="bold" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 text-current p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCompleteBooking(block.booking)
                                  }}
                                  title="Segna Arrivato"
                                >
                                  <Check size={12} weight="bold" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}

                  </div >
                  )
      })}
                </div>
  </CardContent>
      </Card >

      {/* DIALOGS */}

      {/* Search Table Dialog */}
      <Dialog open={showSmartSearch} onOpenChange={setShowSmartSearch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ricerca Tavolo Disponibile</DialogTitle>
            <DialogDescription>
              Inserisci orario e numero di persone per trovare un tavolo libero.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="search-time">Orario</Label>
                <Input
                  id="search-time"
                  type="time"
                  value={searchTime}
                  onChange={(e) => setSearchTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-guests">Persone</Label>
                <Input
                  id="search-guests"
                  type="number"
                  min="1"
                  value={searchGuests}
                  onChange={(e) => setSearchGuests(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSmartSearch} className="w-full">
              <Search className="mr-2" size={16} /> Cerca
            </Button>
          </div>
        </DialogContent>
      </Dialog>


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
                  onChange={(e) => {
                    const val = e.target.value
                    setNewReservation(prev => ({ ...prev, guests: val === '' ? '' : parseInt(val) }))
                  }}
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
            <Button onClick={handleCreateReservation} className="w-full">Conferma Prenotazione</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDragConfirmDialog} onOpenChange={(open) => { if (!open) { setDraggedBookingId(null); setDropTarget(null); setShowDragConfirmDialog(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sposta Prenotazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler spostare la prenotazione alle {dropTarget?.time}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDragConfirmDialog(false)}>Annulla</Button>
            <Button onClick={confirmMove}>Conferma Spostamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Elimina Prenotazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare la prenotazione di {bookingToDelete?.name}?
              <br />L'azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDeleteReservation}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Arrived Confirmation Dialog */}
      <Dialog open={showArriveConfirmDialog} onOpenChange={setShowArriveConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Arrivo</DialogTitle>
            <DialogDescription>
              Vuoi segnare la prenotazione di {bookingToArrive?.name} come "Arrivata"?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowArriveConfirmDialog(false)}>Annulla</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={confirmCompleteBooking}>Conferma</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}