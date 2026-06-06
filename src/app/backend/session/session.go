package session

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

type MessageRecord struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

type Conversation struct {
	SessionID    string          `json:"sessionId"`
	Messages     []MessageRecord `json:"messages"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
	MessageCount int             `json:"messageCount"`
}

type SessionStore struct {
	filePath string
	mu       sync.RWMutex
	sessions map[string]*Conversation
}

func NewSessionStore(filePath string) (*SessionStore, error) {
	store := &SessionStore{
		filePath: filePath,
		sessions: make(map[string]*Conversation),
	}
	if err := store.load(); err != nil {
		if os.IsNotExist(err) {
			return store, store.save()
		}
		return nil, err
	}
	return store, nil
}

// InitSession 初始化会话，加载历史记录
func (s *SessionStore) InitSession(sessionID string, maxMessages int) ([]MessageRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	conv, exists := s.sessions[sessionID]
	if !exists {
		conv = &Conversation{
			SessionID:    sessionID,
			Messages:     make([]MessageRecord, 0),
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
			MessageCount: 0,
		}
		s.sessions[sessionID] = conv
		s.save()
		return []MessageRecord{}, nil
	}

	start := 0
	if len(conv.Messages) > maxMessages {
		start = len(conv.Messages) - maxMessages
	}
	result := make([]MessageRecord, len(conv.Messages[start:]))
	copy(result, conv.Messages[start:])
	return result, nil
}

// GetMessages 获取会话的所有消息
func (s *SessionStore) GetMessages(sessionID string) ([]MessageRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	conv, exists := s.sessions[sessionID]
	if !exists {
		return []MessageRecord{}, nil
	}

	messages := make([]MessageRecord, len(conv.Messages))
	copy(messages, conv.Messages)
	return messages, nil
}

// AddMessage 添加消息记录
func (s *SessionStore) AddMessage(sessionID string, role, content string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	conv, exists := s.sessions[sessionID]
	if !exists {
		conv = &Conversation{
			SessionID:    sessionID,
			Messages:     make([]MessageRecord, 0),
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
			MessageCount: 0,
		}
		s.sessions[sessionID] = conv
	}

	conv.Messages = append(conv.Messages, MessageRecord{
		Role:      role,
		Content:   content,
		Timestamp: time.Now().Unix(),
	})
	conv.MessageCount = len(conv.Messages)
	conv.UpdatedAt = time.Now()

	return s.save()
}

// ClearMessages 清空会话消息
func (s *SessionStore) ClearMessages(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if conv, exists := s.sessions[sessionID]; exists {
		conv.Messages = make([]MessageRecord, 0)
		conv.MessageCount = 0
		conv.UpdatedAt = time.Now()
		return s.save()
	}
	return nil
}

// DeleteSession 删除会话
func (s *SessionStore) DeleteSession(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.sessions, sessionID)
	return s.save()
}

func (s *SessionStore) load() error {
	file, err := os.Open(s.filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}
	if info.Size() == 0 {
		s.sessions = make(map[string]*Conversation)
		return nil
	}

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&s.sessions); err != nil {
		s.sessions = make(map[string]*Conversation)
		return nil
	}
	return nil
}

func (s *SessionStore) save() error {
	file, err := os.Create(s.filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(s.sessions)
}

func (s *SessionStore) Close() error {
	return s.save()
}
