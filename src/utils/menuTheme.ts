// ============================================================
// Menu Theming System
// Provides style presets and primary color tokens for CustomerMenu
// ============================================================

export type MenuStyleKey = 'elegant' | 'friendly' | 'minimal' | 'bold'

export interface ColorOption {
    name: string
    hex: string
    lightHex: string   // lighter variant for hover / soft backgrounds
    darkHex: string    // darker variant for gradients
}

export const COLOR_OPTIONS: ColorOption[] = [
    { name: 'Amber', hex: '#f59e0b', lightHex: '#fbbf24', darkHex: '#d97706' },
    { name: 'Emerald', hex: '#10b981', lightHex: '#34d399', darkHex: '#059669' },
    { name: 'Sky', hex: '#0ea5e9', lightHex: '#38bdf8', darkHex: '#0284c7' },
    { name: 'Rose', hex: '#f43f5e', lightHex: '#fb7185', darkHex: '#e11d48' },
    { name: 'Violet', hex: '#8b5cf6', lightHex: '#a78bfa', darkHex: '#7c3aed' },
    { name: 'Orange', hex: '#f97316', lightHex: '#fb923c', darkHex: '#ea580c' },
    { name: 'Teal', hex: '#14b8a6', lightHex: '#2dd4bf', darkHex: '#0d9488' },
    { name: 'Fuchsia', hex: '#d946ef', lightHex: '#e879f9', darkHex: '#c026d3' },
]

export interface StylePreset {
    key: MenuStyleKey
    label: string
    description: string
}

export const STYLE_PRESETS: StylePreset[] = [
    { key: 'elegant', label: 'Elegante', description: 'Lusso scuro, font serif, vetro smerigliato' },
    { key: 'friendly', label: 'Amichevole', description: 'Caldo, arrotondato, accogliente' },
    { key: 'minimal', label: 'Minimale', description: 'Ultra-pulito, moderno, leggero' },
    { key: 'bold', label: 'Vivace', description: 'Alto contrasto, forte, audace' },
]

// ---- Theme object returned by getMenuTheme ----
export interface MenuTheme {
    // Primary color tokens
    primary: string
    primaryLight: string
    primaryDark: string
    primaryAlpha: (opacity: number) => string

    // Style-dependent tokens
    headerFont: string
    bodyFont: string
    pageBg: string
    pageBgGradient: string
    cardBg: string
    cardBorder: string
    cardRadius: string
    cardShadow: string
    headerBg: string
    dialogBg: string
    dialogBorder: string
    inputBg: string
    inputBorder: string
    inputFocusBorder: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    divider: string
    badgeRadius: string
    buttonRadius: string

    // Computed style helpers (inline style objects)
    primaryColorStyle: React.CSSProperties
    primaryBorderStyle: React.CSSProperties
    primaryBgStyle: React.CSSProperties
    primaryGradientStyle: React.CSSProperties
    categoryActiveStyle: React.CSSProperties
    categoryInactiveHoverBorderStyle: React.CSSProperties
    floatingCartStyle: React.CSSProperties
    ctaButtonStyle: React.CSSProperties
    pinActiveStyle: React.CSSProperties
    accentTextStyle: React.CSSProperties
    accentBorderStyle: React.CSSProperties
    spinnerBorderStyle: React.CSSProperties
    fabStyle: React.CSSProperties
    fabHoverStyle: React.CSSProperties
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 245, g: 158, b: 11 }
}

export function getMenuTheme(
    style: MenuStyleKey = 'elegant',
    colorHex: string = '#f59e0b'
): MenuTheme {
    // Find color option or build one from hex
    const colorOpt = COLOR_OPTIONS.find(c => c.hex === colorHex) || {
        name: 'Custom',
        hex: colorHex,
        lightHex: colorHex,
        darkHex: colorHex,
    }

    const { r, g, b } = hexToRgb(colorOpt.hex)
    const primaryAlpha = (opacity: number) => `rgba(${r}, ${g}, ${b}, ${opacity})`

    // Style-dependent base tokens
    const styleTokens = getStyleTokens(style)

    return {
        primary: colorOpt.hex,
        primaryLight: colorOpt.lightHex,
        primaryDark: colorOpt.darkHex,
        primaryAlpha,
        ...styleTokens,

        // Computed inline styles
        primaryColorStyle: { color: colorOpt.hex },
        primaryBorderStyle: { borderColor: primaryAlpha(0.2) },
        primaryBgStyle: { backgroundColor: primaryAlpha(0.1) },
        primaryGradientStyle: {
            background: `linear-gradient(to right, ${colorOpt.hex}, ${colorOpt.darkHex})`,
        },
        categoryActiveStyle: {
            backgroundColor: colorOpt.hex,
            color: '#000000',
            borderColor: colorOpt.hex,
            boxShadow: `0 10px 15px -3px ${primaryAlpha(0.2)}`,
        },
        categoryInactiveHoverBorderStyle: {
            borderColor: primaryAlpha(0.3),
        },
        floatingCartStyle: {
            background: `linear-gradient(to right, ${colorOpt.hex}, ${colorOpt.darkHex})`,
            boxShadow: `0 25px 50px -12px ${primaryAlpha(0.4)}`,
        },
        ctaButtonStyle: {
            backgroundColor: colorOpt.hex,
            color: '#000000',
            boxShadow: `0 10px 15px -3px ${primaryAlpha(0.2)}`,
        },
        pinActiveStyle: {
            borderColor: colorOpt.hex,
            color: '#ffffff',
        },
        accentTextStyle: {
            color: colorOpt.hex,
        },
        accentBorderStyle: {
            borderColor: primaryAlpha(0.2),
        },
        spinnerBorderStyle: {
            borderColor: colorOpt.hex,
            borderTopColor: 'transparent',
        },
        fabStyle: {
            backgroundColor: '#18181b',
            borderColor: primaryAlpha(0.5),
            color: colorOpt.hex,
        },
        fabHoverStyle: {
            backgroundColor: colorOpt.hex,
            borderColor: colorOpt.hex,
            color: '#ffffff',
        },
    }
}

interface StyleTokens {
    headerFont: string
    bodyFont: string
    pageBg: string
    pageBgGradient: string
    cardBg: string
    cardBorder: string
    cardRadius: string
    cardShadow: string
    headerBg: string
    dialogBg: string
    dialogBorder: string
    inputBg: string
    inputBorder: string
    inputFocusBorder: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    divider: string
    badgeRadius: string
    buttonRadius: string
}

function getStyleTokens(style: MenuStyleKey): StyleTokens {
    switch (style) {
        case 'elegant':
            return {
                headerFont: 'Georgia, "Times New Roman", serif',
                bodyFont: 'system-ui, -apple-system, sans-serif',
                pageBg: '#09090b',
                pageBgGradient: 'linear-gradient(to bottom, #09090b, #171717, #18181b)',
                cardBg: 'rgba(24, 24, 27, 0.9)',
                cardBorder: 'rgba(255, 255, 255, 0.06)',
                cardRadius: '12px',
                cardShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                headerBg: 'rgba(9, 9, 11, 0.9)',
                dialogBg: '#09090b',
                dialogBorder: 'rgba(255, 255, 255, 0.06)',
                inputBg: 'rgba(24, 24, 27, 0.5)',
                inputBorder: 'rgba(255, 255, 255, 0.1)',
                inputFocusBorder: 'rgba(255, 255, 255, 0.3)',
                textPrimary: '#ffffff',
                textSecondary: '#a1a1aa',
                textMuted: '#52525b',
                divider: 'rgba(255, 255, 255, 0.05)',
                badgeRadius: '9999px',
                buttonRadius: '12px',
            }
        case 'friendly':
            return {
                headerFont: '"Nunito", "Segoe UI", system-ui, sans-serif',
                bodyFont: '"Nunito", "Segoe UI", system-ui, sans-serif',
                pageBg: '#0c0a09',
                pageBgGradient: 'linear-gradient(to bottom, #0c0a09, #1c1917, #1c1917)',
                cardBg: 'rgba(28, 25, 23, 0.95)',
                cardBorder: 'rgba(255, 255, 255, 0.08)',
                cardRadius: '16px',
                cardShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
                headerBg: 'rgba(12, 10, 9, 0.95)',
                dialogBg: '#1c1917',
                dialogBorder: 'rgba(255, 255, 255, 0.08)',
                inputBg: 'rgba(28, 25, 23, 0.6)',
                inputBorder: 'rgba(255, 255, 255, 0.12)',
                inputFocusBorder: 'rgba(255, 255, 255, 0.3)',
                textPrimary: '#fafaf9',
                textSecondary: '#a8a29e',
                textMuted: '#57534e',
                divider: 'rgba(255, 255, 255, 0.06)',
                badgeRadius: '9999px',
                buttonRadius: '16px',
            }
        case 'minimal':
            return {
                headerFont: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
                bodyFont: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
                pageBg: '#0a0a0a',
                pageBgGradient: '#0a0a0a',
                cardBg: 'rgba(23, 23, 23, 0.8)',
                cardBorder: 'rgba(255, 255, 255, 0.04)',
                cardRadius: '8px',
                cardShadow: 'none',
                headerBg: 'rgba(10, 10, 10, 0.95)',
                dialogBg: '#0a0a0a',
                dialogBorder: 'rgba(255, 255, 255, 0.06)',
                inputBg: 'rgba(23, 23, 23, 0.5)',
                inputBorder: 'rgba(255, 255, 255, 0.08)',
                inputFocusBorder: 'rgba(255, 255, 255, 0.2)',
                textPrimary: '#fafafa',
                textSecondary: '#a3a3a3',
                textMuted: '#525252',
                divider: 'rgba(255, 255, 255, 0.04)',
                badgeRadius: '6px',
                buttonRadius: '8px',
            }
        case 'bold':
            return {
                headerFont: '"Inter", system-ui, -apple-system, sans-serif',
                bodyFont: '"Inter", system-ui, -apple-system, sans-serif',
                pageBg: '#030712',
                pageBgGradient: 'linear-gradient(to bottom, #030712, #111827, #030712)',
                cardBg: 'rgba(17, 24, 39, 0.95)',
                cardBorder: 'rgba(255, 255, 255, 0.1)',
                cardRadius: '12px',
                cardShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
                headerBg: 'rgba(3, 7, 18, 0.95)',
                dialogBg: '#111827',
                dialogBorder: 'rgba(255, 255, 255, 0.1)',
                inputBg: 'rgba(17, 24, 39, 0.6)',
                inputBorder: 'rgba(255, 255, 255, 0.15)',
                inputFocusBorder: 'rgba(255, 255, 255, 0.4)',
                textPrimary: '#f9fafb',
                textSecondary: '#9ca3af',
                textMuted: '#4b5563',
                divider: 'rgba(255, 255, 255, 0.08)',
                badgeRadius: '8px',
                buttonRadius: '12px',
            }
    }
}
