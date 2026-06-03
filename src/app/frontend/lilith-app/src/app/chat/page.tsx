'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import Image from 'next/image';
import LilithPortrait from '@/components/LilithPortrait';
import useNotice from '@/components/Notice';
import { getWebSocketClient, BasicSettings } from '@/lib/websocket';
import SettingsOverlay, { getGlobalTextSpeed, getGlobalVoiceVolume, setGlobalTextSpeed, setGlobalVoiceVolume } from '@/components/SettingsOverlay';

interface Message {
    id: number;
    speaker: string;
    content: string;
}

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
    const [textSpeed, setTextSpeed] = useState(70);
    const [voiceVolume, setVoiceVolume] = useState(80);
    const [displayMode, setDisplayMode] = useState<string>('窗口');
    const wsClientRef = useRef<ReturnType<typeof getWebSocketClient> | null>(null);
    const messagesRef = useRef(messages);
    const hasShownFullscreenTip = useRef(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);

    const { warning, info } = useNotice();
    const isWsInitialized = useRef(false);
    const settingsLoadedRef = useRef(false);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFullscreen = !!document.fullscreenElement;
            const newMode = isFullscreen ? '全屏' : '窗口';
            if (newMode !== displayMode) {
                setDisplayMode(newMode);
                const client = wsClientRef.current;
                if (client?.isConnected()) {
                    client.updateSettings({
                        displayMode: newMode,
                        textSpeed: textSpeed,
                        voiceVolume: voiceVolume,
                        gameVoice: '汉语',
                        gameLanguage: '简体中文'
                    });
                }
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [displayMode, textSpeed, voiceVolume]);

    useEffect(() => {
        const handleTextSpeedChange = (e: CustomEvent) => {
            setTextSpeed(e.detail.speed);
        };
        window.addEventListener('textSpeedChange', handleTextSpeedChange as EventListener);
        setTextSpeed(getGlobalTextSpeed());
        return () => window.removeEventListener('textSpeedChange', handleTextSpeedChange as EventListener);
    }, []);

    useEffect(() => {
        const handleVoiceVolumeChange = (e: CustomEvent) => {
            setVoiceVolume(e.detail.volume);
            if (audioRef.current) {
                audioRef.current.volume = e.detail.volume / 100;
            }
        };
        window.addEventListener('voiceVolumeChange', handleVoiceVolumeChange as EventListener);
        const initialVolume = getGlobalVoiceVolume();
        setVoiceVolume(initialVolume);
        if (audioRef.current) {
            audioRef.current.volume = initialVolume / 100;
        }
        return () => window.removeEventListener('voiceVolumeChange', handleVoiceVolumeChange as EventListener);
    }, []);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsAudioPlaying(false);
            isPlayingRef.current = false;
        }
        audioQueueRef.current = [];
    }, []);

    const playAudio = useCallback((base64Audio: string, format: string = 'wav') => {
        const audioData = `data:audio/${format};base64,${base64Audio}`;

        const play = () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = audioData;
                audioRef.current.load();
                audioRef.current.volume = voiceVolume / 100;
                audioRef.current.play().catch(err => {
                    console.error('音频播放失败:', err);
                });
                setIsAudioPlaying(true);
                isPlayingRef.current = true;

                audioRef.current.onended = () => {
                    setIsAudioPlaying(false);
                    isPlayingRef.current = false;
                    if (audioQueueRef.current.length > 0) {
                        const next = audioQueueRef.current.shift();
                        if (next) {
                            const audio = new Audio(next);
                            audio.volume = voiceVolume / 100;
                            audio.play();
                        }
                    }
                };
            } else {
                const audio = new Audio(audioData);
                audio.volume = voiceVolume / 100;
                audio.play().catch(err => {
                    console.error('音频播放失败:', err);
                });
                setIsAudioPlaying(true);
                isPlayingRef.current = true;
                audio.onended = () => {
                    setIsAudioPlaying(false);
                    isPlayingRef.current = false;
                };
                audioRef.current = audio;
            }
        };

        play();
    }, [voiceVolume]);

    useEffect(() => {
        if (isWsInitialized.current) return;
        isWsInitialized.current = true;

        const client = getWebSocketClient();
        wsClientRef.current = client;

        client.setDisconnectCallback(() => {
            warning('与应用的 WebSocket 连接断开', {
                title: 'NET_WS_CONN_FAIL',
            });
        });

        client.onOpen = () => {
            client.getSettings();
        };

        client.onClose = () => {
            console.log('WebSocket 断开');
        };

        client.onError = (error) => {
            console.error('WebSocket 错误:', error);
        };

        client.setSettingsCallback((settings: BasicSettings) => {
            if (settings.textSpeed !== undefined) {
                setTextSpeed(settings.textSpeed);
                setGlobalTextSpeed(settings.textSpeed);
            }

            if (settings.voiceVolume !== undefined) {
                setVoiceVolume(settings.voiceVolume);
                setGlobalVoiceVolume(settings.voiceVolume);
                const audioElements = document.querySelectorAll('audio');
                audioElements.forEach(audio => {
                    if (settings.voiceVolume !== undefined) {
                        audio.volume = settings.voiceVolume / 100;
                    }
                });
            }

            if (settings.displayMode) {
                setDisplayMode(settings.displayMode);
            }

            settingsLoadedRef.current = true;
        });

        const removeHandler = client.onMessage((data: any) => {
            if (data.type === 'chat' && data.speaker === 'lilith') {
                const reply: Message = {
                    id: Date.now(),
                    speaker: '莉莉丝',
                    content: data.content || '',
                };

                if (data.expression) {
                    setCurrentExpression(data.expression);
                }

                setMessages(prev => [...prev, reply]);
                setIsLoading(false);
                setShouldShowMessage(true);

                if (data.audio) {
                    playAudio(data.audio, data.audioFormat || 'wav');
                }
            }

            if (data.type === 'audio') {
                if (data.audio) {
                    playAudio(data.audio, data.audioFormat || 'wav');
                }
            }
        });

        if (client.isConnected()) {
            client.getSettings();
        } else {
            client.connect();
        }

        return () => {
            removeHandler();
            client.setSettingsCallback(() => { });
            client.setDisconnectCallback(null);
            client.onOpen = null;
            client.onClose = null;
            client.onError = null;
            isWsInitialized.current = false;
            stopAudio();
        };
    }, [warning, playAudio, stopAudio]);

    useEffect(() => {
        const savedStyle = localStorage.getItem('chatStyle');
        if (savedStyle) {
            setStyle(savedStyle);
        } else {
            router.push('/style-selection');
        }
    }, [router]);

    const getRevealDuration = useCallback(() => {
        return Math.max(150, 1000 - (textSpeed / 100) * 850);
    }, [textSpeed]);

    const startRevealAnimation = useCallback((message: Message, onComplete: () => void) => {
        const duration = getRevealDuration();
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            setRevealProgress(progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                onComplete();
            }
        };

        requestAnimationFrame(animate);
    }, [getRevealDuration]);

    useEffect(() => {
        if (!isInitialized && messages.length > 0) {
            setIsInitialized(true);

            const firstMessage = messages[0];
            setCurrentRevealingMessage(firstMessage);
            setRevealProgress(0);
            setIsRevealing(true);
            setIsSwitching(true);

            startRevealAnimation(firstMessage, () => {
                setIsRevealing(false);
                setIsSwitching(false);
                setWaitingForNext(true);
                setWaitingForClick(true);
            });
        }
    }, [messages, isInitialized, startRevealAnimation]);

    useEffect(() => {
        if (shouldShowMessage) {
            const lastMessage = messagesRef.current[messagesRef.current.length - 1];
            if (lastMessage) {
                setShowInputBox(false);
                setWaitingForClick(false);
                setWaitingForNext(false);

                setCurrentRevealingMessage(lastMessage);
                setRevealProgress(0);
                setIsRevealing(true);
                setIsSwitching(true);

                setShouldShowMessage(false);

                startRevealAnimation(lastMessage, () => {
                    setIsRevealing(false);
                    setIsSwitching(false);
                    setWaitingForNext(true);

                    if (lastMessage.speaker === '莉莉丝') {
                        setWaitingForClick(true);
                    }
                });
            }
        }
    }, [shouldShowMessage, startRevealAnimation]);

    const handlePlayerTurn = () => {
        if (!waitingForClick) return;

        stopAudio();

        setWaitingForClick(false);
        setShowInputBox(true);
        setCurrentRevealingMessage(null);
        setRevealProgress(0);
        setIsRevealing(false);
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || !showInputBox) return;

        stopAudio();

        const userInput = inputText;

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
        if (displayMode === '全屏' && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('全屏失败:', err);
            });
        }

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

    useEffect(() => {
        if (displayMode === '全屏' && !document.fullscreenElement && !hasShownFullscreenTip.current && settingsLoadedRef.current) {
            hasShownFullscreenTip.current = true;
            info('点击页面任意位置即可进入全屏模式', {
                title: '全屏提示',
                duration: 5000,
            });
        }
    }, [displayMode, settingsLoadedRef]);

    const showLoading = isLoading && !showInputBox;
    const shouldShowContent = !showInputBox && !showLoading && currentContent;
    const displayContent = shouldShowContent ? currentContent : '';

    const handleTextSpeedChange = useCallback((speed: number) => {
        setTextSpeed(speed);
    }, []);

    const handleVoiceVolumeChange = useCallback((volume: number) => {
        setVoiceVolume(volume);
        if (audioRef.current) {
            audioRef.current.volume = volume / 100;
        }
    }, []);

    return (
        <>
            <div
                className="relative h-screen w-full overflow-hidden bg-black"
                style={{ cursor: `url('/styles/galgame/ui/cursor.png'), auto` }}
                onClick={handleRootClick}
            >
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        backgroundImage: "url('/Scene/Scence_10_2.png')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <LilithPortrait
                        bodyState={bodyState}
                        expression={currentExpression}
                        animated={false}
                        scale={1.9}
                        className="translate-y-170"
                    />
                </div>

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

                <SettingsOverlay
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onTextSpeedChange={handleTextSpeedChange}
                    onVoiceVolumeChange={handleVoiceVolumeChange}
                />
            </div>
        </>
    );
}