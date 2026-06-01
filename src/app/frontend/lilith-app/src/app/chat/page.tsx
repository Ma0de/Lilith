'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import Image from 'next/image';
import SettingsOverlay from '@/components/SettingsOverlay';
import LilithPortrait from '@/components/LilithPortrait';
import { getWebSocketClient } from '@/lib/websocket';
import useNotice from '@/components/Notice';  // 导入 useNotice

interface Message {
    id: number;
    speaker: string;
    content: string;
}

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
    const [isLoading, setIsLoading] = useState(false);
    const [shouldShowMessage, setShouldShowMessage] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const wsClientRef = useRef<ReturnType<typeof getWebSocketClient> | null>(null);
    const messagesRef = useRef(messages);
    
    // 使用通知 Hook
    const { warning } = useNotice();
    
    // 标记是否已经初始化过 WebSocket
    const isWsInitialized = useRef(false);

    // 保持 messagesRef 同步
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // WebSocket 连接 - 只执行一次
    useEffect(() => {
        if (isWsInitialized.current) return;
        isWsInitialized.current = true;
        
        // 获取客户端实例
        const client = getWebSocketClient();
        wsClientRef.current = client;

        // 设置断开连接时的回调 - 弹通知
        client.setDisconnectCallback(() => {
            console.log('WebSocket 断开，准备弹通知');
            warning('与应用的 WebSocket 连接断开', {
                title: 'NET_WS_CONN_FAIL',
            });
        });

        client.onOpen = () => {
            console.log('WebSocket 连接成功回调');
        };

        client.onClose = () => {
            console.log('WebSocket 断开回调（正常关闭）');
        };

        client.onError = (error) => {
            console.error('WebSocket 错误回调:', error);
        };

        const removeHandler = client.onMessage((data) => {
            console.log('收到消息:', data);

            if (data.type === 'chat' && data.speaker === 'lilith') {
                const reply: Message = {
                    id: Date.now(),
                    speaker: '莉莉丝',
                    content: data.content,
                };
                
                console.log('添加回复消息:', reply);
                setMessages(prev => [...prev, reply]);
                setIsLoading(false);
                setShouldShowMessage(true);
            }
        });

        client.connect();

        return () => {
            console.log('组件卸载，移除消息处理器');
            removeHandler();
            client.setDisconnectCallback(null);
            client.onOpen = null;
            client.onClose = null;
            client.onError = null;
            isWsInitialized.current = false;
        };
    }, [warning]);  // 添加 warning 依赖

    // 其余代码保持不变...
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

    // 添加初始消息的显示逻辑
    useEffect(() => {
        if (!isInitialized && messages.length > 0) {
            console.log('初始化显示第一条消息');
            setIsInitialized(true);
            
            const firstMessage = messages[0];
            setCurrentRevealingMessage(firstMessage);
            setRevealProgress(0);
            setIsRevealing(true);
            setIsSwitching(true);
            
            const startTime = Date.now();
            const duration = 600;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                setRevealProgress(progress);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    console.log('初始消息显示完成');
                    setIsRevealing(false);
                    setIsSwitching(false);
                    setWaitingForNext(true);
                    setWaitingForClick(true);
                }
            };
            
            requestAnimationFrame(animate);
        }
    }, [messages, isInitialized]);

    // 处理新消息显示（WebSocket 回复）
    useEffect(() => {
        if (shouldShowMessage) {
            const lastMessage = messagesRef.current[messagesRef.current.length - 1];
            if (lastMessage) {
                console.log('开始显示新消息:', lastMessage.content);
                
                setShowInputBox(false);
                setWaitingForClick(false);
                setWaitingForNext(false);
                
                setCurrentRevealingMessage(lastMessage);
                setRevealProgress(0);
                setIsRevealing(true);
                setIsSwitching(true);
                
                setShouldShowMessage(false);
                
                const startTime = Date.now();
                const duration = 600;
                
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    setRevealProgress(progress);
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        console.log('消息显示完成');
                        setIsRevealing(false);
                        setIsSwitching(false);
                        setWaitingForNext(true);
                        
                        if (lastMessage.speaker === '莉莉丝') {
                            setWaitingForClick(true);
                        }
                    }
                };
                
                requestAnimationFrame(animate);
            }
        }
    }, [shouldShowMessage]);

    const handlePlayerTurn = () => {
        if (!waitingForClick) return;
        setWaitingForClick(false);
        setShowInputBox(true);
        setCurrentRevealingMessage(null);
        setRevealProgress(0);
        setIsRevealing(false);
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || !showInputBox) return;

        const userInput = inputText;
        console.log('发送消息:', userInput);

        const userMessage: Message = {
            id: Date.now(),
            speaker: '你',
            content: userInput,
        };
        setMessages(prev => [...prev, userMessage]);
        
        setInputText('');
        setShowInputBox(false);
        setWaitingForClick(false);
        setWaitingForNext(false);
        setCurrentRevealingMessage(null);
        setRevealProgress(0);
        setIsLoading(true);

        const client = wsClientRef.current;
        if (client) {
            if (!client.isConnected()) {
                console.log('WebSocket 未连接，尝试重新连接...');
                client.connect();
                setTimeout(() => {
                    client.send('chat', userInput, 'user');
                }, 1000);
            } else {
                client.send('chat', userInput, 'user');
            }
        }
    };

    const currentDisplayMessage = currentRevealingMessage || messages[messages.length - 1];
    const currentSpeaker = currentDisplayMessage?.speaker || '莉莉丝';
    const currentContent = currentDisplayMessage?.content || '';

    const renderGradientText = (text: string, progress: number) => {
        if (progress >= 1) return text;
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
        if (isLoading) return;

        const target = e.target as HTMLElement;
        if (target.closest('input') || target.closest('button')) {
            return;
        }

        if (waitingForClick) {
            handlePlayerTurn();
        }
    };

    const showLoading = isLoading && !showInputBox;
    const shouldShowContent = !showInputBox && !showLoading && currentContent;
    const displayContent = shouldShowContent ? currentContent : '';

    return (
        <>
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
                        <div
                            className="text-center mb-1"
                            style={{
                                fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                                color: '#b84a51',
                                fontSize: '1.55rem',
                                textShadow: '0.5px 0.5px 0 #FFFFFF, -0.5px -0.5px 0 #FFFFFF, 0.5px -0.5px 0 #FFFFFF, -0.5px 0.5px 0 #FFFFFF',
                            }}
                        >
                            {showInputBox ? '你' : (showLoading ? '莉莉丝' : currentSpeaker)}
                        </div>

                        <div
                            className="text-center leading-relaxed flex justify-center flex-wrap items-center min-h-[60px]"
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
                            ) : showLoading ? (
                                <div className="flex justify-center items-center">
                                    <Image
                                        src="/MaodeLab_LOAD_BTN.svg"
                                        alt="加载中"
                                        width={40}
                                        height={40}
                                    />
                                </div>
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
            
        </>
    );
}