'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebSocketClient, AdvancedSettings } from '@/lib/websocket';
import useNotice from './Notice';

interface AdvancedSettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChanged?: (settings: AdvancedSettings) => void;
}

type TabType = '系统' | 'LLM' | 'TTS' | '记忆' | '会话';

const Icons = {
    系统: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    LLM: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
    ),
    TTS: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
    ),
    记忆: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
    ),
    会话: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
    ),
};

export default function AdvancedSettingsOverlay({ isOpen, onClose, onSettingsChanged }: AdvancedSettingsOverlayProps) {
    const [activeTab, setActiveTab] = useState<TabType>('系统');
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 系统设置
    const [webUIPort, setWebUIPort] = useState('8080');
    const [exposePublic, setExposePublic] = useState(false);

    // LLM 设置
    const [llmApiUrl, setLlmApiUrl] = useState('');
    const [llmApiKey, setLlmApiKey] = useState('');
    const [llmModelId, setLlmModelId] = useState('');
    const [llmProtocol, setLlmProtocol] = useState<'OpenAI' | 'Anthropic'>('OpenAI');

    // TTS 设置
    const [ttsApiUrl, setTtsApiUrl] = useState('');
    const [ttsApiKey, setTtsApiKey] = useState('');
    const [useLocalTTS, setUseLocalTTS] = useState(true);
    const [localTTSPort, setLocalTTSPort] = useState('5200');
    const [localTTSStatus, setLocalTTSStatus] = useState<'online' | 'offline' | 'checking'>('checking');

    // 记忆设置
    const [memoryEnabled, setMemoryEnabled] = useState(true);
    const [memoryDbPath, setMemoryDbPath] = useState('./lilith_memory.json');

    // 会话设置
    const [sessionId, setSessionId] = useState('default-session');

    const wsClient = getWebSocketClient();
    const { info, warning, error: showError } = useNotice();

    // 加载高级设置
    const loadAdvancedSettings = useCallback(() => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法加载高级设置', { title: '连接失败' });
            return;
        }

        setLoading(true);
        
        wsClient.setAdvancedSettingsCallback((settings: AdvancedSettings) => {
            console.log('收到高级设置:', settings);
            
            if (settings.system) {
                setWebUIPort(settings.system.webUIPort || '8080');
                setExposePublic(settings.system.exposePublic || false);
            }
            
            if (settings.llm) {
                setLlmApiUrl(settings.llm.apiUrl || '');
                setLlmApiKey(settings.llm.apiKey || '');
                setLlmModelId(settings.llm.modelId || '');
                setLlmProtocol(settings.llm.protocol || 'OpenAI');
            }
            
            if (settings.tts) {
                setUseLocalTTS(settings.tts.useLocalTTS ?? true);
                setLocalTTSPort(settings.tts.localTTSPort || '5200');
                setTtsApiUrl(settings.tts.apiUrl || '');
                setTtsApiKey(settings.tts.apiKey || '');
            }
            
            if (settings.memory) {
                setMemoryEnabled(settings.memory.enabled ?? true);
                setMemoryDbPath(settings.memory.dbPath || './lilith_memory.json');
            }
            
            if (settings.session) {
                setSessionId(settings.session.sessionId || 'default-session');
            }
            
            setLoading(false);
        });
        
        wsClient.getAdvancedSettings();
    }, [wsClient, info, warning]);

    // 保存高级设置
    const saveAdvancedSettings = useCallback(async () => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法保存设置', { title: '保存失败' });
            return;
        }

        setIsSaving(true);
        
        const settings: AdvancedSettings = {
            system: {
                webUIPort,
                exposePublic,
            },
            llm: {
                apiUrl: llmApiUrl,
                apiKey: llmApiKey,
                modelId: llmModelId,
                protocol: llmProtocol,
            },
            tts: {
                useLocalTTS,
                localTTSPort,
                apiUrl: ttsApiUrl,
                apiKey: ttsApiKey,
            },
            memory: {
                enabled: memoryEnabled,
                dbPath: memoryDbPath,
            },
            session: {
                sessionId,
            },
        };
        
        wsClient.updateAdvancedSettings(settings);
        
        setTimeout(() => {
            setIsSaving(false);
            info('已保存', { title: '保存成功' });
            onSettingsChanged?.(settings);
        }, 500);
    }, [wsClient, webUIPort, exposePublic, llmApiUrl, llmApiKey, llmModelId, llmProtocol, useLocalTTS, localTTSPort, ttsApiUrl, ttsApiKey, memoryEnabled, memoryDbPath, sessionId, onSettingsChanged, info, warning]);

    // 检查本地TTS状态
    const checkLocalTTS = useCallback(async () => {
        setLocalTTSStatus('checking');
        try {
            const res = await fetch(`http://localhost:${localTTSPort}/health`);
            if (res.ok) {
                setLocalTTSStatus('online');
                info('TTS服务已就绪', { title: 'TTS在线' });
            } else {
                setLocalTTSStatus('offline');
            }
        } catch {
            setLocalTTSStatus('offline');
        }
    }, [localTTSPort, info]);

    // 启动本地TTS
    const launchLocalTTS = useCallback(async () => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法启动TTS服务', { title: '启动失败' });
            return;
        }
        
        try {
            info('正在启动TTS服务，请稍候...', { title: '启动中' });
            const result = await wsClient.launchTTS(localTTSPort);
            if (result.status === 'success') {
                setTimeout(checkLocalTTS, 2000);
                info('TTS服务正在启动中', { title: '启动中' });
            } else {
                showError('启动失败: ' + result.message, { title: '启动失败' });
            }
        } catch (err) {
            console.error('唤起失败:', err);
            showError('启动失败，请检查TTS服务配置', { title: '启动失败' });
        }
    }, [wsClient, localTTSPort, checkLocalTTS, info, warning, showError]);

    // 删除会话
    const deleteSession = useCallback(async () => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法删除会话', { title: '操作失败' });
            return;
        }
        
        try {
            const result = await wsClient.deleteSession(sessionId);
            if (result.status === 'success') {
                info('会话已删除', { title: '删除成功' });
                setSessionId('default-session');
            } else {
                showError('删除失败: ' + result.message, { title: '删除失败' });
            }
        } catch (err) {
            console.error('删除失败:', err);
            showError('删除失败，请稍后重试', { title: '删除失败' });
        }
    }, [wsClient, sessionId, info, warning, showError]);

    // 压缩会话
    const compressSession = useCallback(async () => {
        if (!wsClient.isConnected()) {
            warning('WebSocket未连接，无法压缩会话', { title: '操作失败' });
            return;
        }
        
        try {
            const result = await wsClient.compressSession(sessionId);
            if (result.status === 'success') {
                info('会话压缩完成', { title: '压缩成功' });
            } else {
                showError('压缩失败: ' + result.message, { title: '压缩失败' });
            }
        } catch (err) {
            console.error('压缩失败:', err);
            showError('压缩失败，请稍后重试', { title: '压缩失败' });
        }
    }, [wsClient, sessionId, info, warning, showError]);

    // 当弹窗打开时加载设置
    useEffect(() => {
        if (isOpen) {
            if (wsClient.isConnected()) {
                loadAdvancedSettings();
            } else {
                const checkConnection = setInterval(() => {
                    if (wsClient.isConnected()) {
                        clearInterval(checkConnection);
                        loadAdvancedSettings();
                    }
                }, 100);
                setTimeout(() => clearInterval(checkConnection), 5000);
            }
        }
    }, [isOpen, wsClient, loadAdvancedSettings]);

    // 检查TTS状态
    useEffect(() => {
        if (useLocalTTS && isOpen) {
            checkLocalTTS();
        }
    }, [useLocalTTS, isOpen, localTTSPort, checkLocalTTS]);

    const tabs: TabType[] = ['系统', 'LLM', 'TTS', '记忆', '会话'];

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full py-20">
                    <div className="text-gray-400">加载中...</div>
                </div>
            );
        }

        switch (activeTab) {
            case '系统':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">WebUI 端口</label>
                            <input
                                type="text"
                                value={webUIPort}
                                onChange={(e) => setWebUIPort(e.target.value)}
                                className="w-64 px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                            />
                            <p className="mt-2 text-xs text-gray-500">修改后需要重启应用</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-3">对公网开放</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setExposePublic(false)}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${!exposePublic
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    关闭
                                </button>
                                <button
                                    onClick={() => setExposePublic(true)}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${exposePublic
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    开启
                                </button>
                            </div>
                            {exposePublic && (
                                <p className="mt-3 text-sm text-yellow-600">警告：对公网开放可能存在安全风险</p>
                            )}
                        </div>
                    </div>
                );

            case 'LLM':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">服务商协议</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setLlmProtocol('OpenAI')}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${llmProtocol === 'OpenAI'
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    OpenAI
                                </button>
                                <button
                                    onClick={() => setLlmProtocol('Anthropic')}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${llmProtocol === 'Anthropic'
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    Anthropic
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">API 地址</label>
                            <input
                                type="text"
                                value={llmApiUrl}
                                onChange={(e) => setLlmApiUrl(e.target.value)}
                                placeholder={llmProtocol === 'OpenAI' ? 'https://api.openai.com' : 'https://api.anthropic.com'}
                                className="w-full max-w-md px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">API 密钥</label>
                            <input
                                type="password"
                                value={llmApiKey}
                                onChange={(e) => setLlmApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full max-w-md px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">模型 ID</label>
                            <input
                                type="text"
                                value={llmModelId}
                                onChange={(e) => setLlmModelId(e.target.value)}
                                placeholder={llmProtocol === 'OpenAI' ? 'gpt-4o' : 'claude-3-opus-20240229'}
                                className="w-full max-w-md px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                            />
                        </div>
                    </div>
                );

            case 'TTS':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-3">TTS 模式</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setUseLocalTTS(true)}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${useLocalTTS
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    本地服务
                                </button>
                                <button
                                    onClick={() => setUseLocalTTS(false)}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${!useLocalTTS
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    远程 API
                                </button>
                            </div>
                        </div>

                        {useLocalTTS ? (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">本地服务端口</label>
                                    <input
                                        type="text"
                                        value={localTTSPort}
                                        onChange={(e) => setLocalTTSPort(e.target.value)}
                                        className="w-48 px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-3">服务状态</label>
                                    <div className="flex items-center gap-4">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${localTTSStatus === 'online' ? 'bg-green-900/50 text-green-400' :
                                            localTTSStatus === 'offline' ? 'bg-red-900/50 text-red-400' :
                                                'bg-yellow-900/50 text-yellow-400'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${localTTSStatus === 'online' ? 'bg-green-400' :
                                                localTTSStatus === 'offline' ? 'bg-red-400' :
                                                    'bg-yellow-400 animate-pulse'
                                                }`} />
                                            {localTTSStatus === 'online' ? '在线' : localTTSStatus === 'offline' ? '离线' : '检测中'}
                                        </span>
                                        <button
                                            onClick={checkLocalTTS}
                                            className="px-3 py-1 rounded-full bg-neutral-800 text-gray-300 hover:bg-neutral-700 transition-colors text-xs"
                                        >
                                            刷新状态
                                        </button>
                                    </div>
                                </div>
                                {localTTSStatus === 'offline' && (
                                    <div>
                                        <button
                                            onClick={launchLocalTTS}
                                            className="px-4 py-1.5 rounded-full bg-blue-900/60 text-blue-300 hover:bg-blue-900/80 transition-colors text-sm"
                                        >
                                            尝试启动本地服务
                                        </button>
                                        <p className="mt-2 text-xs text-gray-500">需要先在本地运行TTS服务程序</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">API 地址</label>
                                    <input
                                        type="text"
                                        value={ttsApiUrl}
                                        onChange={(e) => setTtsApiUrl(e.target.value)}
                                        placeholder="http://localhost:5200"
                                        className="w-full max-w-md px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">API 密钥（可选）</label>
                                    <input
                                        type="password"
                                        value={ttsApiKey}
                                        onChange={(e) => setTtsApiKey(e.target.value)}
                                        className="w-full max-w-md px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                );

            case '记忆':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-3">记忆功能</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMemoryEnabled(true)}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${memoryEnabled
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    开启
                                </button>
                                <button
                                    onClick={() => setMemoryEnabled(false)}
                                    className={`px-5 py-1.5 rounded-lg transition-all text-sm ${!memoryEnabled
                                        ? 'bg-neutral-700 text-white'
                                        : 'bg-neutral-800/50 text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    关闭
                                </button>
                            </div>
                            {!memoryEnabled && (
                                <p className="mt-3 text-sm text-yellow-600">记忆功能已关闭，莉莉丝将无法记住你说过的话</p>
                            )}
                        </div>
                        {memoryEnabled && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">数据库路径</label>
                                <code className="block px-3 py-1.5 rounded-lg bg-neutral-900 text-gray-400 font-mono text-sm">
                                    {memoryDbPath}
                                </code>
                            </div>
                        )}
                    </div>
                );

            case '会话':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">当前会话 ID</label>
                            <input
                                type="text"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value)}
                                className="w-full max-w-md px-3 py-1.5 rounded-full bg-neutral-800 text-white border border-neutral-700 focus:border-neutral-500 focus:outline-none text-sm"
                            />
                            <p className="mt-2 text-xs text-gray-500">切换会话ID可以开始新的对话</p>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={deleteSession}
                                className="px-4 py-1.5 rounded-full bg-red-900/60 text-red-300 hover:bg-red-900/80 transition-colors text-sm"
                            >
                                删除当前会话
                            </button>
                            <button
                                onClick={compressSession}
                                className="px-4 py-1.5 rounded-full bg-neutral-800 text-gray-300 hover:bg-neutral-700 transition-colors text-sm"
                            >
                                压缩会话
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">压缩会将长对话摘要化，释放内存并保持上下文连贯性</p>
                    </div>
                );

            default:
                return null;
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
        >
            {/* 暗色遮罩 */}
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />

            {/* 模态面板 */}
            <div className="relative w-[800px] max-w-[85vw] h-[540px] max-h-[80vh] bg-neutral-900 rounded-2xl shadow-2xl flex overflow-hidden">
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                {/* 左侧标签栏 */}
                <div className="w-52 shrink-0 bg-neutral-900 p-4">
                    <div className="pb-3">
                        <h3 className="text-[16px] text-gray-200 tracking-wide px-2">高级设置</h3>
                    </div>
                    <div className="space-y-1">
                        {tabs.map((tab) => {
                            const Icon = Icons[tab];
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-left ${isActive
                                        ? 'bg-neutral-800 text-white'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-neutral-800/50'
                                        }`}
                                >
                                    <Icon />
                                    <span className="text-sm font-medium">{tab}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 右侧内容区 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 内容区域 */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {renderContent()}
                    </div>

                    {/* 底部保存按钮 */}
                    <div className="shrink-0 px-6 py-4 border-t border-neutral-800 flex justify-end">
                        <button
                            onClick={saveAdvancedSettings}
                            disabled={isSaving}
                            className={`px-5 py-1.5 rounded-full transition-colors text-sm font-medium ${
                                isSaving 
                                    ? 'bg-neutral-800 text-gray-500 cursor-not-allowed' 
                                    : 'bg-neutral-700 text-white hover:bg-neutral-600'
                            }`}
                        >
                            {isSaving ? '保存中...' : '保存设置'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}