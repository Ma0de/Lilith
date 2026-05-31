// src/lib/websocket.ts

export interface WSMessage {
    type: string;
    content: string;
    speaker: string;
    timestamp: number;
}

class WebSocketClient {
    private ws: WebSocket | null = null;
    private handlers: ((data: WSMessage) => void)[] = [];
    private isConnecting = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private shouldReconnect = true;
    
    public onOpen: (() => void) | null = null;
    public onClose: (() => void) | null = null;
    public onError: ((error: Event) => void) | null = null;

    connect() {
        // 清除重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // 如果已经连接，直接返回
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('WebSocket 已连接，跳过');
            return;
        }
        
        // 如果正在连接，等待
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
        };

        this.ws.onmessage = (e) => {
            console.log('原始消息:', e.data);
            try {
                const data = JSON.parse(e.data) as WSMessage;
                this.handlers.forEach(fn => fn(data));
            } catch (err) {
                console.error('解析失败', err);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket 已断开 (code: ${event.code}, reason: ${event.reason})`);
            this.isConnecting = false;
            this.onClose?.();
            
            // 自动重连
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

    onMessage(handler: (data: WSMessage) => void) {
        this.handlers.push(handler);
        // 返回清理函数
        return () => {
            this.handlers = this.handlers.filter(h => h !== handler);
        };
    }

    send(type: string, content: string, speaker: string = 'user') {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const message: WSMessage = { 
                type, 
                content, 
                speaker, 
                timestamp: Date.now() 
            };
            this.ws.send(JSON.stringify(message));
            console.log('发送消息:', message);
        } else {
            console.warn('WebSocket 未连接，状态:', this.ws?.readyState);
            // 尝试重新连接
            this.connect();
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    disconnect() {
        console.log('主动断开 WebSocket');
        this.shouldReconnect = false;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close(1000, '正常关闭');
            this.ws = null;
        }
    }
}

let instance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
    if (!instance) {
        instance = new WebSocketClient();
    }
    return instance;
}