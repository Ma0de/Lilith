package server

import (
	"encoding/json"
	"log"
	"net/http"

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
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("升级失败: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("客户端已连接: %s", r.RemoteAddr)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("读取错误: %v", err)
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("解析失败: %v", err)
			continue
		}

		log.Printf("收到消息: type=%s, speaker=%s, content=%s", msg.Type, msg.Speaker, msg.Content)

		// 处理聊天消息
		if msg.Type == "chat" {
			// 构造回复消息
			reply := WSMessage{
				Type:      "chat",
				Speaker:   "lilith",
				Content:   "莉莉丝收到了: " + msg.Content,
				Timestamp: 0,
			}

			replyData, _ := json.Marshal(reply)
			if err := conn.WriteMessage(websocket.TextMessage, replyData); err != nil {
				log.Printf("发送失败: %v", err)
				break
			}
			log.Printf("回复消息: %s", reply.Content)
		}
	}
}
