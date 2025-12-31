import { motion } from 'framer-motion'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
    Storefront,
    Users,
    Coins,
    CalendarCheck,
    SpeakerHigh,
    CreditCard,
    Clock,
    ForkKnife,
    Info,
    CheckCircle,
    Gear
} from '@phosphor-icons/react'
import { SoundType } from '../utils/SoundManager'
import WeeklyScheduleEditor from './WeeklyScheduleEditor'
import type { WeeklyCopertoSchedule, WeeklyAyceSchedule } from '@/services/types'
import { createDefaultCopertoSchedule, createDefaultAyceSchedule } from '@/utils/pricingUtils'

interface SettingsViewProps {
    restaurantName: string
    setRestaurantName: (name: string) => void
    restaurantNameDirty: boolean
    saveRestaurantName: () => void

    soundEnabled: boolean
    setSoundEnabled: (enabled: boolean) => void
    selectedSound: SoundType
    setSelectedSound: (sound: SoundType) => void

    waiterModeEnabled: boolean
    setWaiterModeEnabled: (enabled: boolean) => void
    allowWaiterPayments: boolean
    setAllowWaiterPayments: (enabled: boolean) => void
    waiterPassword: string
    setWaiterPassword: (password: string) => void
    saveWaiterCredentials: () => void
    waiterCredentialsDirty: boolean

    ayceEnabled: boolean
    setAyceEnabled: (enabled: boolean) => void
    aycePrice: number | string
    setAycePrice: (price: number | string) => void
    ayceMaxOrders: number | string
    setAyceMaxOrders: (orders: number | string) => void

    copertoEnabled: boolean
    setCopertoEnabled: (enabled: boolean) => void
    copertoPrice: number | string
    setCopertoPrice: (price: number | string) => void

    reservationDuration: number
    setReservationDuration: (minutes: number) => void

    openingTime: string
    setOpeningTime: (time: string) => void
    closingTime: string
    setClosingTime: (time: string) => void

    lunchTimeStart: string
    setLunchTimeStart: (time: string) => void
    dinnerTimeStart: string
    setDinnerTimeStart: (time: string) => void

    courseSplittingEnabled: boolean
    setCourseSplittingEnabled: (enabled: boolean) => void
    updateCourseSplitting: (enabled: boolean) => void
    // Weekly schedules
    weeklyCoperto: WeeklyCopertoSchedule | undefined
    setWeeklyCoperto: (schedule: WeeklyCopertoSchedule) => void
    weeklyAyce: WeeklyAyceSchedule | undefined
    setWeeklyAyce: (schedule: WeeklyAyceSchedule) => void
}

export function SettingsView({
    restaurantName,
    setRestaurantName,
    restaurantNameDirty,
    saveRestaurantName,
    soundEnabled,
    setSoundEnabled,
    selectedSound,
    setSelectedSound,
    waiterModeEnabled,
    setWaiterModeEnabled,
    allowWaiterPayments,
    setAllowWaiterPayments,
    waiterPassword,
    setWaiterPassword,
    saveWaiterCredentials,
    waiterCredentialsDirty,
    ayceEnabled,
    setAyceEnabled,
    aycePrice,
    setAycePrice,
    ayceMaxOrders,
    setAyceMaxOrders,
    copertoEnabled,
    setCopertoEnabled,
    copertoPrice,
    setCopertoPrice,
    reservationDuration,
    setReservationDuration,
    openingTime,
    setOpeningTime,
    closingTime,
    setClosingTime,
    lunchTimeStart, setLunchTimeStart,
    dinnerTimeStart, setDinnerTimeStart,
    courseSplittingEnabled,
    setCourseSplittingEnabled,
    updateCourseSplitting,
    weeklyCoperto,
    setWeeklyCoperto,
    weeklyAyce,
    setWeeklyAyce
}: SettingsViewProps) {

    const containerVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
        exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
    }

    return (
        <div className="space-y-8 pb-24 text-zinc-100">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-2"
            >
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    Impostazioni
                </h2>
                <p className="text-zinc-400">
                    Configura ogni aspetto del tuo ristorante, dai menu al personale.
                </p>
            </motion.div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full justify-start h-auto bg-transparent border-b border-white/10 p-0 mb-8 gap-6 overflow-x-auto">
                    <TabsTrigger
                        value="general"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-amber-400 transition-all font-medium gap-2"
                    >
                        <Storefront size={20} />
                        Generale
                    </TabsTrigger>
                    <TabsTrigger
                        value="costs"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-amber-400 transition-all font-medium gap-2"
                    >
                        <Coins size={20} />
                        Costi & Menu
                    </TabsTrigger>
                    <TabsTrigger
                        value="staff"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-amber-400 transition-all font-medium gap-2"
                    >
                        <Users size={20} />
                        Staff
                    </TabsTrigger>
                    <TabsTrigger
                        value="reservations"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-amber-400 transition-all font-medium gap-2"
                    >
                        <CalendarCheck size={20} />
                        Prenotazioni
                    </TabsTrigger>
                </TabsList>

                {/* 1. SEZIONE GENERALE */}
                <TabsContent value="general">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="grid gap-6"
                    >
                        {/* Nome Ristorante */}
                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Storefront className="text-amber-500" />
                                Profilo Attività
                            </h3>
                            <div className="grid gap-4 max-w-xl">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Nome del Ristorante</Label>
                                    <div className="flex gap-3">
                                        <Input
                                            value={restaurantName}
                                            onChange={(e) => setRestaurantName(e.target.value)}
                                            className="bg-black/20 border-white/10 h-12 text-lg focus:ring-amber-500/50"
                                            placeholder="Es. Ristorante Da Mario"
                                        />
                                        {restaurantNameDirty && (
                                            <Button
                                                onClick={saveRestaurantName}
                                                className="h-12 px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]"
                                            >
                                                Salva
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500">Questo nome apparirà sui menu digitali e sulle ricevute.</p>
                                </div>
                            </div>
                        </div>

                        {/* Suoni */}
                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <SpeakerHigh className="text-amber-500" />
                                Notifiche Sonore
                            </h3>
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="space-y-1">
                                        <Label className="text-base font-semibold">Suono Nuovi Ordini</Label>
                                        <p className="text-sm text-zinc-400">Riproduci un effetto sonoro quando arriva una comanda in cucina.</p>
                                    </div>
                                    <Switch
                                        checked={soundEnabled}
                                        onCheckedChange={setSoundEnabled}
                                        className="data-[state=checked]:bg-amber-500"
                                    />
                                </div>

                                {soundEnabled && (
                                    <div className="space-y-3 max-w-md animate-in slide-in-from-top-2">
                                        <Label className="text-zinc-400">Tono di notifica</Label>
                                        <div className="flex gap-2">
                                            <Select value={selectedSound} onValueChange={(val) => setSelectedSound(val as SoundType)}>
                                                <SelectTrigger className="h-12 bg-black/20 border-white/10 flex-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                                    <SelectItem value="classic">Classico (Campanello)</SelectItem>
                                                    <SelectItem value="chime">Moderno (Chime)</SelectItem>
                                                    <SelectItem value="soft">Sottile (Delicato)</SelectItem>
                                                    <SelectItem value="kitchen-bell">Cucina (Forte)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-12 w-12 border-white/10 bg-black/20 hover:bg-amber-500/20 hover:text-amber-500 hover:border-amber-500/50 transition-all"
                                                onClick={async () => {
                                                    const { soundManager } = await import('../utils/SoundManager')
                                                    // Ensure audio context is unlocked on user interaction
                                                    soundManager.play(selectedSound)
                                                }}
                                            >
                                                <SpeakerHigh size={20} weight="duotone" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </TabsContent>

                {/* 2. SEZIONE COSTI & MENU */}
                <TabsContent value="costs">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="space-y-6"
                    >
                        <div className="grid gap-6">
                            {/* All You Can Eat - Weekly Schedule */}
                            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-white/5 overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                    <ForkKnife size={120} weight="fill" />
                                </div>
                                <div className="relative z-10">
                                    <WeeklyScheduleEditor
                                        type="ayce"
                                        schedule={weeklyAyce || {
                                            enabled: ayceEnabled,
                                            defaultPrice: Number(aycePrice) || 0,
                                            defaultMaxOrders: Number(ayceMaxOrders) || 0,
                                            useWeeklySchedule: false,
                                            schedule: {}
                                        }}
                                        onChange={(schedule) => {
                                            setWeeklyAyce(schedule as any)
                                            // Also sync legacy state for backwards compatibility
                                            setAyceEnabled(schedule.enabled)
                                            setAycePrice(schedule.defaultPrice)
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Coperto - Weekly Schedule */}
                            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-white/5 overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                    <Coins size={120} weight="fill" />
                                </div>
                                <div className="relative z-10">
                                    <WeeklyScheduleEditor
                                        type="coperto"
                                        schedule={weeklyCoperto || {
                                            enabled: copertoEnabled,
                                            defaultPrice: Number(copertoPrice) || 0,
                                            useWeeklySchedule: false,
                                            schedule: {}
                                        }}
                                        onChange={(schedule) => {
                                            setWeeklyCoperto(schedule as any)
                                            // Sync global coperto status as fallback/legacy support
                                            if (setCopertoEnabled) setCopertoEnabled(schedule.enabled)
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Configurazione Portate */}
                            <div className="col-span-full p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            Suddivisione in Portate
                                        </h3>
                                        <p className="text-sm text-zinc-400 max-w-prose">
                                            Se attivo, i clienti potranno scegliere l'ordine di uscita (Antipasti, Primi, Secondi) direttamente dal menu digitale.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={courseSplittingEnabled}
                                        onCheckedChange={(val) => {
                                            setCourseSplittingEnabled(val)
                                            updateCourseSplitting(val)
                                        }}
                                        className="data-[state=checked]:bg-amber-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </TabsContent>

                {/* 3. SEZIONE STAFF */}
                <TabsContent value="staff">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="space-y-6"
                    >
                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-zinc-500/10 rounded-xl text-zinc-100">
                                        <Users size={24} weight="duotone" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Modalità Cameriere</h3>
                                        <p className="text-zinc-400 text-sm">Accesso semplificato per lo staff di sala</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={waiterModeEnabled}
                                    onCheckedChange={setWaiterModeEnabled}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>

                            {waiterModeEnabled && (
                                <div className="grid gap-6 p-6 rounded-xl bg-amber-500/5 border border-amber-500/10 animate-in fade-in slide-in-from-top-4">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-amber-200">Username Generato</Label>
                                            <div className="flex items-center h-12 px-4 rounded-lg bg-black/40 border border-amber-500/20 font-mono text-amber-300">
                                                {restaurantName.toLowerCase().replace(/\s+/g, '-') + '_cameriere'}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-amber-200">Password Accesso</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="text"
                                                    value={waiterPassword}
                                                    onChange={(e) => setWaiterPassword(e.target.value)}
                                                    className="bg-black/40 border-amber-500/20 text-white font-mono h-12 text-center tracking-widest"
                                                    placeholder="Es. 1234"
                                                />
                                                {waiterCredentialsDirty && (
                                                    <Button onClick={saveWaiterCredentials} className="h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold">
                                                        Aggiorna
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Separator className="bg-amber-500/10" />
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base text-amber-100">Permessi di Pagamento</Label>
                                            <p className="text-sm text-amber-300/60">Consenti ai camerieri di segnare i tavoli come pagati</p>
                                        </div>
                                        <Switch
                                            checked={allowWaiterPayments}
                                            onCheckedChange={setAllowWaiterPayments}
                                            className="data-[state=checked]:bg-amber-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </TabsContent>

                {/* 4. SEZIONE PRENOTAZIONI */}
                <TabsContent value="reservations">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="space-y-6"
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Durata Tavolo */}
                            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Clock className="text-amber-500" />
                                    Turnazione Tavoli
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400">Durata Standard Prenotazione</Label>
                                        <Select
                                            value={reservationDuration.toString()}
                                            onValueChange={(val) => setReservationDuration(parseInt(val))}
                                        >
                                            <SelectTrigger className="h-12 bg-black/20 border-white/10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                                <SelectItem value="60">1 Ora</SelectItem>
                                                <SelectItem value="90">1 Ora e 30 min</SelectItem>
                                                <SelectItem value="120">2 Ore (Standard)</SelectItem>
                                                <SelectItem value="150">2 Ore e 30 min</SelectItem>
                                                <SelectItem value="180">3 Ore</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Orari Servizio */}
                            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <CalendarCheck className="text-amber-500" />
                                    Orari Servizio
                                </h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Inizio Pranzo</Label>
                                            <Input
                                                type="time"
                                                value={lunchTimeStart}
                                                onChange={(e) => setLunchTimeStart(e.target.value)}
                                                className="bg-black/20 border-white/10 h-10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Inizio Cena</Label>
                                            <Input
                                                type="time"
                                                value={dinnerTimeStart}
                                                onChange={(e) => setDinnerTimeStart(e.target.value)}
                                                className="bg-black/20 border-white/10 h-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
