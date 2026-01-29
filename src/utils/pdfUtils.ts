import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

/**
 * Converte una stringa colore oklch in un hex di fallback
 * Basato sulla luminosità del colore oklch
 */
const oklchToHex = (oklchStr: string): string => {
    const match = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/)
    if (!match) return '#71717a' // Fallback grigio neutro

    let lightness = parseFloat(match[1])
    if (match[1].includes('%')) lightness = lightness / 100

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
 * Sostituisce tutte le occorrenze di oklch in una stringa CSS
 */
const replaceOklchInCss = (css: string): string => {
    return css.replace(/oklch\([^)]+\)/g, (match) => oklchToHex(match))
}

/**
 * APPROCCIO NUCLEARE: Rimuove TUTTI i fogli di stile dal documento clonato
 * e inietta stili inline calcolati su ogni singolo elemento.
 * Questo bypassa completamente il parser di colori di html2canvas.
 */
const inlineAllStyles = (clonedDoc: Document, elementId: string): void => {
    const clonedElement = clonedDoc.getElementById(elementId)
    if (!clonedElement) return

    // 1. RIMUOVI tutti i tag <style> che contengono oklch
    const styleElements = clonedDoc.querySelectorAll('style')
    styleElements.forEach(style => {
        if (style.textContent && style.textContent.includes('oklch')) {
            // Sostituisci oklch invece di rimuovere completamente
            style.textContent = replaceOklchInCss(style.textContent)
        }
    })

    // 2. RIMUOVI tutti i <link rel="stylesheet"> (fogli esterni che potrebbero contenere oklch)
    const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]')
    linkElements.forEach(link => {
        link.remove()
    })

    // 3. Crea un nuovo foglio di stile master con TUTTI gli stili risolti
    const masterStyle = clonedDoc.createElement('style')
    masterStyle.id = 'pdf-master-styles'

    // Ottieni le variabili CSS risolte dal documento originale
    const rootStyle = getComputedStyle(document.documentElement)
    const cssVars: string[] = []

    // Lista estesa di variabili CSS comuni
    const varList = [
        '--background', '--foreground', '--card', '--card-foreground',
        '--popover', '--popover-foreground', '--primary', '--primary-foreground',
        '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
        '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
        '--border', '--input', '--ring', '--radius',
        '--color-background', '--color-foreground', '--color-primary', '--color-primary-foreground',
        '--color-card', '--color-card-foreground', '--color-muted', '--color-muted-foreground',
        '--color-accent', '--color-accent-foreground', '--color-border', '--color-ring',
    ]

    varList.forEach(varName => {
        let value = rootStyle.getPropertyValue(varName).trim()
        if (value) {
            if (value.includes('oklch')) {
                value = oklchToHex(value)
            }
            cssVars.push(`${varName}: ${value}`)
        }
    })

    // Aggiungi override per :root
    masterStyle.textContent = `:root, html, body { ${cssVars.join('; ')} !important; }`
    clonedDoc.head.appendChild(masterStyle)

    // 4. Applica stili inline a TUTTI gli elementi nell'area da esportare
    const processElement = (el: HTMLElement) => {
        try {
            const computed = window.getComputedStyle(el)
            const inlineStyles: string[] = []

            // Proprietà di colore da forzare inline
            const colorProps = [
                'color', 'background-color', 'background',
                'border-color', 'border-top-color', 'border-right-color',
                'border-bottom-color', 'border-left-color',
                'outline-color', 'text-decoration-color'
            ]

            colorProps.forEach(prop => {
                let value = computed.getPropertyValue(prop)
                if (value && value !== 'none' && value !== 'transparent') {
                    if (value.includes('oklch')) {
                        value = replaceOklchInCss(value)
                    }
                    // Evita di sovrascrivere con valori problematici
                    if (!value.includes('oklch') && !value.includes('var(')) {
                        inlineStyles.push(`${prop}: ${value}`)
                    }
                }
            })

            // Rimuovi box-shadow se contiene oklch
            const boxShadow = computed.getPropertyValue('box-shadow')
            if (boxShadow && boxShadow.includes('oklch')) {
                inlineStyles.push('box-shadow: none')
            }

            // Rimuovi text-shadow se contiene oklch
            const textShadow = computed.getPropertyValue('text-shadow')
            if (textShadow && textShadow.includes('oklch')) {
                inlineStyles.push('text-shadow: none')
            }

            // Applica stili inline
            if (inlineStyles.length > 0) {
                const currentStyle = el.getAttribute('style') || ''
                // Pulisci eventuali oklch già presenti nello style inline
                const cleanedCurrent = replaceOklchInCss(currentStyle)
                el.setAttribute('style', cleanedCurrent + '; ' + inlineStyles.join('; '))
            }
        } catch (e) {
            // Ignora errori su elementi problematici
        }
    }

    // Processa l'elemento principale e tutti i figli
    processElement(clonedElement)
    clonedElement.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) {
            processElement(child)
        }
    })
}

/**
 * Pre-processa il DOM originale per forzare stili inline hex
 * Restituisce una mappa per ripristinare gli stili originali dopo
 */
const preProcessOriginalDom = (element: HTMLElement): Map<HTMLElement, string> => {
    const originalStyles = new Map<HTMLElement, string>()

    const processElement = (el: HTMLElement) => {
        const computed = window.getComputedStyle(el)
        const originalStyle = el.getAttribute('style') || ''
        let modified = false
        const newStyles: string[] = []

        // Proprietà colore
        const colorProps = ['color', 'background-color', 'border-color']
        colorProps.forEach(prop => {
            const value = computed.getPropertyValue(prop)
            if (value && value.includes('oklch')) {
                newStyles.push(`${prop}: ${oklchToHex(value)} !important`)
                modified = true
            }
        })

        // Box shadow
        if (computed.boxShadow && computed.boxShadow.includes('oklch')) {
            newStyles.push('box-shadow: none !important')
            modified = true
        }

        if (modified) {
            originalStyles.set(el, originalStyle)
            el.setAttribute('style', originalStyle + '; ' + newStyles.join('; '))
        }
    }

    processElement(element)
    element.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) {
            processElement(child)
        }
    })

    return originalStyles
}

/**
 * Ripristina gli stili originali
 */
const restoreOriginalStyles = (originalStyles: Map<HTMLElement, string>) => {
    originalStyles.forEach((style, el) => {
        if (style) {
            el.setAttribute('style', style)
        } else {
            el.removeAttribute('style')
        }
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

/**
 * Genera un PDF da un elemento HTML specifico
 */
export const generatePdfFromElement = async (elementId: string, options: GeneratePdfOptions = {}) => {
    const {
        fileName = 'document.pdf',
        scale = 2,
        orientation = 'portrait',
        margin = 0,
        backgroundColor = '#09090b',
        onClone
    } = options

    const element = document.getElementById(elementId)
    if (!element) {
        toast.error(`Elemento non trovato: ${elementId}`)
        return false
    }

    // Pre-processa il DOM originale
    const originalStyles = preProcessOriginalDom(element)

    try {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor: backgroundColor.includes('oklch') ? '#09090b' : backgroundColor,
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
                // APPROCCIO NUCLEARE: inline tutti gli stili e rimuovi fogli problematici
                inlineAllStyles(clonedDoc, elementId)

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
        toast.error('Errore generazione PDF')
        return false
    } finally {
        restoreOriginalStyles(originalStyles)
    }
}