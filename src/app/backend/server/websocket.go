package server

import (
	"encoding/base64"
	"encoding/json"
	"lilith-app/agent"
	"lilith-app/llm"
	"lilith-app/tts"
	"lilith-app/utils"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type MemoryItem = agent.MemoryItem
type MemoryList = agent.MemoryList
type MemoryDelta = agent.MemoryDelta

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var (
	clients   = make(map[string]*ClientConnection)
	clientsMu sync.RWMutex
)

var globalAgent *agent.Agent
var ttsClient *tts.TTSClient
var agentOnce sync.Once

func InitAgent(baseURL, apiKey, modelName string, getMemoryFunc func(string) (*agent.MemoryList, error), setMemoryFunc func(string, *agent.MemoryList) error) {
	agentOnce.Do(func() {
		llmClient := llm.NewOpenAIClient(baseURL, apiKey, modelName)
		globalAgent = agent.NewAgent(llmClient, getMemoryFunc, setMemoryFunc)
		log.Println("Agent初始化完成")
	})
}

func InitTTSClient(ttsBaseURL string) {
	ttsClient = tts.NewTTSClient(ttsBaseURL)
	log.Println("TTS客户端初始化完成")
}

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

	clientsMu.Lock()
	clients[clientID] = client
	clientsMu.Unlock()

	go client.writePump()
	go client.heartbeat()

	log.Printf("客户端已连接: %s", clientID)

	client.readPump()

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
		msgID = utils.GenerateMsgID()
	}

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
		var replyContent string
		var replyExpression string

		if globalAgent != nil {
			var memoryDeltas map[string]*agent.MemoryDelta

			if msg.MemoryDelta != nil {
				memoryDeltas = make(map[string]*agent.MemoryDelta)
				for listName, delta := range msg.MemoryDelta {
					memoryDeltas[listName] = &agent.MemoryDelta{
						ListName: delta.ListName,
						Version:  delta.Version,
						Items:    delta.Items,
					}
				}
			}

			result, err := globalAgent.ProcessMessage(msg.Content, memoryDeltas)

			if err != nil {
				log.Printf("Agent处理错误 [%s]: %v", msgID, err)
				replyContent = "抱歉，我出错了"
				replyExpression = "neutral_slight_upset"
			} else {
				replyContent = result.Reply
				replyExpression = result.Expression

				for listName, list := range result.UpdatedMemory {
					items := make([]string, len(list.Items))
					for i, item := range list.Items {
						if item.IsFuzzy {
							items[i] = "#" + item.Value
						} else {
							items[i] = item.Value
						}
					}
					memoryUpdate := MemoryDeltaUpdate{
						ListName: listName,
						Version:  list.Version,
						Items:    items,
					}
					c.sendMemoryUpdate(memoryUpdate)
				}
			}
		} else {
			replyContent = "莉莉丝收到了: " + msg.Content
			replyExpression = "calm_gentle"
		}

		c.mu.Lock()
		if status, exists := c.pendingStatus[msgID]; exists {
			status.Status = "completed"
		}
		c.mu.Unlock()

		var audioBase64 string
		if ttsClient != nil && replyContent != "" &&
			replyContent != "莉莉丝收到了: "+msg.Content &&
			replyContent != "抱歉，我出错了" {
			audioData, err := ttsClient.Synthesize(replyContent, replyExpression)
			if err != nil {
				log.Printf("TTS生成失败 [%s]: %v", msgID, err)
			} else {
				audioBase64 = base64.StdEncoding.EncodeToString(audioData)
				log.Printf("TTS生成成功 [%s], 音频大小: %d bytes", msgID, len(audioData))
			}
		}

		reply := WSMessage{
			Type:        "chat",
			Speaker:     "lilith",
			Content:     replyContent,
			Timestamp:   time.Now().Unix(),
			MsgID:       msgID,
			Expression:  replyExpression,
			Audio:       audioBase64,
			AudioFormat: "wav",
		}

		replyData, _ := json.Marshal(reply)
		select {
		case c.send <- replyData:
			log.Printf("回复已发送 [%s], 包含音频: %v", msgID, audioBase64 != "")
		case <-time.After(10 * time.Second):
			log.Printf("发送超时 [%s]", msgID)
		}
	}()
}

func (c *ClientConnection) sendMemoryUpdate(update MemoryDeltaUpdate) {
	msg := WSMessage{
		Type:      "memory_update",
		Speaker:   "system",
		Content:   "",
		Timestamp: time.Now().Unix(),
	}
	data, _ := json.Marshal(update)
	msg.Content = string(data)

	msgData, _ := json.Marshal(msg)
	select {
	case c.send <- msgData:
		log.Printf("发送记忆更新: %s", update.ListName)
	case <-time.After(5 * time.Second):
		log.Printf("记忆更新发送超时")
	}
}

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

func (c *ClientConnection) handleRetry(msg WSMessage) {
	c.handleChatMessage(msg)
}

func (c *ClientConnection) cleanup() {
	clientsMu.Lock()
	delete(clients, c.clientID)
	clientsMu.Unlock()
	close(c.send)
	log.Printf("客户端已断开: %s", c.clientID)
}
