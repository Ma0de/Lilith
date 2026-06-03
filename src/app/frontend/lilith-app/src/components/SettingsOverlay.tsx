'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Slider from './Slider';
import OptionSelector from './OptionSelector';
import DisplayModeSelector from './DisplayModeSelector';
import AdvancedSettingsOverlay from './AdvancedSettingsOverlay';
import { getWebSocketClient, BasicSettings } from '@/lib/websocket';
import useNotice from './Notice';

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

// 悬停提示文案映射表
const hoverMessages: Record<string, string> = {
    '显示模式': 'G_END1_PlayerText3: 你希望世界以何种形式呈现在你的面前呢？',
    '文本显示速度': 'G_END1_PlayerText4: 你希望我说话快一点或慢一点吗？没问题的哦~',
    '语音音量': 'G_END1_PlayerText7: 这样的声音可以吗~',
    '静音乐语音': 'G_END1_PlayerText10: 会听不到莉莉丝的声音哦~',
    '游戏语音': 'G_END1_PlayerText11: 魔法少女莉莉丝可是无所不能的！',
    '游戏语言': 'G_END1_PlayerText12: 你希望世界以何种符号呈现在你的面前呢？',
    '恢复默认': 'G_END1_PlayerText13: 想听一听我的建议吗？',
    '高级': 'G_END1_PlayerText14: 更深入的设置选项，谨慎调整哦~',
    '返回': 'G_END2_PlayerText15: 保存并退出设置界面。',
    'default': 'G_END1_PlayerText1: 在这里调整我们的世界~',
};

export default function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
    const [displayMode, setDisplayMode] = useState('窗口');
    const [textSpeed, setTextSpeed] = useState(70);
    const [voiceVolume, setVoiceVolume] = useState(80);
    const [gameVoice, setGameVoice] = useState('汉语');
    const [gameLanguage, setGameLanguage] = useState('简体中文');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 悬停提示状态
    const [targetMessage, setTargetMessage] = useState(hoverMessages['default']);
    const [displayMessage, setDisplayMessage] = useState(hoverMessages['default']);
    const [revealProgress, setRevealProgress] = useState(1);
    const [isRevealing, setIsRevealing] = useState(false);
    const [animationKey, setAnimationKey] = useState(0);
    const animationRef = useRef<number | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const wsClient = getWebSocketClient();
    const { info, warning, error: showError } = useNotice();

    // 加载设置
    const loadSettings = useCallback(() => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法加载设置', { title: '加载失败' });
            return;
        }

        setLoading(true);
        
        wsClient.setSettingsCallback((settings: BasicSettings) => {
            console.log('收到基础设置:', settings);
            setDisplayMode(settings.displayMode || '窗口');
            setTextSpeed(settings.textSpeed || 70);
            setVoiceVolume(settings.voiceVolume || 80);
            setGameVoice(settings.gameVoice || '汉语');
            setGameLanguage(settings.gameLanguage || '简体中文');
            setLoading(false);
        });
        
        wsClient.getSettings();
    }, [wsClient, info, warning]);

    // 保存设置
    const saveSettings = useCallback(() => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法保存设置', { title: '保存失败' });
            return;
        }

        setIsSaving(true);
        
        const settings: BasicSettings = {
            displayMode,
            textSpeed,
            voiceVolume,
            gameVoice,
            gameLanguage,
        };
        
        wsClient.updateSettings(settings);
        
        // 保存到本地存储
        localStorage.setItem('displayMode', displayMode);
        localStorage.setItem('textSpeed', textSpeed.toString());
        localStorage.setItem('voiceVolume', voiceVolume.toString());
        localStorage.setItem('gameVoice', gameVoice);
        localStorage.setItem('gameLanguage', gameLanguage);
        
        setTimeout(() => {
            setIsSaving(false);
        }, 300);
    }, [wsClient, displayMode, textSpeed, voiceVolume, gameVoice, gameLanguage, info, warning]);

    // 恢复默认设置
    const handleReset = useCallback(() => {
        setTextSpeed(70);
        setVoiceVolume(80);
        setGameVoice('汉语');
        setGameLanguage('简体中文');
        setDisplayMode('窗口');
        
        info('设置已恢复默认', { title: '恢复成功' });
        
        // 自动保存
        setTimeout(() => {
            if (wsClient.isConnected()) {
                const settings: BasicSettings = {
                    displayMode: '窗口',
                    textSpeed: 70,
                    voiceVolume: 80,
                    gameVoice: '汉语',
                    gameLanguage: '简体中文',
                };
                wsClient.updateSettings(settings);
            }
        }, 100);
    }, [wsClient, info]);

    // 当弹窗打开时加载设置
    useEffect(() => {
        if (isOpen) {
            // 先从本地存储读取
            const savedDisplayMode = localStorage.getItem('displayMode');
            const savedTextSpeed = localStorage.getItem('textSpeed');
            const savedVoiceVolume = localStorage.getItem('voiceVolume');
            const savedGameVoice = localStorage.getItem('gameVoice');
            const savedGameLanguage = localStorage.getItem('gameLanguage');
            
            if (savedDisplayMode) setDisplayMode(savedDisplayMode);
            if (savedTextSpeed) setTextSpeed(parseInt(savedTextSpeed));
            if (savedVoiceVolume) setVoiceVolume(parseInt(savedVoiceVolume));
            if (savedGameVoice) setGameVoice(savedGameVoice);
            if (savedGameLanguage) setGameLanguage(savedGameLanguage);
            
            // 从服务器加载
            if (wsClient.isConnected()) {
                loadSettings();
            } else {
                const checkConnection = setInterval(() => {
                    if (wsClient.isConnected()) {
                        clearInterval(checkConnection);
                        loadSettings();
                    }
                }, 100);
                setTimeout(() => clearInterval(checkConnection), 5000);
            }
        }
    }, [isOpen, wsClient, loadSettings]);

    // 提取纯文本
    const getPureMessage = (msg: string) => {
        const colonIndex = msg.indexOf(':');
        if (colonIndex !== -1) {
            return msg.substring(colonIndex + 1).trim();
        }
        return msg;
    };

    // 处理悬停进入
    const handleHoverEnter = (message: string) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setTargetMessage(message);
    };

    // 处理悬停离开
    const handleHoverLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            setTargetMessage(hoverMessages['default']);
        }, 50);
    };

    // 当目标消息改变时，触发渐变动画
    useEffect(() => {
        if (targetMessage === displayMessage) return;

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        setDisplayMessage(targetMessage);
        setAnimationKey(prev => prev + 1);
        setIsRevealing(true);
        setRevealProgress(0);

        const startTime = Date.now();
        const duration = 400;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            setRevealProgress(progress);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsRevealing(false);
                setRevealProgress(1);
                animationRef.current = null;
            }
        };

        animationRef.current = requestAnimationFrame(animate);
    }, [targetMessage, displayMessage]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    // 逐字渐变渲染函数
    const renderGradientText = (text: string, progress: number, key: number) => {
        const chars = text.split('');
        const totalChars = chars.length;

        if (totalChars === 0) return null;

        const visibleCharCount = Math.floor(totalChars * progress);

        return (
            <div key={key} className="inline-block">
                {chars.map((char, index) => {
                    const opacity = index < visibleCharCount ? 1 : 0;
                    return (
                        <span
                            key={index}
                            style={{
                                opacity: opacity,
                                transition: 'opacity 0.03s ease-out',
                            }}
                        >
                            {char}
                        </span>
                    );
                })}
            </div>
        );
    };

    const currentText = getPureMessage(displayMessage);
    const progress = isRevealing ? revealProgress : 1;

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
            >
                {/* 背景图 */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: "url('/Scene/Scence_10_2.png')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'brightness(0.3) blur(2px)',
                    }}
                />

                {/* 背景叠加层 */}
                <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-black/60" />

                {/* 内容容器 */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-8 py-12">
                    {/* 顶部标题 */}
                    <div className="w-full max-w-4xl flex items-end justify-between mb-2">
                        <div className="flex-1" />
                        <h1 className="text-5xl font-black tracking-wider leading-none">
                            <span className="text-6xl text-red-500">「你」</span>
                            <span className="text-white">的设置</span>
                        </h1>
                        <div className="flex-1 flex justify-end gap-4">
                            <button
                                onClick={() => setShowAdvanced(true)}
                                onMouseEnter={() => handleHoverEnter(hoverMessages['高级'])}
                                onMouseLeave={handleHoverLeave}
                                className="text-white text-2xl font-black hover:text-gray-300 transition-colors leading-none"
                            >
                                高级
                            </button>
                            <button
                                onClick={() => {
                                    saveSettings();
                                    onClose();
                                }}
                                onMouseEnter={() => handleHoverEnter(hoverMessages['返回'])}
                                onMouseLeave={handleHoverLeave}
                                className="text-white text-2xl font-black hover:text-gray-300 transition-colors leading-none"
                            >
                                返回
                            </button>
                        </div>
                    </div>

                    {/* 分割线 */}
                    <div className="w-full max-w-4xl h-[2px] bg-white/80 mt-4 mb-4" />

                    {/* 副标题 - 动态悬停提示 */}
                    <div className="w-full max-w-6xl text-center mb-10">
                        <div
                            className="text-white/80 font-bold italic tracking-wider"
                            style={{
                                fontFamily: 'WeiLaiYuan, var(--font-geist-sans)',
                                fontSize: '1.15rem',
                                lineHeight: 1.5,
                            }}
                        >
                            {renderGradientText(currentText, progress, animationKey)}
                        </div>
                    </div>

                    {/* 设置项列表 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-white/60">加载设置中...</div>
                        </div>
                    ) : (
                        <div className="w-full max-w-4xl space-y-5">
                            {/* 显示模式 */}
                            <div
                                onMouseEnter={() => handleHoverEnter(hoverMessages['显示模式'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <DisplayModeSelector
                                    value={displayMode}
                                    onChange={setDisplayMode}
                                    options={['窗口', '全屏']}
                                    label="显示模式"
                                />
                            </div>

                            {/* 文本显示速度 */}
                            <div
                                onMouseEnter={() => handleHoverEnter(hoverMessages['文本显示速度'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <Slider
                                    id="textSpeed"
                                    label="文本显示速度"
                                    value={textSpeed}
                                    onChange={setTextSpeed}
                                />
                            </div>

                            {/* 语音音量 */}
                            <div
                                onMouseEnter={() => handleHoverEnter(hoverMessages['语音音量'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <Slider
                                    id="voiceVolume"
                                    label="语音音量"
                                    value={voiceVolume}
                                    onChange={setVoiceVolume}
                                    showMute
                                    onMuteClick={() => setVoiceVolume(0)}
                                    onMuteHover={() => handleHoverEnter(hoverMessages['静音乐语音'])}
                                    onMuteLeave={handleHoverLeave}
                                />
                            </div>

                            {/* 游戏语音 */}
                            <div
                                className="flex items-center justify-between"
                                onMouseEnter={() => handleHoverEnter(hoverMessages['游戏语音'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <div className="w-32 text-right text-white text-xl font-bold tracking-wide shrink-0">游戏语音</div>
                                <div className="flex-1 flex items-center justify-center">
                                    <OptionSelector
                                        value={gameVoice}
                                        onChange={setGameVoice}
                                        options={['汉语', '日语', '英语']}
                                    />
                                </div>
                                <div className="w-32" />
                            </div>

                            {/* 游戏语言 */}
                            <div
                                className="flex items-center justify-between"
                                onMouseEnter={() => handleHoverEnter(hoverMessages['游戏语言'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <div className="w-32 text-right text-white text-xl font-bold tracking-wide shrink-0">游戏语言</div>
                                <div className="flex-1 flex items-center justify-center">
                                    <OptionSelector
                                        value={gameLanguage}
                                        onChange={setGameLanguage}
                                        options={['简体中文', '我们没做第二个语言，嘻嘻']}
                                    />
                                </div>
                                <div className="w-32" />
                            </div>

                            {/* 恢复默认 */}
                            <div
                                className="flex items-center justify-center pt-6"
                                onMouseEnter={() => handleHoverEnter(hoverMessages['恢复默认'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <button
                                    onClick={handleReset}
                                    className="text-white text-2xl font-black hover:text-gray-300 transition-colors"
                                >
                                    恢复默认
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 高级设置弹窗 */}
            <AdvancedSettingsOverlay
                isOpen={showAdvanced}
                onClose={() => setShowAdvanced(false)}
                onSettingsChanged={(settings) => {
                    console.log('高级设置已更新:', settings);
                }}
            />
        </>
    );
}