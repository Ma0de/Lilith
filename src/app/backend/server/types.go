package server

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WSMessage struct {
	Type        string                       `json:"type"`
	Content     string                       `json:"content"`
	Speaker     string                       `json:"speaker"`
	Timestamp   int64                        `json:"timestamp"`
	MsgID       string                       `json:"msgId,omitempty"`
	Expression  string                       `json:"expression,omitempty"`
	Audio       string                       `json:"audio,omitempty"`
	AudioFormat string                       `json:"audioFormat,omitempty"`
	MemoryDelta map[string]*MemoryDeltaInput `json:"memoryDelta,omitempty"`
}

type MemoryDeltaInput struct {
	ListName string   `json:"listName"`
	Version  string   `json:"version"`
	Items    []string `json:"items"`
}

type MessageStatus struct {
	MsgID     string
	Status    string
	Content   string
	CreatedAt time.Time
}

type ClientConnection struct {
	conn          *websocket.Conn
	send          chan []byte
	clientID      string
	pendingStatus map[string]*MessageStatus
	mu            sync.RWMutex
}

type MemoryDeltaUpdate struct {
	ListName string   `json:"listName"`
	Version  string   `json:"version"`
	Items    []string `json:"items"`
}
