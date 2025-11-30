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

    return (
        <section className="mt-12">
            {!isOpen ? (
                <Card
                    className="max-w-xl mx-auto bg-gradient-to-r from-slate-900 via-violet-900/60 to-slate-900 border border-cyan-500/30 cursor-pointer hover:border-cyan-400/70 transition-all duration-300 shadow-[0_10px_45px_rgba(67,56,202,0.25)]"
                    onClick={() => setIsOpen(true)}
                >
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bot className="w-7 h-7 text-cyan-300" />
                                <Sparkles className="w-4 h-4 text-violet-300 absolute -top-1 -right-1" />
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">Assistant</p>
                                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-violet-200">
                                    AI Restaurant Manager
                                </h3>
                                <p className="text-xs text-cyan-100/70">Apri il pannello di suggerimenti</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" className="h-9 px-3 text-cyan-100 border-cyan-500/40 bg-white/5 hover:bg-white/10">
                            <ChevronUp className="w-4 h-4" />
                        </Button>
                    </div>
                </Card>
            ) : (
                <Card className="max-w-5xl mx-auto bg-slate-950/90 backdrop-blur-xl border border-cyan-500/30 shadow-[0_20px_60px_rgba(6,182,212,0.35)] flex flex-col">
                    <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-slate-900/60 to-violet-900/40 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bot className="w-8 h-8 text-cyan-300" />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Insight</p>
                                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-violet-200">
                                    AI Restaurant Manager
                                </h3>
                                <p className="text-xs text-cyan-100/70">Powered by Gemini 1.5 Flash</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/10"
                        >
                            <ChevronDown className="w-5 h-5" />
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 p-6 min-h-[320px] max-h-[420px]">
                        <div className="space-y-4">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                                                ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-[0_10px_35px_rgba(99,102,241,0.3)]'
                                                : 'bg-slate-900/70 backdrop-blur border border-cyan-500/20 text-cyan-50'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-900/70 backdrop-blur border border-cyan-500/20 rounded-lg p-4">
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

                    <div className="p-4 border-t border-cyan-500/20 bg-slate-900/60 rounded-b-xl">
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
                                className="flex-1 bg-slate-950/70 border-cyan-500/30 text-cyan-50 placeholder:text-cyan-200/50 focus-visible:ring-cyan-400"
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="h-10 w-10 rounded-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white shadow-lg"
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
