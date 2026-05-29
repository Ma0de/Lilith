'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
    id: number;
    speaker: string;
    content: string;
}

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, speaker: '莉莉丝', content: '欢迎回来，今天怎么样？需要我帮忙吗' },
    ]);
    const [inputText, setInputText] = useState('');
    const [isRevealing, setIsRevealing] = useState(false);
    const [revealProgress, setRevealProgress] = useState(1); // 0-1，表示渐变进度
    const [currentRevealingMessage, setCurrentRevealingMessage] = useState<Message | null>(null);
    const [style, setStyle] = useState<string>('');

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
        if (lastMessage && !isRevealing && currentRevealingMessage?.id !== lastMessage.id) {
            startGradientReveal(lastMessage);
        }
    }, [messages]);

    const startGradientReveal = (message: Message) => {
        setIsRevealing(true);
        setCurrentRevealingMessage(message);
        setRevealProgress(0);

        const startTime = Date.now();
        const duration = 600; // 0.6秒完成渐变

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            setRevealProgress(progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setIsRevealing(false);
                setCurrentRevealingMessage(null);
            }
        };

        requestAnimationFrame(animate);
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || isRevealing) return;

        const userInput = inputText;
        const newMessage: Message = {
            id: Date.now(),
            speaker: '你',
            content: userInput,
        };
        setMessages(prev => [...prev, newMessage]);
        setInputText('');

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

    // 为文字创建从左到右的透明度渐变
    const renderGradientText = (text: string, progress: number) => {
        if (progress >= 1) {
            // 完全显示时，所有文字都是完全可见的
            return text;
        }

        // 根据progress计算哪个位置的字是完全透明的
        const chars = text.split('');
        const totalChars = chars.length;
        
        if (totalChars === 0) return '';

        return chars.map((char, index) => {
            // 计算每个字的透明度
            // 当progress为0时，所有字都是透明的
            // 当progress为1时，所有字都是不透明的
            // 中间状态：左边的字先变得不透明
            const charPosition = index / totalChars; // 0-1，表示字的位置
            const opacity = Math.max(0, Math.min(1, (progress - charPosition * 0.7) / 0.3));
            // progress - charPosition * 0.7：确保左边的字先显示
            // 除以0.3：让渐变更加平滑
            
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
        >
            {/* 背景图 */}
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage: "url('/styles/galgame/bg/TitleMenu_Image_Bg2.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />

            {/* 历史消息记录 */}
            <div className="absolute top-20 left-0 right-0 bottom-40 overflow-y-auto px-4 pointer-events-none">
                <div className="mx-auto max-w-2xl space-y-3">
                    {messages.slice(0, -1).map((msg) => (
                        <div key={msg.id} className="text-center opacity-60">
                            <span className="text-xs text-[#FF636D]">{msg.speaker}</span>
                            <span className="text-xs text-white/50 mx-2">·</span>
                            <span className="text-xs text-white/50">{msg.content}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 返回按钮 */}
            <button
                onClick={() => router.push('/style-selection')}
                className="absolute top-6 left-6 z-20 text-white/60 hover:text-white transition-colors text-sm"
                style={{ cursor: `url('/styles/galgame/ui/cursor.png'), pointer` }}
            >
                ← 返回
            </button>

            {/* Galgame 风格对话框 - 底部 */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
                {/* 对话内容框 */}
                <div className="mx-4 mb-4 rounded-2xl px-6 py-5">
                    {/* 对话者名字 - 边缘白色 */}
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

                    {/* 对话内容 - 从左到右渐变显示 */}
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

            {/* 隐藏的输入框，用于接收用户输入 */}
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
        </div>
    );
}