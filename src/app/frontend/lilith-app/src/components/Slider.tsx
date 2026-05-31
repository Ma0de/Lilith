'use client';

import { useRef, MouseEvent, useState, useEffect, useCallback } from 'react';

interface SliderProps {
    id: string;
    value: number;
    onChange: (value: number) => void;
    label: string;
    showMute?: boolean;
    onMuteClick?: () => void;
    onMuteHover?: () => void;
    onMuteLeave?: () => void;
}

export default function Slider({
    id,
    value,
    onChange,
    label,
    showMute = false,
    onMuteClick,
    onMuteHover,
    onMuteLeave
}: SliderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startMouseXRef = useRef(0);
    const hasMovedRef = useRef(false);
    const onChangeRef = useRef(onChange);

    // 保持 onChange 引用最新
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();

        // 记录起始位置
        startMouseXRef.current = e.clientX;
        hasMovedRef.current = false;

        // 立即更新点击位置
        const ref = sliderRef.current;
        if (ref) {
            const rect = ref.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            onChange(Math.round(percentage));
        }

        // 进入拖拽状态
        setIsDragging(true);
        isDraggingRef.current = true;
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: globalThis.MouseEvent) => {
            if (!isDraggingRef.current) return;

            if (!hasMovedRef.current) {
                const deltaX = Math.abs(e.clientX - startMouseXRef.current);
                if (deltaX < 3) return;
                hasMovedRef.current = true;
            }

            const ref = sliderRef.current;
            if (!ref) return;

            const rect = ref.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            onChangeRef.current(Math.round(percentage));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            isDraggingRef.current = false;
            hasMovedRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
         document.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div className="flex items-center gap-4 select-none">
            <div className="w-32 text-right text-white text-xl font-bold tracking-wide shrink-0 select-none">{label}</div>
            <div className="flex-1 relative h-10 flex items-center select-none">
                <div
                    ref={sliderRef}
                    className="w-full h-7 bg-[#a8a8a8] rounded-[4px] relative shadow-inner cursor-pointer select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div
                        className="h-full bg-white rounded-l-[4px] transition-none select-none"
                        style={{ width: `${value}%` }}
                    />
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-5 h-9 bg-black rounded-[4px] border-[2px] border-[#a8a8a8] shadow-sm select-none ${isDragging ? 'scale-105' : ''}`}
                        style={{
                            left: `${value}%`,
                        }}
                    />
                </div>
            </div>
            {showMute && (
                <button
                    onClick={onMuteClick}
                    onMouseEnter={onMuteHover}
                    onMouseLeave={onMuteLeave}
                    className="text-white text-lg font-bold hover:text-gray-300 transition-colors shrink-0 select-none"
                >
                    静音
                </button>
            )}
        </div>
    );
}