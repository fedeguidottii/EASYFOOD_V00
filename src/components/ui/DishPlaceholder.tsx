import React from 'react'
import { ChefHat, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DishPlaceholderProps {
    className?: string
    iconSize?: number
    icon?: 'chef' | 'utensils'
}

export function DishPlaceholder({ className, iconSize = 24, icon = 'chef' }: DishPlaceholderProps) {
    return (
        <div className={cn(
            "w-full h-full flex items-center justify-center relative overflow-hidden",
            "bg-gradient-to-br from-zinc-800 to-zinc-950",
            className
        )}>
            {/* Background Pattern - Subtle */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                }}
            />

            {/* Center Icon with elegant glow */}
            <div className="relative z-10 flex flex-col items-center justify-center opacity-40">
                <div className="absolute inset-0 bg-amber-500/20 blur-[40px] rounded-full scale-150" />
                {icon === 'chef' ? (
                    <ChefHat size={iconSize} className="text-zinc-500 drop-shadow-lg" strokeWidth={1.5} />
                ) : (
                    <Utensils size={iconSize} className="text-zinc-500 drop-shadow-lg" strokeWidth={1.5} />
                )}
            </div>
        </div>
    )
}
