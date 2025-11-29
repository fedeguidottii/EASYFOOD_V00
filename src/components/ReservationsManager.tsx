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
import { Calendar, Clock, Users, PencilSimple, Trash, Phone, User as UserIcon, CalendarBlank } from '@phosphor-icons/react'
import type { User, Booking, Table } from '../services/types'
import TimelineReservations from './TimelineReservations'

interface ReservationsManagerProps {
  user: User
  restaurantId: string
  tables: Table[]
  bookings: Booking[]
  dateFilter?: 'today' | 'tomorrow' | 'all'
  onRefresh?: () => void
}

export default function ReservationsManager({ user, restaurantId, tables, bookings, dateFilter = 'today', onRefresh }: ReservationsManagerProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)

  // Filter states for future reservations
  const [futureFilter, setFutureFilter] = useState<string>('all')
  const [customFutureDate, setCustomFutureDate] = useState('')

  // Sync prop with internal state when it changes
  useEffect(() => {
    if (dateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      setFutureFilter(today)
    } else if (dateFilter === 'tomorrow') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      setFutureFilter(tomorrowStr)
    } else {
      setFutureFilter('all')
    }
  }, [dateFilter])

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

  // Filter bookings for this restaurant
  const restaurantBookings = bookings.filter(b => b.restaurant_id === restaurantId)
  const restaurantTables = tables.filter(t => t.restaurant_id === restaurantId)

  // Separate active and history (completed) bookings
  // Assuming 'completed' status or past date means history
  const now = new Date()
  const activeBookings = restaurantBookings.filter(b => {
    const bookingDate = new Date(b.date_time)
    return bookingDate >= now && b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  })

  const historyBookings = restaurantBookings.filter(b => {
    const bookingDate = new Date(b.date_time)
    return bookingDate < now || b.status === 'COMPLETED' || b.status === 'CANCELLED'
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

  // Delete reservation
  const handleDeleteBooking = async () => {
    if (!selectedBooking) return

    try {
      await DatabaseService.deleteBooking(selectedBooking.id)
      setShowDeleteDialog(false)
      setSelectedBooking(null)
      toast.success('Prenotazione eliminata')
      await onRefresh?.()
      // Force reload to ensure UI update if refresh is slow
      setTimeout(() => window.location.reload(), 500)
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
    return table?.number ? `Tavolo ${table.number}` : 'Tavolo non trovato'
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

  // Get suggested future dates
  const getFutureDateSuggestions = () => {
    const today = new Date()
    const suggestions: Array<{ value: string; label: string }> = []

    // Today
    suggestions.push({
      value: today.toISOString().split('T')[0],
      label: 'Oggi'
    })

    // Tomorrow
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    suggestions.push({
      value: tomorrow.toISOString().split('T')[0],
      label: 'Domani'
    })

    // Day after tomorrow
    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    suggestions.push({
      value: dayAfterTomorrow.toISOString().split('T')[0],
      label: 'Dopodomani'
    })

    // Next 7 days
    for (let i = 3; i <= 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      suggestions.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })
      })
    }

    return suggestions
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

  // Filter future reservations
  const getFilteredActiveBookings = () => {
    let filtered = activeBookings

    if (futureFilter !== 'all') {
      if (futureFilter === 'custom' && customFutureDate) {
        filtered = filtered.filter(res => res.date_time.startsWith(customFutureDate))
      } else {
        filtered = filtered.filter(res => res.date_time.startsWith(futureFilter))
      }
    }

    return filtered
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

  const futureDateSuggestions = getFutureDateSuggestions()
  const historyDateFilters = getHistoryDateFilters()
  const filteredActiveBookings = getFilteredActiveBookings()
  const filteredHistoryBookings = getFilteredHistoryBookings()

  return (
    <div className="space-y-6">
      {/* Header with Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-foreground">Prenotazioni</h2>
          <div className="flex gap-2 flex-wrap">
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
          onRefresh={onRefresh}
          onEditBooking={handleEditBooking}
        />
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-semibold text-foreground">Lista Prenotazioni</h3>

          {/* Future Reservations Filter - Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={futureFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFutureFilter('all')}
            >
              Tutte
            </Button>
            {futureDateSuggestions.slice(0, 3).map(suggestion => (
              <Button
                key={suggestion.value}
                variant={futureFilter === suggestion.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFutureFilter(suggestion.value)}
              >
                {suggestion.label}
              </Button>
            ))}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={futureFilter === 'custom' || (!['all', ...futureDateSuggestions.slice(0, 3).map(s => s.value)].includes(futureFilter)) ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <CalendarBlank size={16} />
                  {futureFilter === 'custom' || (!['all', ...futureDateSuggestions.slice(0, 3).map(s => s.value)].includes(futureFilter)) ? (customFutureDate ? formatDate(customFutureDate) : 'Data') : 'Altro'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3">
                  <Label htmlFor="custom-future-date" className="mb-2 block">Seleziona data</Label>
                  <Input
                    id="custom-future-date"
                    type="date"
                    value={customFutureDate}
                    onChange={(e) => {
                      setCustomFutureDate(e.target.value)
                      setFutureFilter('custom')
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {filteredActiveBookings.length === 0 ? (
          <Card className="shadow-professional">
            <CardContent className="text-center py-8">
              <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {futureFilter === 'all' ? 'Nessuna prenotazione attiva' : 'Nessuna prenotazione per la data selezionata'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredActiveBookings
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
              .map(booking => {
                const dateStr = booking.date_time.split('T')[0]
                const timeStr = booking.date_time.split('T')[1].substring(0, 5)
                const today = isToday(dateStr)

                return (
                  <Card
                    key={booking.id}
                    className={`shadow-professional hover:shadow-professional-lg transition-all duration-300 cursor-pointer ${today ? 'border-l-4 border-l-primary' : ''}`}
                    onClick={() => handleEditBooking(booking)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <UserIcon size={18} />
                          {booking.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          {today && <Badge variant="default">Oggi</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={16} className="text-muted-foreground" />
                          <span>{booking.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={16} className="text-muted-foreground" />
                          <span>{formatDate(dateStr)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock size={16} className="text-muted-foreground" />
                          <span>{timeStr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users size={16} className="text-muted-foreground" />
                          <span>{booking.guests} {booking.guests === 1 ? 'persona' : 'persone'}</span>
                        </div>
                        <div className="text-sm font-medium text-primary">
                          {getTableName(booking.table_id)}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditBooking(booking)
                          }}
                          className="flex-1"
                        >
                          <PencilSimple size={14} className="mr-1" />
                          Modifica
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCompleteBooking(booking)
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Completata
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBooking(booking)
                            setShowDeleteDialog(true)
                          }}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            }
          </div>
        )}
      </div>

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
              onClick={handleDeleteBooking}
            >
              Elimina Prenotazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reservation History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Storico Prenotazioni</DialogTitle>
            <DialogDescription>
              Tutte le prenotazioni completate
            </DialogDescription>
          </DialogHeader>

          {/* History Filter */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
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
                  <div className="space-y-4">
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

          <div className="max-h-96 overflow-y-auto">
            {filteredHistoryBookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {historyFilter === 'all' ? 'Nessuna prenotazione nello storico' : 'Nessuna prenotazione per il periodo selezionato'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredHistoryBookings
                  .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
                  .map(booking => (
                    <Card key={booking.id} className="border-l-4 border-l-green-400">
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
                            <Badge variant="default" className="bg-green-600">
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
        </DialogContent>
      </Dialog>
    </div>
  )
}