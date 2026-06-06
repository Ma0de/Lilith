// main.go
package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"lilith-app/agent"
	"lilith-app/config"
	"lilith-app/llm"
	"lilith-app/server"
	"lilith-app/session"
	"lilith-app/storage"

	"github.com/joho/godotenv"
)

//go:embed web/out/*
var frontendFS embed.FS

var globalStore *storage.MemoryStore

func main() {
	_ = godotenv.Load()

	server.InitSettingsManager()

	// 加载配置
	cfg := config.Load()

	// 初始化会话存储
	sessionStore, err := session.NewSessionStore("./lilith_session.json")
	if err != nil {
		log.Printf("会话存储初始化失败: %v", err)
	}
	defer func() {
		if sessionStore != nil {
			sessionStore.Close()
		}
	}()

	if err = initStorage(); err != nil {
		log.Fatalf("存储初始化失败: %v", err)
	}
	defer closeStorage()

	// 从配置系统获取 LLM 和 TTS 配置
	llmBaseURL := cfg.LLM.BaseURL
	llmAPIKey := cfg.LLM.APIKey
	llmModelName := cfg.LLM.ModelName
	ttsBaseURL := cfg.TTS.BaseURL

	// 如果配置为空，尝试从环境变量读取（兼容旧方式）
	if llmBaseURL == "" {
		llmBaseURL = os.Getenv("LLM_BASE_URL")
	}
	if llmAPIKey == "" {
		llmAPIKey = os.Getenv("LLM_API_KEY")
	}
	if llmModelName == "" {
		llmModelName = os.Getenv("LLM_MODEL_NAME")
	}
	if ttsBaseURL == "" {
		ttsBaseURL = os.Getenv("TTS_BASE_URL")
	}

	// 检查必要配置
	if llmBaseURL == "" {
		log.Println("警告: LLM_BASE_URL 未配置")
	}
	if llmAPIKey == "" {
		log.Println("警告: LLM_API_KEY 未配置")
	}
	if llmModelName == "" {
		log.Println("警告: LLM_MODEL_NAME 未配置，使用默认值")
		llmModelName = "gpt-3.5-turbo"
	}
	if ttsBaseURL == "" {
		log.Println("警告: TTS_BASE_URL 未配置，TTS 功能将不可用")
	}

	// 创建 LLM 客户端（即使配置不完整也创建，但会在使用时报错）
	var llmClient llm.LLMClient
	if llmBaseURL != "" && llmAPIKey != "" {
		llmClient = llm.NewOpenAIClient(llmBaseURL, llmAPIKey, llmModelName)
	} else {
		log.Println("警告: LLM 配置不完整，Agent 将无法正常工作")
		// 创建一个占位客户端，返回错误信息
		llmClient = &placeholderLLMClient{}
	}

	// 创建 Agent
	ag := agent.NewAgent(llmClient, storageGetMemory, storageSetMemory)

	// 加载历史会话到 Agent 的 messages 中
	if sessionStore != nil {
		sessionID := server.GetSettingsManager().GetSessionID()
		if err := ag.LoadFromSessionStore(sessionStore, sessionID, 50); err != nil {
			log.Printf("加载历史会话失败: %v", err)
		}
	}

	// 替换 server 包的 InitAgent，改为直接设置 globalAgent
	server.SetAgent(ag)
	if ttsBaseURL != "" {
		server.InitTTSClient(ttsBaseURL)
	} else {
		log.Println("警告: TTS 客户端未初始化，语音功能不可用")
	}
	server.InitRoutes()

	staticFS, _ := fs.Sub(frontendFS, "web/out")
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	// 获取服务器端口配置
	port := cfg.Server.Port
	if port == "" {
		port = "8080"
	}
	log.Printf("Lilith 启动成功: http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

type placeholderLLMClient struct{}

func (c *placeholderLLMClient) Chat(messages []llm.Message) (string, bool, error) {
	return "请在设置中配置 API 密钥后再聊天", false, nil
}

func initStorage() error {
	var err error
	globalStore, err = storage.NewMemoryStore("./lilith_memory.json")
	return err
}

func closeStorage() {
	if globalStore != nil {
		globalStore.Close()
	}
}

func storageGetMemory(listName string) (*server.MemoryList, error) {
	if globalStore == nil {
		return nil, nil
	}
	storageList, err := globalStore.Get(listName)
	if err != nil || storageList == nil {
		return nil, err
	}
	items := make([]server.MemoryItem, len(storageList.Items))
	for i, item := range storageList.Items {
		items[i] = server.MemoryItem{Value: item.Value, IsFuzzy: item.IsFuzzy}
	}
	return &server.MemoryList{
		Version:    storageList.Version,
		Items:      items,
		UpdateTime: storageList.UpdateAt,
	}, nil
}

func storageSetMemory(listName string, list *server.MemoryList) error {
	if globalStore == nil {
		return nil
	}
	items := make([]storage.MemoryItem, len(list.Items))
	for i, item := range list.Items {
		items[i] = storage.MemoryItem{Value: item.Value, IsFuzzy: item.IsFuzzy}
	}
	return globalStore.Set(listName, &storage.MemoryList{
		Version:  list.Version,
		Items:    items,
		UpdateAt: list.UpdateTime,
	})
}
