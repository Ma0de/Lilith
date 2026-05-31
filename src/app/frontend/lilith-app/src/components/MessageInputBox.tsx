'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface MessageInputBoxProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

export default function MessageInputBox({
    value,
    onChange,
    onSend,
    placeholder = '点击这里输入...',
    className = '',
    autoFocus = true,
}: MessageInputBoxProps) {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.trim()) {
            onSend();
        }
    };

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <div
            className={`relative ${className}`}
            style={{
                width: '100%',
                height: '50px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: `linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(0, 0, 0, 0.75) 15%,
                    rgba(0, 0, 0, 0.75) 85%,
                    transparent 100%
                )`,
            }}
        >
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder=""
                className="w-full bg-transparent text-white text-center outline-none"
                style={{
                    fontSize: '20px',
                    fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                    letterSpacing: '2px',
                    padding: '0 20px',
                    zIndex: 10,
                    background: 'transparent',
                }}
            />

            {!value && !isFocused && (
                <div
                    className="absolute select-none"
                    style={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '28px',
                        letterSpacing: '8px',
                        fontWeight: 'bold',
                        pointerEvents: 'none',
                        zIndex: 5,
                    }}
                >
                    ······
                </div>
            )}
        </div>
    );
}