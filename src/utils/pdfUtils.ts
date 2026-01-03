
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

/**
 * Helper function to fix oklch colors that html2canvas doesn't support
 * Iterates through all elements in the cloned document and replaces oklch colors
 * with fallback values (transparent for bg, inherit for text)
 */
export const fixOklchColors = (clonedDoc: Document) => {
    const allElements = clonedDoc.querySelectorAll('*')
    allElements.forEach(el => {
        // Check computed styles
        const computed = getComputedStyle(el)
        const props = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'outlineColor', 'fill', 'stroke']

        props.forEach(prop => {
            const value = computed.getPropertyValue(prop)
            if (value && value.includes('oklch')) {
                (el as HTMLElement).style.setProperty(prop, prop === 'backgroundColor' ? 'transparent' : 'inherit', 'important')
            }
        })

        // Check inline styles
        const style = (el as HTMLElement).style
        for (let i = 0; i < style.length; i++) {
            const propName = style[i]
            const value = style.getPropertyValue(propName)
            if (value && value.includes('oklch')) {
                style.setProperty(propName, 'transparent', 'important')
            }
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
