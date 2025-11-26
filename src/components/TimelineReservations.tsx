import { useState, useEffect, useRef } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Clock, X, Plus } from '@phosphor-icons/react'
import type { Table, Reservation, User } from '../services/types'

import { DatabaseService } from '../services/DatabaseService'

interface TimelineReservationsProps {
  user: User
  tables: Table[]
  reservations: Reservation[]
}

interface TimeSlot {
  time: string
  hour: number
  minute: number
}

interface ReservationBlock {
  reservation: Reservation
  startMinutes: number
  duration: number
  table: Table
}

const TimelineReservations = ({ user, tables, reservations }: TimelineReservationsProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showReservationDialog, setShowReservationDialog] = useState(false)
  const [newReservation, setNewReservation] = useState({
    customerName: '',
    customerPhone: '',
    tableId: '',
    time: '',
    guests: 1,
    duration: 120 // Default 2 hours
  })
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ tableId: string, time: string } | null>(null)
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Generate time slots from 10:00 to 24:00 (every 30 minutes)
  const timeSlots: TimeSlot[] = []
  for (let hour = 10; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 23 && minute > 30) break // Stop at 23:30
      timeSlots.push({
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        hour,
        minute
      })
    }
  }

  const restaurantTables = tables?.filter(table => table.restaurantId === user.restaurantId && table.isActive) || []
  const dayReservations = reservations?.filter(res =>
    res.restaurantId === user.restaurantId && res.date === selectedDate
  ) || []

  // Convert time to minutes from start of day
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Convert minutes to time string
  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Get current time indicator position
  const getCurrentTimePosition = () => {
    const now = new Date()
    const currentDate = now.toISOString().split('T')[0]

    if (currentDate !== selectedDate) return null

    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = 10 * 60 // 10:00
    const endMinutes = 24 * 60   // 24:00

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) return null

    const percentage = ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100
    return percentage
  }

  // Check if time slot conflicts with existing reservations
  const hasConflict = (tableId: string, startTime: string, duration: number, excludeId?: string) => {
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = startMinutes + duration

    return dayReservations.some(res => {
      if (res.tableId !== tableId || res.id === excludeId) return false

      const resStartMinutes = timeToMinutes(res.time)
      const resEndMinutes = resStartMinutes + 120 // Default 2 hours

      return (startMinutes < resEndMinutes && endMinutes > resStartMinutes)
    })
  }

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent, tableId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = (clickX / rect.width) * 100

    const startMinutes = 10 * 60 // 10:00
    const endMinutes = 24 * 60   // 24:00
    const totalMinutes = endMinutes - startMinutes

    const clickedMinutes = startMinutes + (percentage / 100) * totalMinutes

    // Round to nearest 30 minutes
    const roundedMinutes = Math.round(clickedMinutes / 30) * 30
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

  // Create reservation
  const handleCreateReservation = () => {
    if (!newReservation.customerName || !newReservation.customerPhone || !newReservation.tableId || !newReservation.time) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    if (hasConflict(newReservation.tableId, newReservation.time, newReservation.duration)) {
      toast.error('Orario in conflitto con un\'altra prenotazione')
      return
    }

    const reservation: Reservation = {
      id: Date.now().toString(),
      customerName: newReservation.customerName,
      customerPhone: newReservation.customerPhone,
      tableId: newReservation.tableId,
      date: selectedDate,
      time: newReservation.time,
      guests: newReservation.guests,
      restaurantId: user.restaurantId!
    }

    DatabaseService.createReservation(reservation)
      .then(() => {
        setNewReservation({
          customerName: '',
          customerPhone: '',
          tableId: '',
          time: '',
          guests: 1,
          duration: 120
        })
        setShowReservationDialog(false)
        setSelectedTimeSlot(null)
        toast.success('Prenotazione creata')
      })
  }

  // Delete reservation
  const handleDeleteReservation = (reservationId: string) => {
    DatabaseService.deleteReservation(reservationId)
      .then(() => toast.success('Prenotazione eliminata'))
  }

  // Get reservation blocks for rendering
  const getReservationBlocks = (): ReservationBlock[] => {
    return dayReservations
      .map(reservation => {
        const table = restaurantTables.find(t => t.id === reservation.tableId)
        if (!table) return null // Skip if table not found
        const startMinutes = timeToMinutes(reservation.time)
        const duration = 120 // Default 2 hours

        return {
          reservation,
          startMinutes,
          duration,
          table
        }
      })
      .filter((block): block is ReservationBlock => block !== null)
  }

  // Get position and width for reservation block
  const getBlockStyle = (block: ReservationBlock) => {
    const startMinutes = 10 * 60 // 10:00
    const endMinutes = 24 * 60   // 24:00
    const totalMinutes = endMinutes - startMinutes

    const left = ((block.startMinutes - startMinutes) / totalMinutes) * 100
    const width = (block.duration / totalMinutes) * 100

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - Math.max(0, left), width)}%`
    }
  }

  const currentTimePosition = getCurrentTimePosition()

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">Timeline Prenotazioni</h2>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Badge variant="secondary" className="text-sm">
          {dayReservations.length} prenotazioni
        </Badge>
      </div>

      {/* Timeline Header - Time Labels */}
      <div className="relative">
        <div className="flex pl-32 pr-4">
          {timeSlots.filter((_, index) => index % 2 === 0).map((slot) => (
            <div key={slot.time} className="flex-1 text-center text-sm text-muted-foreground border-l border-border/20 first:border-l-0">
              {slot.time}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Grid */}
      <Card className="shadow-professional">
        <CardContent className="p-0">
          <div className="relative">
            {/* Current Time Indicator */}
            {currentTimePosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-10 pointer-events-none"
                style={{ left: `calc(8rem + ${currentTimePosition}%)` }}
              >
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md"></div>
              </div>
            )}

            {/* Table Rows */}
            {restaurantTables.map((table, tableIndex) => (
              <div key={table.id} className="relative">
                {/* Table Name */}
                <div className="absolute left-0 top-0 w-32 h-16 flex items-center px-4 font-medium text-foreground bg-muted/30 border-b border-border/20">
                  {table.name}
                </div>

                {/* Timeline Row */}
                <div
                  className="ml-32 h-16 border-b border-border/20 relative cursor-crosshair hover:bg-muted/20 transition-colors"
                  onClick={(e) => handleTimelineClick(e, table.id)}
                  ref={tableIndex === 0 ? timelineRef : undefined}
                >
                  {/* Time Grid Lines */}
                  {timeSlots.filter((_, index) => index % 2 === 0).map((slot) => (
                    <div
                      key={slot.time}
                      className="absolute top-0 bottom-0 border-l border-border/10 pointer-events-none"
                      style={{ left: `${((timeToMinutes(slot.time) - 10 * 60) / (14 * 60)) * 100}%` }}
                    />
                  ))}

                  {/* Reservation Blocks */}
                  {getReservationBlocks()
                    .filter(block => block.table.id === table.id)
                    .map((block) => (
                      <div
                        key={block.reservation.id}
                        className="absolute top-1 bottom-1 bg-primary/80 rounded-md border border-primary flex items-center px-2 cursor-pointer hover:bg-primary/90 transition-colors group"
                        style={getBlockStyle(block)}
                        title={`${block.reservation.customerName} - ${block.reservation.guests} persone`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-primary-foreground truncate">
                            {block.reservation.customerName}
                          </div>
                          <div className="text-xs text-primary-foreground/80">
                            {block.reservation.guests} pers.
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-primary-foreground hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteReservation(block.reservation.id)
                          }}
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>



      {/* Reservation Dialog */}
      <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuova Prenotazione</DialogTitle>
            <DialogDescription>
              Compila i dati per creare una nuova prenotazione
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Nome Cliente *</Label>
              <Input
                id="customerName"
                value={newReservation.customerName}
                onChange={(e) => setNewReservation(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Telefono *</Label>
              <Input
                id="customerPhone"
                value={newReservation.customerPhone}
                onChange={(e) => setNewReservation(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="Numero di telefono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableSelect">Tavolo *</Label>
              <select
                id="tableSelect"
                value={newReservation.tableId}
                onChange={(e) => setNewReservation(prev => ({ ...prev, tableId: e.target.value }))}
                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
              >
                <option value="">Seleziona tavolo</option>
                {restaurantTables.map(table => (
                  <option key={table.id} value={table.id}>{table.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservationTime">Orario *</Label>
              <Input
                id="reservationTime"
                type="time"
                value={newReservation.time}
                onChange={(e) => setNewReservation(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">Numero di persone *</Label>
              <Input
                id="guests"
                type="number"
                min="1"
                value={newReservation.guests}
                onChange={(e) => setNewReservation(prev => ({ ...prev, guests: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReservationDialog(false)
                  setNewReservation({
                    customerName: '',
                    customerPhone: '',
                    tableId: '',
                    time: '',
                    guests: 1,
                    duration: 120
                  })
                }}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                onClick={handleCreateReservation}
                className="flex-1"
              >
                Crea Prenotazione
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TimelineReservations