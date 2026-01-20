import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dish } from '../../services/types';
import { X, PencilSimple } from '@phosphor-icons/react';

interface SortableItemProps {
    id: string; // This is the unique composite ID (dishId-courseNumber-index or similar)
    item: { dishId: string; quantity: number; notes: string; courseNumber: number };
    dish?: Dish;
    onRemove: () => void;
    onEditNote: () => void;
}

export function SortableItem({ id, item, dish, onRemove, onEditNote }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 'auto',
        position: 'relative' as 'relative',
        touchAction: 'none' // Important for mobile DnD
    };

    if (!dish) return null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-zinc-800 p-2 rounded-lg mb-2 flex items-center gap-2 border border-white/5 shadow-sm group select-none active:cursor-grabbing cursor-grab"
        >
            {/* Visual Grip Handle (optional visual cue) */}
            {/* <div className="text-zinc-600 cursor-grab px-1">
        <DotsSixVertical size={16} />
      </div> */}

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-zinc-200 truncate pr-2">{dish.name}</span>
                    <span className="font-bold text-amber-500 text-xs whitespace-nowrap">x{item.quantity}</span>
                </div>
                {item.notes && (
                    <p className="text-[10px] text-zinc-500 truncate italic mt-0.5">Note: {item.notes}</p>
                )}
                {/* Edit Buttons */}
                <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditNote(); }} // prevent drag start
                        className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                        onPointerDown={(e) => e.stopPropagation()} // Stop DnD
                    >
                        <PencilSimple size={10} /> Note
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
                        onPointerDown={(e) => e.stopPropagation()} // Stop DnD
                    >
                        <X size={10} /> Rimuovi
                    </button>
                </div>
            </div>
        </div>
    );
}
