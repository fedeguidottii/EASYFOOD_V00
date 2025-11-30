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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <Card className="w-full max-w-md shadow-xl border-none bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                        <Utensils size={32} />
                    </div>
                    <CardTitle className="text-2xl font-bold">Benvenuto</CardTitle>
                    <CardDescription className="text-base">
                        Inserisci il PIN per accedere al menu
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                <Lock size={20} />
                            </div>
                            <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="PIN"
                                className="text-center text-3xl tracking-[0.5em] font-mono h-14 pl-10 font-bold bg-muted/50 border-border/50 focus:ring-primary/20 transition-all"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                maxLength={4}
                                autoFocus
                            />
                        </div>
                        {tableName && (
                            <p className="text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                {tableName}
                            </p>
                        )}
                    </div>
                    <Button
                        className="w-full h-12 text-lg font-bold shadow-lg rounded-xl transition-all active:scale-[0.98]"
                        onClick={handleAccess}
                        disabled={loading || pin.length < 4}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Verifica...
                            </div>
                        ) : 'Accedi al Menu'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
