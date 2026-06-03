'use client';

import { useState, useEffect, useRef } from 'react';
import Slider from './Slider';
import OptionSelector from './OptionSelector';
import DisplayModeSelector from './DisplayModeSelector';

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

// 悬停提示文案映射表
const hoverMessages: Record<string, string> = {
    '显示模式': 'G_END1_PlayerText3: 你希望世界以何种形式呈现在你的面前呢？',
    '文本显示速度': 'G_END1_PlayerText4: 你希望我说话快一点或慢一点吗？没问题的哦~',
    '背景音乐音量': 'G_END1_PlayerText5: 希望它不会影响到我的声音呢~',
    '音效音量': 'G_END1_PlayerText6: 在这里可以调节游戏效果音的大小哦。',
    '语音音量': 'G_END1_PlayerText7: 这样的声音可以吗~',
    '静音背景音乐': 'G_END1_PlayerText8: 如果「静音」也是一种背景音乐，那该如何静音「静音」呢……？',
    '静音音效': 'G_END1_PlayerText9: 就像在宇宙的中心目睹一颗星球无声地爆炸。',
    '静音乐语音': 'G_END1_PlayerText10: 会听不到莉莉丝的声音哦~',
    '游戏语音': 'G_END1_PlayerText11: 魔法少女莉莉丝可是无所不能的！',
    '游戏语言': 'G_END1_PlayerText12: 你希望世界以何种符号呈现在你的面前呢？',
    '恢复默认': 'G_END1_PlayerText13: 想听一听我的建议吗？',
    '返回': 'G_END2_PlayerText14: 保存并退出设置界面。',
    'default': 'G_END1_PlayerText1: 在这里调整我们的世界~',
};

export default function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
    const [displayMode, setDisplayMode] = useState('窗口');
    const [textSpeed, setTextSpeed] = useState(70);
    const [bgmVolume, setBgmVolume] = useState(80);
    const [sfxVolume, setSfxVolume] = useState(80);
    const [voiceVolume, setVoiceVolume] = useState(80);
    const [gameVoice, setGameVoice] = useState('汉语');
    const [gameLanguage, setGameLanguage] = useState('简体中文');

    // 悬停提示状态
    const [targetMessage, setTargetMessage] = useState(hoverMessages['default']);
    const [displayMessage, setDisplayMessage] = useState(hoverMessages['default']);
    const [revealProgress, setRevealProgress] = useState(1);
    const [isRevealing, setIsRevealing] = useState(false);
    const [animationKey, setAnimationKey] = useState(0);
    const animationRef = useRef<number | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 提取纯文本（去掉标识符）
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

    // 处理悬停离开 - 延迟恢复默认，避免快速移动时的闪烁
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

    if (!isOpen) return null;

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

    return (
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

            {/* 背景叠加层 - 红色氛围 */}
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
                    <div className="flex-1 flex justify-end">
                        <button
                            onClick={onClose}
                            onMouseEnter={() => handleHoverEnter(hoverMessages['返回'])}
                            onMouseLeave={handleHoverLeave}
                            className="text-white text-2xl font-black hover:text-gray-300 transition-colors leading-none self-end"
                        >
                            返回
                        </button>
                    </div>
                </div>

                {/* 分割线 */}
                <div className="w-full max-w-4xl h-[2px] bg-white/80 mt-4 mb-4" />

                {/* 副标题 - 动态悬停提示（带逐字动画） */}
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

                    {/* 背景音乐音量 */}
                    {/*
                    <div
                        onMouseEnter={() => handleHoverEnter(hoverMessages['背景音乐音量'])}
                        onMouseLeave={handleHoverLeave}
                    >
                        <Slider
                            id="bgmVolume"
                            label="背景音乐音量"
                            value={bgmVolume}
                            onChange={setBgmVolume}
                            showMute
                            onMuteClick={() => setBgmVolume(0)}
                            onMuteHover={() => handleHoverEnter(hoverMessages['静音背景音乐'])}
                            onMuteLeave={handleHoverLeave}
                        />
                    </div>

                    {/* 音效音量 */}
                    {/*
                    <div
                        onMouseEnter={() => handleHoverEnter(hoverMessages['音效音量'])}
                        onMouseLeave={handleHoverLeave}
                    >
                        <Slider
                            id="sfxVolume"
                            label="音效音量"
                            value={sfxVolume}
                            onChange={setSfxVolume}
                            showMute
                            onMuteClick={() => setSfxVolume(0)}
                            onMuteHover={() => handleHoverEnter(hoverMessages['静音音效'])}
                            onMuteLeave={handleHoverLeave}
                        />
                    </div>*/}

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
                            onClick={() => {
                                setTextSpeed(70);
                                setBgmVolume(80);
                                setSfxVolume(80);
                                setVoiceVolume(80);
                                setGameVoice('汉语');
                                setGameLanguage('简体中文');
                                setDisplayMode('窗口');
                            }}
                            className="text-white text-2xl font-black hover:text-gray-300 transition-colors"
                        >
                            恢复默认
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}