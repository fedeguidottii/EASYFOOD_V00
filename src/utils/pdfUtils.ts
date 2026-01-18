
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

/**
 * Helper function to fix oklch colors that html2canvas doesn't support
 * Iterates through all elements in the cloned document and replaces oklch colors
 * with fallback values (transparent for bg, inherit for text)
 */
// Helper to map simplified oklch/variable colors to hex for PDF safety
const colorMap: Record<string, string> = {
    'amber-500': '#f59e0b',
    'amber-400': '#fbbf24',
    'amber-600': '#d97706',
    'zinc-950': '#09090b',
    'zinc-900': '#18181b',
    'zinc-800': '#27272a',
    'zinc-700': '#3f3f46',
    'zinc-500': '#71717a',
    'zinc-400': '#a1a1aa',
    'zinc-100': '#f4f4f5',
    'white': '#ffffff',
    'black': '#000000',
    'emerald-500': '#10b981',
    'rose-500': '#f43f5e',
    'transparent': 'transparent'
}

/**
 * Helper function to fix oklch colors that html2canvas doesn't support
 * Iterates through all elements in the cloned document and replaces oklch colors
 * with fallback hex values
 */
export const fixOklchColors = (clonedDoc: Document) => {
    const allElements = clonedDoc.querySelectorAll('*')
    allElements.forEach(el => {
        const style = (el as HTMLElement).style

        // Helper to replace oklch in a specific property
        const replaceColor = (prop: string) => {
            const val = style.getPropertyValue(prop)
            if (val && (val.includes('oklch') || val.startsWith('var('))) {
                // Heuristic: try to find common color names in classNames or style to guess the fallback
                // This is a rough fallback for oklch issues
                let fallback = '#000000' // default text

                if (prop === 'color') {
                    fallback = '#ffffff' // assume light text on dark bg usually
                    if (el.className.includes('zinc-400')) fallback = colorMap['zinc-400']
                    if (el.className.includes('zinc-500')) fallback = colorMap['zinc-500']
                    if (el.className.includes('amber')) fallback = colorMap['amber-500']
                    if (el.className.includes('black')) fallback = '#000000'
                } else if (prop.includes('background')) {
                    fallback = 'transparent' // safe default for bg
                    if (el.className.includes('zinc-950')) fallback = colorMap['zinc-950']
                    if (el.className.includes('zinc-900')) fallback = colorMap['zinc-900']
                    if (el.className.includes('zinc-800')) fallback = colorMap['zinc-800']
                    if (el.className.includes('amber')) fallback = colorMap['amber-500']
                    if (el.className.includes('emerald')) fallback = colorMap['emerald-500']
                    if (el.className.includes('rose')) fallback = colorMap['rose-500']
                    if (el.className.includes('white')) fallback = '#ffffff'
                } else if (prop.includes('border')) {
                    fallback = 'transparent'
                    if (el.className.includes('zinc-800')) fallback = colorMap['zinc-800']
                    if (el.className.includes('amber')) fallback = colorMap['amber-500']
                }

                style.setProperty(prop, fallback, 'important')
            }
        }

        ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach(replaceColor)
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
 * Generates a PDF from a specific HTML element ID
 */
export const generatePdfFromElement = async (elementId: string, options: GeneratePdfOptions = {}) => {
    const {
        fileName = 'document.pdf',
        scale = 2,
        orientation = 'portrait',
        margin = 0, // Default no margin for full screenshot effect
        backgroundColor = '#09090b', // Zinc 950 default
        onClone
    } = options

    const element = document.getElementById(elementId)
    if (!element) {
        toast.error(`Elemento non trovato: ${elementId}`)
        return false
    }

    // Clone handling for visibility
    const originalDisplay = element.style.display
    // Ensure it's visible if hidden (though typically we capture visible elements)
    // element.style.display = 'block' 

    try {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor,
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
                fixOklchColors(clonedDoc)
                if (onClone) onClone(clonedDoc)
            }
        })

        // Restore original display if changed
        // element.style.display = originalDisplay

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

        // Handle pagination if image is taller than page
        let heightLeft = imgHeight
        let position = margin

        // First page
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= (pdfHeight - (margin * 2))

        // Subsequent pages
        while (heightLeft > 0) {
            position = heightLeft - imgHeight // shift up
            pdf.addPage()
            pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
            heightLeft -= (pdfHeight - (margin * 2))
        }

        // For single page fit (if preferred for dashboards):
        // if (imgHeight <= pdfHeight) {
        //   pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight)
        // } else {
        //   // See above for multi-page loop
        // }

        pdf.save(fileName)
        return true

    } catch (error) {
        console.error('Error generating PDF:', error)
        toast.error('Errore durante la generazione del PDF')
        return false
    }
}
