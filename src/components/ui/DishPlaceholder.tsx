import React from 'react'
import { ForkKnife, CookingPot } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface DishPlaceholderProps {
    className?: string
    iconSize?: number
    variant?: 'default' | 'pot'
}

export function DishPlaceholder({ className, iconSize = 48, variant = 'default' }: DishPlaceholderProps) {
    return (
        <div className={cn(
            "w-full h-full flex items-center justify-center relative overflow-hidden",
            "bg-zinc-900", // Solid base
            className
        )}>
            {/* Rich Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />

            {/* Detailed Pattern - Subtle Hexagons or Noise */}
            <div className="absolute inset-0 opacity-[0.05]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                    backgroundSize: '16px 16px'
                }}
            />

            {/* Amber Glow Center - Very subtle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-amber-500/5 blur-[50px] rounded-full" />

            {/* Decorative Vector Graphic (Large Watermark) */}
            <div className="absolute -bottom-4 -right-4 opacity-[0.03] transform rotate-12 scale-150 pointer-events-none">
                {variant === 'default' ? (
                    <ForkKnife size={iconSize * 3} weight="fill" />
                ) : (
                    <CookingPot size={iconSize * 3} weight="fill" />
                )}
            </div>

            {/* Central Icon */}
            <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-white/5 border border-white/5 shadow-2xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                    {variant === 'default' ? (
                        <ForkKnife
                            size={iconSize}
                            weight="light"
                            className="text-zinc-500 group-hover:text-amber-500 transition-colors duration-300"
                        />
                    ) : (
                        <CookingPot
                            size={iconSize}
                            weight="light"
                            className="text-zinc-500 group-hover:text-amber-500 transition-colors duration-300"
                        />
                    )}
                </div>
            </div>

            {/* Inner Border */}
            <div className="absolute inset-0 border border-white/5 pointer-events-none" />
        </div>
    )
}
