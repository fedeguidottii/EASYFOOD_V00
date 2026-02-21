import React from 'react'
import { ForkKnife, CookingPot } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface DishPlaceholderProps {
    className?: string
    iconSize?: number
    variant?: 'default' | 'pot' | 'fork'
}

export function DishPlaceholder({ className, iconSize = 40, variant = 'default' }: DishPlaceholderProps) {
    return (
        <div className={cn(
            "w-full h-full flex items-center justify-center relative overflow-hidden bg-zinc-900",
            className
        )}>
            {/* Elegant Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/80 via-zinc-900 to-black/80" />

            {/* Subtle Noise Texture for Premium Feel */}
            <div className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Central Icon container with subtle glow */}
            <div className="relative z-10 flex items-center justify-center">
                <div className="absolute inset-0 bg-amber-500/10 blur-[20px] rounded-full transform scale-150" />

                {variant === 'default' ? (
                    <ForkKnife
                        size={iconSize}
                        weight="duotone"
                        className="text-zinc-600 drop-shadow-sm relative z-10"
                    />
                ) : (
                    <CookingPot
                        size={iconSize}
                        weight="duotone"
                        className="text-zinc-600 drop-shadow-sm relative z-10"
                    />
                )}
            </div>

            {/* Fine border detail */}
            <div className="absolute inset-0 border border-white/5 pointer-events-none" />
        </div>
    )
}
