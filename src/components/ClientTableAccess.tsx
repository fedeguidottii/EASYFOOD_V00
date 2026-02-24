import { useState, useEffect, useRef } from 'react'
import { DatabaseService } from '../services/DatabaseService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Utensils, Lock, ArrowRight, ChefHat } from 'lucide-react'
import { User, Restaurant } from '../services/types'
import { getMenuTheme } from '../utils/menuTheme'
import { useMemo } from 'react'

interface ClientTableAccessProps {
    tableId: string
    onAccessGranted: (user: User) => void
}

export default function ClientTableAccess({ tableId, onAccessGranted }: ClientTableAccessProps) {
    const [pin, setPin] = useState(['', '', '', ''])
    const [loading, setLoading] = useState(false)
    const [tableName, setTableName] = useState<string>('')
    const [restaurantData, setRestaurantData] = useState<Partial<Restaurant> | null>(null)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Compute theme
    const theme = useMemo(() => getMenuTheme(
        (restaurantData?.menu_style as any) || 'elegant',
        restaurantData?.menu_primary_color || '#f59e0b'
    ), [restaurantData])

    useEffect(() => {
        const fetchTableInfo = async () => {
            try {
                const { data, error } = await supabase
                    .from('tables')
                    .select('number, restaurants(name, menu_style, menu_primary_color)')
                    .eq('id', tableId)
                    .single()

                if (data) {
                    setTableName(data.number)
                    if (data.restaurants) {
                        setRestaurantData(data.restaurants as Partial<Restaurant>)
                    }
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
        // Always focus the first empty field instead of the clicked one
        const firstEmptyIndex = pin.findIndex(digit => digit === '')
        if (firstEmptyIndex !== -1 && firstEmptyIndex !== index) {
            inputRefs.current[firstEmptyIndex]?.focus()
        } else {
            // If all filled or clicked on the first empty, select content for replacement
            inputRefs.current[index]?.select()
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
        <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden font-sans" style={{ ...theme.cssVars, background: theme.pageBgGradient, fontFamily: theme.bodyFont }}>
            {/* Background Effects - Professional & Elegant */}
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: theme.primaryAlpha(0.1) }}></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl bg-slate-500/10"></div>

            <Card className="w-full max-w-md relative z-10 overflow-hidden shadow-2xl backdrop-blur-xl" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: theme.cardRadius }}>
                <CardHeader className="text-center pb-2 pt-10">
                    <div className="mx-auto mb-6 relative">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg border" style={{ backgroundColor: theme.primaryAlpha(0.1), borderColor: theme.primaryAlpha(0.2), boxShadow: `0 10px 15px -3px ${theme.primaryAlpha(0.1)}` }}>
                            <ChefHat size={40} style={{ color: theme.primary }} />
                        </div>
                    </div>

                    <CardTitle className="text-3xl font-bold tracking-tight" style={{ color: theme.textPrimary, fontFamily: theme.headerFont }}>
                        {restaurantData?.name || 'EasyFood'}
                    </CardTitle>
                    <CardDescription className="font-medium text-sm mt-2" style={{ color: theme.textSecondary }}>
                        Accedi al menu e ordina
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-8 pb-10 pt-6 space-y-8">
                    <div className="text-center space-y-8">
                        {tableName && (
                            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full backdrop-blur-sm border border-black/10 shadow-sm" style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}>
                                <span className="font-bold text-2xl" style={{ color: theme.textPrimary }}>{tableName}</span>
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
                                        className="w-14 h-16 text-center text-3xl font-bold border rounded-xl outline-none transition-all shadow-inner"
                                        style={{
                                            backgroundColor: theme.inputBg,
                                            borderColor: digit ? theme.primary : theme.inputBorder,
                                            color: theme.textPrimary,
                                            boxShadow: digit ? `0 0 0 4px ${theme.primaryAlpha(0.1)}` : 'none'
                                        }}
                                        placeholder="•"
                                        autoComplete="off"
                                    />
                                ))}
                            </div>
                            <p className="text-xs" style={{ color: theme.textMuted }}>Inserisci il PIN fornito dal personale</p>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 text-base font-bold shadow-lg transition-all active:scale-[0.98] text-white"
                        style={{ ...theme.primaryBgStyle, borderRadius: theme.buttonRadius, boxShadow: `0 10px 15px -3px ${theme.primaryAlpha(0.2)}` }}
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

            <div className="absolute bottom-6 text-xs" style={{ color: theme.textMuted }}>
                Powered by EasyFood
            </div>
        </div>
    )
}
