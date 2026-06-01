'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';

export type NoticeType = 'info' | 'warning' | 'error';

export interface NoticeMessage {
    id: string;
    type: NoticeType;
    title?: string;
    content: string;
    duration?: number;
}

interface NoticeItemProps {
    message: NoticeMessage;
    onClose: (id: string) => void;
    onAnimationEnd: (id: string) => void;
}

// 单个通知条目组件
const NoticeItem = ({ message, onClose, onAnimationEnd }: NoticeItemProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const getBgColor = () => {
        switch (message.type) {
            case 'error':
                return 'bg-red-600/95';
            case 'warning':
                return 'bg-amber-500/95';
            case 'info':
            default:
                return 'bg-black/90';
        }
    };

    const getDefaultDuration = () => {
        switch (message.type) {
            case 'error':
                return 6000;
            case 'warning':
                return 4000;
            case 'info':
            default:
                return 4000;
        }
    };

    const duration = message.duration ?? getDefaultDuration();

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setIsVisible(false);
        setTimeout(() => {
            onAnimationEnd(message.id);
            onClose(message.id);
        }, 300);
    };

    return (
        <div
            className={`
                relative mb-3 rounded-lg shadow-2xl overflow-hidden
                transition-all duration-300 ease-out
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
                ${isExiting ? 'translate-x-full opacity-0' : ''}
            `}
            style={{
                minWidth: '280px',
                maxWidth: '360px',
            }}
        >
            <div className={`${getBgColor()} backdrop-blur-sm`}>
                <div className="flex items-start p-3 gap-3">
                    <div className="flex-shrink-0">
                        <Image
                            src="/MaodeLab_Show.svg"
                            alt="MaodeLab"
                            width={28}
                            height={28}
                            className="opacity-80"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        {message.title && (
                            <div className="font-bold text-white/90 text-sm mb-0.5">
                                {message.title}
                            </div>
                        )}
                        <div className="text-white/80 text-sm break-words">
                            {message.content}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="flex-shrink-0 text-white/60 hover:text-white transition-colors p-0.5"
                        aria-label="关闭"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div
                    className="h-0.5 bg-white/30"
                    style={{
                        animation: `shrink ${duration}ms linear forwards`,
                    }}
                />
            </div>
            <style jsx>{`
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
};

interface NoticeManagerProps {
    messages: NoticeMessage[];
    onRemove: (id: string) => void;
}

// 通知管理器组件 - 使用 memo 避免不必要的重渲染
const NoticeManager = React.memo(({ messages, onRemove }: NoticeManagerProps) => {
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

    const handleAnimationEnd = useCallback((id: string) => {
        setRemovingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const handleClose = useCallback((id: string) => {
        setRemovingIds(prev => new Set(prev).add(id));
    }, []);

    const activeMessages = messages.filter(msg => !removingIds.has(msg.id));

    if (activeMessages.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
            {activeMessages.map((message) => (
                <NoticeItem
                    key={message.id}
                    message={message}
                    onClose={handleClose}
                    onAnimationEnd={handleAnimationEnd}
                />
            ))}
        </div>
    );
});

NoticeManager.displayName = 'NoticeManager';

// 全局通知状态（单例，不受组件渲染影响）
let globalNotices: NoticeMessage[] = [];
let globalListeners: ((notices: NoticeMessage[]) => void)[] = [];

const notifyListeners = () => {
    globalListeners.forEach(listener => listener([...globalNotices]));
};

const addNotice = (type: NoticeType, content: string, options?: NoticeOptions): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const duration = options?.duration ?? (type === 'error' ? 6000 : 4000);
    const newNotice: NoticeMessage = {
        id,
        type,
        content,
        title: options?.title,
        duration,
    };
    console.log(`[Notice] 添加通知: ${type} - ${content}`);
    globalNotices = [...globalNotices, newNotice];
    notifyListeners();

    setTimeout(() => {
        removeNotice(id);
    }, duration + 300);

    return id;
};

const removeNotice = (id: string) => {
    globalNotices = globalNotices.filter(n => n.id !== id);
    notifyListeners();
};

// 全局通知 Hook - 返回稳定的函数和容器
export interface NoticeOptions {
    title?: string;
    duration?: number;
}

export const useNotice = () => {
    const info = useCallback((content: string, options?: NoticeOptions) => {
        return addNotice('info', content, options);
    }, []);

    const warning = useCallback((content: string, options?: NoticeOptions) => {
        return addNotice('warning', content, options);
    }, []);

    const error = useCallback((content: string, options?: NoticeOptions) => {
        return addNotice('error', content, options);
    }, []);

    const clearAll = useCallback(() => {
        globalNotices = [];
        notifyListeners();
    }, []);

    // NoticeContainer 是稳定的组件，不会因为父组件渲染而重新创建
    const NoticeContainer = useCallback(() => {
        const [notices, setNotices] = useState<NoticeMessage[]>([]);
        
        useEffect(() => {
            const listener = (newNotices: NoticeMessage[]) => {
                setNotices(newNotices);
            };
            globalListeners.push(listener);
            return () => {
                const index = globalListeners.indexOf(listener);
                if (index !== -1) globalListeners.splice(index, 1);
            };
        }, []);

        const handleRemove = useCallback((id: string) => {
            removeNotice(id);
        }, []);

        return <NoticeManager messages={notices} onRemove={handleRemove} />;
    }, []);

    return {
        info,
        warning,
        error,
        clearAll,
        NoticeContainer,
    };
};

// 全局通知容器组件（用于 layout）
export const GlobalNoticeContainer = () => {
    const [notices, setNotices] = useState<NoticeMessage[]>([]);

    useEffect(() => {
        const listener = (newNotices: NoticeMessage[]) => {
            setNotices(newNotices);
        };
        globalListeners.push(listener);
        return () => {
            const index = globalListeners.indexOf(listener);
            if (index !== -1) globalListeners.splice(index, 1);
        };
    }, []);

    const removeNoticeHandler = useCallback((id: string) => {
        removeNotice(id);
    }, []);

    return <NoticeManager messages={notices} onRemove={removeNoticeHandler} />;
};

export default useNotice;