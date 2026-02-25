import React from 'react'
import { ForkKnife, CookingPot } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface DishPlaceholderProps {
    className?: string
    iconSize?: number
    variant?: 'default' | 'pot' | 'fork'
    // Optional theme color overrides for customer menu
    bgColor?: string
    gradientFrom?: string
    accentGlow?: string
    iconColor?: string
    borderColor?: string
}

export function DishPlaceholder({
    className,
    iconSize = 40,
    variant = 'default',
    bgColor,
    gradientFrom,
    accentGlow,
    iconColor,
    borderColor,
}: DishPlaceholderProps) {
    const bg = bgColor || 'rgb(24,24,27)'
    const gFrom = gradientFrom || 'rgba(39,39,42,0.8)'
    const glow = accentGlow || 'rgba(245,158,11,0.1)'
    const icon = iconColor || 'rgb(82,82,91)'
    const border = borderColor || 'rgba(255,255,255,0.05)'

    return (
        <div
            className={cn("w-full h-full flex items-center justify-center relative overflow-hidden", className)}
            style={{ backgroundColor: bg }}
        >
            {/* Elegant Background Gradient */}
            <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(to bottom right, ${gFrom}, ${bg}, rgba(0,0,0,0.8))` }}
            />

            {/* Subtle Noise Texture for Premium Feel */}
            <div className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Central Icon container with subtle glow */}
            <div className="relative z-10 flex items-center justify-center">
                <div
                    className="absolute inset-0 blur-[20px] rounded-full transform scale-150"
                    style={{ backgroundColor: glow }}
                />

                {variant === 'default' ? (
                    <ForkKnife
                        size={iconSize}
                        weight="duotone"
                        className="drop-shadow-sm relative z-10"
                        style={{ color: icon }}
                    />
                ) : (
                    <CookingPot
                        size={iconSize}
                        weight="duotone"
                        className="drop-shadow-sm relative z-10"
                        style={{ color: icon }}
                    />
                )}
            </div>

            {/* Fine border detail */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ border: `1px solid ${border}` }}
            />
        </div>
    )
}
