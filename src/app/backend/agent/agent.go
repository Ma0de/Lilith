package agent

import (
	"fmt"
	"lilith-app/agent/parser"
	"lilith-app/llm"
	"lilith-app/session"
	"log"
)

type Agent struct {
	llmClient     llm.LLMClient
	memoryManager *MemoryManager
	promptBuilder *PromptBuilder
	messages      []llm.Message
	sessionStore  *session.SessionStore
	sessionID     string
}

type MemoryStorageAdapter struct {
	store *MemoryStoreAdapter
}

type MemoryStoreAdapter struct {
	getFunc func(string) (*MemoryList, error)
	setFunc func(string, *MemoryList) error
}

func (a *MemoryStoreAdapter) Get(listName string) (*MemoryList, error) {
	return a.getFunc(listName)
}

func (a *MemoryStoreAdapter) Set(listName string, list *MemoryList) error {
	return a.setFunc(listName, list)
}

func NewAgent(llmClient llm.LLMClient, getMemoryFunc func(string) (*MemoryList, error), setMemoryFunc func(string, *MemoryList) error) *Agent {
	adapter := &MemoryStoreAdapter{
		getFunc: getMemoryFunc,
		setFunc: setMemoryFunc,
	}
	return &Agent{
		llmClient:     llmClient,
		memoryManager: NewMemoryManager(adapter),
		promptBuilder: NewPromptBuilder(),
		messages:      make([]llm.Message, 0),
		sessionStore:  nil,
		sessionID:     "",
	}
}

// SetSessionStore 设置会话存储
func (a *Agent) SetSessionStore(store *session.SessionStore, sessionID string) {
	a.sessionStore = store
	a.sessionID = sessionID
}

// AddUserMessage 添加用户消息到对话历史（用于加载历史记录）
func (a *Agent) AddUserMessage(content string) {
	a.messages = append(a.messages, llm.Message{
		Role:    "user",
		Content: content,
	})
}

// AddAssistantMessage 添加助手消息到对话历史（用于加载历史记录）
func (a *Agent) AddAssistantMessage(content string) {
	a.messages = append(a.messages, llm.Message{
		Role:    "assistant",
		Content: content,
	})
}

// LoadSessionHistory 从会话存储加载历史消息到 LLM 上下文
func (a *Agent) LoadSessionHistory(sessionID string, maxMessages int) error {
	if a.sessionStore == nil {
		return nil
	}

	messages, err := a.sessionStore.GetMessages(sessionID)
	if err != nil {
		return err
	}

	// 清空当前消息，只保留 system prompt
	newMessages := make([]llm.Message, 0)
	for _, msg := range a.messages {
		if msg.Role == "system" {
			newMessages = append(newMessages, msg)
			break
		}
	}

	// 加载历史消息，只取最近的 maxMessages 条
	start := 0
	if len(messages) > maxMessages {
		start = len(messages) - maxMessages
	}
	for i := start; i < len(messages); i++ {
		newMessages = append(newMessages, llm.Message{
			Role:    messages[i].Role,
			Content: messages[i].Content,
		})
	}

	a.messages = newMessages
	log.Printf("[Agent] 加载会话历史: session=%s, 消息数=%d", sessionID, len(newMessages)-1)
	return nil
}

type ProcessResult struct {
	Reply         string
	UpdatedMemory map[string]*MemoryList
	ShouldConfuse bool
	Expression    string
}

func (a *Agent) ProcessMessage(userMessage string, memoryDeltas map[string]*MemoryDelta) (*ProcessResult, error) {
	result := &ProcessResult{
		UpdatedMemory: make(map[string]*MemoryList),
	}

	for listName, delta := range memoryDeltas {
		if delta == nil {
			continue
		}
		currentList, err := a.memoryManager.GetList(listName)
		if err != nil {
			return nil, err
		}
		if currentList != nil && currentList.Version != delta.Version {
			return nil, fmt.Errorf("version mismatch for %s", listName)
		}
	}

	memoryContext := a.promptBuilder.BuildMemoryContext(memoryDeltas)
	expressionList := BuildExpressionList()

	if len(a.messages) == 0 {
		systemPrompt := a.promptBuilder.BuildSystemPrompt(memoryContext, expressionList)
		a.messages = append(a.messages, llm.Message{
			Role:    "system",
			Content: systemPrompt,
		})
	}

	a.messages = append(a.messages, llm.Message{
		Role:    "user",
		Content: a.promptBuilder.BuildUserMessage(userMessage),
	})

	llmResponse, err := a.llmClient.Chat(a.messages)
	if err != nil {
		return nil, err
	}

	// 保存到会话存储
	if a.sessionStore != nil {
		if err := a.sessionStore.AddMessage(a.sessionID, "user", userMessage); err != nil {
			log.Printf("[Agent] 保存用户消息失败: %v", err)
		}
		if err := a.sessionStore.AddMessage(a.sessionID, "assistant", llmResponse); err != nil {
			log.Printf("[Agent] 保存助手回复失败: %v", err)
		}
	}

	parsed := parser.ParseTagOutput(llmResponse)
	result.Reply = parsed.EchoContent
	result.Expression = parsed.Expression

	a.messages = append(a.messages, llm.Message{
		Role:    "assistant",
		Content: llmResponse,
	})

	for _, cmd := range parsed.Commands {
		var updatedList *MemoryList
		var err error

		switch cmd.Operation {
		case "add":
			updatedList, err = a.memoryManager.AddItem(cmd.List, cmd.Item, cmd.Version)
		case "rep":
			updatedList, err = a.memoryManager.ReplaceItem(cmd.List, cmd.OldItem, cmd.Item, cmd.Version)
		case "del":
			updatedList, err = a.memoryManager.DeleteItem(cmd.List, cmd.Item, cmd.Version)
		case "rst":
			keep := cmd.Keep
			if keep == 0 {
				keep = ResetKeepCount
			}
			updatedList, err = a.memoryManager.ResetList(cmd.List, keep, cmd.Version)
		}

		if err != nil {
			return nil, err
		}
		if updatedList != nil {
			result.UpdatedMemory[cmd.List] = updatedList
		}
	}

	for listName := range memoryDeltas {
		if a.memoryManager.ShouldConfuse(listName) {
			result.ShouldConfuse = true
			updatedList, err := a.memoryManager.ResetList(listName, ResetKeepCount, memoryDeltas[listName].Version)
			if err == nil && updatedList != nil {
				result.UpdatedMemory[listName] = updatedList
			}
			break
		}
	}

	return result, nil
}

func (a *Agent) GetMemoryDelta(listName string) (*MemoryDelta, error) {
	return a.memoryManager.GetMemoryDelta(listName)
}

func (a *Agent) ClearConversation() {
	// 清空对话历史，但保留 system prompt
	newMessages := make([]llm.Message, 0)
	for _, msg := range a.messages {
		if msg.Role == "system" {
			newMessages = append(newMessages, msg)
			break
		}
	}
	a.messages = newMessages

	// 如果启用了会话存储，也清空存储中的消息
	if a.sessionStore != nil {
		a.sessionStore.ClearMessages(a.sessionID)
	}
}

func (a *Agent) LoadFromSessionStore(store *session.SessionStore, sessionID string, maxMessages int) error {
	a.sessionStore = store
	a.sessionID = sessionID

	messages, err := store.GetMessages(sessionID)
	if err != nil {
		return err
	}

	// 直接加载到 messages 中（跳过 system prompt，因为还没有）
	for i := len(messages) - maxMessages; i < len(messages); i++ {
		if i < 0 {
			continue
		}
		a.messages = append(a.messages, llm.Message{
			Role:    messages[i].Role,
			Content: messages[i].Content,
		})
	}
	return nil
}
