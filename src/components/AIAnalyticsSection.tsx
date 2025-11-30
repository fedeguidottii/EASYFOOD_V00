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
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
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
                content: '❌ Si è verificato un errore. Verifica che la chiave API sia configurata correttamente.'
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

    if (!isOpen) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50">
                <div className="container mx-auto px-4 pb-4">
                    <Card
                        className="bg-gradient-to-r from-slate-950 via-violet-950/50 to-slate-950 border-2 border-cyan-500/50 cursor-pointer hover:border-cyan-400 transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)]"
                        onClick={() => setIsOpen(true)}
                    >
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Bot className="w-8 h-8 text-cyan-400 animate-pulse" />
                                    <Sparkles className="w-4 h-4 text-violet-400 absolute -top-1 -right-1" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                                        ✨ AI RESTAURANT MANAGER
                                    </h3>
                                    <p className="text-sm text-cyan-300/70">Clicca per analisi completa</p>
                                </div>
                            </div>
                            <ChevronUp className="w-6 h-6 text-cyan-400" />
                        </div>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="container mx-auto px-4 pb-4">
                <Card className="bg-slate-950/95 backdrop-blur-xl border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.4)] max-h-[600px] flex flex-col">
                    <div className="p-4 border-b border-cyan-500/30 flex items-center justify-between bg-gradient-to-r from-slate-900/50 to-violet-900/30">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bot className="w-8 h-8 text-cyan-400" />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                                    AI RESTAURANT MANAGER
                                </h3>
                                <p className="text-xs text-cyan-300/70">Powered by Gemini Pro</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        >
                            <ChevronDown className="w-5 h-5" />
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 p-6 min-h-[300px] max-h-[400px]">
                        <div className="space-y-4">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                                                ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white'
                                                : 'bg-slate-800/50 backdrop-blur border border-cyan-500/20 text-cyan-50'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800/50 backdrop-blur border border-cyan-500/20 rounded-lg p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t border-cyan-500/30 bg-slate-900/30">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                sendMessage(input)
                            }}
                            className="flex gap-2"
                        >
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Chiedi all'AI manager..."
                                className="flex-1 bg-slate-800/50 border-cyan-500/30 text-cyan-50 placeholder:text-cyan-300/50 focus-visible:ring-cyan-400"
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    )
}
