// ============================================================
// Menu Theming System — Color Only
// Provides primary color tokens for CustomerMenu
// ============================================================

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

// ---- Theme object returned by getMenuTheme ----
export interface MenuTheme {
    // Primary color tokens
    primary: string
    primaryLight: string
    primaryDark: string
    primaryAlpha: (opacity: number) => string

    // Fixed dark style tokens
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

    // CSS custom property overrides for shadcn/ui components
    // Applied to document.body so portal dialogs also inherit theme
    cssVars: React.CSSProperties
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 245, g: 158, b: 11 }
}

// Fixed dark style tokens — no more style variants
const STYLE_TOKENS = {
    headerFont: 'system-ui, -apple-system, sans-serif',
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
} as const

export function getMenuTheme(colorHex: string = '#f59e0b'): MenuTheme {
    // Find color option or build one from hex
    const colorOpt = COLOR_OPTIONS.find(c => c.hex === colorHex) || {
        name: 'Custom',
        hex: colorHex,
        lightHex: colorHex,
        darkHex: colorHex,
    }

    const { r, g, b } = hexToRgb(colorOpt.hex)
    const primaryAlpha = (opacity: number) => `rgba(${r}, ${g}, ${b}, ${opacity})`

    return {
        primary: colorOpt.hex,
        primaryLight: colorOpt.lightHex,
        primaryDark: colorOpt.darkHex,
        primaryAlpha,
        ...STYLE_TOKENS,

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
            color: '#ffffff',
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

        // CSS custom property overrides — applied to document.body so ALL
        // nested shadcn/ui primitives (Dialog, Card, Button…) AND portals inherit theme
        cssVars: {
            '--background': STYLE_TOKENS.dialogBg,
            '--foreground': STYLE_TOKENS.textPrimary,
            '--card': STYLE_TOKENS.cardBg,
            '--card-foreground': STYLE_TOKENS.textPrimary,
            '--popover': STYLE_TOKENS.dialogBg,
            '--popover-foreground': STYLE_TOKENS.textPrimary,
            '--primary': colorOpt.hex,
            '--primary-foreground': '#000000',
            '--secondary': STYLE_TOKENS.cardBg,
            '--secondary-foreground': STYLE_TOKENS.textPrimary,
            '--muted': STYLE_TOKENS.inputBg,
            '--muted-foreground': STYLE_TOKENS.textMuted,
            '--accent': primaryAlpha(0.1),
            '--accent-foreground': colorOpt.hex,
            '--border': STYLE_TOKENS.cardBorder,
            '--input': STYLE_TOKENS.inputBorder,
            '--ring': colorOpt.hex,
            '--menu-primary': colorOpt.hex,
            '--menu-primary-light': colorOpt.lightHex,
            '--menu-primary-dark': colorOpt.darkHex,
            '--menu-primary-alpha20': primaryAlpha(0.2),
            '--menu-primary-alpha10': primaryAlpha(0.1),
            '--menu-primary-alpha50': primaryAlpha(0.5),
            '--menu-card-bg': STYLE_TOKENS.cardBg,
            '--menu-card-border': STYLE_TOKENS.cardBorder,
            '--menu-text-primary': STYLE_TOKENS.textPrimary,
            '--menu-text-secondary': STYLE_TOKENS.textSecondary,
            '--menu-text-muted': STYLE_TOKENS.textMuted,
            '--menu-input-bg': STYLE_TOKENS.inputBg,
            '--menu-dialog-bg': STYLE_TOKENS.dialogBg,
        } as React.CSSProperties,
    }
}
