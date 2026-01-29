import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

// Comprehensive color map for oklch replacement - includes all Tailwind colors
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
 * Converts an oklch color string to a fallback hex color
 * Parses the oklch values and maps to closest hex based on lightness
 */
const oklchToHex = (oklchStr: string): string => {
    // Parse oklch(L C H) or oklch(L C H / A)
    const match = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/)
    if (!match) return '#000000'

    let lightness = parseFloat(match[1])
    if (match[1].includes('%')) lightness = lightness / 100

    // Simple mapping based on lightness
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
 * Extracts all CSS custom properties (variables) from :root/:html and returns them with oklch converted to hex
 * This is THE KEY function - it reads all --* variables and converts any oklch values
 */
const extractAndCleanCssVariables = (): Record<string, string> => {
    const cleanedVariables: Record<string, string> = {}

    // Get computed style from document root (html element)
    const rootElement = document.documentElement
    const computedStyle = window.getComputedStyle(rootElement)

    // Get all stylesheets and extract CSS variable names
    const cssVariableNames = new Set<string>()

    // Method 1: Parse all stylesheets to find variable names
    try {
        for (const sheet of document.styleSheets) {
            try {
                const rules = sheet.cssRules || sheet.rules
                for (const rule of rules) {
                    if (rule instanceof CSSStyleRule) {
                        const cssText = rule.cssText
                        // Find all --variable-name patterns
                        const matches = cssText.matchAll(/--[\w-]+/g)
                        for (const match of matches) {
                            cssVariableNames.add(match[0])
                        }
                    }
                }
            } catch {
                // Cross-origin stylesheets will throw, ignore them
            }
        }
    } catch {
        // Fallback if stylesheet parsing fails
    }

    // Method 2: Also check common Tailwind/shadcn CSS variable names
    const commonVariables = [
        '--background', '--foreground', '--card', '--card-foreground',
        '--popover', '--popover-foreground', '--primary', '--primary-foreground',
        '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
        '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
        '--border', '--input', '--ring', '--radius',
        '--tw-ring-color', '--tw-ring-offset-color', '--tw-shadow-color',
        '--tw-border-opacity', '--tw-bg-opacity', '--tw-text-opacity',
        '--color-background', '--color-foreground', '--color-card', '--color-card-foreground',
        '--color-popover', '--color-popover-foreground', '--color-primary', '--color-primary-foreground',
        '--color-secondary', '--color-secondary-foreground', '--color-muted', '--color-muted-foreground',
        '--color-accent', '--color-accent-foreground', '--color-destructive', '--color-destructive-foreground',
        '--color-border', '--color-input', '--color-ring',
    ]
    commonVariables.forEach(v => cssVariableNames.add(v))

    // Now get the computed value of each variable and clean oklch
    for (const varName of cssVariableNames) {
        const value = computedStyle.getPropertyValue(varName).trim()
        if (value) {
            if (value.includes('oklch')) {
                // Convert oklch to hex
                cleanedVariables[varName] = value.replace(/oklch\([^)]+\)/g, (match) => oklchToHex(match))
            } else {
                // Keep original value
                cleanedVariables[varName] = value
            }
        }
    }

    return cleanedVariables
}

/**
 * Applies cleaned CSS variables to the cloned document's html element
 * This overrides all :root variables with hex-safe versions
 */
const applyCssVariablesToClonedDocument = (clonedDoc: Document, cleanedVariables: Record<string, string>): void => {
    const clonedHtml = clonedDoc.documentElement
    const clonedBody = clonedDoc.body

    // Build inline style string with all cleaned variables
    let inlineVars = ''
    for (const [varName, value] of Object.entries(cleanedVariables)) {
        inlineVars += `${varName}: ${value} !important; `
    }

    // Apply to html element
    if (clonedHtml) {
        const existingStyle = clonedHtml.getAttribute('style') || ''
        clonedHtml.setAttribute('style', existingStyle + inlineVars)
    }

    // Also apply to body for good measure
    if (clonedBody) {
        const existingStyle = clonedBody.getAttribute('style') || ''
        clonedBody.setAttribute('style', existingStyle + inlineVars)
    }
}

/**
 * Force replaces all oklch colors in a cloned document's stylesheets and inline styles
 */
const replaceOklchInClonedDocument = (doc: Document): void => {
    // Process all style elements - replace oklch in actual CSS text
    const styleElements = doc.querySelectorAll('style')
    styleElements.forEach(style => {
        if (style.textContent && style.textContent.includes('oklch')) {
            style.textContent = style.textContent.replace(
                /oklch\([^)]+\)/g,
                (match) => oklchToHex(match)
            )
        }
    })

    // Process all elements with inline styles containing oklch
    const allElements = doc.querySelectorAll('*')
    allElements.forEach(el => {
        if (el instanceof HTMLElement) {
            // Check inline style
            if (el.style.cssText.includes('oklch')) {
                el.style.cssText = el.style.cssText.replace(
                    /oklch\([^)]+\)/g,
                    (match) => oklchToHex(match)
                )
            }

            // Check style attribute directly
            const styleAttr = el.getAttribute('style')
            if (styleAttr && styleAttr.includes('oklch')) {
                el.setAttribute('style', styleAttr.replace(
                    /oklch\([^)]+\)/g,
                    (match) => oklchToHex(match)
                ))
            }
        }
    })
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

        // All CSS properties that might contain colors
        const colorProps = [
            'color', 'backgroundColor', 'borderColor',
            'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
            'outlineColor', 'fill', 'stroke', 'caretColor', 'textDecorationColor',
            'accentColor', 'columnRuleColor', 'textEmphasisColor', 'floodColor', 'lightingColor', 'stopColor'
        ]

        colorProps.forEach(prop => {
            const cssPropName = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
            const value = computed.getPropertyValue(cssPropName)
            if (value && value.includes('oklch')) {
                originalInline[prop] = el.style.getPropertyValue(cssPropName)

                let fallback = oklchToHex(value)

                const className = typeof el.className === 'string' ? el.className : el.getAttribute('class') || ''
                for (const [key, hex] of Object.entries(colorMap)) {
                    if (className.includes(key)) {
                        fallback = hex
                        break
                    }
                }

                if (prop.includes('background') && fallback === '#000000') fallback = 'transparent'
                if (prop.includes('border') && fallback === '#000000') fallback = 'transparent'
                if (prop === 'color' && fallback === '#000000' && !className.includes('text-')) fallback = '#e4e4e7'

                el.style.setProperty(cssPropName, fallback, 'important')
            }
        })

        // Handle box-shadow
        const shadow = computed.getPropertyValue('box-shadow')
        if (shadow && shadow.includes('oklch')) {
            originalInline['box-shadow'] = el.style.getPropertyValue('box-shadow')
            el.style.setProperty('box-shadow', 'none', 'important')
        }

        // Handle text-shadow
        const textShadow = computed.getPropertyValue('text-shadow')
        if (textShadow && textShadow.includes('oklch')) {
            originalInline['text-shadow'] = el.style.getPropertyValue('text-shadow')
            el.style.setProperty('text-shadow', 'none', 'important')
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

    // STEP 1: Extract and clean all CSS variables from original document BEFORE cloning
    const cleanedCssVariables = extractAndCleanCssVariables()

    // STEP 2: Force inline hex colors on the actual DOM before capture
    const originalStyles = forceInlineHexColors(element)

    try {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor,
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
                // STEP 3: Apply cleaned CSS variables to cloned document's :root
                // This is CRITICAL - it overrides all var(--*) that contain oklch
                applyCssVariablesToClonedDocument(clonedDoc, cleanedCssVariables)

                // STEP 4: Replace any remaining oklch in <style> elements
                replaceOklchInClonedDocument(clonedDoc)

                // STEP 5: Process all elements in the cloned doc for inline oklch
                const clonedElement = clonedDoc.getElementById(elementId)
                if (clonedElement) {
                    // Force inline hex on cloned element too
                    const processClonedElement = (el: HTMLElement) => {
                        const computed = clonedDoc.defaultView?.getComputedStyle(el)
                        if (!computed) return

                        const colorProps = [
                            'color', 'background-color', 'border-color',
                            'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
                            'outline-color', 'fill', 'stroke', 'caret-color', 'text-decoration-color'
                        ]

                        colorProps.forEach(prop => {
                            const value = computed.getPropertyValue(prop)
                            if (value && value.includes('oklch')) {
                                el.style.setProperty(prop, oklchToHex(value), 'important')
                            }
                        })

                        const shadow = computed.getPropertyValue('box-shadow')
                        if (shadow && shadow.includes('oklch')) {
                            el.style.setProperty('box-shadow', 'none', 'important')
                        }

                        const textShadow = computed.getPropertyValue('text-shadow')
                        if (textShadow && textShadow.includes('oklch')) {
                            el.style.setProperty('text-shadow', 'none', 'important')
                        }
                    }

                    processClonedElement(clonedElement)
                    clonedElement.querySelectorAll('*').forEach(child => {
                        if (child instanceof HTMLElement) {
                            processClonedElement(child)
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
        restoreOriginalStyles(originalStyles)
    }
}
