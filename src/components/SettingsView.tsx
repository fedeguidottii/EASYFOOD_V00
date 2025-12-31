import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
    CheckCircle
} from '@phosphor-icons/react'
import { SoundType } from '../utils/SoundManager'

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
    updateCourseSplitting
}: SettingsViewProps) {

    return (
        <div className="space-y-8 pb-24 text-zinc-100">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    Impostazioni
                </h2>
                <p className="text-zinc-400">
                    Configura ogni aspetto del tuo ristorante, dai menu al personale.
                </p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full justify-start h-auto bg-transparent border-b border-white/10 p-0 mb-8 gap-6 overflow-x-auto">
                    <TabsTrigger
                        value="general"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-emerald-400 transition-all font-medium gap-2"
                    >
                        <Storefront size={20} />
                        Generale
                    </TabsTrigger>
                    <TabsTrigger
                        value="costs"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-emerald-400 transition-all font-medium gap-2"
                    >
                        <Coins size={20} />
                        Costi & Menu
                    </TabsTrigger>
                    <TabsTrigger
                        value="staff"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-emerald-400 transition-all font-medium gap-2"
                    >
                        <Users size={20} />
                        Staff
                    </TabsTrigger>
                    <TabsTrigger
                        value="reservations"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-2 py-3 text-zinc-400 data-[state=active]:text-emerald-400 transition-all font-medium gap-2"
                    >
                        <CalendarCheck size={20} />
                        Prenotazioni
                    </TabsTrigger>
                </TabsList>

                {/* 1. SEZIONE GENERALE */}
                <TabsContent value="general" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="grid gap-6">
                        {/* Nome Ristorante */}
                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Storefront className="text-emerald-500" />
                                Profilo Attività
                            </h3>
                            <div className="grid gap-4 max-w-xl">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Nome del Ristorante</Label>
                                    <div className="flex gap-3">
                                        <Input
                                            value={restaurantName}
                                            onChange={(e) => setRestaurantName(e.target.value)}
                                            className="bg-black/20 border-white/10 h-12 text-lg focus:ring-emerald-500/50"
                                            placeholder="Es. Ristorante Da Mario"
                                        />
                                        {restaurantNameDirty && (
                                            <Button
                                                onClick={saveRestaurantName}
                                                className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
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
                                <SpeakerHigh className="text-emerald-500" />
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
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>

                                {soundEnabled && (
                                    <div className="space-y-3 max-w-md animate-in slide-in-from-top-2">
                                        <Label className="text-zinc-400">Tono di notifica</Label>
                                        <Select value={selectedSound} onValueChange={(val) => setSelectedSound(val as SoundType)}>
                                            <SelectTrigger className="h-12 bg-black/20 border-white/10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                                <SelectItem value="classic">Classico (Campanello)</SelectItem>
                                                <SelectItem value="modern">Moderno (Minimal)</SelectItem>
                                                <SelectItem value="subtle">Sottile (Delicato)</SelectItem>
                                                <SelectItem value="kitchen">Cucina (Forte)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* 2. SEZIONE COSTI & MENU */}
                <TabsContent value="costs" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* All You Can Eat */}
                        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-white/5 overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ForkKnife size={120} weight="fill" />
                            </div>

                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
                                        <ForkKnife size={24} weight="duotone" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">All You Can Eat</h3>
                                        <p className="text-xs text-zinc-400">Formula a prezzo fisso</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={ayceEnabled}
                                    onCheckedChange={setAyceEnabled}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>

                            {ayceEnabled && (
                                <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="grid gap-2">
                                        <Label className="text-zinc-400">Prezzo a Persona (€)</Label>
                                        <Input
                                            type="number"
                                            value={aycePrice}
                                            onChange={(e) => setAycePrice(e.target.value)}
                                            className="bg-black/20 border-white/10 text-xl font-bold text-amber-500 h-12"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-zinc-400">Limite Ordini / Giri</Label>
                                        <Input
                                            type="number"
                                            value={ayceMaxOrders}
                                            onChange={(e) => setAyceMaxOrders(e.target.value)}
                                            className="bg-black/20 border-white/10 h-12"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Coperto */}
                        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-white/5 overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Coins size={120} weight="fill" />
                            </div>

                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
                                        <Coins size={24} weight="duotone" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Coperto</h3>
                                        <p className="text-xs text-zinc-400">Costo di servizio fisso</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={copertoEnabled}
                                    onCheckedChange={setCopertoEnabled}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                            </div>

                            {copertoEnabled && (
                                <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="grid gap-2">
                                        <Label className="text-zinc-400">Prezzo a Persona (€)</Label>
                                        <Input
                                            type="number"
                                            value={copertoPrice}
                                            onChange={(e) => setCopertoPrice(e.target.value)}
                                            className="bg-black/20 border-white/10 text-xl font-bold text-emerald-500 h-12"
                                        />
                                    </div>
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400 leading-relaxed">
                                        <Info className="inline mr-1 mb-0.5" />
                                        Il coperto verrà applicato automaticamente ad ogni coperto aggiunto al tavolo.
                                    </div>
                                </div>
                            )}
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
                                    className="data-[state=checked]:bg-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* 3. SEZIONE STAFF */}
                <TabsContent value="staff" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
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
                                className="data-[state=checked]:bg-indigo-500"
                            />
                        </div>

                        {waiterModeEnabled && (
                            <div className="grid gap-6 p-6 rounded-xl bg-indigo-500/5 border border-indigo-500/10 animate-in fade-in slide-in-from-top-4">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-indigo-200">Username Generato</Label>
                                        <div className="flex items-center h-12 px-4 rounded-lg bg-black/40 border border-indigo-500/20 font-mono text-indigo-300">
                                            {restaurantName.toLowerCase().replace(/\s+/g, '-') + '_cameriere'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-indigo-200">Password Accesso</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="text"
                                                value={waiterPassword}
                                                onChange={(e) => setWaiterPassword(e.target.value)}
                                                className="bg-black/40 border-indigo-500/20 text-white font-mono h-12"
                                                placeholder="Es. 1234"
                                            />
                                            {waiterCredentialsDirty && (
                                                <Button onClick={saveWaiterCredentials} className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white">
                                                    Aggiorna
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Separator className="bg-indigo-500/10" />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base text-indigo-100">Permessi di Pagamento</Label>
                                        <p className="text-sm text-indigo-300/60">Consenti ai camerieri di segnare i tavoli come pagati</p>
                                    </div>
                                    <Switch
                                        checked={allowWaiterPayments}
                                        onCheckedChange={setAllowWaiterPayments}
                                        className="data-[state=checked]:bg-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* 4. SEZIONE PRENOTAZIONI */}
                <TabsContent value="reservations" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Durata Tavolo */}
                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Clock className="text-violet-500" />
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
                                <CalendarCheck className="text-violet-500" />
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
                </TabsContent>
            </Tabs>
        </div>
    )
}
