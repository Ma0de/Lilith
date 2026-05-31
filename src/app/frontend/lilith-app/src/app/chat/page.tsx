'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import SettingsOverlay from '@/components/SettingsOverlay';

interface Message {
    id: number;
    speaker: string;
    content: string;
}

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, speaker: '测试', content: '欢迎回来' },
    ]);
    const [inputText, setInputText] = useState('');
    const [isRevealing, setIsRevealing] = useState(false);
    const [revealProgress, setRevealProgress] = useState(0);
    const [currentRevealingMessage, setCurrentRevealingMessage] = useState<Message | null>(null);
    const [style, setStyle] = useState<string>('');
    const [waitingForNext, setWaitingForNext] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    // 设置覆盖窗口状态
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        const savedStyle = localStorage.getItem('chatStyle');
        if (savedStyle) {
            setStyle(savedStyle);
        } else {
            router.push('/style-selection');
        }
    }, [router]);

    // 从左到右渐变效果
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && !isRevealing && !isSwitching) {
            startGradientReveal(lastMessage);
        }
    }, [messages]);

    const startGradientReveal = (message: Message) => {
        setIsSwitching(true);
        setCurrentRevealingMessage(message);
        setRevealProgress(0);
        setIsRevealing(true);
        setWaitingForNext(false);

        const startTime = Date.now();
        const duration = 600;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            setRevealProgress(progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setIsRevealing(false);
                setIsSwitching(false);
                setWaitingForNext(true);
            }
        };

        requestAnimationFrame(animate);
    };

    const handleNextMessage = () => {
        if (!waitingForNext || isRevealing || isSwitching) return;

        const reply: Message = {
            id: Date.now(),
            speaker: '测试',
            content: getAutoReplyByStyle(style),
        };
        setMessages(prev => [...prev, reply]);
        setWaitingForNext(false);
    };

    const getAutoReplyByStyle = (style: string): string => {
        const replies = [
            '11111',
            '2222',
            '33333',
            '444444',
            '555555'
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        return randomReply;
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || isRevealing || waitingForNext || isSwitching) return;

        const userInput = inputText;
        const newMessage: Message = {
            id: Date.now(),
            speaker: '你',
            content: userInput,
        };
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        setWaitingForNext(false);

        setTimeout(() => {
            const reply: Message = {
                id: Date.now() + 1,
                speaker: '莉莉丝',
                content: getReplyByStyle(userInput, style),
            };
            setMessages(prev => [...prev, reply]);
        }, 500);
    };

    const getReplyByStyle = (input: string, style: string): string => {
        if (style === 'Galgame') {
            return `「${input}」... 嗯，莉莉丝收到啦～ ✨`;
        }
        return `「${input}」... 莉莉丝记住了呢～ ✨`;
    };

    const currentDisplayMessage = currentRevealingMessage || messages[messages.length - 1];
    const currentSpeaker = currentDisplayMessage?.speaker || '莉莉丝';
    const currentContent = currentDisplayMessage?.content || '';

    const renderGradientText = (text: string, progress: number) => {
        if (progress >= 1) {
            return text;
        }

        const chars = text.split('');
        const totalChars = chars.length;

        if (totalChars === 0) return '';

        return chars.map((char, index) => {
            const charPosition = index / totalChars;
            const opacity = Math.max(0, Math.min(1, (progress - charPosition * 0.7) / 0.3));

            return (
                <span
                    key={index}
                    style={{
                        opacity: opacity,
                        transition: 'opacity 0.1s ease-out',
                    }}
                >
                    {char}
                </span>
            );
        });
    };

    return (
        <div
            className="relative h-screen w-full overflow-hidden bg-black"
            style={{ cursor: `url('/styles/galgame/ui/cursor.png'), auto` }}
            onClick={!isSettingsOpen ? handleNextMessage : undefined}
        >
            {/* 背景图 */}
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage: "url('/Scene/Scence_10_2.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />

            {/* 返回按钮 */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    router.push('/style-selection');
                }}
                className="absolute top-6 left-6 z-20 text-white/60 hover:text-white transition-colors text-sm"
                style={{ cursor: `url('/styles/galgame/ui/cursor.png'), pointer` }}
            >
                ← 返回
            </button>

            {/* 设置按钮 - 右上角 */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsSettingsOpen(true);
                }}
                className="absolute top-6 right-6 z-20 text-white/60 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
                style={{ cursor: `url('/styles/galgame/ui/cursor.png'), pointer` }}
                aria-label="设置"
            >
                <Settings size={22} />
            </button>

            {/* Galgame 风格对话框 - 底部 */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
                <div className="mx-4 mb-4 rounded-2xl px-6 py-5">
                    <div
                        className="text-center mb-1"
                        style={{
                            fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                            color: '#FF636D',
                            fontSize: '1.55rem',
                            textShadow: '0.5px 0.5px 0 #FFFFFF, -0.5px -0.5px 0 #FFFFFF, 0.5px -0.5px 0 #FFFFFF, -0.5px 0.5px 0 #FFFFFF',
                        }}
                    >
                        {currentSpeaker}
                    </div>

                    <div
                        className="text-center leading-relaxed min-h-[80px] flex justify-center flex-wrap"
                        style={{
                            fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                            color: '#FFFFFF',
                            fontSize: '1.25rem',
                            textShadow: '2px 2px 0 #000000, -1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000',
                        }}
                    >
                        {renderGradientText(currentContent, revealProgress)}
                    </div>
                </div>
            </div>

            {/* 隐藏的输入框 */}
            <div className="absolute bottom-0 left-0 right-0 opacity-0 pointer-events-auto z-20">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="w-full p-4 bg-transparent outline-none"
                    style={{ cursor: `url('/styles/galgame/ui/cursor.png') 16 16, auto` }}
                    autoFocus
                />
            </div>

            {/* 全屏设置覆盖窗口 */}
            <SettingsOverlay
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}