'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

// 表情映射表类型
interface ExpressionData {
    file_name: string;
    emotion: string;
    description: string;
    eyes: string;
    mouth: string;
}

// 基准尺寸（从 HTML 中提取的原始测试尺寸）
const BASE_SIZE = {
    width: 700,
    height: 700,
};

// 基准偏移量（在 700x700 画布上测试得到的最佳值）
const BASE_OFFSET = {
    left: 314.75,   // 基准 X 偏移 (px)
    top: -1.0,      // 基准 Y 偏移 (px)
    width: 71,      // 基准表情显示宽度 (px)
};

// 备用映射（确保基础表情可用）
const fallbackExpressionMap: Record<string, string> = {
    calm_gentle: '/lilith/Expression/Lilithemo_1.png',
    pout_playful: '/lilith/Expression/Lilithemo_2.png',
    confident_laugh: '/lilith/Expression/Lilithemo_3.png',
    neutral_slight_upset: '/lilith/Expression/Lilithemo_4.png',
    serious_deadpan: '/lilith/Expression/Lilithemo_5.png',
    smug_playful: '/lilith/Expression/Lilithemo_6.png',
    joyful_laugh: '/lilith/Expression/Lilithemo_7.png',
    peaceful_sleeping: '/lilith/Expression/Lilithemo_8.png',
    surprised_slight: '/lilith/Expression/Lilithemo_9.png',
    gentle_smile_closed: '/lilith/Expression/Lilithemo_10.png',
    cheerful_laughing: '/lilith/Expression/Lilithemo_11.png',
    upset_whimper: '/lilith/Expression/Lilithemo_12.png',
    blank_dazed: '/lilith/Expression/Lilithemo_13.png',
    questioning: '/lilith/Expression/Lilithemo_65.png',
    blush: '/lilith/Expression/Lilithemo_blush.png',
    sweat: '/lilith/Expression/Lilithemo_sweat_1.png',
};

let expressionMap: Record<string, string> = { ...fallbackExpressionMap };

const loadExpressionMapping = async () => {
    try {
        const response = await fetch('/lilith/Expression_Mapping_Table.json');
        const data = await response.json();
        const expressions = data[1] as ExpressionData[];
        
        const newMap: Record<string, string> = {};
        expressions.forEach((exp) => {
            newMap[exp.emotion] = `/lilith/Expression/${exp.file_name}`;
        });
        
        newMap['blush'] = '/lilith/Expression/Lilithemo_blush.png';
        newMap['sweat_1'] = '/lilith/Expression/Lilithemo_sweat_1.png';
        newMap['sweat_2'] = '/lilith/Expression/Lilithemo_sweat_2.png';
        
        // 更新 allExpressions
        allExpressions = { ...fallbackExpressionMap, ...newMap };
        
        Object.assign(expressionMap, newMap);
    } catch (error) {
        console.error('加载表情映射失败，使用备用映射:', error);
    }
};

if (typeof window !== 'undefined') {
    loadExpressionMapping();
}
let allExpressions: Record<string, string> = { ...fallbackExpressionMap };

export type ExpressionType = keyof typeof allExpressions;

// 智能计算偏移量
interface CalculatedOffset {
    left: number;
    top: number;
    width: number;
}

/**
 * 根据目标尺寸智能计算表情偏移量和大小
 * @param targetWidth - 目标身体画布宽度
 * @param targetHeight - 目标身体画布高度
 * @param customOffset - 可选的自定义偏移覆盖
 * @returns 计算后的偏移量
 */
const calculateOffset = (
    targetWidth: number,
    targetHeight: number,
    customOffset?: Partial<CalculatedOffset>
): CalculatedOffset => {
    // 计算缩放比例（使用宽度作为主要参考，高度作为次要参考）
    const scaleX = targetWidth / BASE_SIZE.width;
    const scaleY = targetHeight / BASE_SIZE.height;
    
    // 使用宽高比例的平均值作为综合缩放因子（保持表情比例与身体协调）
    const scale = (scaleX + scaleY) / 2;
    
    // 基础计算结果
    const calculated = {
        left: BASE_OFFSET.left * scaleX,      // X 偏移主要随宽度缩放
        top: BASE_OFFSET.top * scaleY,        // Y 偏移主要随高度缩放
        width: BASE_OFFSET.width * scale,     // 表情宽度随综合缩放
    };
    
    // 应用自定义覆盖
    return {
        left: customOffset?.left ?? calculated.left,
        top: customOffset?.top ?? calculated.top,
        width: customOffset?.width ?? calculated.width,
    };
};

interface LilithPortraitProps {
    /** 身体状态图片（基础立绘）1 或 2 */
    bodyState: 1 | 2;
    /** 当前表情（emotion 字符串） */
    expression: string;
    /** 是否显示过渡动画 */
    animated?: boolean;
    /** 自定义类名 */
    className?: string;
    /** 图片质量 */
    quality?: number;
    /** 整体透明度 */
    opacity?: number;
    /** 整体缩放比例 */
    scale?: number;
    /** 身体画布尺寸（可选，默认 700x700） */
    bodySize?: { width: number; height: number };
    /** 手动覆盖表情偏移量（可选，优先级最高） */
    expressionOffset?: Partial<CalculatedOffset>;
    /** 开发模式：显示调试信息（表情名称、偏移量等） */
    dev_mode?: boolean;
}

export default function LilithPortrait({
    bodyState,
    expression,
    animated = true,
    className = '',
    quality = 90,
    opacity = 1,
    scale = 1,
    bodySize = BASE_SIZE,
    expressionOffset,
    dev_mode = false,
}: LilithPortraitProps) {
    const [currentExpression, setCurrentExpression] = useState(expression);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        setMounted(true);
    }, []);

    const expressionPath = allExpressions[expression] || allExpressions['calm_gentle'];
    const bodyPath = `/lilith/Lilith_state_${bodyState}.png`;

    useEffect(() => {
        if (!animated || !mounted) {
            setCurrentExpression(expression);
            return;
        }

        if (expression !== currentExpression) {
            setIsTransitioning(true);
            const timeout = setTimeout(() => {
                setCurrentExpression(expression);
                setTimeout(() => {
                    setIsTransitioning(false);
                }, 50);
            }, 150);
            return () => clearTimeout(timeout);
        }
    }, [expression, currentExpression, animated, mounted]);

    const finalExpressionPath = allExpressions[currentExpression] || allExpressions['calm_gentle'];

    // 智能计算当前尺寸下的偏移量
    const computedOffset = calculateOffset(
        bodySize.width,
        bodySize.height,
        expressionOffset
    );

    // 处理图片加载完成，获取原始尺寸用于计算实际高度
    const handleExpressionLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    if (!mounted) {
        return (
            <div className={`relative inline-block ${className}`} style={{ transform: `scale(${scale})` }}>
                <div className="w-[350px] h-[500px] bg-gray-800/20" />
            </div>
        );
    }

    // 计算表情的实际显示高度（保持原始宽高比）
    const expressionDisplayHeight = imgSize.height
        ? computedOffset.width * (imgSize.height / imgSize.width)
        : computedOffset.width;

    return (
        <div
            className={`relative inline-block ${className}`}
            style={{
                transform: `scale(${scale})`,
                transformOrigin: 'bottom center',
                opacity: opacity,
            }}
        >
            <div
                className="relative"
                style={{
                    width: bodySize.width,
                    height: bodySize.height,
                    minWidth: bodySize.width,
                    minHeight: bodySize.height,
                }}
            >
                {/* 身体基础立绘 */}
                <div className="absolute inset-0">
                    <Image
                        src={bodyPath}
                        alt={`莉莉丝 状态${bodyState}`}
                        width={bodySize.width}
                        height={bodySize.height}
                        priority
                        className="select-none pointer-events-none"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        quality={quality}
                    />
                </div>

                {/* 表情叠加层 - 使用智能计算的偏移量定位 */}
                <div
                    className={`absolute transition-opacity duration-200 ${
                        isTransitioning ? 'opacity-0' : 'opacity-100'
                    }`}
                    style={{
                        left: computedOffset.left,
                        top: computedOffset.top,
                        width: computedOffset.width,
                        height: expressionDisplayHeight,
                    }}
                >
                    <Image
                        src={finalExpressionPath}
                        alt={`莉莉丝表情: ${expression}`}
                        width={computedOffset.width}
                        height={expressionDisplayHeight}
                        priority
                        className="select-none pointer-events-none"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        quality={quality}
                        onLoad={handleExpressionLoad}
                    />
                </div>
            </div>

            {/* 开发模式调试信息 - 通过 dev_mode 控制 */}
            {dev_mode && (
                <div className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-2 py-1 rounded-r z-10 font-mono">
                    <div>{currentExpression}</div>
                    <div className="text-[10px] text-gray-300">
                        offset: {Math.round(computedOffset.left)}x{Math.round(computedOffset.top)} / w:{Math.round(computedOffset.width)}
                    </div>
                </div>
            )}
        </div>
    );
}