import React, { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Trash, MagnifyingGlass as Search, Check, Clock, ArrowRight, Users, ChatText } from '@phosphor-icons/react'
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
  onDateChange?: (date: Date) => void
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

export default function TimelineReservations({ user, restaurantId, tables, bookings, selectedDate, openingTime = '10:00', closingTime = '23:00', reservationDuration = 120, onRefresh, onEditBooking, onDeleteBooking, onDateChange }: TimelineReservationsProps) {
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
    notes: string
  }>({
    name: '',
    phone: '',
    guests: 2,
    time: '',
    tableId: '',
    notes: ''
  })

  // Filter tables for this restaurant
  const restaurantTables = tables.filter(t => t.restaurant_id === restaurantId)

  // Filter bookings for selected date
  const localBookings = bookings.filter(b => b.restaurant_id === restaurantId && b.status !== 'CANCELLED')

  const dayBookings = localBookings?.filter(res => {
    if (!res.date_time) return false
    const bDate = new Date(res.date_time)
    const bDateStr = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`
    return bDateStr === selectedDate
  }) || []

  // Timeline configuration
  const startHour = openingTime ? parseInt(openingTime.split(':')[0]) || 0 : 0
  const endHour = closingTime ? parseInt(closingTime.split(':')[0]) || 24 : 24

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
    if (!time) return 0
    const parts = time.split(':')
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
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

        if (!booking.date_time) return null
        const timePart = booking.date_time.split('T')[1] || ''
        const parts = timePart.split(':')
        const hours = parseInt(parts[0]) || 0
        const minutes = parseInt(parts[1]) || 0
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

    if (hasConflict(tableId, clickedTime, reservationDuration)) {
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
      // Capacity Check
      const selectedTable = restaurantTables.find(t => t.id === newReservation.tableId)
      const guests = typeof newReservation.guests === 'string' ? parseInt(newReservation.guests) || 1 : newReservation.guests
      if (selectedTable && (selectedTable.seats || 4) < guests) {
        toast.error(`Il tavolo ${selectedTable.number} può contenere massimo ${selectedTable.seats || 4} persone`)
        return
      }

      const dateTime = `${selectedDate}T${newReservation.time}:00`

      await DatabaseService.createBooking({
        restaurant_id: restaurantId,
        table_id: newReservation.tableId,
        date_time: dateTime,
        guests: Number(newReservation.guests),
        status: 'CONFIRMED',
        name: newReservation.name,
        phone: newReservation.phone,
        notes: newReservation.notes
      })

      toast.success('Prenotazione creata')
      setShowReservationDialog(false)
      setNewReservation({ name: '', phone: '', guests: 2, time: '', tableId: '', notes: '' })
      onRefresh?.()
    } catch (error) {
      console.error('Error creating reservation:', error)
      toast.error('Errore creazione prenotazione')
    }
  }

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, bookingId: string, duration: number) => {
    e.dataTransfer.setData('bookingId', bookingId)
    setDraggedBookingId(bookingId)

    // Calculate click offset relative to the block
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const offsetPercentage = clickX / rect.width
    const offsetMinutes = Math.round(offsetPercentage * duration)
    setDragOffsetMinutes(offsetMinutes)
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

    // Position on timeline in minutes
    const mouseMinutes = TIMELINE_START_MINUTES + (percentage / 100) * totalMinutes

    // Adjust for the drag offset
    const adjustedStartMinutes = mouseMinutes - dragOffsetMinutes

    // Snap to 15 mins
    const roundedMinutes = Math.round(adjustedStartMinutes / 15) * 15
    const newTime = minutesToTime(roundedMinutes)

    if (hasConflict(tableId, newTime, reservationDuration, bookingId)) {
      toast.error('Orario occupato o sovrapposto')
      return
    }

    // Capacity Check
    const targetTable = restaurantTables.find(t => t.id === tableId)
    const movingBooking = localBookings.find(b => b.id === bookingId)
    if (targetTable && movingBooking && (targetTable.seats || 4) < movingBooking.guests) {
      toast.error(`Il tavolo ${targetTable.number} può contenere massimo ${targetTable.seats || 4} persone`)
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

  const handleCompleteBooking = (booking: Booking) => {
    setBookingToArrive(booking)
    setShowArriveConfirmDialog(true)
  }

  const confirmCompleteBooking = async () => {
    if (!bookingToArrive) return

    try {
      await DatabaseService.updateBooking({
        id: bookingToArrive.id,
        status: 'COMPLETED'
      })
      toast.success('Prenotazione completata! 👍')
      onRefresh?.()
    } catch (error) {
      console.error('Complete error:', error)
      toast.error('Errore completamento prenotazione')
    } finally {
      setShowArriveConfirmDialog(false)
      setBookingToArrive(null)
    }
  }

  const handleDeleteReservation = (booking: Booking) => {
    setBookingToDelete(booking)
    setShowDeleteConfirmDialog(true)
  }

  const confirmDeleteReservation = async () => {
    if (!bookingToDelete) return

    try {
      if (onDeleteBooking) {
        onDeleteBooking(bookingToDelete.id)
      } else {
        await DatabaseService.deleteBooking(bookingToDelete.id)
      }
      toast.success('Prenotazione eliminata')
      onRefresh?.()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Errore durante l\'eliminazione')
    } finally {
      setShowDeleteConfirmDialog(false)
      setBookingToDelete(null)
    }
  }

  const handleSmartSearch = () => {
    if (!searchTime) {
      toast.error('Seleziona un orario')
      return
    }

    const available = restaurantTables.filter(table => {
      const guests = typeof searchGuests === 'string' ? parseInt(searchGuests) || 1 : searchGuests
      if ((table.seats || 0) < guests) return false
      return !hasConflict(table.id, searchTime, reservationDuration)
    })

    setAvailableTables(available)

    if (available.length === 0) {
      toast.error('Nessun tavolo disponibile per questo orario')
    } else {
      toast.success(`${available.length} tavolo/i disponibile/i`)
      if (available.length > 0) {
        setHighlightedTableId(available[0].id)
        setTimeout(() => setHighlightedTableId(null), 5000)
      }
    }
  }

  const getCurrentTimePosition = () => {
    const now = new Date()
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
            <div className="flex h-12 sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/50">
              <div className="w-40 shrink-0 border-r border-white/10 flex items-center px-4">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tavoli</span>
              </div>
              <div className="flex-1 relative">
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
                      <span className="text-xs font-bold text-zinc-400 mb-1 px-1">{slot.time}</span>
                      <div className="h-2 w-px bg-white/10"></div>
                    </div>
                  )
                })}
              </div>
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
              let borderClass = 'border-l-2 border-l-zinc-800'
              let bgClass = 'bg-black/40' // Pure black/glass default

              if (isCurrentlyOccupied) {
                borderClass = 'border-l-2 border-l-amber-500'
                bgClass = 'bg-amber-950/20' // Subtle gold tint for occupied
              } else if (isAvailable && searchTime) {
                borderClass = 'border-l-2 border-l-emerald-500' // Available
                bgClass = 'bg-emerald-950/20'
              } else {
                // Default Free
                borderClass = 'border-l-2 border-l-zinc-800'
                bgClass = 'bg-black' // Deep black for free
              }

              // Collision check for ghost block
              const isHoverColliding = hoveredSlot && hoveredSlot.tableId === table.id && reservationBlocks.some(block => {
                if (block.table.id !== table.id) return false
                const blockEnd = block.startMinutes + block.duration
                const ghostStart = hoveredSlot.startMinutes
                const ghostEnd = ghostStart + reservationDuration
                return (ghostStart < blockEnd && ghostEnd > block.startMinutes)
              })

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
                    {/* GHOST BLOCK ON HOVER - Only if no collision */}
                    {hoveredSlot && hoveredSlot.tableId === table.id && !draggedBookingId && !isHoverColliding && (
                      <div
                        className="absolute top-2 bottom-2 rounded-md bg-amber-500/20 border-2 border-amber-500/50 border-dashed z-0 pointer-events-none transition-all duration-75 ease-out"
                        style={{
                          left: `${getBlockStyle(hoveredSlot.startMinutes, reservationDuration).left}`,
                          width: `${getBlockStyle(hoveredSlot.startMinutes, reservationDuration).width}`
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-amber-500 text-black text-xs px-1.5 py-0.5 rounded shadow-sm font-bold whitespace-nowrap">
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
                            className="absolute top-0 bottom-0 w-px bg-white/5 dashed border-r border-dashed border-white/5"
                            style={{ left: `${left}%` }}
                          ></div>
                        )
                      })}
                    </div>

                    {/* CURRENT TIME INDICATOR */}
                    {currentTimePos >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(245,158,11,0.8)]"
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

                        // FIXED: Opacity for completed items
                        return (
                          <div
                            key={block.booking.id}
                            draggable={!isCompleted}
                            onDragStart={(e) => handleDragStart(e, block.booking.id, block.duration)}
                            // INCREASED SCALE: hover:scale-105 for more pop
                            className={`absolute top-2 bottom-2 rounded-md border border-white/20 px-2 flex flex-col justify-center overflow-hidden transition-all duration-300 hover:z-50 hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] ${isCompleted ? 'opacity-40 grayscale scale-[0.98]' : 'shadow-[0_10px_20px_-5px_rgba(0,0,0,0.5)]'}`}
                            style={{
                              left: `${getBlockStyle(block.startMinutes, block.duration).left}`,
                              width: `${getBlockStyle(block.startMinutes, block.duration).width}`,
                              backgroundColor: bgColor,
                              color: '#000', // Force black text for contrast on gold
                              fontWeight: 600
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditBooking?.(block.booking)
                            }}
                            onMouseEnter={() => setHoveredSlot(null)} // Hide ghost block explicitly when entering a block
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <div className="font-bold text-sm truncate leading-tight flex-1">
                                {block.booking.name}
                              </div>
                              {block.booking.notes && (
                                <ChatText size={14} weight="fill" className="text-black/60 shrink-0" />
                              )}
                            </div>
                            <div className="text-[10px] truncate opacity-80 mt-0.5 font-bold uppercase tracking-wide">
                              {minutesToTime(block.startMinutes)} - {minutesToTime(block.startMinutes + block.duration)} • {block.booking.guests}p
                            </div>

                            {!isCompleted && (
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full p-0.5 backdrop-blur-sm"> {/* Hide buttons by default */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5 rounded-full hover:bg-black/20 text-black p-0"
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
                                  className="w-5 h-5 rounded-full hover:bg-black/20 text-black p-0"
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
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card >

      {/* DIALOGS */}

      {/* Search Table Dialog */}
      <Dialog open={showSmartSearch} onOpenChange={setShowSmartSearch}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Ricerca Tavolo Disponibile</DialogTitle>
            <DialogDescription>
              Trova un tavolo libero per la prenotazione.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="search-date">Data</Label>
                <Input
                  id="search-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value)
                    if (!isNaN(newDate.getTime()) && onDateChange) {
                      onDateChange(newDate)
                      setAvailableTables([]) // Reset results when date changes
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-date">Data</Label>
                <Input
                  id="search-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value)
                    if (!isNaN(newDate.getTime()) && onDateChange) {
                      onDateChange(newDate)
                      setAvailableTables([]) // Reset results when date changes
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-time">Orario</Label>
                <Input
                  id="search-time"
                  type="time"
                  value={searchTime}
                  onChange={(e) => {
                    setSearchTime(e.target.value)
                    setAvailableTables([]) // Reset results on change
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-guests">Persone</Label>
                <Input
                  id="search-guests"
                  type="number"
                  min="1"
                  value={searchGuests}
                  onChange={(e) => {
                    setSearchGuests(e.target.value)
                    setAvailableTables([])
                  }}
                />
              </div>
            </div>

            <Button onClick={handleSmartSearch} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
              <Search className="mr-2" size={16} /> Cerca Tavoli
            </Button>

            {availableTables.length > 0 && (
              <div className="mt-4 border rounded-md overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="bg-muted px-4 py-2 border-b text-xs font-semibold text-muted-foreground">
                  Risultati Disponibili ({availableTables.length})
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {availableTables.map(table => (
                    <div key={table.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold">Tavolo {table.number}</span>
                        <span className="text-xs text-muted-foreground">{table.seats} Posti</span>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setNewReservation({
                            name: '',
                            phone: '',
                            guests: searchGuests,
                            time: searchTime,
                            tableId: table.id,
                            notes: ''
                          })
                          setShowSmartSearch(false)
                          setShowReservationDialog(true)
                        }}
                      >
                        Prenota
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableTables.length === 0 && searchTime && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                Clicca su "Cerca" per vedere i risultati.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Nuova Prenotazione</DialogTitle>
            <DialogDescription>
              Aggiungi una prenotazione per il {selectedDate} alle {newReservation.time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="res-name" className="text-zinc-400">Nome Cliente</Label>
                <Input
                  id="res-name"
                  value={newReservation.name}
                  onChange={(e) => setNewReservation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome del cliente"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="res-phone" className="text-zinc-400">Telefono</Label>
                <Input
                  id="res-phone"
                  value={newReservation.phone}
                  onChange={(e) => setNewReservation(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="E.g. +39 333..."
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="res-notes" className="text-zinc-400">Note / Richieste Speciali</Label>
              <Textarea
                id="res-notes"
                value={newReservation.notes}
                onChange={(e) => setNewReservation(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Allergie, tavolo preferito, compleanni..."
                className="bg-zinc-900 border-zinc-800 min-h-[100px] resize-none"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="res-guests" className="text-zinc-400">Ospiti</Label>
                <div className="relative">
                  <Input
                    id="res-guests"
                    type="number"
                    min="1"
                    value={newReservation.guests}
                    onChange={(e) => {
                      const val = e.target.value
                      setNewReservation(prev => ({ ...prev, guests: val === '' ? '' : parseInt(val) }))
                    }}
                    className="bg-zinc-900 border-zinc-800 pl-9"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="res-time" className="text-zinc-400">Orario</Label>
                <div className="relative">
                  <Input
                    id="res-time"
                    type="time"
                    value={newReservation.time}
                    onChange={(e) => setNewReservation(prev => ({ ...prev, time: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800 pl-9"
                  />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                </div>
              </div>
            </div>
            <Button onClick={handleCreateReservation} className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/10">
              Conferma Prenotazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDragConfirmDialog} onOpenChange={(open) => { if (!open) { setDraggedBookingId(null); setDropTarget(null); setShowDragConfirmDialog(false) } }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Sposta Prenotazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler spostare la prenotazione alle {dropTarget?.time}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDragConfirmDialog(false)} className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800">Annulla</Button>
            <Button onClick={confirmMove} className="bg-amber-600 hover:bg-amber-700 text-white">Conferma Spostamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
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
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Conferma Arrivo</DialogTitle>
            <DialogDescription>
              Vuoi segnare la prenotazione di {bookingToArrive?.name} come "Arrivata"?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowArriveConfirmDialog(false)}>Annulla</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={confirmCompleteBooking}>Conferma</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}