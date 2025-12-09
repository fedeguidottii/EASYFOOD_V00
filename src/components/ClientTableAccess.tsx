import { useState, useEffect, useRef } from 'react'
import { DatabaseService } from '../services/DatabaseService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Utensils, Lock, ArrowRight, ChefHat } from 'lucide-react'
import { User } from '../services/types'

interface ClientTableAccessProps {
    tableId: string
    onAccessGranted: (user: User) => void
}

export default function ClientTableAccess({ tableId, onAccessGranted }: ClientTableAccessProps) {
    const [pin, setPin] = useState(['', '', '', ''])
    const [loading, setLoading] = useState(false)
    const [tableName, setTableName] = useState<string>('')
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    useEffect(() => {
        const fetchTableInfo = async () => {
            try {
                const { data, error } = await supabase
                    .from('tables')
                    .select('number')
                    .eq('id', tableId)
                    .single()

                if (data) {
                    setTableName(data.number)
                }
            } catch (error) {
                console.error('Error fetching table info', error)
            }
        }
        fetchTableInfo()
    }, [tableId])

    const handlePinChange = (index: number, value: string) => {
        if (value.length > 1) {
            // Handle paste or multi-char input
            const chars = value.split('').slice(0, 4 - index)
            const newPin = [...pin]
            chars.forEach((char, i) => {
                newPin[index + i] = char
            })
            setPin(newPin)
            const nextIndex = Math.min(3, index + chars.length)
            inputRefs.current[nextIndex]?.focus()
            return
        }

        const newPin = [...pin]
        newPin[index] = value
        setPin(newPin)

        // Auto-advance
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleAccess = async () => {
        const fullPin = pin.join('')
        if (fullPin.length < 4) {
            toast.error('Inserisci il PIN completo')
            return
        }

        setLoading(true)
        try {
            // Verify PIN
            const isValid = await DatabaseService.verifySessionPin(tableId, fullPin)

            if (isValid) {
                // Create a temporary customer user
                const tempUser: User = {
                    id: 'customer-' + Date.now(),
                    name: 'Cliente',
                    role: 'CUSTOMER',
                    email: 'customer@temp.com'
                }
                onAccessGranted(tempUser)
                toast.success('Accesso effettuato')
            } else {
                toast.error('PIN non valido')
                setPin(['', '', '', ''])
                inputRefs.current[0]?.focus()
            }
        } catch (error) {
            console.error('Access error:', error)
            toast.error('Errore di connessione')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 relative overflow-hidden font-sans p-4">
            {/* Subtle Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/20 via-transparent to-transparent dark:from-emerald-900/10 pointer-events-none"></div>

            <Card className="w-full max-w-xs border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl relative z-10 overflow-hidden">
                <CardHeader className="text-center pb-2 pt-6">
                    <div className="mx-auto mb-4 relative">
                        <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                            <ChefHat size={28} className="text-emerald-600 dark:text-emerald-500" />
                        </div>
                    </div>

                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        EasyFood
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-1">
                        Inserisci il PIN per accedere
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-5 pb-6 pt-3 space-y-5">
                    <div className="text-center space-y-4">
                        {tableName && (
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                                <span className="text-slate-900 dark:text-white font-bold text-lg">{tableName}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex justify-center gap-2">
                                {pin.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => { inputRefs.current[idx] = el }}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handlePinChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder-slate-300 dark:placeholder-slate-600 caret-emerald-500"
                                        placeholder="•"
                                    />
                                ))}
                            </div>
                            <p className="text-slate-400 dark:text-slate-500 text-[11px]">PIN fornito dal personale</p>
                        </div>
                    </div>

                    <Button
                        className="w-full h-11 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        onClick={handleAccess}
                        disabled={loading || pin.some(d => !d)}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Verifica...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <span>Accedi</span>
                                <ArrowRight size={16} />
                            </div>
                        )}
                    </Button>
                </CardContent>
            </Card>

            <div className="absolute bottom-4 text-slate-400 dark:text-slate-600 text-[10px]">
                Powered by EasyFood
            </div>
        </div>
    )
}
