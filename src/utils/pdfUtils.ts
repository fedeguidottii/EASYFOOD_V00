import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

/**
 * Converte una stringa colore oklch in un hex di fallback basato sulla luminosità
 */
const oklchToHex = (oklchStr: string): string => {
    const match = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/)
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
 * Sostituisce TUTTE le occorrenze di oklch in una stringa
 */
const replaceAllOklch = (str: string): string => {
    return str.replace(/oklch\([^)]+\)/g, (match) => oklchToHex(match))
}

/**
 * APPROCCIO DEFINITIVO: Pulisce completamente il documento clonato da oklch
 * 1. Rimuove TUTTI i link ai fogli di stile esterni
 * 2. Sostituisce oklch in TUTTI i tag <style>
 * 3. Sostituisce oklch in TUTTI gli attributi style inline
 * MA preserva gli stili inline già presenti negli elementi
 */
const sanitizeClonedDocument = (clonedDoc: Document): void => {
    // 1. RIMUOVI COMPLETAMENTE tutti i fogli di stile esterni
    const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]')
    linkElements.forEach(link => link.remove())

    // 2. Pulisci TUTTI i tag <style> da oklch
    const styleElements = clonedDoc.querySelectorAll('style')
    styleElements.forEach(style => {
        if (style.textContent) {
            style.textContent = replaceAllOklch(style.textContent)
        }
    })

    // 3. Pulisci TUTTI gli elementi con attributo style contenente oklch
    const elementsWithStyle = clonedDoc.querySelectorAll('*[style]')
    elementsWithStyle.forEach(el => {
        const styleAttr = el.getAttribute('style')
        if (styleAttr && styleAttr.includes('oklch')) {
            el.setAttribute('style', replaceAllOklch(styleAttr))
        }
    })

    // 4. NON sovrascriviamo i colori esistenti - il template ha già stili inline corretti
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
        backgroundColor = '#09090b',
        onClone
    } = options

    const element = document.getElementById(elementId)
    if (!element) {
        toast.error(`Elemento non trovato: ${elementId}`)
        return false
    }

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
    }
}