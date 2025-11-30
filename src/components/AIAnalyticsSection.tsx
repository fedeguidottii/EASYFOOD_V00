import { useState, useRef, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkle, PaperPlaneRight, X, CaretUp, Robot, Lightning, WarningCircle } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    text: string
}

export default function AIAnalyticsSection({ orders, completedOrders, dishes, categories, tables, bookings }: AIAnalyticsSectionProps) {
    const [inputMessage, setInputMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [chatSession, setChatSession] = useState<Message[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCKgah6OfjQ9E9cgxEwKEsGBsUslCvkN7Q"

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [chatSession])

    const generateReport = async () => {
        if (!apiKey) {
            setError("Chiave API mancante. Controlla la configurazione.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

            const fullContext = {
                menu: { categories, dishes },
                orders: orders,
                tables: tables,
                bookings: bookings
            }

            const prompt = `
            Sei il Manager Virtuale di questo ristorante. Analizza i dati seguenti e fornisci un report BRUTALE e ONESTO su come migliorare il business.
            Usa emoji, sii diretto, parla in italiano.
            
            DATI RISTORANTE:
            ${JSON.stringify(fullContext, null, 2)}
            `

            const result = await model.generateContent(prompt)
            const response = result.response
            const text = response.text()

            setChatSession([{ role: 'model', text: text }])
        } catch (error) {
            console.error("Gemini Error:", error)
            setError("Errore IA: Verifica la chiave API o riprova più tardi.")
        } finally {
            setLoading(false)
        }
    }

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !chatSession) return

        const newMessage: Message = { role: 'user', text: inputMessage }
        setChatSession(prev => [...(prev || []), newMessage])
        setInputMessage('')
        setLoading(true)
        setError(null)

        try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

            const history = chatSession.map((msg: Message) => ({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }))

            const chat = model.startChat({
                history: history
            })

            const result = await chat.sendMessage(inputMessage)
            const response = result.response
            const text = response.text()
            setChatSession(prev => [...(prev || []), { role: 'model', text: text }])
        } catch (error) {
            console.error("Gemini Error:", error)
            setError("Errore nella risposta. Riprova.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white overflow-hidden relative group">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

            <CardHeader className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
                            <Sparkle size={24} weight="fill" className="text-white animate-pulse" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                AI Manager Intelligence
                            </CardTitle>
                            <CardDescription className="text-slate-400 font-medium">
                                Analisi avanzata e consigli strategici
                            </CardDescription>
                        </div>
                    </div>
                    {!chatSession && (
                        <Button
                            onClick={generateReport}
                            disabled={loading}
                            className="bg-white text-black hover:bg-slate-200 font-bold shadow-lg shadow-white/10 transition-all hover:scale-105 active:scale-95"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    Analisi in corso...
                                </div>
                            ) : (
                                <>
                                    <Lightning size={18} weight="fill" className="mr-2 text-amber-500" />
                                    Genera Report
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="relative z-10 p-0 min-h-[200px]">
                {error && (
                    <div className="p-8 text-center text-red-400 bg-red-950/30 m-4 rounded-xl border border-red-900/50">
                        <WarningCircle size={32} className="mx-auto mb-2" />
                        <p className="font-bold">{error}</p>
                    </div>
                )}

                {!chatSession && !loading && !error && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                        <Robot size={64} weight="duotone" className="opacity-20 animate-bounce" />
                        <p className="text-lg font-medium">L'IA è pronta ad analizzare i dati del tuo ristorante.</p>
                    </div>
                )}

                {chatSession && (
                    <div className="flex flex-col h-[500px]">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" ref={scrollRef}>
                            {chatSession.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-md ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-slate-800/80 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-md'
                                        }`}>
                                        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none flex gap-2 items-center">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-100" />
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-200" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-900/50 border-t border-white/5 backdrop-blur-lg">
                            <div className="flex gap-2">
                                <Input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Chiedi dettagli sui dati..."
                                    className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={loading || !inputMessage.trim()}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-600/20"
                                >
                                    <PaperPlaneRight size={18} weight="fill" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
