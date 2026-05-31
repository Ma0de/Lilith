'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface OptionSelectorProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    label?: string;
}

export default function OptionSelector({ 
    value, 
    onChange, 
    options,
    label 
}: OptionSelectorProps) {
    return (
        <div className="flex items-center gap-6">
            {label && (
                <div className="w-32 text-right text-white text-xl font-bold tracking-wide shrink-0">
                    {label}
                </div>
            )}
            <button
                onClick={() => {
                    const index = options.indexOf(value);
                    const prev = options[(index - 1 + options.length) % options.length];
                    onChange(prev);
                }}
                className="text-white hover:text-gray-300 transition-colors"
            >
                <ChevronLeft size={24} strokeWidth={3} />
            </button>
            <span className="text-white text-xl font-bold min-w-[100px] text-center">{value}</span>
            <button
                onClick={() => {
                    const index = options.indexOf(value);
                    const next = options[(index + 1) % options.length];
                    onChange(next);
                }}
                className="text-white hover:text-gray-300 transition-colors"
            >
                <ChevronRight size={24} strokeWidth={3} />
            </button>
        </div>
    );
}