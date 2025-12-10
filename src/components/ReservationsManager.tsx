import { useState, useEffect } from 'react'
import { DatabaseService } from '../services/DatabaseService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { Calendar, Clock, Users, PencilSimple, Trash, Phone, User as UserIcon, CalendarBlank, ArrowsLeftRight } from '@phosphor-icons/react'
import type { User, Booking, Table, Room } from '../services/types'
import TimelineReservations from './TimelineReservations'
import QRCodeGenerator from './QRCodeGenerator'
import { QrCode } from '@phosphor-icons/react'

interface ReservationsManagerProps {
  user: User
  restaurantId: string
  tables: Table[]
  rooms: Room[]
  bookings: Booking[]
  selectedDate: Date
  openingTime?: string
  closingTime?: string
  reservationDuration?: number
  onRefresh?: () => void
}

export default function ReservationsManager({ user, restaurantId, tables, rooms, bookings, selectedDate, openingTime = '10:00', closingTime = '23:00', reservationDuration = 120, onRefresh }: ReservationsManagerProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showQrDialog, setShowQrDialog] = useState(false)

  // Helper for date comparison (ignoring time)
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
  }

  // Filter states for history
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  const [customHistoryStartDate, setCustomHistoryStartDate] = useState('')
  const [customHistoryEndDate, setCustomHistoryEndDate] = useState('')

  // Form states for editing
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    tableId: '',
    date: '',
    time: '',
    guests: 1
  })

  // Move form state
  const [moveForm, setMoveForm] = useState({
    date: '',
    time: ''
  })

  // Filter bookings for this restaurant
  const restaurantBookings = bookings.filter(b => b.restaurant_id === restaurantId)
  const restaurantTables = tables
    .filter(t => t.restaurant_id === restaurantId)
    .filter(t => selectedRoomId === 'all' || t.room_id === selectedRoomId)

  // Separate active and history (completed) bookings
  const now = new Date()

  const activeBookings = restaurantBookings.filter(b => {
    const bookingDate = new Date(b.date_time)
    // Filter by selectedDate
    return isSameDay(bookingDate, selectedDate) && b.status !== 'CANCELLED'
  })

  const historyBookings = restaurantBookings.filter(b => {
    const bookingDate = new Date(b.date_time)
    const isPast = bookingDate < now && !isSameDay(bookingDate, now)
    return isPast || b.status === 'COMPLETED' || b.status === 'CANCELLED'
  })

  // Initialize edit form when reservation is selected
  const handleEditBooking = (booking: Booking) => {
    setSelectedBooking(booking)
    const [date, time] = booking.date_time.split('T')
    setEditForm({
      name: booking.name,
      phone: booking.phone || '',
      tableId: booking.table_id || '',
      date: date,
      time: time.substring(0, 5),
      guests: booking.guests
    })
    setShowEditDialog(true)
  }

  // Initialize move form
  const handleMoveBooking = (booking: Booking) => {
    setSelectedBooking(booking)
    const [date, time] = booking.date_time.split('T')
    setMoveForm({
      date: date,
      time: time.substring(0, 5)
    })
    setShowMoveDialog(true)
  }

  // Save edited reservation
  const handleSaveEdit = () => {
    if (!selectedBooking) return

    if (!editForm.name.trim() || !editForm.tableId || !editForm.date || !editForm.time) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    const dateTime = `${editForm.date}T${editForm.time}:00`

    const updatedBooking: Partial<Booking> = {
      id: selectedBooking.id,
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      table_id: editForm.tableId,
      date_time: dateTime,
      guests: editForm.guests
    }

    DatabaseService.updateBooking(updatedBooking)
      .then(() => {
        setShowEditDialog(false)
        setSelectedBooking(null)
        toast.success('Prenotazione modificata con successo')
        onRefresh?.()
      })
  }

  // Save moved reservation
  const handleSaveMove = () => {
    if (!selectedBooking || !moveForm.date || !moveForm.time) {
      toast.error('Seleziona data e ora')
      return
    }

    const dateTime = `${moveForm.date}T${moveForm.time}:00`

    // Check if date changed
    const originalDate = selectedBooking.date_time.split('T')[0]
    if (originalDate !== moveForm.date) {
      // Confirmation is implicit in the dialog action, but we could add another step if needed.
      // The user asked for a confirmation message.
      if (!confirm(`Sei sicuro di voler spostare la prenotazione al ${formatDate(moveForm.date)} alle ${moveForm.time}?`)) {
        return
      }
    }

    DatabaseService.updateBooking({
      id: selectedBooking.id,
      date_time: dateTime
    })
      .then(() => {
        setShowMoveDialog(false)
        setSelectedBooking(null)
        toast.success('Prenotazione spostata con successo')
        onRefresh?.()
      })
  }

  // Delete reservation
  const handleDeleteBooking = async (bookingId?: string) => {
    const id = bookingId || selectedBooking?.id
    if (!id) return

    try {
      await DatabaseService.deleteBooking(id)
      setShowDeleteDialog(false)
      setSelectedBooking(null)
      toast.success('Prenotazione eliminata')
      await onRefresh?.()
    } catch (error) {
      console.error('Errore durante l\'eliminazione della prenotazione', error)
      toast.error('Non è stato possibile eliminare la prenotazione')
    }
  }

  // Complete reservation (move to history)
  const handleCompleteBooking = (booking: Booking) => {
    DatabaseService.updateBooking({ id: booking.id, status: 'COMPLETED' })
      .then(() => {
        toast.success('Prenotazione completata')
        onRefresh?.()
      })
  }

  // Get table name
  const getTableName = (tableId?: string) => {
    if (!tableId) return 'Nessun tavolo'
    const table = restaurantTables.find(t => t.id === tableId)
    return table?.number ? `${table.number}` : 'Tavolo non trovato'
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Check if reservation is today
  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  // Get history date filters
  const getHistoryDateFilters = () => {
    const filters: Array<{ value: string; label: string }> = []
    filters.push({ value: 'today', label: 'Oggi' })
    filters.push({ value: 'yesterday', label: 'Ieri' })
    filters.push({ value: 'dayBeforeYesterday', label: 'Ieri l\'altro' })
    filters.push({ value: 'lastWeek', label: 'Ultima settimana' })
    filters.push({ value: 'lastMonth', label: 'Ultimo mese' })
    filters.push({ value: 'custom', label: 'Personalizzato' })
    return filters
  }

  // Filter history reservations
  const getFilteredHistoryBookings = () => {
    let filtered = historyBookings
    const today = new Date()

    if (historyFilter !== 'all') {
      switch (historyFilter) {
        case 'today':
          const todayStr = today.toISOString().split('T')[0]
          filtered = filtered.filter(res => res.date_time.startsWith(todayStr))
          break
        case 'yesterday':
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]
          filtered = filtered.filter(res => res.date_time.startsWith(yesterdayStr))
          break
        case 'dayBeforeYesterday':
          const dayBefore = new Date(today)
          dayBefore.setDate(dayBefore.getDate() - 2)
          const dayBeforeStr = dayBefore.toISOString().split('T')[0]
          filtered = filtered.filter(res => res.date_time.startsWith(dayBeforeStr))
          break
        case 'lastWeek':
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          filtered = filtered.filter(res => {
            const resDate = new Date(res.date_time)
            return resDate >= weekAgo && resDate <= today
          })
          break
        case 'lastMonth':
          const monthAgo = new Date(today)
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          filtered = filtered.filter(res => {
            const resDate = new Date(res.date_time)
            return resDate >= monthAgo && resDate <= today
          })
          break
        case 'custom':
          if (customHistoryStartDate && customHistoryEndDate) {
            const startDate = new Date(customHistoryStartDate)
            const endDate = new Date(customHistoryEndDate)
            // Adjust end date to include the full day
            endDate.setHours(23, 59, 59, 999)
            filtered = filtered.filter(res => {
              const resDate = new Date(res.date_time)
              return resDate >= startDate && resDate <= endDate
            })
          }
          break
      }
    }

    return filtered
  }

  const historyDateFilters = getHistoryDateFilters()
  const filteredHistoryBookings = getFilteredHistoryBookings()

  return (
    <div className="space-y-6">
      {/* Header with Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-foreground">Prenotazioni del {selectedDate.toLocaleDateString('it-IT')}</h2>
          <div className="flex gap-2 flex-wrap">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
              onClick={() => setShowQrDialog(true)}
            >
              <QrCode size={18} weight="bold" />
              QR Prenotazioni (Pubblico)
            </Button>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtra per Sala" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Sale</SelectItem>
                {rooms.map(room => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowHistoryDialog(true)}
            >
              Storico Prenotazioni
            </Button>
          </div>
        </div>

        {/* Timeline Component */}
        <TimelineReservations
          user={user}
          restaurantId={restaurantId}
          tables={tables}
          bookings={bookings}
          selectedDate={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`}
          openingTime={openingTime}
          closingTime={closingTime}
          reservationDuration={reservationDuration}
          onRefresh={onRefresh}
          onEditBooking={handleEditBooking}
          onDeleteBooking={handleDeleteBooking}
        />
      </div>

      {/* Reservations List Removed */}

      {/* Edit Reservation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Prenotazione</DialogTitle>
            <DialogDescription>
              Modifica i dettagli della prenotazione
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-customer-name">Nome Cliente *</Label>
                <Input
                  id="edit-customer-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome e cognome"
                />
              </div>
              <div>
                <Label htmlFor="edit-customer-phone">Telefono *</Label>
                <Input
                  id="edit-customer-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+39 333 123 4567"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="edit-date">Data *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-time">Orario *</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-guests">Ospiti *</Label>
                <Input
                  id="edit-guests"
                  type="number"
                  min="1"
                  max="20"
                  value={editForm.guests}
                  onChange={(e) => setEditForm(prev => ({ ...prev, guests: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-table">Tavolo *</Label>
              <Select
                value={editForm.tableId}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, tableId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tavolo" />
                </SelectTrigger>
                <SelectContent>
                  {restaurantTables.map(table => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-primary hover:bg-primary/90"
              >
                Salva Modifiche
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Reservation Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestisci Prenotazione</DialogTitle>
            <DialogDescription>
              Gestisci la prenotazione di {selectedBooking?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="move-date">Nuova Data</Label>
              <Input
                id="move-date"
                type="date"
                value={moveForm.date}
                onChange={(e) => setMoveForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-time">Nuovo Orario</Label>
              <Input
                id="move-time"
                type="time"
                value={moveForm.time}
                onChange={(e) => setMoveForm(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={handleSaveMove}
                className="w-full"
              >
                Conferma Spostamento
              </Button>

              {selectedBooking && selectedBooking.status !== 'COMPLETED' && (
                <Button
                  onClick={() => {
                    handleCompleteBooking(selectedBooking)
                    setShowMoveDialog(false)
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Segna come Completata
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => setShowMoveDialog(false)}
                className="w-full"
              >
                Chiudi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Prenotazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questa prenotazione? Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="bg-muted/30 p-4 rounded-lg">
              <p><strong>Cliente:</strong> {selectedBooking.name}</p>
              <p><strong>Data:</strong> {formatDate(selectedBooking.date_time.split('T')[0])}</p>
              <p><strong>Orario:</strong> {selectedBooking.date_time.split('T')[1].substring(0, 5)}</p>
              <p><strong>Tavolo:</strong> {getTableName(selectedBooking.table_id)}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteBooking()}
            >
              Elimina Prenotazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reservation History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Storico Prenotazioni</DialogTitle>
            <DialogDescription>
              Tutte le prenotazioni completate o cancellate
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* History Filter */}
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={historyFilter} onValueChange={setHistoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtra storico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le prenotazioni</SelectItem>
                  {historyDateFilters.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {historyFilter === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarBlank size={16} />
                      Periodo Personalizzato
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4 p-2">
                      <div className="space-y-2">
                        <Label htmlFor="custom-history-start">Data Inizio</Label>
                        <Input
                          id="custom-history-start"
                          type="date"
                          value={customHistoryStartDate}
                          onChange={(e) => setCustomHistoryStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-history-end">Data Fine</Label>
                        <Input
                          id="custom-history-end"
                          type="date"
                          value={customHistoryEndDate}
                          onChange={(e) => setCustomHistoryEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {filteredHistoryBookings.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>{historyFilter === 'all' ? 'Nessuna prenotazione nello storico' : 'Nessuna prenotazione trovata per il periodo selezionato'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistoryBookings
                    .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
                    .map(booking => (
                      <Card key={booking.id} className="border-l-4 border-l-muted">
                        <CardContent className="p-4">
                          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="font-semibold">{booking.name}</p>
                              <p className="text-sm text-muted-foreground">{booking.phone}</p>
                            </div>
                            <div>
                              <p className="text-sm">{formatDate(booking.date_time.split('T')[0])}</p>
                              <p className="text-sm text-muted-foreground">{booking.date_time.split('T')[1].substring(0, 5)}</p>
                            </div>
                            <div>
                              <p className="text-sm">{getTableName(booking.table_id)}</p>
                              <p className="text-sm text-muted-foreground">{booking.guests} ospiti</p>
                            </div>
                            <div className="flex items-center">
                              <Badge variant={booking.status === 'COMPLETED' ? 'default' : 'destructive'} className={booking.status === 'COMPLETED' ? 'bg-green-600' : ''}>
                                {booking.status === 'COMPLETED' ? 'Completata' : 'Cancellata'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Public Booking QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Prenotazioni Pubbliche</DialogTitle>
            <DialogDescription className="text-center">
              Fai scansionare questo codice ai clienti per prenotare un tavolo autonomamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-lg border">
              <QRCodeGenerator
                value={`${window.location.origin}/book/${restaurantId}`}
                size={200}
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Link diretto:</p>
              <code className="text-xs bg-muted p-2 rounded block break-all">
                {`${window.location.origin}/book/${restaurantId}`}
              </code>
            </div>
          </div>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => window.open(`${window.location.origin}/book/${restaurantId}`, '_blank')}>
              Apri pagina di prenotazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}