import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, ArrowLeft, Sparkle, Check } from '@phosphor-icons/react'
import { Button } from './ui/button'

interface TourStep {
    target: string // CSS selector for the element to highlight
    title: string
    content: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
}

interface OnboardingTourProps {
    steps: TourStep[]
    onComplete: () => void
    isOpen: boolean
}

const TOUR_STORAGE_KEY = 'easyfood_tour_completed'

export const useOnboardingTour = () => {
    const [isOpen, setIsOpen] = useState(false)

    const checkShouldShowTour = useCallback(() => {
        const completed = localStorage.getItem(TOUR_STORAGE_KEY)
        return !completed
    }, [])

    const startTour = useCallback(() => {
        setIsOpen(true)
    }, [])

    const completeTour = useCallback(() => {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true')
        setIsOpen(false)
    }, [])

    const resetTour = useCallback(() => {
        localStorage.removeItem(TOUR_STORAGE_KEY)
    }, [])

    // Auto-start tour for new users after a short delay
    useEffect(() => {
        if (checkShouldShowTour()) {
            const timer = setTimeout(() => {
                setIsOpen(true)
            }, 1500) // Delay to let dashboard load
            return () => clearTimeout(timer)
        }
    }, [checkShouldShowTour])

    return {
        isOpen,
        startTour,
        completeTour,
        resetTour,
        checkShouldShowTour
    }
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ steps, onComplete, isOpen }) => {
    const [currentStep, setCurrentStep] = useState(0)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

    const step = steps[currentStep]
    const isLastStep = currentStep === steps.length - 1
    const isFirstStep = currentStep === 0

    // Find and highlight target element
    useEffect(() => {
        if (!isOpen || !step?.target) return

        const findElement = () => {
            const element = document.querySelector(step.target)
            if (element) {
                const rect = element.getBoundingClientRect()
                setTargetRect(rect)
                // Scroll element into view
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            } else {
                setTargetRect(null)
            }
        }

        // Delay to allow DOM updates
        const timer = setTimeout(findElement, 300)
        window.addEventListener('resize', findElement)

        return () => {
            clearTimeout(timer)
            window.removeEventListener('resize', findElement)
        }
    }, [isOpen, step?.target, currentStep])

    const handleNext = () => {
        if (isLastStep) {
            onComplete()
        } else {
            setCurrentStep(prev => prev + 1)
        }
    }

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1)
        }
    }

    const handleSkip = () => {
        onComplete()
    }

    if (!isOpen) return null

    // Calculate tooltip position
    const getTooltipPosition = () => {
        if (!targetRect) {
            // Center of screen if no target
            return {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            }
        }

        const padding = 16
        const placement = step?.placement || 'bottom'

        switch (placement) {
            case 'top':
                return {
                    bottom: `${window.innerHeight - targetRect.top + padding}px`,
                    left: `${targetRect.left + targetRect.width / 2}px`,
                    transform: 'translateX(-50%)'
                }
            case 'bottom':
                return {
                    top: `${targetRect.bottom + padding}px`,
                    left: `${targetRect.left + targetRect.width / 2}px`,
                    transform: 'translateX(-50%)'
                }
            case 'left':
                return {
                    top: `${targetRect.top + targetRect.height / 2}px`,
                    right: `${window.innerWidth - targetRect.left + padding}px`,
                    transform: 'translateY(-50%)'
                }
            case 'right':
                return {
                    top: `${targetRect.top + targetRect.height / 2}px`,
                    left: `${targetRect.right + padding}px`,
                    transform: 'translateY(-50%)'
                }
            default:
                return {
                    top: `${targetRect.bottom + padding}px`,
                    left: `${targetRect.left + targetRect.width / 2}px`,
                    transform: 'translateX(-50%)'
                }
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9998]"
                        style={{
                            background: 'rgba(0,0,0,0.75)',
                            // Cutout for target element
                            ...(targetRect && {
                                clipPath: `polygon(
                  0% 0%, 
                  0% 100%, 
                  ${targetRect.left - 8}px 100%, 
                  ${targetRect.left - 8}px ${targetRect.top - 8}px, 
                  ${targetRect.right + 8}px ${targetRect.top - 8}px, 
                  ${targetRect.right + 8}px ${targetRect.bottom + 8}px, 
                  ${targetRect.left - 8}px ${targetRect.bottom + 8}px, 
                  ${targetRect.left - 8}px 100%, 
                  100% 100%, 
                  100% 0%
                )`
                            })
                        }}
                    />

                    {/* Highlight ring around target */}
                    {targetRect && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="fixed z-[9999] pointer-events-none"
                            style={{
                                top: targetRect.top - 8,
                                left: targetRect.left - 8,
                                width: targetRect.width + 16,
                                height: targetRect.height + 16,
                                border: '2px solid #f59e0b',
                                borderRadius: '12px',
                                boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.2), 0 0 30px rgba(245, 158, 11, 0.3)'
                            }}
                        />
                    )}

                    {/* Tooltip */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed z-[10000] w-80 max-w-[90vw]"
                        style={getTooltipPosition()}
                    >
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-zinc-800/50 px-4 py-3 flex items-center justify-between border-b border-zinc-700/50">
                                <div className="flex items-center gap-2">
                                    <Sparkle weight="fill" className="text-amber-500" size={16} />
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                        Tutorial {currentStep + 1}/{steps.length}
                                    </span>
                                </div>
                                <button
                                    onClick={handleSkip}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                <h3 className="text-lg font-bold text-zinc-100 mb-2">{step?.title}</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">{step?.content}</p>
                            </div>

                            {/* Actions */}
                            <div className="px-5 pb-5 flex items-center justify-between gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePrev}
                                    disabled={isFirstStep}
                                    className="text-zinc-400 hover:text-white disabled:opacity-30"
                                >
                                    <ArrowLeft className="mr-1" size={14} />
                                    Indietro
                                </Button>

                                <Button
                                    size="sm"
                                    onClick={handleNext}
                                    className="bg-amber-600 hover:bg-amber-700 text-zinc-950 font-semibold"
                                >
                                    {isLastStep ? (
                                        <>
                                            <Check className="mr-1" size={14} weight="bold" />
                                            Inizia!
                                        </>
                                    ) : (
                                        <>
                                            Avanti
                                            <ArrowRight className="ml-1" size={14} />
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Progress dots */}
                            <div className="flex justify-center gap-1.5 pb-4">
                                {steps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? 'bg-amber-500' : 'bg-zinc-700'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

// Default tour steps for restaurant dashboard
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
    {
        target: '[data-tour="welcome"]',
        title: '👋 Benvenuto in EASYFOOD!',
        content: 'Questa è la tua dashboard per gestire il ristorante. Ti guideremo attraverso le funzionalità principali.',
        placement: 'bottom'
    },
    {
        target: '[data-tour="tables"]',
        title: '🪑 Gestione Tavoli',
        content: 'Qui puoi vedere tutti i tuoi tavoli, attivarli quando arrivano clienti e monitorare gli ordini in corso.',
        placement: 'right'
    },
    {
        target: '[data-tour="menu"]',
        title: '📋 Il Tuo Menu',
        content: 'Aggiungi, modifica ed elimina piatti. Puoi organizzarli per categorie e impostare prezzi.',
        placement: 'right'
    },
    {
        target: '[data-tour="reservations"]',
        title: '📅 Prenotazioni',
        content: 'Visualizza e gestisci tutte le prenotazioni. I clienti possono prenotare tramite QR code.',
        placement: 'right'
    },
    {
        target: '[data-tour="analytics"]',
        title: '📊 Analitiche',
        content: 'Monitora ricavi, ordini più popolari e trend del tuo ristorante nel tempo.',
        placement: 'right'
    },
    {
        target: '[data-tour="settings"]',
        title: '⚙️ Impostazioni',
        content: 'Personalizza orari, prezzi del coperto, credenziali camerieri e molto altro.',
        placement: 'right'
    },
    {
        target: '[data-tour="qrcode"]',
        title: '🎉 Sei Pronto!',
        content: 'Usa i QR code per permettere ai clienti di visualizzare il menu e ordinare direttamente dal tavolo. Buon lavoro!',
        placement: 'bottom'
    }
]

export default OnboardingTour
