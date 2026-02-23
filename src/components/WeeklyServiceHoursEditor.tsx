import React, { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Sun, Moon, Clock, CalendarCheck, Check, X } from '@phosphor-icons/react'
import type { WeeklyServiceSchedule } from '@/services/types'

const DAYS = [
    { key: 'monday', label: 'Lunedì', short: 'Lun' },
    { key: 'tuesday', label: 'Martedì', short: 'Mar' },
    { key: 'wednesday', label: 'Mercoledì', short: 'Mer' },
    { key: 'thursday', label: 'Giovedì', short: 'Gio' },
    { key: 'friday', label: 'Venerdì', short: 'Ven' },
    { key: 'saturday', label: 'Sabato', short: 'Sab' },
    { key: 'sunday', label: 'Domenica', short: 'Dom' },
] as const

type DayKey = typeof DAYS[number]['key']

interface WeeklyServiceHoursEditorProps {
    schedule: WeeklyServiceSchedule
    onChange: (schedule: WeeklyServiceSchedule) => void
    defaultLunchStart?: string
    defaultLunchEnd?: string
    defaultDinnerStart?: string
    defaultDinnerEnd?: string
}

export default function WeeklyServiceHoursEditor({
    schedule,
    onChange,
    defaultLunchStart = '12:00',
    defaultLunchEnd = '15:00',
    defaultDinnerStart = '19:00',
    defaultDinnerEnd = '23:00'
}: WeeklyServiceHoursEditorProps) {
    const [showAdvanced, setShowAdvanced] = useState(schedule?.useWeeklySchedule || false)

    const updateUseWeeklySchedule = (use: boolean) => {
        setShowAdvanced(use)
        onChange({ ...schedule, useWeeklySchedule: use })
    }

    const updateDayMeal = (day: DayKey, meal: 'lunch' | 'dinner', config: Partial<{ enabled: boolean; start: string; end: string }>) => {
        const daySchedule = schedule.schedule?.[day] || {}
        const defaultStart = meal === 'lunch' ? defaultLunchStart : defaultDinnerStart;
        const defaultEnd = meal === 'lunch' ? defaultLunchEnd : defaultDinnerEnd;
        const mealConfig = daySchedule[meal] || { enabled: false, start: defaultStart, end: defaultEnd }

        onChange({
            ...schedule,
            schedule: {
                ...schedule.schedule,
                [day]: {
                    ...daySchedule,
                    [meal]: { ...mealConfig, ...config }
                }
            }
        })
    }

    const getMealConfig = (day: DayKey, meal: 'lunch' | 'dinner') => {
        const daySchedule = schedule?.schedule?.[day]
        const defaultStart = meal === 'lunch' ? defaultLunchStart : defaultDinnerStart;
        const defaultEnd = meal === 'lunch' ? defaultLunchEnd : defaultDinnerEnd;
        if (!daySchedule || !daySchedule[meal]) {
            return { enabled: false, start: defaultStart, end: defaultEnd }
        }
        return daySchedule[meal]!
    }

    const applyToAll = (meal: 'lunch' | 'dinner', enabled: boolean) => {
        const newSchedule = { ...schedule.schedule }
        const defaultStart = meal === 'lunch' ? defaultLunchStart : defaultDinnerStart;
        const defaultEnd = meal === 'lunch' ? defaultLunchEnd : defaultDinnerEnd;

        DAYS.forEach(({ key }) => {
            const currentObj = newSchedule[key] || {};
            const currentMeal = currentObj[meal] || { enabled: false, start: defaultStart, end: defaultEnd };
            newSchedule[key as DayKey] = {
                ...currentObj,
                [meal]: { ...currentMeal, enabled }
            }
        })
        onChange({ ...schedule, schedule: newSchedule })
    }

    return (
        <div className="space-y-3">
            {/* Main Toggle Header */}
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20 text-amber-500 border border-amber-500/20 shrink-0">
                        <CalendarCheck size={16} weight="duotone" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">Orari di Servizio</h3>
                        <p className="text-[11px] text-zinc-500">
                            Gestione giorni apertura e coprifuoco ordini
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-zinc-400 text-[11px]">Settimanale:</Label>
                    <Switch
                        checked={showAdvanced}
                        onCheckedChange={updateUseWeeklySchedule}
                    />
                </div>
            </div>

            {/* Weekly Schedule Grid */}
            {showAdvanced && (
                <Card className="bg-zinc-900/50 border-zinc-800 p-2.5 space-y-2 overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center px-1">
                        <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Giorno</span>
                        <span className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase tracking-wider">
                            <Sun size={10} weight="duotone" className="text-amber-400" /> Pranzo
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase tracking-wider">
                            <Moon size={10} weight="duotone" className="text-indigo-400" /> Cena
                        </span>
                    </div>

                    <div className="space-y-0.5">
                        {DAYS.map(({ key, short }) => (
                            <div
                                key={key}
                                className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center py-1 px-1 rounded-lg hover:bg-zinc-800/40 transition-colors"
                            >
                                <span className="font-medium text-zinc-300 text-[11px] shrink-0">{short}</span>

                                {/* Lunch */}
                                <div className="flex items-center gap-1 min-w-0">
                                    <button
                                        onClick={() => updateDayMeal(key, 'lunch', { enabled: !getMealConfig(key, 'lunch').enabled })}
                                        className={cn(
                                            "w-5 h-5 rounded flex items-center justify-center transition-all shrink-0",
                                            getMealConfig(key, 'lunch').enabled
                                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                                : "bg-zinc-800 text-zinc-600 border border-zinc-700 hover:bg-zinc-700"
                                        )}
                                    >
                                        {getMealConfig(key, 'lunch').enabled ? <Check size={9} weight="bold" /> : <X size={9} />}
                                    </button>
                                    <div className={cn("flex items-center gap-0.5 min-w-0 flex-1", !getMealConfig(key, 'lunch').enabled && "opacity-25 pointer-events-none")}>
                                        <Input
                                            type="time"
                                            value={getMealConfig(key, 'lunch').start}
                                            onChange={(e) => updateDayMeal(key, 'lunch', { start: e.target.value })}
                                            className="h-6 text-[10px] bg-zinc-900 border-zinc-700 px-0.5 text-center min-w-0 flex-1"
                                        />
                                        <span className="text-zinc-600 text-[9px] shrink-0">-</span>
                                        <Input
                                            type="time"
                                            value={getMealConfig(key, 'lunch').end}
                                            onChange={(e) => updateDayMeal(key, 'lunch', { end: e.target.value })}
                                            className="h-6 text-[10px] bg-zinc-900 border-zinc-700 px-0.5 text-center min-w-0 flex-1"
                                        />
                                    </div>
                                </div>

                                {/* Dinner */}
                                <div className="flex items-center gap-1 min-w-0">
                                    <button
                                        onClick={() => updateDayMeal(key, 'dinner', { enabled: !getMealConfig(key, 'dinner').enabled })}
                                        className={cn(
                                            "w-5 h-5 rounded flex items-center justify-center transition-all shrink-0",
                                            getMealConfig(key, 'dinner').enabled
                                                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                                                : "bg-zinc-800 text-zinc-600 border border-zinc-700 hover:bg-zinc-700"
                                        )}
                                    >
                                        {getMealConfig(key, 'dinner').enabled ? <Check size={9} weight="bold" /> : <X size={9} />}
                                    </button>
                                    <div className={cn("flex items-center gap-0.5 min-w-0 flex-1", !getMealConfig(key, 'dinner').enabled && "opacity-25 pointer-events-none")}>
                                        <Input
                                            type="time"
                                            value={getMealConfig(key, 'dinner').start}
                                            onChange={(e) => updateDayMeal(key, 'dinner', { start: e.target.value })}
                                            className="h-6 text-[10px] bg-zinc-900 border-zinc-700 px-0.5 text-center min-w-0 flex-1"
                                        />
                                        <span className="text-zinc-600 text-[9px] shrink-0">-</span>
                                        <Input
                                            type="time"
                                            value={getMealConfig(key, 'dinner').end}
                                            onChange={(e) => updateDayMeal(key, 'dinner', { end: e.target.value })}
                                            className="h-6 text-[10px] bg-zinc-900 border-zinc-700 px-0.5 text-center min-w-0 flex-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-6 px-2 border-zinc-700 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/50"
                            onClick={() => applyToAll('lunch', true)}
                        >
                            <Sun size={10} className="mr-1" />
                            Tutti Pranzo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-6 px-2 border-zinc-700 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/50"
                            onClick={() => applyToAll('dinner', true)}
                        >
                            <Moon size={10} className="mr-1" />
                            Tutti Cena
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    )
}
