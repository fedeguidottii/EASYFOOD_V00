import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

// Color map for oklch replacement
const colorMap: Record<string, string> = {
    'zinc-50': '#fafafa', 'zinc-100': '#f4f4f5', 'zinc-200': '#e4e4e7',
    'zinc-300': '#d4d4d8', 'zinc-400': '#a1a1aa', 'zinc-500': '#71717a',
    'zinc-600': '#52525b', 'zinc-700': '#3f3f46', 'zinc-800': '#27272a',
    'zinc-900': '#18181b', 'zinc-950': '#09090b',
    'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706',
    'orange-500': '#f97316', 'red-500': '#ef4444', 'rose-500': '#f43f5e',
    'emerald-500': '#10b981', 'green-500': '#22c55e', 'blue-500': '#3b82f6',
    'white': '#ffffff', 'black': '#000000', 'transparent': 'transparent',
    'slate-50': '#f8fafc', 'slate-100': '#f1f5f9',
}

/**
 * Recursively applies inline hex colors to an element and all its children
 * This modifies the actual DOM temporarily to force html2canvas to use hex colors
 */
const forceInlineHexColors = (element: HTMLElement): Map<HTMLElement, { [key: string]: string }> => {
    const originalStyles = new Map<HTMLElement, { [key: string]: string }>()

    const processElement = (el: HTMLElement) => {
        const computed = window.getComputedStyle(el)
        const originalInline: { [key: string]: string } = {}

        // Properties that might contain oklch
        const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor',
            'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor',
            'fill', 'stroke', 'caretColor', 'textDecorationColor']

        colorProps.forEach(prop => {
            const value = computed.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase())
            if (value && value.includes('oklch')) {
                // Save original inline style
                originalInline[prop] = el.style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase())

                // Determine fallback color based on class names
                let fallback = '#000000'
                const className = typeof el.className === 'string' ? el.className : el.getAttribute('class') || ''

                // Find matching color from class name
                for (const [key, hex] of Object.entries(colorMap)) {
                    if (className.includes(key)) {
                        fallback = hex
                        break
                    }
                }

                // Special handling based on property
                if (prop.includes('background') && fallback === '#000000') fallback = 'transparent'
                if (prop.includes('border') && fallback === '#000000') fallback = 'transparent'
                if (prop === 'color' && !className.includes('text-')) fallback = '#ffffff'

                // Force inline style
                el.style.setProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase(), fallback, 'important')
            }
        })

        // Handle box-shadow
        const shadow = computed.getPropertyValue('box-shadow')
        if (shadow && shadow.includes('oklch')) {
            originalInline['box-shadow'] = el.style.getPropertyValue('box-shadow')
            el.style.setProperty('box-shadow', 'none', 'important')
        }

        // Handle caret-color
        const caret = computed.getPropertyValue('caret-color')
        if (caret && caret.includes('oklch')) {
            originalInline['caret-color'] = el.style.getPropertyValue('caret-color')
            el.style.setProperty('caret-color', 'auto', 'important')
        }

        if (Object.keys(originalInline).length > 0) {
            originalStyles.set(el, originalInline)
        }
    }

    // Process element and all children
    processElement(element)
    element.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement) {
            processElement(child)
        }
    })

    return originalStyles
}

/**
 * Restores original inline styles after PDF generation
 */
const restoreOriginalStyles = (originalStyles: Map<HTMLElement, { [key: string]: string }>) => {
    originalStyles.forEach((styles, el) => {
        Object.entries(styles).forEach(([prop, value]) => {
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            if (value) {
                el.style.setProperty(cssProp, value)
            } else {
                el.style.removeProperty(cssProp)
            }
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

/**
 * Generates a PDF from a specific HTML element ID
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

    // Force inline hex colors on the actual DOM before capture
    const originalStyles = forceInlineHexColors(element)

    try {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor,
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
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
        heightLeft -= (pdfHeight - (margin * 2))

        while (heightLeft > 0) {
            position = heightLeft - imgHeight
            pdf.addPage()
            pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
            heightLeft -= (pdfHeight - (margin * 2))
        }

        pdf.save(fileName)
        return true

    } catch (error) {
        console.error('Error generating PDF:', error)
        toast.error('Errore durante la generazione del PDF')
        return false
    } finally {
        // Always restore original styles
        restoreOriginalStyles(originalStyles)
    }
}
