'use client';

interface DisplayModeSelectorProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    label: string;
}

export default function DisplayModeSelector({ 
    value, 
    onChange, 
    options,
    label
}: DisplayModeSelectorProps) {
    return (
        <div className="flex items-center justify-between">
            <div className="w-32 text-right text-white text-xl font-bold tracking-wide shrink-0">{label}</div>
            <div className="flex-1 flex items-center justify-center gap-10">
                {options.map((option) => (
                    <div key={option} className="flex items-center gap-3">
                        {value === option && (
                            <div className="w-3 h-6 border-2 border-white/50 bg-white" />
                        )}
                        <button
                            onClick={() => onChange(option)}
                            className={`text-xl font-bold transition-colors ${
                                value === option ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {option}
                        </button>
                    </div>
                ))}
            </div>
            <div className="w-32" /> {/* 占位，保持对齐 */}
        </div>
    );
}