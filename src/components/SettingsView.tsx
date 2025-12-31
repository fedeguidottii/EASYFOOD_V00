import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { Dish, Category } from '../services/types'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
    Gear,
    Palette,
    Users,
    Coins,
    CalendarCheck,
    Storefront,
    SpeakerHigh
} from '@phosphor-icons/react'
import { SoundType } from '../utils/SoundManager'
import { ModeToggle } from './ModeToggle'

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
    courseSplittingEnabled,
    setCourseSplittingEnabled,
    updateCourseSplitting
}: SettingsViewProps) {

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Gear className="w-8 h-8 text-primary" weight="duotone" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Impostazioni</h2>
                    <p className="text-muted-foreground">Gestisci tutti gli aspetti del tuo ristorante</p>
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-14 bg-muted/50 p-1 rounded-xl mb-8">
                    <TabsTrigger value="general" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Storefront size={18} />
                        <span className="hidden sm:inline">Generale</span>
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Palette size={18} />
                        <span className="hidden sm:inline">Aspetto</span>
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Users size={18} />
                        <span className="hidden sm:inline">Staff</span>
                    </TabsTrigger>
                    <TabsTrigger value="costs" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Coins size={18} />
                        <span className="hidden sm:inline">Costi & Menu</span>
                    </TabsTrigger>
                    <TabsTrigger value="reservations" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <CalendarCheck size={18} />
                        <span className="hidden sm:inline">Prenotazioni</span>
                    </TabsTrigger>
                </TabsList>

                {/* 1. SEZIONE GENERALE */}
                <TabsContent value="general" className="space-y-6 animate-in fade-in-50 duration-300">
                    <Card className="border-none shadow-md bg-card">
                        <CardHeader>
                            <CardTitle>Profilo Ristorante</CardTitle>
                            <CardDescription>Informazioni principali visibili ai clienti</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-2">
                                <Label htmlFor="restaurantName" className="text-base">Nome dell'Attività</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="restaurantName"
                                        value={restaurantName}
                                        onChange={(e) => setRestaurantName(e.target.value)}
                                        className="max-w-md h-11 text-lg"
                                        placeholder="Es. Ristorante Da Mario"
                                    />
                                    {restaurantNameDirty && (
                                        <Button onClick={saveRestaurantName} className="h-11 px-6">Salva</Button>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div className="grid gap-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <SpeakerHigh size={20} /> Suoni e Notifiche
                                </h3>
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Suoni Attivi</Label>
                                        <p className="text-sm text-muted-foreground">Riproduci un suono all'arrivo di nuovi ordini</p>
                                    </div>
                                    <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                                </div>

                                {soundEnabled && (
                                    <div className="grid gap-2 max-w-md">
                                        <Label>Tono di notifica</Label>
                                        <Select value={selectedSound} onValueChange={(val) => setSelectedSound(val as SoundType)}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="classic">Classico (Campanello)</SelectItem>
                                                <SelectItem value="modern">Moderno (Minimal)</SelectItem>
                                                <SelectItem value="subtle">Sottile (Delicato)</SelectItem>
                                                <SelectItem value="kitchen">Cucina (Forte)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 2. SEZIONE ASPETTO */}
                <TabsContent value="appearance" className="space-y-6 animate-in fade-in-50 duration-300">
                    <Card className="border-none shadow-md bg-card">
                        <CardHeader>
                            <CardTitle>Tema e Visualizzazione</CardTitle>
                            <CardDescription>Personalizza l'interfaccia per te e il tuo staff</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Tema Scuro / Chiaro</Label>
                                    <p className="text-sm text-muted-foreground">Passa dalla modalità scura alla modalità chiara</p>
                                </div>
                                <ModeToggle />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 3. SEZIONE STAFF */}
                <TabsContent value="staff" className="space-y-6 animate-in fade-in-50 duration-300">
                    <Card className="border-none shadow-md bg-card">
                        <CardHeader>
                            <CardTitle>Gestione Camerieri</CardTitle>
                            <CardDescription>Configura l'accesso per il personale di sala</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Modalità Cameriere</Label>
                                    <p className="text-sm text-muted-foreground">Abilita un'interfaccia semplificata per prendere le comande</p>
                                </div>
                                <Switch checked={waiterModeEnabled} onCheckedChange={setWaiterModeEnabled} />
                            </div>

                            {waiterModeEnabled && (
                                <div className="grid gap-6 p-4 border border-border/50 rounded-xl bg-card">
                                    <div className="grid gap-2">
                                        <Label>Username Accesso (Generato)</Label>
                                        <Input
                                            value={restaurantName.toLowerCase().replace(/\s+/g, '-') + '_cameriere'}
                                            readOnly
                                            className="font-mono bg-muted text-muted-foreground"
                                        />
                                        <p className="text-xs text-muted-foreground">Utilizza questo username per il login dei camerieri</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Password Accesso Camerieri</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="text"
                                                value={waiterPassword}
                                                onChange={(e) => setWaiterPassword(e.target.value)}
                                                className="max-w-xs font-mono"
                                                placeholder="Es. 1234"
                                            />
                                            {waiterCredentialsDirty && (
                                                <Button onClick={saveWaiterCredentials}>Aggiorna Password</Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Permetti Pagamenti</Label>
                                            <p className="text-sm text-muted-foreground">I camerieri possono segnare i tavoli come pagati</p>
                                        </div>
                                        <Switch checked={allowWaiterPayments} onCheckedChange={setAllowWaiterPayments} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 4. SEZIONE COSTI */}
                <TabsContent value="costs" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="grid gap-6 md:grid-cols-2">

                        {/* All You Can Eat */}
                        <Card className="border-none shadow-md bg-card relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Coins size={100} weight="fill" />
                            </div>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    All You Can Eat
                                    <Switch checked={ayceEnabled} onCheckedChange={setAyceEnabled} />
                                </CardTitle>
                                <CardDescription>Formula a prezzo fisso</CardDescription>
                            </CardHeader>
                            {ayceEnabled && (
                                <CardContent className="space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid gap-2">
                                        <Label>Prezzo a persona (€)</Label>
                                        <Input
                                            type="number"
                                            value={aycePrice}
                                            onChange={(e) => setAycePrice(e.target.value)}
                                            className="text-lg font-bold text-emerald-600"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Limite Ordini / Giri</Label>
                                        <Input
                                            type="number"
                                            value={ayceMaxOrders}
                                            onChange={(e) => setAyceMaxOrders(e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* Coperto */}
                        <Card className="border-none shadow-md bg-card relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Users size={100} weight="fill" />
                            </div>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Coperto
                                    <Switch checked={copertoEnabled} onCheckedChange={setCopertoEnabled} />
                                </CardTitle>
                                <CardDescription>Costo fisso per servizio</CardDescription>
                            </CardHeader>
                            {copertoEnabled && (
                                <CardContent className="space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid gap-2">
                                        <Label>Prezzo a persona (€)</Label>
                                        <Input
                                            type="number"
                                            value={copertoPrice}
                                            onChange={(e) => setCopertoPrice(e.target.value)}
                                            className="text-lg font-bold"
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* Course Splitting Setting */}
                        <Card className="border-none shadow-md bg-card md:col-span-2">
                            <CardHeader>
                                <CardTitle>Logica Menu Cliente</CardTitle>
                                <CardDescription>Personalizza l'esperienza del menu digitale</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Divisione in Portate</Label>
                                        <p className="text-sm text-muted-foreground">Permetti ai clienti di organizzare l'ordine in "Uscite" separate (Antipasti, Primi, ecc.)</p>
                                    </div>
                                    <Switch
                                        checked={courseSplittingEnabled}
                                        onCheckedChange={(val) => {
                                            setCourseSplittingEnabled(val)
                                            updateCourseSplitting(val)
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>


                </TabsContent>

                {/* 5. SEZIONE PRENOTAZIONI */}
                <TabsContent value="reservations" className="space-y-6 animate-in fade-in-50 duration-300">
                    <Card className="border-none shadow-md bg-card">
                        <CardHeader>
                            <CardTitle>Configurazione Prenotazioni</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="grid gap-2">
                                    <Label>Durata Standard (minuti)</Label>
                                    <p className="text-xs text-muted-foreground mb-2">Tempo medio di occupazione tavolo</p>
                                    <Select
                                        value={reservationDuration.toString()}
                                        onValueChange={(val) => setReservationDuration(parseInt(val))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="60">1 Ora</SelectItem>
                                            <SelectItem value="90">1 Ora e 30</SelectItem>
                                            <SelectItem value="120">2 Ore (Standard)</SelectItem>
                                            <SelectItem value="150">2 Ore e 30</SelectItem>
                                            <SelectItem value="180">3 Ore</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Orari Apertura</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
                                        <span className="text-muted-foreground">-</span>
                                        <Input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
