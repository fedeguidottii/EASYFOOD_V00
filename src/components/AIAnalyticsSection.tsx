import { useState, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bot, Sparkles, Send, ChevronDown, ChevronUp } from 'lucide-react'
import type { Order, Dish, Category, Table, Booking } from '../services/types'

interface AIAnalyticsSectionProps {
    orders: Order[]
    dishes: Dish[]
    categories: Category[]
    tables?: Table[]
    bookings?: Booking[]
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export default function AIAnalyticsSection({ orders, dishes, categories, tables = [], bookings = [] }: AIAnalyticsSectionProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [hasInitialized, setHasInitialized] = useState(false)

    // FIX: Using correct model name to avoid 404
    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

    const buildRestaurantContext = () => {
        const dishSales = dishes.map(dish => {
            const soldCount = orders.reduce((count, order) => {
                const items = order.items || []
                const dishItems = items.filter(item => item.dish_id === dish.id)
                return count + dishItems.reduce((sum, item) => sum + item.quantity, 0)
            }, 0)

            const revenue = orders.reduce((sum, order) => {
                const items = order.items || []
                const dishItems = items.filter(item => item.dish_id === dish.id)
                return sum + dishItems.reduce((itemSum, item) => itemSum + (item.quantity * dish.price), 0)
            }, 0)

            return {
                name: dish.name,
                category: categories.find(c => c.id === dish.category_id)?.name || 'Unknown',
                price: dish.price,
                soldCount,
                revenue
            }
        })

        const hourlyOrders = Array.from({ length: 24 }, (_, hour) => {
            const count = orders.filter(order => {
                const orderHour = new Date(order.created_at).getHours()
                return orderHour === hour
            }).length
            return { hour: `${hour}:00`, count }
        })

        return {
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, o) => sum + o.total_amount, 0),
            averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total_amount, 0) / orders.length : 0,
            dishSales: dishSales.sort((a, b) => b.soldCount - a.soldCount),
            categories: categories.map(cat => ({
                name: cat.name,
                dishCount: dishes.filter(d => d.category_id === cat.id).length
            })),
            hourlyOrders: hourlyOrders.filter(h => h.count > 0),
            tableCount: tables.length,
            upcomingBookings: bookings.filter(b => new Date(b.date_time) > new Date()).length
        }
    }

    const sendMessage = async (messageContent: string, isInitial = false) => {
        if (!messageContent.trim() && !isInitial) return

        setIsLoading(true)
        const userMessage: Message = { role: 'user', content: messageContent }

        if (!isInitial) {
            setMessages(prev => [...prev, userMessage])
            setInput('')
        }

        try {
            // FIX: Use correct model name for Gemini API
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            const context = buildRestaurantContext()

            const prompt = isInitial
                ? `Agisci come il Manager Esperto di questo ristorante. Hai accesso ai dati completi del locale in formato JSON: ${JSON.stringify(context)}.
Analizza spietatamente i dati. Cerca:
1. Piatti che non vendono (Spreco soldi).
2. Orari morti vs Orari di punta.
3. Opportunità di guadagno mancate.

Dammi un REPORT STRATEGICO immediato:
- Usa EMOJI per ogni punto.
- Sii breve, diretto e professionale.
- Concludi con un'azione pratica da fare domani.`
                : `Contesto ristorante: ${JSON.stringify(context)}

Domanda dell'utente: ${messageContent}

Rispondi in modo professionale e conciso, usando emoji quando appropriato.`

            const result = await model.generateContent(prompt)
            const response = await result.response
            const assistantMessage: Message = {
                role: 'assistant',
                content: response.text()
            }

            setMessages(prev => isInitial ? [assistantMessage] : [...prev, assistantMessage])
        } catch (error) {
            console.error('Errore AI:', error)
            const errorMessage: Message = {
                role: 'assistant',
                content: '❌ Si è verificato un errore durante la connessione con l\'intelligenza artificiale. Riprova più tardi.'
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen && !hasInitialized && orders.length > 0) {
            setHasInitialized(true)
            sendMessage('', true)
        }
    }, [isOpen, hasInitialized, orders.length])

    return (
        <section className="mt-12">
            {!isOpen ? (
                <Card
                    className="max-w-xl mx-auto border-none shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-muted/50"
                    onClick={() => setIsOpen(true)}
                >
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative p-2 bg-primary/10 rounded-xl">
                                <Bot className="w-6 h-6 text-primary" />
                                <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Assistant</p>
                                <h3 className="text-base font-bold text-foreground">
                                    AI Restaurant Manager
                                </h3>
                            </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full">
                            <ChevronUp className="w-4 h-4" />
                        </Button>
                    </div>
                </Card>
            ) : (
                <Card className="max-w-5xl mx-auto border-none shadow-2xl flex flex-col overflow-hidden bg-card">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="relative p-2 bg-primary/10 rounded-xl">
                                <Bot className="w-6 h-6 text-primary" />
                                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    AI Restaurant Manager
                                </h3>
                                <p className="text-xs text-muted-foreground">Powered by Gemini</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="h-8 w-8 p-0 rounded-full"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 p-6 min-h-[320px] max-h-[500px] bg-muted/5">
                        <div className="space-y-6">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${message.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                            : 'bg-card border border-border/50 rounded-bl-none'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-card border border-border/50 rounded-2xl rounded-bl-none p-4 shadow-sm">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t bg-card">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                sendMessage(input)
                            }}
                            className="flex gap-3"
                        >
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Chiedi un'analisi o un consiglio..."
                                className="flex-1 bg-muted/30 border-border/50 focus-visible:ring-primary"
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="h-10 w-10 rounded-xl shadow-sm"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </Card>
            )}
        </section>
    )
}