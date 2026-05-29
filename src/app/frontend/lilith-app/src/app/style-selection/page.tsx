'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimationText } from '@/components/AnimationText';
import { Button } from '@/components/Button';

interface StyleOption {
    id: string;
    title: string;
    description: string;
    icon: string;
}

const styleOptions: StyleOption[] = [
    {
        id: 'Galgame',
        title: '不/存在的你，和我',
        description: '《不/存在》系列的初版游戏对话风格，梦开始的地方',
        icon: '🥚',
    },
    {
        id: 'Not Found',
        title: 'Not Found',
        description: '我们没做第二个风格，嘻嘻',
        icon: '❌',
    },
];

export default function StyleSelectionPage() {
    const router = useRouter();
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    
    // 新增状态：控制文本显示
    const [isLilithMode, setIsLilithMode] = useState(false);
    const [isGlitching, setIsGlitching] = useState(false);
    const [displayText, setDisplayText] = useState('你');

    // 乱码字符集
    const glitchChars = 'QWERTYUIOPASDFGHJKLZXCVBNM@#$%&';

    const getRandomGlitchChar = () => {
        return glitchChars[Math.floor(Math.random() * glitchChars.length)];
    };

    const glitchText = async (text: string, targetText: string, callback: () => void) => {
        setIsGlitching(true);
        const steps = 8;
        const duration = 400;
        const stepDuration = duration / steps;

        for (let i = 0; i <= steps; i++) {
            await new Promise(resolve => setTimeout(resolve, stepDuration));
            if (i === steps) {
                setDisplayText(targetText);
            } else {
                // 生成乱码
                const glitched = text.split('').map(() => getRandomGlitchChar()).join('');
                setDisplayText(glitched);
            }
        }
        setIsGlitching(false);
        callback();
    };

    const handleYouClick = async () => {
        if (isGlitching) return; // 防止动画期间重复点击

        if (!isLilithMode) {
            await glitchText('你', '莉莉丝', () => {
                setIsLilithMode(true);
                setSelectedStyle('Galgame');
            });
        } else {
            await glitchText('莉莉丝', '你', () => {
                setIsLilithMode(false);
            });
        }
    };

    const handleStyleSelect = (optionId: string) => {
        if (isLilithMode) return;
        setSelectedStyle(optionId);
    };

    const handleConfirm = () => {
        if (selectedStyle) {
            setIsConfirming(true);
            localStorage.setItem('chatStyle', selectedStyle);
            localStorage.setItem('isLilithMode', String(isLilithMode));
            router.push('/chat');
        }
    };

    return (
        <div
            className="relative flex min-h-screen flex-col items-center justify-center px-4"
            style={{
                backgroundImage: "url('/background/bg_001.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
            }}
        >
            {/* 半透明遮罩层 */}
            <div className="absolute inset-0 bg-black/40" />

            {/* 内容区域 */}
            <div className="relative z-10 w-full max-w-4xl">
                {/* 标题区域 */}
                <div className="mb-12 text-center">
                    <AnimationText
                        text={isLilithMode ? '她的对话风格' : '选择你的对话风格'}
                        className="mb-4 text-3xl font-semibold tracking-tight text-white drop-shadow-lg sm:text-4xl"
                        delay={0}
                        duration={500}
                    />
                    <p className="text-md text-white/80 drop-shadow-md">
                        <span
                            onClick={handleYouClick}
                            className={`inline-block cursor-pointer transition-all duration-200 ${isLilithMode ? 'font-weilaiyuan' : 'font-sans'} ${
                                isGlitching 
                                    ? 'animate-pulse' 
                                    : 'hover:scale-110 hover:text-white'
                            }`}
                            style={{
                                textShadow: isGlitching ? '0 0 5px rgba(255,0,0,0.5)' : 'none',
                            }}
                        >
                            {displayText}
                        </span>
                        {isLilithMode ? ' 的选择' : ' 的设置'}
                    </p>
                </div>

                {/* 风格选项网格 */}
                <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    {styleOptions.map((option, index) => (
                        <div
                            key={option.id}
                            className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 backdrop-blur-sm overflow-hidden ${
                                selectedStyle === option.id
                                    ? 'border-white bg-white/20 shadow-lg'
                                    : 'border-white/30 bg-white/10 hover:border-white/50 hover:bg-white/15'
                            } ${isLilithMode && option.id !== 'Galgame' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={{
                                opacity: 0,
                                transform: 'translateY(20px)',
                                animation: `fadeInUp 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) forwards`,
                                animationDelay: `${100 + index * 100}ms`,
                            }}
                            onClick={() => handleStyleSelect(option.id)}
                        >
                            {/* 背景图标 - 放在右侧 */}
                            <div
                                className="absolute text-8xl opacity-20"
                                style={{
                                    right: '-10%',
                                    top: '50%',
                                    transform: 'translateY(-50%) rotate(10deg)',
                                }}
                            >
                                {option.icon}
                            </div>

                            {/* 前景内容 */}
                            <div className="relative z-10">
                                <h3
                                    className={`mb-2 text-xl font-semibold ${
                                        selectedStyle === option.id
                                            ? 'text-white'
                                            : 'text-white/90'
                                    }`}
                                >
                                    {option.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-white/80">
                                    {option.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 确认按钮 */}
                <div className="flex justify-center">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleConfirm}
                        disabled={!selectedStyle || isConfirming}
                        isLoading={isConfirming}
                    >
                        确认
                    </Button>
                </div>
            </div>

            {/* 添加 CSS 动画 */}
            <style jsx>{`
                @keyframes fadeInUp {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}