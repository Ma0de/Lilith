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
}

class WebSocketClient {
    private ws: WebSocket | null = null;
    private handlers: ((data: WSMessage) => void)[] = [];
    private isConnecting = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private shouldReconnect = true;
    private pendingMessages: Map<string, PendingMessage> = new Map();
    private statusQueryTimer: NodeJS.Timeout | null = null;
    
    public onOpen: (() => void) | null = null;
    public onClose: (() => void) | null = null;
    public onError: ((error: Event) => void) | null = null;
    public onMessageConfirmed: ((msgId: string) => void) | null = null;

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
                this.reconnectTimer = setTimeout(() => {
                    this.connect();
                }, 3000);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            this.isConnecting = false;
            this.onError?.(error);
        };
    }

    // 检查待处理消息的状态
    private async checkPendingMessages() {
        if (this.pendingMessages.size === 0) return;
        
        console.log(`检查 ${this.pendingMessages.size} 条待处理消息`);
        
        for (const [msgId, pending] of this.pendingMessages) {
            if (pending.status === 'pending' || pending.status === 'processing') {
                await this.queryMessageStatus(msgId);
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
                if (pending.retryCount < 3) {
                    console.log(`消息 ${msgId} 未处理完成，准备重试 (${pending.retryCount + 1}/3)`);
                    this.retryMessage(msgId);
                } else {
                    console.error(`消息 ${msgId} 重试次数已达上限，放弃重试`);
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
                this.pendingMessages.delete(msgId);
                console.log(`消息 ${msgId} 已完成`);
                break;
        }
    }

    // 重试消息
    private retryMessage(msgId: string) {
        const pending = this.pendingMessages.get(msgId);
        if (!pending) return;

        pending.retryCount++;
        pending.status = 'pending';

        if (this.isConnected()) {
            const retryMsg: WSMessage = {
                type: 'retry',
                content: pending.content,
                speaker: 'user',
                timestamp: Date.now(),
                msgId: msgId
            };
            this.ws?.send(JSON.stringify(retryMsg));
            console.log(`重发消息 ${msgId} (${pending.retryCount}/3)`);
        } else {
            console.log(`WebSocket 未连接，等待重连后重试消息 ${msgId}`);
        }
    }

    // 启动状态查询循环
    private startStatusQueryLoop() {
        this.stopStatusQueryLoop();
        
        // 每5秒查询一次待处理消息的状态
        this.statusQueryTimer = setInterval(() => {
            if (this.isConnected() && this.pendingMessages.size > 0) {
                for (const [msgId, pending] of this.pendingMessages) {
                    if (pending.status === 'pending' || pending.status === 'processing') {
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
            // 尝试重新连接
            this.connect();
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
}

let instance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
    if (!instance) {
        instance = new WebSocketClient();
    }
    return instance;
}