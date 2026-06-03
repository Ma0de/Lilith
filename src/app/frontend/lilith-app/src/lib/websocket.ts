// lib/websocket.ts
export interface WSMessage {
    type: string;
    content: string;
    speaker: string;
    timestamp: number;
    msgId?: string;
    expression?: string;
    audio?: string;
    audioFormat?: string;
}

// 基础设置类型
export interface BasicSettings {
    displayMode: string;
    textSpeed: number;
    voiceVolume: number;
    gameVoice: string;
    gameLanguage: string;
}

// 高级设置类型
export interface AdvancedSettings {
    system: {
        webUIPort: string;
        exposePublic: boolean;
    };
    llm: {
        apiUrl: string;
        apiKey: string;
        modelId: string;
        protocol: 'OpenAI' | 'Anthropic';
    };
    tts: {
        useLocalTTS: boolean;
        localTTSPort: string;
        apiUrl: string;
        apiKey: string;
    };
    memory: {
        enabled: boolean;
        dbPath: string;
    };
    session: {
        sessionId: string;
    };
}

export interface PendingMessage {
    id: string;
    content: string;
    timestamp: number;
    retryCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    nextRetryTime?: number;
}

// 模块级别的防重复标志
let hasShownDisconnectWarning = false;
let warningResetTimer: NodeJS.Timeout | null = null;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private handlers: ((data: WSMessage) => void)[] = [];
    private isConnecting = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private shouldReconnect = true;
    private pendingMessages: Map<string, PendingMessage> = new Map();
    private statusQueryTimer: NodeJS.Timeout | null = null;
    private retryTimers: Map<string, NodeJS.Timeout> = new Map();

    private readonly BASE_DELAY = 2000;
    private readonly MAX_DELAY = 50000;
    private readonly MAX_RETRY_COUNT = 5;

    public onOpen: (() => void) | null = null;
    public onClose: (() => void) | null = null;
    public onError: ((error: Event) => void) | null = null;
    public onMessageConfirmed: ((msgId: string) => void) | null = null;
    public onRetryUpdate: ((msgId: string, retryCount: number, nextDelay: number) => void) | null = null;

    private onDisconnectCallback: (() => void) | null = null;
    private onSettingsResponse: ((settings: BasicSettings) => void) | null = null;
    private onAdvancedSettingsResponse: ((settings: AdvancedSettings) => void) | null = null;

    setDisconnectCallback(callback: (() => void) | null) {
        this.onDisconnectCallback = callback;
    }

    setSettingsCallback(callback: (settings: BasicSettings) => void) {
        this.onSettingsResponse = callback;
    }

    setAdvancedSettingsCallback(callback: (settings: AdvancedSettings) => void) {
        this.onAdvancedSettingsResponse = callback;
    }

    connect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('WebSocket 已连接，跳过');
            this.startStatusQueryLoop();
            return;
        }

        if (this.ws?.readyState === WebSocket.CONNECTING) {
            console.log('WebSocket 正在连接中...');
            return;
        }

        if (this.isConnecting) {
            console.log('防止重复连接');
            return;
        }

        this.isConnecting = true;
        this.shouldReconnect = true;

        // 硬编码连接地址
        console.log('开始连接 WebSocket...');
        this.ws = new WebSocket('ws://localhost:8080/ws');

        this.ws.onopen = () => {
            console.log('WebSocket 已连接');
            this.isConnecting = false;
            hasShownDisconnectWarning = false;
            if (warningResetTimer) {
                clearTimeout(warningResetTimer);
                warningResetTimer = null;
            }
            this.onOpen?.();
            this.checkPendingMessages();
            this.startStatusQueryLoop();
        };

        this.ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data) as WSMessage;
                console.log('收到消息:', data.type, data);

                switch (data.type) {
                    case 'status_response':
                        this.handleStatusResponse(data);
                        break;
                    case 'settings_response':
                        if (data.content && this.onSettingsResponse) {
                            const settings = JSON.parse(data.content) as BasicSettings;
                            this.onSettingsResponse(settings);
                        }
                        break;
                    case 'advanced_settings_response':
                        if (data.content && this.onAdvancedSettingsResponse) {
                            const settings = JSON.parse(data.content) as AdvancedSettings;
                            this.onAdvancedSettingsResponse(settings);
                        }
                        break;
                    case 'settings_update_response':
                    case 'advanced_settings_update_response':
                        console.log('设置更新成功:', data.type);
                        break;
                    case 'tts_launch_response':
                        console.log('TTS启动响应:', data.content);
                        break;
                    case 'delete_session_response':
                    case 'compress_session_response':
                        console.log('会话操作响应:', data.type, data.content);
                        break;
                    case 'chat':
                        if (data.msgId && this.pendingMessages.has(data.msgId)) {
                            this.clearRetryTimer(data.msgId);
                            this.pendingMessages.delete(data.msgId);
                            this.onMessageConfirmed?.(data.msgId);
                            console.log(`消息 ${data.msgId} 已被确认完成`);
                        }
                        break;
                }

                this.handlers.forEach(fn => fn(data));
            } catch (err) {
                console.error('解析失败', err);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket 已断开 (code: ${event.code}, reason: ${event.reason})`);
            this.isConnecting = false;
            this.stopStatusQueryLoop();
            this.onClose?.();

            if (event.code !== 1000 && this.onDisconnectCallback) {
                if (!hasShownDisconnectWarning) {
                    hasShownDisconnectWarning = true;
                    this.onDisconnectCallback();
                    
                    if (warningResetTimer) {
                        clearTimeout(warningResetTimer);
                    }
                    warningResetTimer = setTimeout(() => {
                        hasShownDisconnectWarning = false;
                    }, 5000);
                }
            }

            if (this.shouldReconnect && event.code !== 1000) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            this.isConnecting = false;
            this.onError?.(error);
        };
    }

    private reconnectAttemptCount = 0;

    private calculateBackoffDelay(retryCount: number): number {
        const delay = this.BASE_DELAY * Math.pow(2, retryCount - 1);
        return Math.min(delay, this.MAX_DELAY);
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        const delay = this.calculateBackoffDelay(this.reconnectAttemptCount + 1);
        console.log(`${delay / 1000}秒后尝试重连 (第${this.reconnectAttemptCount + 1}次)`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttemptCount++;
            this.connect();
        }, delay);
    }

    private resetReconnectCounter() {
        this.reconnectAttemptCount = 0;
    }

    // 获取基础设置
    getSettings(): void {
        if (!this.isConnected()) {
            console.warn('WebSocket 未连接，无法获取设置');
            return;
        }

        const message: WSMessage = {
            type: 'get_settings',
            content: '',
            speaker: 'system',
            timestamp: Date.now(),
        };
        this.ws?.send(JSON.stringify(message));
        console.log('请求基础设置');
    }

    // 更新基础设置
    updateSettings(settings: BasicSettings): void {
        if (!this.isConnected()) {
            console.warn('WebSocket 未连接，无法更新设置');
            return;
        }

        const message: WSMessage = {
            type: 'update_settings',
            content: JSON.stringify(settings),
            speaker: 'system',
            timestamp: Date.now(),
        };
        this.ws?.send(JSON.stringify(message));
        console.log('更新基础设置:', settings);
    }

    // 获取高级设置
    getAdvancedSettings(): void {
        if (!this.isConnected()) {
            console.warn('WebSocket 未连接，无法获取高级设置');
            return;
        }

        const message: WSMessage = {
            type: 'get_advanced_settings',
            content: '',
            speaker: 'system',
            timestamp: Date.now(),
        };
        this.ws?.send(JSON.stringify(message));
        console.log('请求高级设置');
    }

    // 更新高级设置
    updateAdvancedSettings(settings: AdvancedSettings): void {
        if (!this.isConnected()) {
            console.warn('WebSocket 未连接，无法更新高级设置');
            return;
        }

        const message: WSMessage = {
            type: 'update_advanced_settings',
            content: JSON.stringify(settings),
            speaker: 'system',
            timestamp: Date.now(),
        };
        this.ws?.send(JSON.stringify(message));
        console.log('更新高级设置');
    }

    // 启动本地TTS
    launchTTS(localPort: string): Promise<{ status: string; message: string }> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('WebSocket 未连接'));
                return;
            }

            const msgId = this.generateMsgId();
            const timeout = setTimeout(() => {
                reject(new Error('TTS启动请求超时'));
            }, 10000);

            const handler = (data: WSMessage) => {
                if (data.type === 'tts_launch_response' && data.msgId === msgId) {
                    clearTimeout(timeout);
                    try {
                        const result = JSON.parse(data.content);
                        resolve(result);
                    } catch {
                        resolve({ status: 'failed', message: data.content });
                    }
                    this.handlers = this.handlers.filter(h => h !== handler);
                }
            };

            this.handlers.push(handler);

            const message: WSMessage = {
                type: 'launch_tts',
                content: JSON.stringify({ port: localPort }),
                speaker: 'system',
                timestamp: Date.now(),
                msgId: msgId,
            };
            this.ws?.send(JSON.stringify(message));
        });
    }

    // 删除会话
    deleteSession(sessionId: string): Promise<{ status: string; message: string }> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('WebSocket 未连接'));
                return;
            }

            const msgId = this.generateMsgId();
            const timeout = setTimeout(() => {
                reject(new Error('删除会话请求超时'));
            }, 10000);

            const handler = (data: WSMessage) => {
                if (data.type === 'delete_session_response' && data.msgId === msgId) {
                    clearTimeout(timeout);
                    try {
                        const result = JSON.parse(data.content);
                        resolve(result);
                    } catch {
                        resolve({ status: 'failed', message: data.content });
                    }
                    this.handlers = this.handlers.filter(h => h !== handler);
                }
            };

            this.handlers.push(handler);

            const message: WSMessage = {
                type: 'delete_session',
                content: JSON.stringify({ sessionId }),
                speaker: 'system',
                timestamp: Date.now(),
                msgId: msgId,
            };
            this.ws?.send(JSON.stringify(message));
        });
    }

    // 压缩会话
    compressSession(sessionId: string): Promise<{ status: string; message: string }> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('WebSocket 未连接'));
                return;
            }

            const msgId = this.generateMsgId();
            const timeout = setTimeout(() => {
                reject(new Error('压缩会话请求超时'));
            }, 10000);

            const handler = (data: WSMessage) => {
                if (data.type === 'compress_session_response' && data.msgId === msgId) {
                    clearTimeout(timeout);
                    try {
                        const result = JSON.parse(data.content);
                        resolve(result);
                    } catch {
                        resolve({ status: 'failed', message: data.content });
                    }
                    this.handlers = this.handlers.filter(h => h !== handler);
                }
            };

            this.handlers.push(handler);

            const message: WSMessage = {
                type: 'compress_session',
                content: JSON.stringify({ sessionId }),
                speaker: 'system',
                timestamp: Date.now(),
                msgId: msgId,
            };
            this.ws?.send(JSON.stringify(message));
        });
    }

    private async checkPendingMessages() {
        if (this.pendingMessages.size === 0) return;
        console.log(`检查 ${this.pendingMessages.size} 条待处理消息`);
        for (const [msgId, pending] of this.pendingMessages) {
            if (pending.status === 'pending' || pending.status === 'processing') {
                if (pending.nextRetryTime && Date.now() >= pending.nextRetryTime) {
                    await this.queryMessageStatus(msgId);
                } else if (!pending.nextRetryTime) {
                    await this.queryMessageStatus(msgId);
                }
            }
        }
    }

    private async queryMessageStatus(msgId: string) {
        if (!this.isConnected()) {
            console.log(`WebSocket 未连接，无法查询消息 ${msgId} 的状态`);
            return;
        }

        const queryMsg: WSMessage = {
            type: 'status_query',
            content: '',
            speaker: 'system',
            timestamp: Date.now(),
            msgId: msgId
        };
        this.ws?.send(JSON.stringify(queryMsg));
        console.log(`查询消息状态: ${msgId}`);
    }

    private handleStatusResponse(data: WSMessage) {
        const msgId = data.msgId;
        if (!msgId) return;

        const pending = this.pendingMessages.get(msgId);
        if (!pending) return;

        console.log(`消息 ${msgId} 状态响应: ${data.content}`);

        switch (data.content) {
            case 'not_found':
            case 'failed':
                if (pending.retryCount < this.MAX_RETRY_COUNT) {
                    const nextDelay = this.calculateBackoffDelay(pending.retryCount + 1);
                    console.log(`消息 ${msgId} 未处理完成，将在 ${nextDelay / 1000}秒后重试`);
                    this.scheduleRetry(msgId, nextDelay);
                } else {
                    console.error(`消息 ${msgId} 重试次数已达上限，放弃重试`);
                    this.clearRetryTimer(msgId);
                    this.pendingMessages.delete(msgId);
                    this.handlers.forEach(fn => fn({
                        type: 'error',
                        content: '消息发送失败，请重试',
                        speaker: 'system',
                        timestamp: Date.now(),
                        msgId: msgId
                    }));
                }
                break;
            case 'processing':
                console.log(`消息 ${msgId} 仍在处理中...`);
                break;
            case 'completed':
                this.clearRetryTimer(msgId);
                this.pendingMessages.delete(msgId);
                console.log(`消息 ${msgId} 已完成`);
                break;
        }
    }

    private scheduleRetry(msgId: string, delay: number) {
        this.clearRetryTimer(msgId);
        const pending = this.pendingMessages.get(msgId);
        if (!pending) return;

        pending.nextRetryTime = Date.now() + delay;
        this.onRetryUpdate?.(msgId, pending.retryCount + 1, delay);

        const timer = setTimeout(() => {
            this.executeRetry(msgId);
        }, delay);
        this.retryTimers.set(msgId, timer);
    }

    private clearRetryTimer(msgId: string) {
        const timer = this.retryTimers.get(msgId);
        if (timer) {
            clearTimeout(timer);
            this.retryTimers.delete(msgId);
        }
    }

    private clearAllRetryTimers() {
        for (const timer of this.retryTimers.values()) {
            clearTimeout(timer);
        }
        this.retryTimers.clear();
    }

    private executeRetry(msgId: string) {
        const pending = this.pendingMessages.get(msgId);
        if (!pending) return;

        pending.retryCount++;
        pending.status = 'pending';
        delete pending.nextRetryTime;

        if (this.isConnected()) {
            const retryMsg: WSMessage = {
                type: 'retry',
                content: pending.content,
                speaker: 'user',
                timestamp: Date.now(),
                msgId: msgId
            };
            this.ws?.send(JSON.stringify(retryMsg));
            console.log(`重发消息 ${msgId} (${pending.retryCount}/${this.MAX_RETRY_COUNT})`);
            pending.status = 'processing';
        } else {
            console.log(`WebSocket 未连接，等待重连后重试消息 ${msgId}`);
            if (this.reconnectAttemptCount === 0) {
                this.connect();
            }
        }
    }

    private startStatusQueryLoop() {
        this.stopStatusQueryLoop();
        this.statusQueryTimer = setInterval(() => {
            if (this.isConnected() && this.pendingMessages.size > 0) {
                for (const [msgId, pending] of this.pendingMessages) {
                    if ((pending.status === 'pending' || pending.status === 'processing') &&
                        (!pending.nextRetryTime || Date.now() >= pending.nextRetryTime)) {
                        this.queryMessageStatus(msgId);
                    }
                }
            }
        }, 5000);
    }

    private stopStatusQueryLoop() {
        if (this.statusQueryTimer) {
            clearInterval(this.statusQueryTimer);
            this.statusQueryTimer = null;
        }
    }

    onMessage(handler: (data: WSMessage) => void) {
        this.handlers.push(handler);
        return () => {
            this.handlers = this.handlers.filter(h => h !== handler);
        };
    }

    send(type: string, content: string, speaker: string = 'user'): string {
        const msgId = this.generateMsgId();

        this.pendingMessages.set(msgId, {
            id: msgId,
            content: content,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending'
        });

        const message: WSMessage = {
            type,
            content,
            speaker,
            timestamp: Date.now(),
            msgId: msgId
        };

        if (this.isConnected()) {
            this.ws?.send(JSON.stringify(message));
            console.log('发送消息:', message);
            const pending = this.pendingMessages.get(msgId);
            if (pending) pending.status = 'processing';
        } else {
            console.warn('WebSocket 未连接，消息已缓存，等待重连后发送');
            if (this.reconnectAttemptCount === 0) {
                this.connect();
            }
            const delay = this.calculateBackoffDelay(1);
            this.scheduleRetry(msgId, delay);
        }

        return msgId;
    }

    private generateMsgId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    disconnect() {
        console.log('主动断开 WebSocket');
        this.shouldReconnect = false;
        this.stopStatusQueryLoop();
        this.clearAllRetryTimers();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close(1000, '正常关闭');
            this.ws = null;
        }
    }

    getPendingCount(): number {
        return this.pendingMessages.size;
    }

    getRetryInfo(msgId: string): { retryCount: number; nextDelay?: number } | null {
        const pending = this.pendingMessages.get(msgId);
        if (!pending) return null;

        let nextDelay: number | undefined;
        if (pending.nextRetryTime) {
            nextDelay = Math.max(0, pending.nextRetryTime - Date.now());
        }

        return {
            retryCount: pending.retryCount,
            nextDelay
        };
    }
}

let instance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
    if (!instance) {
        instance = new WebSocketClient();
    }
    return instance;
}