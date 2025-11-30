import { useState, useRef, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkle, PaperPlaneRight, X, CaretUp, Robot } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Order, Dish, Category, Table, Booking } from '../services/types'

interface AIAnalyticsSectionProps {
    orders: Order[]
    completedOrders: Order[]
    dishes: Dish[]
    categories: Category[]
    tables: Table[]
    bookings: Booking[]
}

interface Message {
    role: 'user' | 'model'
    content: string
}

export default function AIAnalyticsSection({ orders, completedOrders, dishes, categories, tables, bookings }: AIAnalyticsSectionProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [chatSession, setChatSession] = useState<any>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCKgah6OfjQ9E9cgxEwKEsGBsUslCvkN7Q"

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const initializeChat = async () => {
        if (!apiKey) {
            setMessages([{ role: 'model', content: '⚠️ API Key mancante. Controlla la configurazione.' }])
            return
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

            const fullContext = {
                menu: { categories, dishes },
                orders: { active: orders, completed: completedOrders },
                tables,
                bookings
            }

            const systemPrompt = `Sei il Manager virtuale di questo ristorante. Hai accesso al database completo: ${JSON.stringify(fullContext)}.
Analizza tutto: efficienza menu, incassi, piatti "morti" che non si vendono, orari di punta e sprechi.
Dammi un report brutale e onesto su come migliorare il business. Sii pratico. Usa emoji.
Rispondi sempre in italiano.`

            const chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{ text: systemPrompt }],
                    },
                ],
            })

            setChatSession(chat)
            setIsLoading(true)

            const result = await chat.sendMessage("Genera il report iniziale.")
            const response = await result.response
            const text = response.text()

            setMessages([{ role: 'model', content: text }])
            setIsLoading(false)
        } catch (error) {
            console.error("Gemini Error:", error)
            setMessages([{ role: 'model', content: '❌ Errore durante l\'inizializzazione dell\'AI.' }])
            setIsLoading(false)
        }
    }

    const handleSend = async () => {
        if (!input.trim() || !chatSession) return

        const userMsg = input
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setIsLoading(true)

        try {
            const result = await chatSession.sendMessage(userMsg)
            const response = await result.response
            const text = response.text()
            setMessages(prev => [...prev, { role: 'model', content: text }])
        } catch (error) {
            console.error("Gemini Error:", error)
            setMessages(prev => [...prev, { role: 'model', content: '❌ Errore nella risposta.' }])
        } finally {
            setIsLoading(false)
        }
    }

    const toggleOpen = () => {
        if (!isOpen && messages.length === 0) {
            initializeChat()
        }
        setIsOpen(!isOpen)
    }

    return (
        <div className="mt-8 w-full">
            {!isOpen ? (
                <div
                    onClick={toggleOpen}
                    className="w-full bg-slate-900 border border-cyan-500/50 rounded-xl p-6 cursor-pointer hover:bg-slate-800 transition-all duration-300 group relative overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                    <div className="flex items-center justify-center gap-3 text-cyan-400 font-bold tracking-widest text-lg">
                        <Sparkle weight="fill" className="animate-pulse" />
                        <span>AI MANAGER INTELLIGENCE - CLICCA PER ANALISI COMPLETA</span>
                        <Sparkle weight="fill" className="animate-pulse" />
                    </div>
                </div>
            ) : (
                <Card className="w-full bg-slate-950 border-cyan-500/50 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-slate-900/50 p-4 border-b border-cyan-500/30 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-cyan-400 font-bold">
                            <Robot size={24} weight="duotone" />
                            <span>AI RESTAURANT MANAGER</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                            <X size={20} />
                        </Button>
                    </div>

                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px] p-4" ref={scrollRef}>
                            <div className="space-y-4">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                        <div className={cn(
                                            "max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-md",
                                            msg.role === 'user'
                                                ? "bg-cyan-600 text-white rounded-br-none"
                                                : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
                                        )}>
                                            {msg.role === 'model' ? (
                                                <div className="markdown-prose" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 rounded-bl-none flex items-center gap-2">
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-4 bg-slate-900 border-t border-cyan-500/20 flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Chiedi qualcosa al tuo manager AI..."
                                className="bg-slate-950 border-slate-700 text-white focus-visible:ring-cyan-500"
                            />
                            <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                <PaperPlaneRight size={20} weight="fill" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
