'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import SettingsOverlay from '@/components/SettingsOverlay';
import LilithPortrait from '@/components/LilithPortrait';

interface Message {
    id: number;
    speaker: string;
    content: string;
}

// 根据说话者和内容匹配表情的简单映射
const getExpressionBySpeakerAndContent = (speaker: string, content: string): string => {
    if (speaker === '莉莉丝') {
        if (content.includes('~')) {
            return 'joyful_laugh';
        }
        if (content.includes('...')) {
            return 'neutral_slight_upset';
        }
        if (content.includes('？') || content.includes('?')) {
            return 'questioning';
        }
        return 'calm_gentle';
    }
    return 'calm_gentle';
};

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, speaker: '莉莉丝', content: '欢迎回来~ ' },
    ]);
    const [inputText, setInputText] = useState('');
    const [isRevealing, setIsRevealing] = useState(false);
    const [revealProgress, setRevealProgress] = useState(0);
    const [currentRevealingMessage, setCurrentRevealingMessage] = useState<Message | null>(null);
    const [style, setStyle] = useState<string>('');
    const [waitingForNext, setWaitingForNext] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [currentExpression, setCurrentExpression] = useState('calm_gentle');
    const [bodyState, setBodyState] = useState<1 | 2>(1);
    const [waitingForClick, setWaitingForClick] = useState(false);
    const [showInputBox, setShowInputBox] = useState(false);

    useEffect(() => {
        const savedStyle = localStorage.getItem('chatStyle');
        if (savedStyle) {
            setStyle(savedStyle);
        } else {
            router.push('/style-selection');
        }
    }, [router]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
            const expression = getExpressionBySpeakerAndContent(lastMessage.speaker, lastMessage.content);
            setCurrentExpression(expression);
        }
    }, [messages]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && !isRevealing && !isSwitching && !waitingForClick && !showInputBox) {
            startGradientReveal(lastMessage);
        }
    }, [messages]);

    const startGradientReveal = (message: Message) => {
        setIsSwitching(true);
        setCurrentRevealingMessage(message);
        setRevealProgress(0);
        setIsRevealing(true);
        setWaitingForNext(false);
        setWaitingForClick(false);
        setShowInputBox(false);

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

                if (message.speaker === '莉莉丝') {
                    setWaitingForClick(true);
                }
            }
        };
        requestAnimationFrame(animate);
    };

    const handlePlayerTurn = () => {
        if (!waitingForClick) return;
        setWaitingForClick(false);
        setShowInputBox(true);
        setCurrentRevealingMessage(null);
        // 清空对话框内容
        setRevealProgress(0);
        setIsRevealing(false);
    };

    const getReplyByStyle = (input: string, style: string): string => {
        if (style === 'Galgame') {
            return `「${input}」... 嗯，莉莉丝收到啦～`;
        }
        return `「${input}」... 莉莉丝记住了呢～`;
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || !showInputBox) return;

        const userInput = inputText;

        // 立即清空输入框和显示状态，防止闪烁
        setInputText('');
        setShowInputBox(false);
        setWaitingForClick(false);
        setWaitingForNext(false);
        setCurrentRevealingMessage(null);
        setRevealProgress(0);

        // 直接添加莉莉丝回复
        const reply: Message = {
            id: Date.now(),
            speaker: '莉莉丝',
            content: getReplyByStyle(userInput, style),
        };
        setMessages(prev => [...prev, reply]);
    };

    const currentDisplayMessage = currentRevealingMessage || messages[messages.length - 1];
    const currentSpeaker = currentDisplayMessage?.speaker || '莉莉丝';
    const currentContent = currentDisplayMessage?.content || '';

    const renderGradientText = (text: string, progress: number) => {
        const chars = text.split('');
        const totalChars = chars.length;
        if (totalChars === 0) return null;

        const visibleCount = Math.ceil(totalChars * Math.min(progress, 1));

        return chars.map((char, index) => {
            const isVisible = index < visibleCount;
            return (
                <span key={index} style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.08s ease-out' }}>
                    {char === ' ' ? '\u00A0' : char}
                </span>
            );
        });
    };

    const handleRootClick = (e: React.MouseEvent) => {
        if (isSettingsOpen) return;

        const target = e.target as HTMLElement;
        if (target.closest('input') || target.closest('button')) {
            return;
        }

        if (waitingForClick) {
            handlePlayerTurn();
        }
    };

    // 当 showInputBox 为 true 时，不显示任何对话内容
    const shouldShowContent = !showInputBox && currentContent;
    const displayContent = shouldShowContent ? currentContent : '';

    return (
        <div
            className="relative h-screen w-full overflow-hidden bg-black"
            style={{ cursor: `url('/styles/galgame/ui/cursor.png'), auto` }}
            onClick={handleRootClick}
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

            {/* 莉莉丝立绘 - 画面中心 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <LilithPortrait
                    bodyState={bodyState}
                    expression={currentExpression}
                    animated={false}
                    scale={1.9}
                    className="translate-y-170"
                />
            </div>

            {/* 返回按钮 */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    router.push('/');
                }}
                className="absolute top-6 left-6 z-20 text-white/60 hover:text-white transition-colors text-sm"
                style={{ cursor: `url('/styles/galgame/ui/cursor.png'), pointer` }}
            >
                ← 返回
            </button>

            {/* 设置按钮 */}
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
            <div className="absolute bottom-23 left-0 right-0 z-10">
                <div className="mx-4 mb-4 rounded-2xl px-6 py-5">
                    {/* 说话者名称 */}
                    <div
                        className="text-center mb-1"
                        style={{
                            fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                            color: '#b84a51',
                            fontSize: '1.55rem',
                            textShadow: '0.5px 0.5px 0 #FFFFFF, -0.5px -0.5px 0 #FFFFFF, 0.5px -0.5px 0 #FFFFFF, -0.5px 0.5px 0 #FFFFFF',
                        }}
                    >
                        {showInputBox ? '你' : currentSpeaker}
                    </div>

                    {/* 内容区域 */}
                    <div
                        className="text-center leading-relaxed flex justify-center flex-wrap"
                        style={{
                            fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                            color: '#FFFFFF',
                            fontSize: '1.25rem',
                            textShadow: '2px 2px 0 #000000, -1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000',
                        }}
                    >
                        {showInputBox ? (
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="点击这里输入..."
                                className="w-full bg-transparent text-white text-center outline-none"
                                style={{
                                    fontSize: '1.25rem',
                                    fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                                    letterSpacing: '2px',
                                }}
                                autoFocus
                            />
                        ) : (
                            renderGradientText(displayContent, revealProgress)
                        )}
                    </div>
                </div>
            </div>

            {/* 全屏设置覆盖窗口 */}
            <SettingsOverlay
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}