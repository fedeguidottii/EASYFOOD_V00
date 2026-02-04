import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

/**
 * Converte una stringa colore oklch in un hex di fallback basato sulla luminosità
 */
/**
 * Converte una stringa colore oklch/oklab in un hex di fallback basato sulla luminosità
 */
const colorFunctionToHex = (colorStr: string): string => {
    // Gestisce sia oklch(...) che oklab(...)
    const match = colorStr.match(/okl(?:ch|ab)\(\s*([\d.]+%?)\s+/)
    if (!match) return '#71717a'

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
 * Sostituisce TUTTE le occorrenze di oklch/oklab in una stringa
 */
const replaceAllUnsupportedColors = (str: string): string => {
    return str.replace(/okl(?:ch|ab)\([^)]+\)/g, (match) => colorFunctionToHex(match))
}

/**
 * APPROCCIO DEFINITIVO: Pulisce completamente il documento clonato da oklch/oklab
 * 1. Rimuove TUTTI i link ai fogli di stile esterni
 * 2. Sostituisce oklch/oklab in TUTTI i tag <style>
 * 3. Sostituisce oklch/oklab in TUTTI gli attributi style inline
 * MA preserva gli stili inline già presenti negli elementi
 */
const sanitizeClonedDocument = (clonedDoc: Document): void => {
    // 1. RIMUOVI COMPLETAMENTE tutti i fogli di stile esterni
    const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]')
    linkElements.forEach(link => link.remove())

    // 2. Pulisci TUTTI i tag <style> da oklch/oklab
    const styleElements = clonedDoc.querySelectorAll('style')
    styleElements.forEach(style => {
        if (style.textContent) {
            style.textContent = replaceAllUnsupportedColors(style.textContent)
        }
    })

    // 3. Pulisci TUTTI gli elementi con attributo style contenente oklch/oklab
    const elementsWithStyle = clonedDoc.querySelectorAll('*[style]')
    elementsWithStyle.forEach(el => {
        const styleAttr = el.getAttribute('style')
        if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
            el.setAttribute('style', replaceAllUnsupportedColors(styleAttr))
        }
    })

    // 4. Inject basic CSS reset to ensure layout works without external stylesheets
    // FORCE LIGHT THEME FOR ALL PDFS
    const resetStyle = clonedDoc.createElement('style')
    resetStyle.innerHTML = `
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background-color: #ffffff; color: #000000; }
        img { display: block; max-width: 100%; }
    `
    clonedDoc.head.appendChild(resetStyle)
}

/**
 * Pre-processa l'elemento originale per convertire colori oklab/oklch in hex inline
 * Restituisce una funzione per ripristinare gli stili originali
 */
const preProcessElementColors = (element: HTMLElement): (() => void) => {
    const originalStyles: { el: HTMLElement, style: string }[] = []

    const process = (el: HTMLElement) => {
        const style = el.getAttribute('style')
        if (style && (style.includes('oklch') || style.includes('oklab'))) {
            originalStyles.push({ el, style })
            el.setAttribute('style', replaceAllUnsupportedColors(style))
        }
    }

    process(element)
    element.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) process(child)
    })

    return () => {
        originalStyles.forEach(({ el, style }) => {
            el.setAttribute('style', style)
        })
    }
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
        backgroundColor = '#ffffff', // Default Light Theme
        onClone
    } = options

    const element = document.getElementById(elementId)
    if (!element) {
        toast.error(`Elemento non trovato: ${elementId}`)
        return false
    }

    // Pre-process colors to avoid html2canvas parsing errors
    const restoreColors = preProcessElementColors(element)

    try {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor,
            logging: false,
            allowTaint: true,
            // Ignora elementi che potrebbero causare problemi
            ignoreElements: (el) => {
                // Ignora link ai fogli di stile
                if (el.tagName === 'LINK' && el.getAttribute('rel') === 'stylesheet') {
                    return true
                }
                return false
            },
            onclone: (clonedDoc) => {
                // PULISCI COMPLETAMENTE il documento da oklch
                sanitizeClonedDocument(clonedDoc)

                // SMART PAGE BREAKS
                const mmToPx = 3.7795275591 // 1mm = ~3.78px a 96dpi (standard browser)
                // Usiamo un'altezza pagina leggermente ridotta per sicurezza (es. 290mm invece di 297mm) 
                // per tenere conto di margini di errore rendering
                // FIX: Non moltiplicare per scale, perché getBoundingClientRect restituisce dimensioni CSS (1x)
                const pageHeightPx = (297 - (margin * 2)) * mmToPx

                // ASSICURA VISIBILITÀ: Riporta l'elemento nel viewport del clone
                const clonedElement = clonedDoc.getElementById(elementId)
                if (clonedElement) {
                    clonedElement.style.display = 'block'
                    clonedElement.style.visibility = 'visible'
                    clonedElement.style.position = 'absolute'
                    clonedElement.style.left = '0'
                    clonedElement.style.top = '0'
                    clonedElement.style.zIndex = '9999'

                    // Logica per evitare il taglio dei contenuti
                    const items = clonedElement.querySelectorAll('.break-inside-avoid')

                    // Get the container's position to calculate relative offsets
                    const containerRect = clonedElement.getBoundingClientRect()
                    const containerTop = containerRect.top

                    items.forEach((item) => {
                        if (item instanceof HTMLElement) {
                            const rect = item.getBoundingClientRect()
                            // Posizione RELATIVA al contenitore
                            const itemTop = rect.top - containerTop
                            const itemBottom = rect.bottom - containerTop
                            const itemHeight = rect.height

                            // Calcola in quale pagina cade l'inizio e la fine dell'elemento
                            const startPage = Math.floor(itemTop / pageHeightPx)
                            const endPage = Math.floor(itemBottom / pageHeightPx)

                            if (startPage !== endPage) {
                                // L'elemento attraversa un'interruzione di pagina
                                // Calcola quanto spazio manca alla fine della pagina corrente
                                const spaceRemainingOnPage = ((startPage + 1) * pageHeightPx) - itemTop

                                // Aggiungi spacer PRIMA dell'elemento per spingerlo nella pagina successiva
                                const spacer = document.createElement('div')
                                spacer.style.height = `${spaceRemainingOnPage + 5}px`
                                spacer.style.display = 'block'
                                spacer.style.width = '100%'
                                spacer.style.gridColumn = '1 / -1' // Full width in Grid
                                spacer.style.visibility = 'hidden'
                                item.parentElement?.insertBefore(spacer, item)
                            }
                        }
                    })
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

        while (heightLeft > 5) { // Threshold increased to 5mm to avoid blank pages with tiny artifacts
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
        restoreColors()
    }
}