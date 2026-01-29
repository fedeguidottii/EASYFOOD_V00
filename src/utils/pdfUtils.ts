import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

// Mappa completa dei colori per la sostituzione oklch - include tutti i colori Tailwind
const colorMap: Record<string, string> = {
    // Zinc
    'zinc-50': '#fafafa', 'zinc-100': '#f4f4f5', 'zinc-200': '#e4e4e7',
    'zinc-300': '#d4d4d8', 'zinc-400': '#a1a1aa', 'zinc-500': '#71717a',
    'zinc-600': '#52525b', 'zinc-700': '#3f3f46', 'zinc-800': '#27272a',
    'zinc-900': '#18181b', 'zinc-950': '#09090b',
    // Slate
    'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0',
    'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
    'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b',
    'slate-900': '#0f172a', 'slate-950': '#020617',
    // Gray
    'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb',
    'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280',
    'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-800': '#1f2937',
    'gray-900': '#111827', 'gray-950': '#030712',
    // Amber / Orange
    'amber-50': '#fffbeb', 'amber-100': '#fef3c7', 'amber-200': '#fde68a',
    'amber-300': '#fcd34d', 'amber-400': '#fbbf24', 'amber-500': '#f59e0b',
    'amber-600': '#d97706', 'amber-700': '#b45309', 'amber-800': '#92400e',
    'amber-900': '#78350f', 'amber-950': '#451a03',
    'orange-50': '#fff7ed', 'orange-100': '#ffedd5', 'orange-200': '#fed7aa',
    'orange-300': '#fdba74', 'orange-400': '#fb923c', 'orange-500': '#f97316',
    'orange-600': '#ea580c', 'orange-700': '#c2410c', 'orange-800': '#9a3412',
    'orange-900': '#7c2d12', 'orange-950': '#431407',
    // Red
    'red-50': '#fef2f2', 'red-100': '#fee2e2', 'red-200': '#fecaca',
    'red-300': '#fca5a5', 'red-400': '#f87171', 'red-500': '#ef4444',
    'red-600': '#dc2626', 'red-700': '#b91c1c', 'red-800': '#991b1b',
    'red-900': '#7f1d1d', 'red-950': '#450a0a',
    // Rose
    'rose-50': '#fff1f2', 'rose-100': '#ffe4e6', 'rose-200': '#fecdd3',
    'rose-300': '#fda4af', 'rose-400': '#fb7185', 'rose-500': '#f43f5e',
    'rose-600': '#e11d48', 'rose-700': '#be123c', 'rose-800': '#9f1239',
    'rose-900': '#881337', 'rose-950': '#4c0519',
    // Green / Emerald
    'green-50': '#f0fdf4', 'green-100': '#dcfce7', 'green-200': '#bbf7d0',
    'green-300': '#86efac', 'green-400': '#4ade80', 'green-500': '#22c55e',
    'green-600': '#16a34a', 'green-700': '#15803d', 'green-800': '#166534',
    'green-900': '#14532d', 'green-950': '#052e16',
    'emerald-50': '#ecfdf5', 'emerald-100': '#d1fae5', 'emerald-200': '#a7f3d0',
    'emerald-300': '#6ee7b7', 'emerald-400': '#34d399', 'emerald-500': '#10b981',
    'emerald-600': '#059669', 'emerald-700': '#047857', 'emerald-800': '#065f46',
    'emerald-900': '#064e3b', 'emerald-950': '#022c22',
    // Blue
    'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe',
    'blue-300': '#93c5fd', 'blue-400': '#60a5fa', 'blue-500': '#3b82f6',
    'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'blue-800': '#1e40af',
    'blue-900': '#1e3a8a', 'blue-950': '#172554',
    // Basic
    'white': '#ffffff', 'black': '#000000', 'transparent': 'transparent',
}

/**
 * Converte una stringa colore oklch in un hex di fallback
 */
const oklchToHex = (oklchStr: string): string => {
    // Parse oklch(L C H) or oklch(L C H / A)
    const match = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/)
    if (!match) return '#000000'

    let lightness = parseFloat(match[1])
    if (match[1].includes('%')) lightness = lightness / 100

    // Mapping semplice basato sulla luminosità
    if (lightness > 0.95) return '#ffffff'
    if (lightness > 0.9) return '#f4f4f5'
    if (lightness > 0.8) return '#e4e4e7'
    if (lightness > 0.7) return '#a1a1aa'
    if (lightness > 0.6) return '#71717a'
    if (lightness > 0.5) return '#52525b'
    if (lightness > 0.4) return '#3f3f46'
    if (lightness > 0.3) return '#27272a'
    if (lightness > 0.2) return '#18181b'
    if (lightness > 0.1) return '#09090b'
    return '#000000'
}

/**
 * Forza la sostituzione di tutti i colori oklch nei fogli di stile del documento clonato
 */
const replaceOklchInClonedDocument = (doc: Document): void => {
    const styleElements = doc.querySelectorAll('style')
    styleElements.forEach(style => {
        if (style.textContent && style.textContent.includes('oklch')) {
            style.textContent = style.textContent.replace(
                /oklch\([^)]+\)/g,
                (match) => oklchToHex(match)
            )
        }
    })

    // Pulisce anche gli attributi style inline sugli elementi
    const allElements = doc.querySelectorAll('*[style]')
    allElements.forEach(el => {
        const style = el.getAttribute('style')
        if (style && style.includes('oklch')) {
            const newStyle = style.replace(/oklch\([^)]+\)/g, (match) => oklchToHex(match))
            el.setAttribute('style', newStyle)
        }
    })
}

/**
 * Legge tutte le variabili CSS dal documento originale, converte OKLCH in Hex,
 * e le applica inline alla root del documento clonato.
 * Questo impedisce a html2canvas di crashare sulle variabili ereditate.
 */
const flattenCssVariables = (clonedDoc: Document) => {
    const rootStyle = getComputedStyle(document.documentElement)
    const newStyles: string[] = []

    // 1. Cerca di identificare le variabili dai fogli di stile
    const varNames = new Set<string>()

    try {
        Array.from(document.styleSheets).forEach(sheet => {
            try {
                Array.from(sheet.cssRules).forEach(rule => {
                    if (rule instanceof CSSStyleRule) {
                        Array.from(rule.style).forEach(prop => {
                            if (prop.startsWith('--')) {
                                varNames.add(prop)
                            }
                        })
                    }
                })
            } catch (e) {
                // Ignora errori cross-origin
            }
        })
    } catch (e) {
        console.warn('Impossibile leggere fogli di stile per le variabili', e)
    }

    // 2. Aggiunge manualmente le variabili comuni di Tailwind/System se mancate
    const commonVars = [
        '--background', '--foreground', '--primary', '--primary-foreground',
        '--card', '--card-foreground', '--popover', '--popover-foreground',
        '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
        '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
        '--border', '--input', '--ring', '--radius'
    ]
    commonVars.forEach(v => varNames.add(v))

    // 3. Risolve e appiattisce
    varNames.forEach(name => {
        const value = rootStyle.getPropertyValue(name).trim()
        if (value.includes('oklch')) {
            const hex = oklchToHex(value)
            newStyles.push(`${name}: ${hex} !important`)
        } else if (value && !value.includes('var(')) {
            // Opzionale: assicura che altre var siano portate se necessario
            newStyles.push(`${name}: ${value}`)
        }
    })

    // 4. Applica all'elemento html clonato
    if (newStyles.length > 0) {
        clonedDoc.documentElement.style.cssText += ';' + newStyles.join(';')
    }
}

/**
 * Applica ricorsivamente colori hex inline a un elemento
 */
const forceInlineHexColors = (element: HTMLElement): Map<HTMLElement, { [key: string]: string }> => {
    const originalStyles = new Map<HTMLElement, { [key: string]: string }>()

    const processElement = (el: HTMLElement) => {
        const computed = window.getComputedStyle(el)
        const originalInline: { [key: string]: string } = {}

        const colorProps = [
            'color', 'backgroundColor', 'borderColor',
            'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
            'outlineColor', 'fill', 'stroke', 'caretColor',
            'accentColor', 'columnRuleColor', 'textDecorationColor'
        ]

        colorProps.forEach(prop => {
            const cssPropName = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            const value = computed.getPropertyValue(cssPropName)

            // Controlla se il valore è oklch O usa una variabile che potrebbe essere oklch
            if (value && (value.includes('oklch') || value.startsWith('var('))) {
                originalInline[prop] = el.style.getPropertyValue(cssPropName)

                // Prova a risolvere il colore esatto
                let fallback = value
                if (value.includes('oklch')) {
                    fallback = oklchToHex(value)
                }
                // Se è ancora complesso, controlla le classi
                if (!fallback.startsWith('#') && !fallback.startsWith('rgb')) {
                    const className = el.getAttribute('class') || ''
                    for (const [key, hex] of Object.entries(colorMap)) {
                        if (className.includes(key)) {
                            fallback = hex
                            break
                        }
                    }
                }

                // Rete di sicurezza finale
                if (fallback.includes('oklch')) fallback = '#000000'

                // Fix per sfondi/bordi neri di default indesiderati
                if ((prop.includes('background') || prop.includes('border')) && fallback === '#000000' && !el.className.includes('black')) {
                    fallback = 'transparent'
                }

                el.style.setProperty(cssPropName, fallback, 'important')
            }
        })

        // Rimuove ombre che causano problemi
        const shadow = computed.boxShadow
        if (shadow && shadow.includes('oklch')) {
            originalInline['box-shadow'] = el.style.boxShadow
            el.style.boxShadow = 'none'
        }

        if (Object.keys(originalInline).length > 0) {
            originalStyles.set(el, originalInline)
        }
    }

    processElement(element)
    element.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) processElement(child)
    })

    return originalStyles
}

const restoreOriginalStyles = (originalStyles: Map<HTMLElement, { [key: string]: string }>) => {
    originalStyles.forEach((styles, el) => {
        Object.entries(styles).forEach(([prop, value]) => {
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            el.style.setProperty(cssProp, value || '')
        })
    })
}

interface GeneratePdfOptions {
    fileName?: string
    scale?: number
    orientation?: 'portrait' | 'landscape'
    margin?: number
    backgroundColor?: string
    onClone?: (doc: Document) => void
}

export const generatePdfFromElement = async (elementId: string, options: GeneratePdfOptions = {}) => {
    const {
        fileName = 'document.pdf',
        scale = 2,
        orientation = 'portrait',
        margin = 0,
        backgroundColor = '#ffffff', // Default più sicuro del nero oklch
        onClone
    } = options

    const element = document.getElementById(elementId)
    if (!element) {
        toast.error(`Elemento non trovato: ${elementId}`)
        return false
    }

    // 1. Forza stili inline sul DOM REALE (temporaneo)
    const originalStyles = forceInlineHexColors(element)

    try {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor: backgroundColor.includes('oklch') ? '#ffffff' : backgroundColor,
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
                // 2. CRITICO: Appiattisce tutte le variabili CSS in Hex sulla root clonata
                flattenCssVariables(clonedDoc)

                // 3. Pulisce i tag style
                replaceOklchInClonedDocument(clonedDoc)

                // 4. Ri-applica forzatura hex sugli elementi clonati per sicurezza
                const clonedElement = clonedDoc.getElementById(elementId)
                if (clonedElement) {
                    forceInlineHexColors(clonedElement)
                }

                if (onClone) onClone(clonedDoc)
            }
        })

        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4'
        })

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = pdfWidth - (margin * 2)
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        let heightLeft = imgHeight
        let position = margin

        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= (pdfHeight - margin * 2)

        while (heightLeft > 0) {
            position = heightLeft - imgHeight
            pdf.addPage()
            pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
            heightLeft -= (pdfHeight - margin * 2)
        }

        pdf.save(fileName)
        return true

    } catch (error) {
        console.error('Error generating PDF:', error)
        toast.error('Errore generazione PDF: Colori non supportati')
        return false
    } finally {
        restoreOriginalStyles(originalStyles)
    }
}