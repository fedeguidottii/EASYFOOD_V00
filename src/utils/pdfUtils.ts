import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

/**
 * Injects a CSS stylesheet that overrides Tailwind's oklch colors with hex equivalents.
 * This must run BEFORE html2canvas to prevent parsing errors.
 */
const injectPdfSafeStyles = (): HTMLStyleElement => {
    const style = document.createElement('style')
    style.id = 'pdf-safe-colors'
    style.textContent = `
        /* PDF-safe color overrides - replaces oklch with hex */
        * {
            --tw-ring-color: #fb923c !important;
            --tw-border-opacity: 1 !important;
        }

        /* Force all text colors to hex */
        [class*="text-zinc-50"], [class*="text-white"] { color: #fafafa !important; }
        [class*="text-zinc-100"] { color: #f4f4f5 !important; }
        [class*="text-zinc-200"] { color: #e4e4e7 !important; }
        [class*="text-zinc-300"] { color: #d4d4d8 !important; }
        [class*="text-zinc-400"] { color: #a1a1aa !important; }
        [class*="text-zinc-500"] { color: #71717a !important; }
        [class*="text-zinc-600"] { color: #52525b !important; }
        [class*="text-zinc-700"] { color: #3f3f46 !important; }
        [class*="text-zinc-800"] { color: #27272a !important; }
        [class*="text-zinc-900"] { color: #18181b !important; }
        [class*="text-zinc-950"] { color: #09090b !important; }
        [class*="text-black"] { color: #000000 !important; }
        [class*="text-amber"] { color: #f59e0b !important; }
        [class*="text-orange"] { color: #f97316 !important; }
        [class*="text-red"], [class*="text-rose"] { color: #f43f5e !important; }
        [class*="text-green"], [class*="text-emerald"] { color: #10b981 !important; }
        [class*="text-blue"] { color: #3b82f6 !important; }
        [class*="text-slate-50"] { color: #f8fafc !important; }

        /* Force all background colors to hex */
        [class*="bg-zinc-50"], [class*="bg-white"] { background-color: #fafafa !important; }
        [class*="bg-zinc-100"] { background-color: #f4f4f5 !important; }
        [class*="bg-zinc-200"] { background-color: #e4e4e7 !important; }
        [class*="bg-zinc-800"] { background-color: #27272a !important; }
        [class*="bg-zinc-900"] { background-color: #18181b !important; }
        [class*="bg-zinc-950"] { background-color: #09090b !important; }
        [class*="bg-black"] { background-color: #000000 !important; }
        [class*="bg-amber"] { background-color: #f59e0b !important; }
        [class*="bg-orange"] { background-color: #f97316 !important; }
        [class*="bg-red"], [class*="bg-rose"] { background-color: #f43f5e !important; }
        [class*="bg-green"], [class*="bg-emerald"] { background-color: #10b981 !important; }
        [class*="bg-gradient"] { background-image: none !important; background-color: #09090b !important; }

        /* Force all border colors to hex */
        [class*="border-zinc-700"] { border-color: #3f3f46 !important; }
        [class*="border-zinc-800"] { border-color: #27272a !important; }
        [class*="border-zinc-900"] { border-color: #18181b !important; }
        [class*="border-amber"] { border-color: #f59e0b !important; }
        [class*="border-white"] { border-color: #ffffff !important; }
        [class*="border-transparent"] { border-color: transparent !important; }
        
        /* Force ring colors */
        [class*="ring-amber"] { --tw-ring-color: #f59e0b !important; }
        [class*="ring-zinc"] { --tw-ring-color: #3f3f46 !important; }
        
        /* Fix SVG fills and strokes */
        svg [class*="fill-"] { fill: currentColor !important; }
        svg [class*="stroke-"] { stroke: currentColor !important; }
        [class*="fill-amber"] { fill: #f59e0b !important; }
        [class*="fill-zinc"] { fill: #71717a !important; }
        [class*="fill-white"] { fill: #ffffff !important; }
        [class*="fill-current"] { fill: currentColor !important; }
        
        /* Shadow overrides - remove complex shadows that may use oklch */
        [class*="shadow"] { 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1) !important; 
        }
        
        /* Disable backdrop-filter which can cause issues */
        [class*="backdrop"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    `
    document.head.appendChild(style)
    return style
}

const removePdfSafeStyles = (style: HTMLStyleElement) => {
    if (style && style.parentNode) {
        style.parentNode.removeChild(style)
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

    // Inject PDF-safe styles BEFORE html2canvas runs
    const injectedStyle = injectPdfSafeStyles()

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
        // Always remove injected styles
        removePdfSafeStyles(injectedStyle)
    }
}
