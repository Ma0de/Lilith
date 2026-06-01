package agent

import (
	"fmt"
	"lilith-app/llm"
)

type Agent struct {
	llmClient     llm.LLMClient
	memoryManager *MemoryManager
	promptBuilder *PromptBuilder
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
	}
}

type ProcessResult struct {
	Reply         string
	UpdatedMemory map[string]*MemoryList
	ShouldConfuse bool
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

	messages := []llm.Message{
		{Role: "system", Content: a.promptBuilder.BuildSystemPrompt(memoryContext)},
		{Role: "user", Content: a.promptBuilder.BuildUserMessage(userMessage)},
	}

	llmResponse, err := a.llmClient.Chat(messages)
	if err != nil {
		return nil, err
	}

	parsed := ParseOutput(llmResponse)
	result.Reply = parsed.EchoContent

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
