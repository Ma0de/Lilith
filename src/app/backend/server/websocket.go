package server

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSMessage struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	Speaker   string `json:"speaker"`
	Timestamp int64  `json:"timestamp"`
	MsgID     string `json:"msgId,omitempty"` // 消息唯一标识
}

type MessageStatus struct {
	MsgID     string
	Status    string // "pending", "processing", "completed", "failed"
	Content   string
	CreatedAt time.Time
}

// 客户端连接管理器
type ClientConnection struct {
	conn          *websocket.Conn
	send          chan []byte
	clientID      string
	pendingStatus map[string]*MessageStatus // 消息状态追踪
	mu            sync.RWMutex
}

var (
	clients   = make(map[string]*ClientConnection)
	clientsMu sync.RWMutex
)

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("升级失败: %v", err)
		return
	}

	clientID := r.RemoteAddr
	client := &ClientConnection{
		conn:          conn,
		send:          make(chan []byte, 256),
		clientID:      clientID,
		pendingStatus: make(map[string]*MessageStatus),
	}

	// 注册客户端
	clientsMu.Lock()
	clients[clientID] = client
	clientsMu.Unlock()

	// 启动发送协程
	go client.writePump()

	// 启动心跳检测
	go client.heartbeat()

	log.Printf("客户端已连接: %s", clientID)

	// 读取消息循环
	client.readPump()

	// 清理
	client.cleanup()
}

func (c *ClientConnection) readPump() {
	defer func() {
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Printf("读取错误: %v", err)
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("解析失败: %v", err)
			continue
		}

		log.Printf("收到消息: type=%s, speaker=%s, content=%s, msgId=%s",
			msg.Type, msg.Speaker, msg.Content, msg.MsgID)

		switch msg.Type {
		case "chat":
			go c.handleChatMessage(msg)
		case "status_query":
			go c.handleStatusQuery(msg)
		case "retry":
			go c.handleRetry(msg)
		}
	}
}

func (c *ClientConnection) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("发送失败: %v", err)
				return
			}
		case <-ticker.C:
			// 发送心跳
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *ClientConnection) heartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.RLock()
		// 清理超过5分钟的消息状态
		for id, status := range c.pendingStatus {
			if time.Since(status.CreatedAt) > 5*time.Minute {
				delete(c.pendingStatus, id)
			}
		}
		c.mu.RUnlock()
	}
}

func (c *ClientConnection) handleChatMessage(msg WSMessage) {
	msgID := msg.MsgID
	if msgID == "" {
		msgID = generateMsgID()
	}

	// 记录消息状态
	c.mu.Lock()
	c.pendingStatus[msgID] = &MessageStatus{
		MsgID:     msgID,
		Status:    "processing",
		Content:   msg.Content,
		CreatedAt: time.Now(),
	}
	c.mu.Unlock()

	log.Printf("处理消息 [%s]: %s", msgID, msg.Content)

	go func() {

		// 模拟处理结果
		reply := WSMessage{
			Type:      "chat",
			Speaker:   "lilith",
			Content:   "莉莉丝收到了: " + msg.Content,
			Timestamp: time.Now().Unix(),
			MsgID:     msgID,
		}

		// 更新状态为完成
		c.mu.Lock()
		if status, exists := c.pendingStatus[msgID]; exists {
			status.Status = "completed"
		}
		c.mu.Unlock()

		replyData, _ := json.Marshal(reply)
		select {
		case c.send <- replyData:
			log.Printf("回复消息 [%s]: %s", msgID, reply.Content)
		case <-time.After(5 * time.Second):
			log.Printf("发送超时 [%s]", msgID)
		}
	}()
}

// 处理状态查询
func (c *ClientConnection) handleStatusQuery(msg WSMessage) {
	c.mu.RLock()
	status, exists := c.pendingStatus[msg.MsgID]
	c.mu.RUnlock()

	var response WSMessage
	if !exists {
		response = WSMessage{
			Type:    "status_response",
			Speaker: "system",
			Content: "not_found",
			MsgID:   msg.MsgID,
		}
	} else {
		response = WSMessage{
			Type:    "status_response",
			Speaker: "system",
			Content: status.Status,
			MsgID:   msg.MsgID,
		}
	}

	respData, _ := json.Marshal(response)
	select {
	case c.send <- respData:
		log.Printf("状态回复 [%s]: %s", msg.MsgID, response.Content)
	case <-time.After(5 * time.Second):
		log.Printf("状态回复超时 [%s]", msg.MsgID)
	}
}

// 处理重试
func (c *ClientConnection) handleRetry(msg WSMessage) {
	// 重新处理消息
	c.handleChatMessage(msg)
}

func (c *ClientConnection) cleanup() {
	clientsMu.Lock()
	delete(clients, c.clientID)
	clientsMu.Unlock()
	close(c.send)
	log.Printf("客户端已断开: %s", c.clientID)
}

func generateMsgID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}
