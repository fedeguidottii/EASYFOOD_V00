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

        // Auto-focus first input on mount
        setTimeout(() => {
            inputRefs.current[0]?.focus()
        }, 100)
    }, [tableId])

    const handlePinChange = (index: number, value: string) => {
        // Filter only numeric input
        const numericValue = value.replace(/[^0-9]/g, '')

        if (numericValue.length > 1) {
            // Handle paste or multi-char input
            const chars = numericValue.split('').slice(0, 4 - index)
            const newPin = [...pin]
            chars.forEach((char, i) => {
                if (index + i < 4) {
                    newPin[index + i] = char
                }
            })
            setPin(newPin)
            const nextIndex = Math.min(3, index + chars.length)
            inputRefs.current[nextIndex]?.focus()
            return
        }

        const newPin = [...pin]
        newPin[index] = numericValue
        setPin(newPin)

        // Auto-advance
        if (numericValue && index < 3) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handlePinFocus = (index: number) => {
        // When a field is focused, select its content for easy replacement
        inputRefs.current[index]?.select()
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
            {/* Background Effects - Professional & Elegant */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/20 pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl"></div>

            <Card className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden">
                <CardHeader className="text-center pb-2 pt-10">
                    <div className="mx-auto mb-6 relative">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                            <ChefHat size={40} className="text-emerald-500" />
                        </div>
                    </div>

                    <CardTitle className="text-3xl font-bold text-white tracking-tight">
                        EasyFood
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-medium text-sm mt-2">
                        Accedi al menu e ordina
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-8 pb-10 pt-6 space-y-8">
                    <div className="text-center space-y-8">
                        {tableName && (
                            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
                                <span className="text-white font-bold text-2xl">{tableName}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex justify-center gap-3">
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
                                        onFocus={() => handlePinFocus(idx)}
                                        onClick={() => handlePinFocus(idx)}
                                        className="w-14 h-16 text-center text-3xl font-bold bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-inner placeholder-slate-700 caret-emerald-500"
                                        placeholder="•"
                                        autoComplete="off"
                                    />
                                ))}
                            </div>
                            <p className="text-slate-500 text-xs">Inserisci il PIN fornito dal personale</p>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 text-base font-bold shadow-lg shadow-emerald-500/20 rounded-xl transition-all active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleAccess}
                        disabled={loading || pin.some(d => !d)}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Verifica in corso...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <span>Accedi al Menu</span>
                                <ArrowRight size={20} />
                            </div>
                        )}
                    </Button>
                </CardContent>
            </Card>

            <div className="absolute bottom-6 text-slate-600 text-xs">
                Powered by EasyFood
            </div>
        </div>
    )
}
