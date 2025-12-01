import { useState, useEffect } from 'react'
import { DatabaseService } from '../services/DatabaseService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Utensils, Lock } from 'lucide-react'
import { User } from '../services/types'

interface ClientTableAccessProps {
    tableId: string
    onAccessGranted: (user: User) => void
}

export default function ClientTableAccess({ tableId, onAccessGranted }: ClientTableAccessProps) {
    const [pin, setPin] = useState('')
    const [loading, setLoading] = useState(false)
    const [tableName, setTableName] = useState<string>('')

    useEffect(() => {
        const fetchTableInfo = async () => {
            try {
                const { data, error } = await supabase
                    .from('tables')
                    .select('number')
                    .eq('id', tableId)
                    .single()

                if (data) {
                    setTableName(`Tavolo ${data.number}`)
                }
            } catch (error) {
                console.error('Error fetching table info', error)
            }
        }
        fetchTableInfo()
    }, [tableId])

    const handleAccess = async () => {
        if (!pin.trim()) {
            toast.error('Inserisci il PIN')
            return
        }

        setLoading(true)
        try {
            // Verify PIN
            const isValid = await DatabaseService.verifySessionPin(tableId, pin.trim())

            if (isValid) {
                // Create a temporary customer user
                const tempUser: User = {
                    id: 'customer-' + Date.now(),
                    name: 'Cliente',
                    role: 'CUSTOMER',
                    email: 'customer@temp.com'
                }
                onAccessGranted(tempUser)
                toast.success('Accesso effettuato!')
            } else {
                toast.error('PIN non valido')
            }
        } catch (error) {
            console.error('Access error:', error)
            toast.error('Errore durante l\'accesso')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
            <Card className="w-full max-w-md shadow-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 backdrop-blur-xl overflow-hidden rounded-3xl">
                <CardHeader className="text-center pb-4 pt-8 px-8">
                    <div className="mx-auto relative mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 transform hover:scale-105 transition-transform">
                            <Utensils size={36} className="text-white" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                            <Lock size={14} className="text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                        Benvenuto
                    </CardTitle>
                    <CardDescription className="text-base mt-2 text-slate-600 dark:text-slate-400">
                        Inserisci il PIN per accedere al menu digitale
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 pt-4 px-8 pb-8">
                    <div className="space-y-6">
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Lock size={22} />
                            </div>
                            <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="••••"
                                className="text-center text-4xl tracking-[0.8em] font-mono h-16 pl-12 pr-12 font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500 rounded-2xl transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                maxLength={4}
                                autoFocus
                            />
                        </div>
                        {tableName && (
                            <div className="text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                    {tableName}
                                </p>
                            </div>
                        )}
                    </div>
                    <Button
                        className="w-full h-14 text-lg font-bold shadow-2xl shadow-emerald-500/30 rounded-2xl transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-none hover:shadow-emerald-500/40"
                        onClick={handleAccess}
                        disabled={loading || pin.length < 4}
                    >
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Verifica in corso...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Utensils size={20} />
                                <span>Accedi al Menu</span>
                            </div>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
