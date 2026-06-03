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
    onTextSpeedChange?: (speed: number) => void;
    onVoiceVolumeChange?: (volume: number) => void;
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

// 全局变量存储当前音量，供其他组件使用
let globalVoiceVolume = 80;
export const getGlobalVoiceVolume = () => globalVoiceVolume;
export const setGlobalVoiceVolume = (volume: number) => {
    globalVoiceVolume = volume;
    window.dispatchEvent(new CustomEvent('voiceVolumeChange', { detail: { volume } }));
};

// 全局文本速度
let globalTextSpeed = 70;
export const getGlobalTextSpeed = () => globalTextSpeed;
export const setGlobalTextSpeed = (speed: number) => {
    globalTextSpeed = speed;
    window.dispatchEvent(new CustomEvent('textSpeedChange', { detail: { speed } }));
};

export default function SettingsOverlay({ isOpen, onClose, onTextSpeedChange, onVoiceVolumeChange }: SettingsOverlayProps) {
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
    // 存储动画启动时间，用于计算当前进度（支持速度中途改变）
    const animationStartTimeRef = useRef<number | null>(null);
    // 存储动画完成时的回调
    const animationOnCompleteRef = useRef<(() => void) | null>(null);

    const wsClient = getWebSocketClient();
    const { info, warning, error: showError } = useNotice();

    // 根据文本速度获取动画时长
    const getRevealDuration = useCallback((speed: number) => {
        // 速度值 0-100，速度越快动画越短
        // 速度 0 -> 1000ms，速度 100 -> 150ms
        const duration = Math.max(150, 1000 - (speed / 100) * 850);
        return duration;
    }, []);

    // 启动文字渐变动画（支持中途改变速度）
    const startRevealAnimation = useCallback((message: string, onComplete?: () => void) => {
        // 取消之前的动画
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        const duration = getRevealDuration(textSpeed);
        const startTime = Date.now();
        animationStartTimeRef.current = startTime;
        animationOnCompleteRef.current = onComplete || null;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            let progress = Math.min(elapsed / duration, 1);

            // 如果动画完成
            if (progress >= 1) {
                setRevealProgress(1);
                setIsRevealing(false);
                animationRef.current = null;
                animationStartTimeRef.current = null;
                if (animationOnCompleteRef.current) {
                    animationOnCompleteRef.current();
                    animationOnCompleteRef.current = null;
                }
                return;
            }

            setRevealProgress(progress);
            animationRef.current = requestAnimationFrame(animate);
        };

        setIsRevealing(true);
        animationRef.current = requestAnimationFrame(animate);
    }, [textSpeed, getRevealDuration]);

    // 当文本速度改变时，重新计算当前正在进行的动画进度
    const adjustCurrentAnimation = useCallback(() => {
        // 如果当前没有正在进行的动画，直接返回
        if (!isRevealing || animationStartTimeRef.current === null) return;

        const elapsed = Date.now() - animationStartTimeRef.current;
        const oldDuration = getRevealDuration(textSpeedBeforeChangeRef.current);
        const oldProgress = Math.min(elapsed / oldDuration, 1);

        // 如果动画已经完成，不需要调整
        if (oldProgress >= 1) return;

        // 计算剩余内容比例（1 - 已完成进度）
        const remainingRatio = 1 - oldProgress;

        // 根据新的速度计算新的剩余时间
        const newDuration = getRevealDuration(textSpeed);
        const newElapsed = newDuration * (1 - remainingRatio);

        // 重新设置动画起始时间，使得从当前视觉效果平滑过渡
        const adjustedStartTime = Date.now() - newElapsed;
        animationStartTimeRef.current = adjustedStartTime;

        // 动画循环会自动根据新的起始时间继续执行
    }, [isRevealing, textSpeed, getRevealDuration]);

    // 记录速度变化前的值
    const textSpeedBeforeChangeRef = useRef(textSpeed);

    // 当文本速度变化时，重新计算动画进度
    useEffect(() => {
        if (textSpeed !== textSpeedBeforeChangeRef.current) {
            adjustCurrentAnimation();
            textSpeedBeforeChangeRef.current = textSpeed;
        }
    }, [textSpeed, adjustCurrentAnimation]);

    // 应用显示模式（全屏/窗口）
    const applyDisplayMode = useCallback((mode: string) => {
        if (mode === '全屏') {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`全屏请求失败: ${err.message}`);
            });
        } else {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => {
                    console.warn(`退出全屏失败: ${err.message}`);
                });
            }
        }
    }, []);

    // 监听全屏变化事件，同步显示模式状态
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFullscreen = !!document.fullscreenElement;
            const newMode = isFullscreen ? '全屏' : '窗口';
            if (newMode !== displayMode) {
                setDisplayMode(newMode);
                localStorage.setItem('displayMode', newMode);
                if (wsClient.isConnected()) {
                    wsClient.updateSettings({ displayMode: newMode });
                }
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [displayMode, wsClient]);

    // 处理显示模式变更
    const handleDisplayModeChange = useCallback((mode: string) => {
        setDisplayMode(mode);
        localStorage.setItem('displayMode', mode);
        applyDisplayMode(mode);

        if (wsClient.isConnected()) {
            wsClient.updateSettings({ displayMode: mode });
        }
    }, [wsClient, applyDisplayMode]);

    // 处理文本速度变更
    const handleTextSpeedChange = useCallback((speed: number) => {
        setTextSpeed(speed);
        setGlobalTextSpeed(speed);
        localStorage.setItem('textSpeed', speed.toString());
        onTextSpeedChange?.(speed);

        if (wsClient.isConnected()) {
            wsClient.updateSettings({ textSpeed: speed });
        }
    }, [wsClient, onTextSpeedChange]);

    // 处理语音音量变更
    const handleVoiceVolumeChange = useCallback((volume: number) => {
        setVoiceVolume(volume);
        setGlobalVoiceVolume(volume);
        localStorage.setItem('voiceVolume', volume.toString());
        onVoiceVolumeChange?.(volume);

        if (wsClient.isConnected()) {
            wsClient.updateSettings({ voiceVolume: volume });
        }

        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.volume = volume / 100;
        });
    }, [wsClient, onVoiceVolumeChange]);

    // 加载设置
    const loadSettings = useCallback(() => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法加载设置', { title: '加载失败' });
            return;
        }

        setLoading(true);

        wsClient.setSettingsCallback((settings: BasicSettings) => {
            console.log('收到基础设置:', settings);
            if (settings.displayMode) {
                setDisplayMode(settings.displayMode);
                const isFullscreen = !!document.fullscreenElement;
                if (settings.displayMode === '全屏' && !isFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => { });
                } else if (settings.displayMode === '窗口' && isFullscreen) {
                    document.exitFullscreen().catch(() => { });
                }
            }
            if (settings.textSpeed) {
                setTextSpeed(settings.textSpeed);
                setGlobalTextSpeed(settings.textSpeed);
                onTextSpeedChange?.(settings.textSpeed);
            }
            if (settings.voiceVolume !== undefined) {
                setVoiceVolume(settings.voiceVolume);
                setGlobalVoiceVolume(settings.voiceVolume);
                onVoiceVolumeChange?.(settings.voiceVolume);
                const audioElements = document.querySelectorAll('audio');
                audioElements.forEach(audio => {
                    if (settings.voiceVolume !== undefined) {
                        audio.volume = settings.voiceVolume / 100;
                    }
                });
            }
            if (settings.gameVoice) setGameVoice(settings.gameVoice);
            if (settings.gameLanguage) setGameLanguage(settings.gameLanguage);
            setLoading(false);
        });

        wsClient.getSettings();
    }, [wsClient, warning, onTextSpeedChange, onVoiceVolumeChange]);

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

        localStorage.setItem('displayMode', displayMode);
        localStorage.setItem('textSpeed', textSpeed.toString());
        localStorage.setItem('voiceVolume', voiceVolume.toString());
        localStorage.setItem('gameVoice', gameVoice);
        localStorage.setItem('gameLanguage', gameLanguage);

        setTimeout(() => {
            setIsSaving(false);
        }, 300);
    }, [wsClient, displayMode, textSpeed, voiceVolume, gameVoice, gameLanguage, warning]);

    // 恢复默认设置
    const handleReset = useCallback(() => {
        handleTextSpeedChange(70);
        handleVoiceVolumeChange(80);
        setGameVoice('汉语');
        setGameLanguage('简体中文');
        handleDisplayModeChange('窗口');

        info('设置已恢复默认', { title: '恢复成功' });

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
    }, [wsClient, info, handleTextSpeedChange, handleVoiceVolumeChange, handleDisplayModeChange]);

    // 当弹窗打开时加载设置并同步状态
    useEffect(() => {
        if (isOpen) {
            const savedDisplayMode = localStorage.getItem('displayMode');
            const savedTextSpeed = localStorage.getItem('textSpeed');
            const savedVoiceVolume = localStorage.getItem('voiceVolume');
            const savedGameVoice = localStorage.getItem('gameVoice');
            const savedGameLanguage = localStorage.getItem('gameLanguage');

            if (savedDisplayMode) {
                setDisplayMode(savedDisplayMode);
                const isFullscreen = !!document.fullscreenElement;
                if (savedDisplayMode === '全屏' && !isFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => { });
                } else if (savedDisplayMode === '窗口' && isFullscreen) {
                    document.exitFullscreen().catch(() => { });
                }
            }
            if (savedTextSpeed) {
                const speed = parseInt(savedTextSpeed);
                setTextSpeed(speed);
                setGlobalTextSpeed(speed);
                onTextSpeedChange?.(speed);
            }
            if (savedVoiceVolume) {
                const volume = parseInt(savedVoiceVolume);
                setVoiceVolume(volume);
                setGlobalVoiceVolume(volume);
                onVoiceVolumeChange?.(volume);
                const audioElements = document.querySelectorAll('audio');
                audioElements.forEach(audio => {
                    audio.volume = volume / 100;
                });
            }
            if (savedGameVoice) setGameVoice(savedGameVoice);
            if (savedGameLanguage) setGameLanguage(savedGameLanguage);

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
    }, [isOpen, wsClient, loadSettings, onTextSpeedChange, onVoiceVolumeChange]);

    // 提取纯文本
    const getPureMessage = (msg: string) => {
        const colonIndex = msg.indexOf(':');
        if (colonIndex !== -1) {
            return msg.substring(colonIndex + 1).trim();
        }
        return msg;
    };

    // 处理悬停进入 - 使用文本速度进行动画
    const handleHoverEnter = useCallback((message: string) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        // 如果鼠标悬停到了相同的消息上，不要重复触发动画
        if (message === targetMessage && displayMessage === message) {
            return;
        }

        setTargetMessage(message);
        setDisplayMessage(message);
        setAnimationKey(prev => prev + 1);

        // 启动动画，使用当前文本速度
        startRevealAnimation(getPureMessage(message), () => {
            // 动画完成后的回调（可选）
        });
    }, [targetMessage, displayMessage, startRevealAnimation]);

    // 处理悬停离开
    const handleHoverLeave = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            const defaultMsg = hoverMessages['default'];
            setTargetMessage(defaultMsg);
            setDisplayMessage(defaultMsg);
            setAnimationKey(prev => prev + 1);
            startRevealAnimation(getPureMessage(defaultMsg));
        }, 50);
    }, [startRevealAnimation]);

    // 清理定时器和动画
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
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

                    {/* 副标题 - 动态悬停提示（会响应文本速度变化） */}
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
                                    onChange={handleDisplayModeChange}
                                    options={['窗口', '全屏']}
                                    label="显示模式"
                                />
                            </div>

                            {/* 文本显示速度 - 滑块本身也会触发悬停提示 */}
                            <div
                                onMouseEnter={() => handleHoverEnter(hoverMessages['文本显示速度'])}
                                onMouseLeave={handleHoverLeave}
                            >
                                <Slider
                                    id="textSpeed"
                                    label="文本显示速度"
                                    value={textSpeed}
                                    onChange={handleTextSpeedChange}
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
                                    onChange={handleVoiceVolumeChange}
                                    showMute
                                    onMuteClick={() => handleVoiceVolumeChange(0)}
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