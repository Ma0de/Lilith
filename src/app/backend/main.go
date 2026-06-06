package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"lilith-app/agent"
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

	llmBaseURL := os.Getenv("LLM_BASE_URL")
	llmAPIKey := os.Getenv("LLM_API_KEY")
	llmModelName := os.Getenv("LLM_MODEL_NAME")
	ttsBaseURL := os.Getenv("TTS_BASE_URL")

	if llmBaseURL == "" || llmAPIKey == "" || llmModelName == "" || ttsBaseURL == "" {
		log.Fatal("缺少必要的环境变量")
	}

	// 创建 LLM 客户端
	llmClient := llm.NewOpenAIClient(llmBaseURL, llmAPIKey, llmModelName)

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
	server.InitTTSClient(ttsBaseURL)
	server.InitRoutes()

	staticFS, _ := fs.Sub(frontendFS, "web/out")
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	log.Println("Lilith 启动成功: http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
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
