import { useState, useEffect } from 'react'
import { DatabaseService } from '../services/DatabaseService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { User } from '../services/types'

interface ClientTableAccessProps {
    tableId: string
    onAccessGranted: (user: User) => void
}

export default function ClientTableAccess({ tableId, onAccessGranted }: ClientTableAccessProps) {
    const [pin, setPin] = useState('')
    const [loading, setLoading] = useState(false)
    const [restaurantName, setRestaurantName] = useState('')

    useEffect(() => {
        // Fetch restaurant name for better UX
        const fetchTableInfo = async () => {
            try {
                // We need to get the table first to find the restaurant
                // This assumes we have a way to get table by ID. 
                // Since we don't have a direct method exposed in DatabaseService for just one table without auth context sometimes,
                // we might need to rely on the fact that we can query public tables if RLS allows.
                // For now, let's skip restaurant name or try to fetch it if possible.
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
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Benvenuto</CardTitle>
                    <CardDescription>
                        Inserisci il PIN del tavolo per accedere al menu
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="text"
                            placeholder="PIN Tavolo (es. 1234)"
                            className="text-center text-2xl tracking-widest uppercase"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            maxLength={4}
                        />
                    </div>
                    <Button
                        className="w-full h-12 text-lg"
                        onClick={handleAccess}
                        disabled={loading}
                    >
                        {loading ? 'Verifica...' : 'Accedi al Menu'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
