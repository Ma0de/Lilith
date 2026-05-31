// src/lib/websocket.ts

export interface WSMessage {
    type: string;
    content: string;
    speaker: string;
    timestamp: number;
    msgId?: string;
}

export interface PendingMessage {
    id: string;
    content: string;
    timestamp: number;
    retryCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    nextRetryTime?: number; // 下次重试的时间戳
}

class WebSocketClient {
    private ws: WebSocket | null = null;
    private handlers: ((data: WSMessage) => void)[] = [];
    private isConnecting = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private shouldReconnect = true;
    private pendingMessages: Map<string, PendingMessage> = new Map();
    private statusQueryTimer: NodeJS.Timeout | null = null;
    private retryTimers: Map<string, NodeJS.Timeout> = new Map(); // 存储每个消息的重试定时器
    
    // 退避策略配置
    private readonly BASE_DELAY = 2000; // 基础延迟 2秒
    private readonly MAX_DELAY = 50000; // 最大延迟 50秒
    private readonly MAX_RETRY_COUNT = 5; // 最大重试次数（对应 2,4,8,16,32秒，下次是50秒上限）
    
    public onOpen: (() => void) | null = null;
    public onClose: (() => void) | null = null;
    public onError: ((error: Event) => void) | null = null;
    public onMessageConfirmed: ((msgId: string) => void) | null = null;
    public onRetryUpdate: ((msgId: string, retryCount: number, nextDelay: number) => void) | null = null;

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
        
        console.log('开始连接 WebSocket...');
        this.ws = new WebSocket('ws://localhost:8080/ws');

        this.ws.onopen = () => {
            console.log('WebSocket 已连接');
            this.isConnecting = false;
            this.onOpen?.();
            
            // 连接成功后，检查待处理消息
            this.checkPendingMessages();
            this.startStatusQueryLoop();
        };

        this.ws.onmessage = (e) => {
            console.log('原始消息:', e.data);
            try {
                const data = JSON.parse(e.data) as WSMessage;
                
                // 处理状态响应
                if (data.type === 'status_response') {
                    this.handleStatusResponse(data);
                }
                // 处理聊天回复
                else if (data.type === 'chat' && data.msgId) {
                    // 标记消息为已完成
                    if (this.pendingMessages.has(data.msgId)) {
                        this.clearRetryTimer(data.msgId);
                        this.pendingMessages.delete(data.msgId);
                        this.onMessageConfirmed?.(data.msgId);
                        console.log(`消息 ${data.msgId} 已被确认完成`);
                    }
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
            
            if (this.shouldReconnect && event.code !== 1000) {
                // 使用指数退避重连
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            this.isConnecting = false;
            this.onError?.(error);
        };
    }

    // 计算退避延迟（指数退避，上限50秒）
    private calculateBackoffDelay(retryCount: number): number {
        // 第1次失败: 2秒
        // 第2次失败: 4秒  
        // 第3次失败: 8秒
        // 第4次失败: 16秒
        // 第5次失败: 32秒
        // 第6次及以后: 50秒（上限）
        const delay = this.BASE_DELAY * Math.pow(2, retryCount - 1);
        return Math.min(delay, this.MAX_DELAY);
    }

    // 调度重连
    private reconnectAttemptCount = 0;
    private scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        const delay = this.calculateBackoffDelay(this.reconnectAttemptCount + 1);
        console.log(`${delay/1000}秒后尝试重连 (第${this.reconnectAttemptCount + 1}次)`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttemptCount++;
            this.connect();
        }, delay);
    }

    // 重置重连计数器（连接成功后调用）
    private resetReconnectCounter() {
        this.reconnectAttemptCount = 0;
    }

    // 检查待处理消息的状态
    private async checkPendingMessages() {
        if (this.pendingMessages.size === 0) return;
        
        console.log(`检查 ${this.pendingMessages.size} 条待处理消息`);
        
        for (const [msgId, pending] of this.pendingMessages) {
            if (pending.status === 'pending' || pending.status === 'processing') {
                // 检查是否到了重试时间
                if (pending.nextRetryTime && Date.now() >= pending.nextRetryTime) {
                    await this.queryMessageStatus(msgId);
                } else if (!pending.nextRetryTime) {
                    await this.queryMessageStatus(msgId);
                }
            }
        }
    }

    // 查询消息状态
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

    // 处理状态响应
    private handleStatusResponse(data: WSMessage) {
        const msgId = data.msgId;
        if (!msgId) return;

        const pending = this.pendingMessages.get(msgId);
        if (!pending) return;

        console.log(`消息 ${msgId} 状态响应: ${data.content}`);

        switch (data.content) {
            case 'not_found':
            case 'failed':
                // 消息未找到或失败，进行重试
                if (pending.retryCount < this.MAX_RETRY_COUNT) {
                    const nextDelay = this.calculateBackoffDelay(pending.retryCount + 1);
                    console.log(`消息 ${msgId} 未处理完成，将在 ${nextDelay/1000}秒后重试 (${pending.retryCount + 1}/${this.MAX_RETRY_COUNT})`);
                    this.scheduleRetry(msgId, nextDelay);
                } else {
                    console.error(`消息 ${msgId} 重试次数已达上限 (${this.MAX_RETRY_COUNT}次)，放弃重试`);
                    this.clearRetryTimer(msgId);
                    this.pendingMessages.delete(msgId);
                    // 通知UI消息发送失败
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
                // 消息还在处理中，继续等待
                console.log(`消息 ${msgId} 仍在处理中...`);
                break;
            case 'completed':
                // 消息已完成
                this.clearRetryTimer(msgId);
                this.pendingMessages.delete(msgId);
                console.log(`消息 ${msgId} 已完成`);
                break;
        }
    }

    // 调度重试（带指数退避）
    private scheduleRetry(msgId: string, delay: number) {
        // 清除该消息的现有定时器
        this.clearRetryTimer(msgId);
        
        const pending = this.pendingMessages.get(msgId);
        if (!pending) return;
        
        // 设置下次重试时间
        pending.nextRetryTime = Date.now() + delay;
        
        // 通知UI更新
        this.onRetryUpdate?.(msgId, pending.retryCount + 1, delay);
        
        // 设置定时器
        const timer = setTimeout(() => {
            this.executeRetry(msgId);
        }, delay);
        
        this.retryTimers.set(msgId, timer);
    }
    
    // 清除重试定时器
    private clearRetryTimer(msgId: string) {
        const timer = this.retryTimers.get(msgId);
        if (timer) {
            clearTimeout(timer);
            this.retryTimers.delete(msgId);
        }
    }
    
    // 清除所有重试定时器
    private clearAllRetryTimers() {
        for (const timer of this.retryTimers.values()) {
            clearTimeout(timer);
        }
        this.retryTimers.clear();
    }

    // 执行重试
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
            
            // 更新状态
            pending.status = 'processing';
        } else {
            console.log(`WebSocket 未连接，等待重连后重试消息 ${msgId}`);
            // 如果未连接，等连接后再调度
            if (this.reconnectAttemptCount === 0) {
                this.connect();
            }
        }
    }

    // 启动状态查询循环
    private startStatusQueryLoop() {
        this.stopStatusQueryLoop();
        
        // 每5秒查询一次待处理消息的状态
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

    // 停止状态查询循环
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
        
        // 记录待处理消息
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
            
            // 更新状态
            const pending = this.pendingMessages.get(msgId);
            if (pending) pending.status = 'processing';
        } else {
            console.warn('WebSocket 未连接，消息已缓存，等待重连后发送');
            // 使用退避策略进行重连
            if (this.reconnectAttemptCount === 0) {
                this.connect();
            }
            // 调度消息重试
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

    // 获取待处理消息数量
    getPendingCount(): number {
        return this.pendingMessages.size;
    }
    
    // 获取消息的重试信息
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