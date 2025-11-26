import { useState } from 'react'

import { DatabaseService } from '../services/DatabaseService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { Calendar, Clock, Users, PencilSimple, Trash, Plus, Phone, User as UserIcon, CalendarBlank, Funnel } from '@phosphor-icons/react'
import type { User, Reservation, Table } from '../services/types'
import TimelineReservations from './TimelineReservations'

interface ReservationsManagerProps {
  user: User
  tables: Table[]
  reservations: Reservation[]
  setReservations?: (reservations: Reservation[]) => void // Optional or deprecated
}

export default function ReservationsManager({ user, tables, reservations }: ReservationsManagerProps) {
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)

  // Filter states for future reservations
  const [futureFilter, setFutureFilter] = useState<string>('all')
  const [customFutureDate, setCustomFutureDate] = useState('')

  // Filter states for history
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  const [customHistoryStartDate, setCustomHistoryStartDate] = useState('')
  const [customHistoryEndDate, setCustomHistoryEndDate] = useState('')

  // Form states for editing
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    tableId: '',
    date: '',
    time: '',
    guests: 1
  })

  // Get reservation history (completed reservations)
  // Get reservation history (completed reservations)
  // For now, we filter completed reservations from the main list or assume history is fetched elsewhere
  const reservationHistory: Reservation[] = [] // Placeholder if not passed as prop

  const restaurantTables = tables.filter(table => table.restaurantId === user.restaurantId)
  const restaurantReservations = reservations.filter(reservation => reservation.restaurantId === user.restaurantId)
  const restaurantReservationHistory = reservationHistory?.filter(res => res.restaurantId === user.restaurantId) || []

  // Initialize edit form when reservation is selected
  const handleEditReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setEditForm({
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      tableId: reservation.tableId,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests
    })
    setShowEditDialog(true)
  }

  // Save edited reservation
  const handleSaveEdit = () => {
    if (!selectedReservation) return

    if (!editForm.customerName.trim() || !editForm.customerPhone.trim() || !editForm.tableId || !editForm.date || !editForm.time) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    const updatedReservation: Reservation = {
      ...selectedReservation,
      customerName: editForm.customerName.trim(),
      customerPhone: editForm.customerPhone.trim(),
      tableId: editForm.tableId,
      date: editForm.date,
      time: editForm.time,
      guests: editForm.guests
    }

    DatabaseService.updateReservation(updatedReservation)
      .then(() => {
        setShowEditDialog(false)
        setSelectedReservation(null)
        toast.success('Prenotazione modificata con successo')
      })
  }

  // Delete reservation
  const handleDeleteReservation = () => {
    if (!selectedReservation) return

    DatabaseService.deleteReservation(selectedReservation.id)
      .then(() => {
        setShowDeleteDialog(false)
        setSelectedReservation(null)
        toast.success('Prenotazione eliminata')
      })
  }

  // Complete reservation (move to history)
  const handleCompleteReservation = (reservation: Reservation) => {
    // For now, we just delete it from active reservations. 
    // Ideally we should have a 'status' field and update it to 'completed'.
    // If we want to keep history, we should update status.
    // Let's assume we update status to 'completed' if the schema supports it, 
    // or delete it if we only track active ones in this view.
    // The current schema has 'status'.

    DatabaseService.updateReservation({ ...reservation, status: 'completed' })
      .then(() => toast.success('Prenotazione completata'))
  }

  // Get table name
  const getTableName = (tableId: string) => {
    const table = restaurantTables.find(t => t.id === tableId)
    return table?.name || 'Tavolo non trovato'
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

    // Today
    filters.push({
      value: 'today',
      label: 'Oggi'
    })

    // Yesterday
    filters.push({
      value: 'yesterday',
      label: 'Ieri'
    })

    // Day before yesterday
    filters.push({
      value: 'dayBeforeYesterday',
      label: 'Ieri l\'altro'
    })

    // Last week
    filters.push({
      value: 'lastWeek',
      label: 'Ultima settimana'
    })

    // Last month
    filters.push({
      value: 'lastMonth',
      label: 'Ultimo mese'
    })

    // Custom
    filters.push({
      value: 'custom',
      label: 'Personalizzato'
    })

    return filters
  }

  // Filter future reservations
  const getFilteredFutureReservations = () => {
    let filtered = restaurantReservations

    if (futureFilter !== 'all') {
      if (futureFilter === 'custom' && customFutureDate) {
        filtered = filtered.filter(res => res.date === customFutureDate)
      } else {
        filtered = filtered.filter(res => res.date === futureFilter)
      }
    }

    return filtered
  }

  // Filter history reservations
  const getFilteredHistoryReservations = () => {
    let filtered = restaurantReservationHistory
    const today = new Date()

    if (historyFilter !== 'all') {
      switch (historyFilter) {
        case 'today':
          const todayStr = today.toISOString().split('T')[0]
          filtered = filtered.filter(res => res.date === todayStr)
          break
        case 'yesterday':
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]
          filtered = filtered.filter(res => res.date === yesterdayStr)
          break
        case 'dayBeforeYesterday':
          const dayBefore = new Date(today)
          dayBefore.setDate(dayBefore.getDate() - 2)
          const dayBeforeStr = dayBefore.toISOString().split('T')[0]
          filtered = filtered.filter(res => res.date === dayBeforeStr)
          break
        case 'lastWeek':
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          filtered = filtered.filter(res => {
            const resDate = new Date(res.date)
            return resDate >= weekAgo && resDate <= today
          })
          break
        case 'lastMonth':
          const monthAgo = new Date(today)
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          filtered = filtered.filter(res => {
            const resDate = new Date(res.date)
            return resDate >= monthAgo && resDate <= today
          })
          break
        case 'custom':
          if (customHistoryStartDate && customHistoryEndDate) {
            const startDate = new Date(customHistoryStartDate)
            const endDate = new Date(customHistoryEndDate)
            filtered = filtered.filter(res => {
              const resDate = new Date(res.date)
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
  const filteredFutureReservations = getFilteredFutureReservations()
  const filteredHistoryReservations = getFilteredHistoryReservations()

  // Check if reservation is past
  const isPast = (dateStr: string, timeStr: string) => {
    const now = new Date()
    const reservationDate = new Date(`${dateStr}T${timeStr}`)
    return reservationDate < now
  }

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
          tables={tables}
          reservations={reservations}
        />
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-semibold text-foreground">Lista Prenotazioni</h3>

          {/* Future Reservations Filter */}
          <div className="flex items-center gap-4">
            <Select value={futureFilter} onValueChange={setFutureFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtra per data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le date</SelectItem>
                {futureDateSuggestions.map(suggestion => (
                  <SelectItem key={suggestion.value} value={suggestion.value}>
                    {suggestion.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Personalizzato</SelectItem>
              </SelectContent>
            </Select>

            {futureFilter === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarBlank size={16} />
                    Scegli Data
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto" align="end">
                  <div className="space-y-2">
                    <Label htmlFor="custom-future-date">Data personalizzata</Label>
                    <Input
                      id="custom-future-date"
                      type="date"
                      value={customFutureDate}
                      onChange={(e) => setCustomFutureDate(e.target.value)}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {filteredFutureReservations.length === 0 ? (
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
            {filteredFutureReservations
              .sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time}`)
                const dateB = new Date(`${b.date}T${b.time}`)
                return dateA.getTime() - dateB.getTime()
              })
              .map(reservation => {
                const past = isPast(reservation.date, reservation.time)
                const today = isToday(reservation.date)

                return (
                  <Card
                    key={reservation.id}
                    className={`shadow-professional hover:shadow-professional-lg transition-all duration-300 cursor-pointer ${past ? 'opacity-60' : ''
                      } ${today ? 'border-l-4 border-l-primary' : ''}`}
                    onClick={() => handleEditReservation(reservation)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <UserIcon size={18} />
                          {reservation.customerName}
                        </CardTitle>
                        <div className="flex gap-1">
                          {today && <Badge variant="default">Oggi</Badge>}
                          {past && <Badge variant="secondary">Passata</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={16} className="text-muted-foreground" />
                          <span>{reservation.customerPhone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={16} className="text-muted-foreground" />
                          <span>{formatDate(reservation.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock size={16} className="text-muted-foreground" />
                          <span>{reservation.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users size={16} className="text-muted-foreground" />
                          <span>{reservation.guests} {reservation.guests === 1 ? 'persona' : 'persone'}</span>
                        </div>
                        <div className="text-sm font-medium text-primary">
                          {getTableName(reservation.tableId)}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditReservation(reservation)
                          }}
                          className="flex-1"
                        >
                          <PencilSimple size={14} className="mr-1" />
                          Modifica
                        </Button>
                        {!past && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCompleteReservation(reservation)
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Completata
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedReservation(reservation)
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
                  value={editForm.customerName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Nome e cognome"
                />
              </div>
              <div>
                <Label htmlFor="edit-customer-phone">Telefono *</Label>
                <Input
                  id="edit-customer-phone"
                  value={editForm.customerPhone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customerPhone: e.target.value }))}
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
                      {table.name}
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
          {selectedReservation && (
            <div className="bg-muted/30 p-4 rounded-lg">
              <p><strong>Cliente:</strong> {selectedReservation.customerName}</p>
              <p><strong>Data:</strong> {formatDate(selectedReservation.date)}</p>
              <p><strong>Orario:</strong> {selectedReservation.time}</p>
              <p><strong>Tavolo:</strong> {getTableName(selectedReservation.tableId)}</p>
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
              onClick={handleDeleteReservation}
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
            {filteredHistoryReservations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {historyFilter === 'all' ? 'Nessuna prenotazione nello storico' : 'Nessuna prenotazione per il periodo selezionato'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredHistoryReservations
                  .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`)
                    const dateB = new Date(`${b.date}T${b.time}`)
                    return dateB.getTime() - dateA.getTime()
                  })
                  .map(reservation => (
                    <Card key={reservation.id} className="border-l-4 border-l-green-400">
                      <CardContent className="p-4">
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="font-semibold">{reservation.customerName}</p>
                            <p className="text-sm text-muted-foreground">{reservation.customerPhone}</p>
                          </div>
                          <div>
                            <p className="text-sm">{formatDate(reservation.date)}</p>
                            <p className="text-sm text-muted-foreground">{reservation.time}</p>
                          </div>
                          <div>
                            <p className="text-sm">{getTableName(reservation.tableId)}</p>
                            <p className="text-sm text-muted-foreground">{reservation.guests} ospiti</p>
                          </div>
                          <div className="flex items-center">
                            <Badge variant="default" className="bg-green-600">Completata</Badge>
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